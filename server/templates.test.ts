import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(null)),
  getTemplatesByUserId: vi.fn(() => Promise.resolve([])),
  getTemplateById: vi.fn(() => Promise.resolve(null)),
  createTemplate: vi.fn(() => Promise.resolve({ insertId: 1 })),
  getMetricsByTemplateId: vi.fn(() => Promise.resolve(null)),
  getDashboardMetrics: vi.fn(() =>
    Promise.resolve({
      totalTemplates: 0,
      totalSends: 0,
      avgOpenRate: 0,
      avgReplyRate: 0,
      totalMeetingsBooked: 0,
    })
  ),
  getAISuggestionsByTemplateId: vi.fn(() => Promise.resolve([])),
  seedUserTemplates: vi.fn(() => Promise.resolve()),
}));

function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Template Routes", () => {
  it("should return empty list for new user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // This will use the mocked getTemplatesByUserId
    const result = await caller.templates.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should require authentication for template list", async () => {
    const ctx = createMockContext();
    ctx.user = null as any;
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.templates.list();
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should get dashboard metrics", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metrics.dashboard();

    expect(result).toEqual({
      totalTemplates: 0,
      totalSends: 0,
      avgOpenRate: 0,
      avgReplyRate: 0,
      totalMeetingsBooked: 0,
    });
  });
});

describe("Auth Routes", () => {
  it("should return current user from me query", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toEqual(ctx.user);
    expect(result?.email).toBe("test@example.com");
  });

  it("should handle logout mutation", async () => {
    const ctx = createMockContext();
    ctx.res = {
      clearCookie: vi.fn(),
    } as any;

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});
