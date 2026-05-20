import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  templates: many(templates),
  emailSends: many(emailSends),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Email Templates table
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subjectLine: text("subjectLine").notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 100 }).default("General"),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// Email Sends table (tracks each time a template is used)
export const emailSends = mysqlTable("emailSends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  templateId: int("templateId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientCompany: varchar("recipientCompany", { length: 255 }),
  recipientTitle: varchar("recipientTitle", { length: 255 }),
  sentAt: timestamp("sentAt").notNull(),
  openedAt: timestamp("openedAt"),
  firstReplyAt: timestamp("firstReplyAt"),
  meetingScheduled: boolean("meetingScheduled").default(false),
  dealValue: decimal("dealValue", { precision: 10, scale: 2 }),
  externalId: varchar("externalId", { length: 255 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailSend = typeof emailSends.$inferSelect;
export type InsertEmailSend = typeof emailSends.$inferInsert;

// Template Performance Metrics (cached metrics)
export const templateMetrics = mysqlTable("templateMetrics", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull().unique(),
  totalSends: int("totalSends").default(0),
  opens: int("opens").default(0),
  replies: int("replies").default(0),
  meetingsBooked: int("meetingsBooked").default(0),
  avgDaysToReply: decimal("avgDaysToReply", { precision: 5, scale: 2 }),
  dealValueTotal: decimal("dealValueTotal", { precision: 12, scale: 2 }),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TemplateMetric = typeof templateMetrics.$inferSelect;
export type InsertTemplateMetric = typeof templateMetrics.$inferInsert;

// AI Suggestions table
export const aiSuggestions = mysqlTable("aiSuggestions", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  suggestionText: text("suggestionText").notNull(),
  suggestedChange: text("suggestedChange"),
  area: varchar("area", { length: 100 }).notNull(), // 'subject_line', 'opening_hook', 'cta'
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AISuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAISuggestion = typeof aiSuggestions.$inferInsert;

// Relations
export const templatesRelations = relations(templates, ({ many }) => ({
  emailSends: many(emailSends),
  metrics: many(templateMetrics),
  suggestions: many(aiSuggestions),
}));

export const emailSendsRelations = relations(emailSends, ({ one }) => ({
  template: one(templates, {
    fields: [emailSends.templateId],
    references: [templates.id],
  }),
}));

export const templateMetricsRelations = relations(templateMetrics, ({ one }) => ({
  template: one(templates, {
    fields: [templateMetrics.templateId],
    references: [templates.id],
  }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  template: one(templates, {
    fields: [aiSuggestions.templateId],
    references: [templates.id],
  }),
}));