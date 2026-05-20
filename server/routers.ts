import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createTemplate,
  getTemplatesByUserId,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  createEmailSend,
  getEmailSendsByTemplateId,
  getMetricsByTemplateId,
  upsertMetrics,
  createAISuggestion,
  getAISuggestionsByTemplateId,
  deleteAISuggestionsByTemplateId,
  getDashboardMetrics,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { seedUserTemplates } from "./seed-init";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      // Seed templates on first login
      await seedUserTemplates(ctx.user.id).catch(err => console.error("Seed error:", err));
      return ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Template management routes
  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const templates = await getTemplatesByUserId(ctx.user.id);
      return templates;
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Template name is required"),
          subjectLine: z.string().min(1, "Subject line is required"),
          body: z.string().min(1, "Body is required"),
          category: z.string().optional().default("General"),
          tags: z.array(z.string()).optional().default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const template = await createTemplate({
          userId: ctx.user.id,
          name: input.name,
          subjectLine: input.subjectLine,
          body: input.body,
          category: input.category,
          tags: input.tags,
        });
        return template;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }
        return template;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          subjectLine: z.string().optional(),
          body: z.string().optional(),
          category: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const template = await getTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.subjectLine !== undefined) updateData.subjectLine = input.subjectLine;
        if (input.body !== undefined) updateData.body = input.body;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.tags !== undefined) updateData.tags = input.tags;

        await updateTemplate(input.id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getTemplateById(input.id);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        await deleteTemplate(input.id);
        return { success: true };
      }),
  }),

  // Metrics routes
  metrics: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardMetrics(ctx.user.id);
    }),

    getByTemplate: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getTemplateById(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        const metrics = await getMetricsByTemplateId(input.templateId);
        return metrics;
      }),

    // Simulate email send and update metrics
    simulateSend: protectedProcedure
      .input(
        z.object({
          templateId: z.number(),
          recipientEmail: z.string().email(),
          recipientCompany: z.string().optional(),
          recipientTitle: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const template = await getTemplateById(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        const now = new Date();
        await createEmailSend({
          userId: ctx.user.id,
          templateId: input.templateId,
          recipientEmail: input.recipientEmail,
          recipientCompany: input.recipientCompany,
          recipientTitle: input.recipientTitle,
          sentAt: now,
        });

        // Recalculate metrics
        const sends = await getEmailSendsByTemplateId(input.templateId);
        const opens = sends.filter(s => s.openedAt).length;
        const replies = sends.filter(s => s.firstReplyAt).length;
        const meetings = sends.filter(s => s.meetingScheduled).length;

        await upsertMetrics({
          templateId: input.templateId,
          totalSends: sends.length,
          opens,
          replies,
          meetingsBooked: meetings,
        });

        return { success: true };
      }),
  }),

  // AI Suggestions routes
  ai: router({
    generateSuggestions: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getTemplateById(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        const metrics = await getMetricsByTemplateId(input.templateId);

        // Delete existing suggestions
        await deleteAISuggestionsByTemplateId(input.templateId);

        const totalSends = metrics?.totalSends || 0;
        const opens = metrics?.opens || 0;
        const replies = metrics?.replies || 0;
        const openRate = totalSends > 0 ? ((opens / totalSends) * 100).toFixed(1) : "0";
        const replyRate = totalSends > 0 ? ((replies / totalSends) * 100).toFixed(1) : "0";

        const prompt = `You are an expert sales copywriter analyzing email templates for conversion optimization.

Current template:
Subject: ${template.subjectLine}
Body: ${template.body}

Current performance:
- Total sends: ${totalSends}
- Opens: ${opens}
- Replies: ${replies}
- Open rate: ${openRate}%
- Reply rate: ${replyRate}%

Provide exactly 3 specific, actionable suggestions in this exact order:
1. Subject line optimization
2. Opening hook / opening line improvement
3. Call-to-action clarity

For each suggestion, provide:
- area: one of "subject_line", "opening_hook", or "cta"
- current: the current text being improved
- suggested: the improved text
- reasoning: why this change will improve reply rate

Format your response as a valid JSON object with a "suggestions" array containing exactly 3 objects.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        let suggestions = [];
        try {
          const content = response.choices[0].message.content;
          if (typeof content === "string") {
            // Extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              suggestions = parsed.suggestions || [];
            }
          }
        } catch (error) {
          console.error("Failed to parse AI response:", error);
          // Return default suggestions if parsing fails
          suggestions = [
            {
              area: "subject_line",
              current: template.subjectLine,
              suggested: `[Improved] ${template.subjectLine}`,
              reasoning: "Consider adding urgency or personalization to increase open rates",
            },
            {
              area: "opening_hook",
              current: template.body.substring(0, 100),
              suggested: "Start with a compelling hook that addresses the recipient's pain point",
              reasoning: "Strong opening hooks increase engagement and reply rates",
            },
            {
              area: "cta",
              current: "Check if CTA exists in body",
              suggested: "Add a clear, single call-to-action with specific next steps",
              reasoning: "Clear CTAs improve conversion and meeting booking rates",
            },
          ];
        }

        // Ensure exactly 3 suggestions with correct areas
        const areas: Array<"subject_line" | "opening_hook" | "cta"> = ["subject_line", "opening_hook", "cta"];
        const finalSuggestions = areas.map((area) => {
          const existing = suggestions.find((s: any) => s.area === area);
          return {
            area,
            current: existing?.current || "",
            suggested: existing?.suggested || "",
            reasoning: existing?.reasoning || "",
          };
        });

        // Store suggestions in database
        for (const suggestion of finalSuggestions) {
          await createAISuggestion({
            templateId: input.templateId,
            suggestionText: suggestion.reasoning,
            suggestedChange: suggestion.suggested,
            area: suggestion.area as "subject_line" | "opening_hook" | "cta",
            confidenceScore: "0.85" as any,
          });
        }

        return finalSuggestions;
      }),

    getSuggestions: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getTemplateById(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new Error("Template not found or access denied");
        }

        const suggestions = await getAISuggestionsByTemplateId(input.templateId);
        return suggestions;
      }),
  }),
});

export type AppRouter = typeof appRouter;
