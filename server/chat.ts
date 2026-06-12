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
      const conversation = conversations.find((c) => c.id === input.conversationId);
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return await getConversationMessages(input.conversationId);
    }),

  /**
   * Send a message and get a streaming AI response
   * This procedure returns the full response text (not streaming to client)
   * For true streaming, the client should use a separate endpoint
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
      const conversation = conversations.find((c) => c.id === input.conversationId);
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
      const llmMessages: Array<{ role: "user" | "assistant"; content: string }> = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content as string,
      }));

      // Add the new user message
      llmMessages.push({
        role: "user" as const,
        content: input.message as string,
      });

      try {
        // Get available models
        const { data: models } = await listLLMModels();
        const model = models[0]?.id || "gpt-4";

        // Invoke LLM
        const response = await invokeLLM({
          model,
          messages: llmMessages as any,
        });

        const content = response.choices[0]?.message?.content;
        const aiResponse =
          typeof content === "string" ? content : "No response generated";

        // Save AI response to database
        await addMessage(input.conversationId, "assistant", aiResponse);

        // Update conversation title if it's the first message
        if (messages.length === 0) {
          const title = input.message.substring(0, 50);
          await updateConversationTitle(input.conversationId, title);
        }

        return {
          response: aiResponse,
        };
      } catch (error) {
        console.error("[Chat] Failed to get AI response:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate AI response",
        });
      }
    }),

  /**
   * Stream a chat response word-by-word
   * Uses server-sent events (SSE) to stream the response as it's generated
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
        (async () => {
          try {
            // Verify ownership
            const conversations = await getUserConversations(ctx.user.id);
            const conversation = conversations.find(
              (c) => c.id === input.conversationId
            );
            if (!conversation) {
              emit.error(
                new TRPCError({
                  code: "NOT_FOUND",
                  message: "Conversation not found",
                })
              );
              return;
            }

            // Add user message to database
            await addMessage(input.conversationId, "user", input.message);

            // Get conversation history for context
            const messages = await getConversationMessages(input.conversationId);

            // Build message history for LLM
            const llmMessages: Array<{
              role: "user" | "assistant";
              content: string;
            }> = messages.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content as string,
            }));

            // Add the new user message
            llmMessages.push({
              role: "user" as const,
              content: input.message as string,
            });

            // Get available models
            const { data: models } = await listLLMModels();
            const model = models[0]?.id || "gpt-4";

            // Invoke LLM with streaming
            const response = await invokeLLM({
              model,
              messages: llmMessages as any,
            });

            const content = response.choices[0]?.message?.content;
            const aiResponse =
              typeof content === "string" ? content : "No response generated";

            // Stream the response word by word
            const words = aiResponse.split(" ");
            for (const word of words) {
              emit.next({ token: word + " " });
              // Small delay between words for better streaming effect
              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            // Save the full response to database
            await addMessage(input.conversationId, "assistant", aiResponse);

            // Update conversation title if it's the first message
            if (messages.length === 0) {
              const title = input.message.substring(0, 50);
              await updateConversationTitle(input.conversationId, title);
            }

            emit.complete();
          } catch (error) {
            console.error("[Chat] Failed to stream response:", error);
            emit.error(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to generate AI response",
              })
            );
          }
        })();
      });
    }),
});
