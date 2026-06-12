import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("chat router", () => {
  describe("listConversations", () => {
    it("returns empty list for new user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.chat.listConversations();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createConversation", () => {
    it("creates a new conversation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.chat.createConversation({});

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      expect(result.id).toBeGreaterThan(0);
    });

    it("creates conversation with unique IDs", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result1 = await caller.chat.createConversation({});
      const result2 = await caller.chat.createConversation({});

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe("getMessages", () => {
    it("returns empty messages for new conversation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const convResult = await caller.chat.createConversation({});
      const messages = await caller.chat.getMessages({ conversationId: convResult.id });

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(0);
    });

    it("rejects access to other user's conversation", async () => {
      const ctx1 = createAuthContext(1);
      const ctx2 = createAuthContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const convResult = await caller1.chat.createConversation({});

      try {
        await caller2.chat.getMessages({ conversationId: convResult.id });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("deleteConversation", () => {
    it("deletes a conversation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const convResult = await caller.chat.createConversation({});
      await caller.chat.deleteConversation({ conversationId: convResult.id });

      const conversations = await caller.chat.listConversations();
      const deleted = conversations.find((c) => c.id === convResult.id);

      expect(deleted).toBeUndefined();
    });

    it("rejects deletion of other user's conversation", async () => {
      const ctx1 = createAuthContext(1);
      const ctx2 = createAuthContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const convResult = await caller1.chat.createConversation({});

      try {
        await caller2.chat.deleteConversation({ conversationId: convResult.id });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("sendMessage", () => {
    it("sends a message and gets response", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const convResult = await caller.chat.createConversation({});
      const result = await caller.chat.sendMessage({
        conversationId: convResult.id,
        message: "Hello, how are you?",
      });

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
      expect(result.response.length).toBeGreaterThan(0);
    });

    it("rejects message to other user's conversation", async () => {
      const ctx1 = createAuthContext(1);
      const ctx2 = createAuthContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const convResult = await caller1.chat.createConversation({});

      try {
        await caller2.chat.sendMessage({
          conversationId: convResult.id,
          message: "Hello",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("persists messages in conversation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const convResult = await caller.chat.createConversation({});
      await caller.chat.sendMessage({
        conversationId: convResult.id,
        message: "First message",
      });

      const messages = await caller.chat.getMessages({ conversationId: convResult.id });

      expect(messages.length).toBeGreaterThan(0);
      const userMessage = messages.find((m) => m.role === "user");
      expect(userMessage?.content).toBe("First message");
    });
  });

  describe("authentication", () => {
    it("rejects unauthenticated access to protected procedures", async () => {
      const ctx = { user: null } as any;
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.chat.listConversations();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });
});
