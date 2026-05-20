import { getDb, getTemplatesByUserId, createTemplate, createEmailSend, upsertMetrics } from "./db";

const MOCK_TEMPLATES = [
  {
    name: "Cold Outreach - Tech Founders",
    subjectLine: "Quick idea for [Company]",
    body: "Hi [Name],\n\nI came across [Company] and thought your product could benefit from [specific feature].\n\nWould you be open to a quick 15-min call?\n\nBest,\n[Your Name]",
    category: "Cold Outreach",
  },
  {
    name: "Follow-up After Meeting",
    subjectLine: "Great meeting today - next steps",
    body: "Hi [Name],\n\nThanks for taking the time to chat today. I really enjoyed learning about [topic].\n\nAs discussed, I'll send over [deliverable] by [date].\n\nLooking forward to working together!\n\nBest,\n[Your Name]",
    category: "Follow-up",
  },
  {
    name: "Product Demo Request",
    subjectLine: "[Company] - product demo?",
    body: "Hi [Name],\n\nI noticed [Company] is using [competitor]. We recently helped [similar company] reduce costs by 40%.\n\nWould you be interested in seeing how?\n\nBest,\n[Your Name]",
    category: "Demo Request",
  },
  {
    name: "Reconnection Email",
    subjectLine: "Reconnecting after 6 months",
    body: "Hi [Name],\n\nIt's been a while! I wanted to reach out and see how things are going at [Company].\n\nWe've made some exciting updates that might be relevant to your team.\n\nLet's catch up soon!\n\nBest,\n[Your Name]",
    category: "Reconnection",
  },
  {
    name: "Value Prop - Time Savings",
    subjectLine: "Save your team 10 hours/week",
    body: "Hi [Name],\n\nMost teams like yours spend 10+ hours/week on [task]. We help cut that in half.\n\nWant to see a quick demo?\n\nBest,\n[Your Name]",
    category: "Value Prop",
  },
];

function generateMockSends(templateId: number, count: number) {
  const sends = [];
  const now = new Date();
  const openRate = Math.random() * 0.5 + 0.2; // 20-70% open rate
  const replyRate = Math.random() * 0.3 + 0.05; // 5-35% reply rate
  const meetingRate = Math.random() * 0.2; // 0-20% meeting rate

  for (let i = 0; i < count; i++) {
    const sentAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const hasOpen = Math.random() < openRate;
    const hasReply = hasOpen && Math.random() < replyRate;
    const hasMeeting = hasReply && Math.random() < meetingRate;

    sends.push({
      templateId,
      sentAt,
      openedAt: hasOpen ? new Date(sentAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null,
      firstReplyAt: hasReply ? new Date(sentAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) : null,
      meetingScheduled: hasMeeting,
    });
  }

  return sends;
}

export async function seedUserTemplates(userId: number) {
  try {
    const db = await getDb();
    if (!db) {
      console.log("[Seed] Database not available");
      return;
    }

    // Check if user already has templates
    const existingTemplates = await getTemplatesByUserId(userId);
    if (existingTemplates.length > 0) {
      console.log(`[Seed] User ${userId} already has ${existingTemplates.length} templates, skipping seed`);
      return;
    }

    console.log(`[Seed] Creating initial templates for user ${userId}...`);

    // Create templates
    for (const template of MOCK_TEMPLATES) {
      await createTemplate({
        userId,
        name: template.name,
        subjectLine: template.subjectLine,
        body: template.body,
        category: template.category,
        tags: [],
      });
    }

    // Get the created templates to get their IDs
    const templates = await getTemplatesByUserId(userId);

    // Create email sends and metrics for each template
    for (const template of templates) {
      const sendCount = Math.floor(Math.random() * 30) + 10; // 10-40 sends per template
      const sends = generateMockSends(template.id, sendCount);

      // Create email sends
      for (const send of sends) {
        await createEmailSend({
          userId,
          templateId: send.templateId,
          recipientEmail: `prospect${Math.random().toString(36).substring(7)}@example.com`,
          recipientCompany: `Company ${Math.floor(Math.random() * 1000)}`,
          recipientTitle: ["CEO", "Founder", "CTO", "VP Sales", "Manager"][Math.floor(Math.random() * 5)],
          sentAt: send.sentAt,
          openedAt: send.openedAt,
          firstReplyAt: send.firstReplyAt,
          meetingScheduled: send.meetingScheduled,
        });
      }

      // Calculate and store metrics
      const opens = sends.filter(s => s.openedAt).length;
      const replies = sends.filter(s => s.firstReplyAt).length;
      const meetings = sends.filter(s => s.meetingScheduled).length;

      await upsertMetrics({
        templateId: template.id,
        totalSends: sends.length,
        opens,
        replies,
        meetingsBooked: meetings,
      });
    }

    console.log(`[Seed] Successfully seeded ${templates.length} templates for user ${userId}`);
  } catch (error) {
    console.error("[Seed] Error seeding templates:", error);
  }
}
