import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getUserConversations,
  createConversation,
  deleteConversation,
  getConversationMessages,
  addMessage,
  updateConversationTitle,
} from "./db";
import { invokeLLM, listLLMModels } from "./_core/llm";

import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";


export const chatRouter = router({
  /**
   * Get all conversations for the current user
   */
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return await getUserConversations(ctx.user.id);
  }),

  /**
   * Create a new conversation
   */
  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const conversationId = await createConversation(
        ctx.user.id,
        input.title
      );
      return { id: conversationId };
    }),

  /**
   * Delete a conversation
   */
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const conversations = await getUserConversations(ctx.user.id);
      const conversation = conversations.find((c) => c.id === input.conversationId);
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      await deleteConversation(input.conversationId);
      return { success: true };
    }),

  /**
   * Get all messages in a conversation
   */
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const conversations = await getUserConversations(ctx.user.id);
      const conversation = conversations.find(
        (c) => c.id === input.conversationId
      );
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return await getConversationMessages(input.conversationId);
    }),

  /**
   * Send a message and get a non-streaming response
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const conversations = await getUserConversations(ctx.user.id);
      const conversation = conversations.find(
        (c) => c.id === input.conversationId
      );
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Add user message to database
      await addMessage(input.conversationId, "user", input.message);

      // Get conversation history for context
      const messages = await getConversationMessages(input.conversationId);

      // Build message history for LLM
      // Note: messages array includes the user message we just added
      const llmMessages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = messages
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content as string,
        }));
      
      console.log("[Chat] Message history:", llmMessages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`).join(" | "));
      // Note: llmMessages already includes the user message we just added

      // Get available models
      let models: any[] = [];
      try {
        const modelsResponse = await listLLMModels();
        models = modelsResponse.data || [];
        console.log("[Chat] Available models:", models.map((m: any) => m.id).join(", "));
      } catch (err) {
        console.error("[Chat] Failed to list models:", err instanceof Error ? err.message : String(err));
        models = [];
      }
      const model = models[0]?.id || "gpt-4";
      console.log("[Chat] Using model:", model);

      // Invoke LLM
      console.log("[Chat] Invoking LLM with", llmMessages.length, "messages");
      const response = await invokeLLM({
        model,
        messages: llmMessages as any,
      });
      console.log("[Chat] LLM response received:", JSON.stringify(response).substring(0, 200));

      // Defensive check for response structure
      if (!response || !response.choices || !Array.isArray(response.choices)) {
        console.error("[Chat] Invalid LLM response structure:", JSON.stringify(response).substring(0, 500));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM returned invalid response structure",
        });
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error("[Chat] No content in LLM response:", JSON.stringify(response.choices[0]).substring(0, 500));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM returned empty response",
        });
      }

      const aiResponse = typeof content === "string" ? content : "No response generated";
      if (!aiResponse.trim()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM returned empty string",
        });
      }

      // Save the response to database
      await addMessage(input.conversationId, "assistant", aiResponse);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = input.message.substring(0, 50);
        await updateConversationTitle(input.conversationId, title);
      }

      return { response: aiResponse };
    }),

  /**
   * Stream a message response in real-time
   */
  streamMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string().min(1),
      })
    )
    .subscription(({ ctx, input }) => {
      return observable<{ token: string }>((emit: any) => {
        let aborted = false;

        const task = (async () => {
          try {
            // Verify ownership
            const conversations = await getUserConversations(ctx.user.id);
            const conversation = conversations.find(
              (c) => c.id === input.conversationId
            );
            if (!conversation) {
              if (!aborted) {
                emit.error(
                  new TRPCError({
                    code: "NOT_FOUND",
                    message: "Conversation not found",
                  })
                );
              }
              return;
            }

            // Add user message to database
            await addMessage(input.conversationId, "user", input.message);

            // Get conversation history for context
            const messages = await getConversationMessages(input.conversationId);

            // Build message history for LLM
            // Note: messages array includes the user message we just added
            const llmMessages: Array<{
              role: "user" | "assistant";
              content: string;
            }> = messages
              .map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content as string,
              }));
            
            console.log("[Chat] Message history:", llmMessages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`).join(" | "));

            // Get available models
            let models: any[] = [];
            try {
              const modelsResponse = await listLLMModels();
              models = modelsResponse.data || [];
              console.log("[Chat] Available models:", models.map((m: any) => m.id).join(", "));
            } catch (err) {
              console.error("[Chat] Failed to list models:", err instanceof Error ? err.message : String(err));
              models = [];
            }
            const model = models[0]?.id || "gpt-4";
            console.log("[Chat] Using model:", model);

            // Invoke LLM with streaming
            console.log("[Chat] Invoking LLM with", llmMessages.length, "messages");
            const response = await invokeLLM({
              model,
              messages: llmMessages as any,
            });
            console.log("[Chat] LLM response received:", JSON.stringify(response).substring(0, 200));

            if (aborted) return;

            // Defensive check for response structure
            if (!response || !response.choices || !Array.isArray(response.choices)) {
              console.error("[Chat] Invalid LLM response structure:", JSON.stringify(response).substring(0, 500));
              throw new Error("LLM returned invalid response structure");
            }

            const content = response.choices[0]?.message?.content;
            if (!content) {
              console.error("[Chat] No content in LLM response:", JSON.stringify(response.choices[0]).substring(0, 500));
              throw new Error("LLM returned empty response");
            }

            const aiResponse = typeof content === "string" ? content : "No response generated";
            if (!aiResponse.trim()) {
              throw new Error("LLM returned empty string");
            }

            // Stream the response word by word
            const words = aiResponse.split(" ");
            for (const word of words) {
              if (aborted) return;
              emit.next({ token: word + " " });
              // Small delay between words for better streaming effect
              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            if (aborted) return;

            // Save the full response to database
            await addMessage(input.conversationId, "assistant", aiResponse);

            // Update conversation title if it's the first message
            if (messages.length === 0) {
              const title = input.message.substring(0, 50);
              await updateConversationTitle(input.conversationId, title);
            }

            if (!aborted) {
              emit.complete();
            }
          } catch (error) {
            if (!aborted) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error("[Chat] Failed to stream response:", errorMsg);
              if (error instanceof Error) {
                console.error("[Chat] Error stack:", error.stack);
              }
              emit.error(
                new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to generate AI response: " + errorMsg,
                })
              );
            }
          }
        })();

        // Return cleanup function
        return () => {
          aborted = true;
        };
      });
    }),
});
