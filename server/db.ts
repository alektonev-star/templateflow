import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, templates, emailSends, templateMetrics, aiSuggestions, InsertTemplate, InsertEmailSend, InsertTemplateMetric, InsertAISuggestion } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Template queries
export async function createTemplate(data: InsertTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(templates).values(data);
  return result;
}

export async function getTemplatesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(templates).where(eq(templates.userId, userId)).orderBy(desc(templates.createdAt));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateTemplate(id: number, data: Partial<InsertTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(templates).set({ ...data, updatedAt: new Date() }).where(eq(templates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(templates).where(eq(templates.id, id));
}

// Email Send queries
export async function createEmailSend(data: InsertEmailSend) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(emailSends).values(data);
}

export async function getEmailSendsByTemplateId(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(emailSends).where(eq(emailSends.templateId, templateId)).orderBy(desc(emailSends.sentAt));
}

export async function getEmailSendsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(emailSends).where(eq(emailSends.userId, userId)).orderBy(desc(emailSends.sentAt));
}

// Template Metrics queries
export async function getMetricsByTemplateId(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(templateMetrics).where(eq(templateMetrics.templateId, templateId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertMetrics(data: InsertTemplateMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(templateMetrics).values(data).onDuplicateKeyUpdate({
    set: {
      totalSends: data.totalSends,
      opens: data.opens,
      replies: data.replies,
      meetingsBooked: data.meetingsBooked,
      avgDaysToReply: data.avgDaysToReply,
      dealValueTotal: data.dealValueTotal,
      updatedAt: new Date(),
    },
  });
}

// AI Suggestions queries
export async function createAISuggestion(data: InsertAISuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(aiSuggestions).values(data);
}

export async function getAISuggestionsByTemplateId(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(aiSuggestions).where(eq(aiSuggestions.templateId, templateId)).orderBy(aiSuggestions.createdAt);
}

export async function deleteAISuggestionsByTemplateId(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(aiSuggestions).where(eq(aiSuggestions.templateId, templateId));
}

// Aggregate queries for dashboard
export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const userTemplates = await db.select().from(templates).where(eq(templates.userId, userId));
  const templateIds = userTemplates.map(t => t.id);
  
  if (templateIds.length === 0) {
    return {
      totalTemplates: 0,
      totalSends: 0,
      avgOpenRate: 0,
      avgReplyRate: 0,
      totalMeetingsBooked: 0,
    };
  }
  
  const metrics = await db.select().from(templateMetrics).where(
    sql`${templateMetrics.templateId} IN (${sql.join(templateIds)})`
  );
  
  const totalSends = metrics.reduce((sum, m) => sum + (m.totalSends || 0), 0);
  const totalOpens = metrics.reduce((sum, m) => sum + (m.opens || 0), 0);
  const totalReplies = metrics.reduce((sum, m) => sum + (m.replies || 0), 0);
  const totalMeetingsBooked = metrics.reduce((sum, m) => sum + (m.meetingsBooked || 0), 0);
  
  const avgOpenRate = totalSends > 0 ? (totalOpens / totalSends) * 100 : 0;
  const avgReplyRate = totalSends > 0 ? (totalReplies / totalSends) * 100 : 0;
  
  return {
    totalTemplates: userTemplates.length,
    totalSends,
    avgOpenRate,
    avgReplyRate,
    totalMeetingsBooked,
  };
}
