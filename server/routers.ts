import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, type Message as LLMMessage } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  getUserConversation,
  insertFile,
  insertMessage,
  insertUsage,
  listUserConversations,
  renameConversation,
  searchUserConversations,
  touchConversation,
} from "./db";

const modeSchema = z.enum(["chat", "search", "study", "coding", "analyze", "creative"]);
const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
});

const modeInstructions: Record<z.infer<typeof modeSchema>, string> = {
  chat: "Be a thoughtful, concise general-purpose assistant.",
  search: "Be careful about freshness. Explain when you cannot verify current information and never invent sources.",
  study: "Teach clearly with examples, checkpoints, and a short recap when helpful.",
  coding: "Act as a senior software engineer. Prefer runnable code, explain tradeoffs, and call out assumptions.",
  analyze: "Analyze the provided material carefully. Separate observations from conclusions and say when context is missing.",
  creative: "Be imaginative and collaborative. Offer distinct directions while respecting the user's constraints.",
};

export const contentToText = (content: unknown) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => typeof part === "string" ? part : (part as { text?: string }).text ?? "").join("\n");
  }
  return "";
};

export const titleFromPrompt = (prompt: string) => {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}…` : cleaned || "New conversation";
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: router({
    list: protectedProcedure.query(({ ctx }) => listUserConversations(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const conversation = await getUserConversation(ctx.user.id, input.id);
      if (!conversation) return null;
      const history = await getConversationMessages(ctx.user.id, input.id);
      return { conversation, messages: history };
    }),
    search: protectedProcedure.input(z.object({ query: z.string().trim().max(120) })).query(({ ctx, input }) => {
      if (!input.query) return listUserConversations(ctx.user.id);
      return searchUserConversations(ctx.user.id, input.query);
    }),
    rename: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(255) })).mutation(({ ctx, input }) => renameConversation(ctx.user.id, input.id, input.title)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteConversation(ctx.user.id, input.id).then(() => ({ success: true }))),
    upload: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(255), fileType: z.string().min(1).max(120), fileSize: z.number().int().positive().max(12_000_000), data: z.string().min(1), conversationId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const key = `${ctx.user.id}-files/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(input.data.replace(/^data:[^;]+;base64,/, ""), "base64");
      const stored = await storagePut(key, buffer, input.fileType);
      await insertFile({ userId: ctx.user.id, conversationId: input.conversationId, fileName: input.fileName, fileType: input.fileType, fileSize: input.fileSize, storageKey: stored.key, storageUrl: stored.url });
      return { name: input.fileName, type: input.fileType, size: input.fileSize, url: stored.url };
    }),
    send: protectedProcedure.input(z.object({ conversationId: z.number().int().positive().optional(), content: z.string().trim().min(1).max(20_000), mode: modeSchema.default("chat"), model: z.string().default("nova-balanced"), attachments: z.array(attachmentSchema).max(4).default([]) })).mutation(async ({ ctx, input }) => {
      let conversation = input.conversationId ? await getUserConversation(ctx.user.id, input.conversationId) : undefined;
      if (input.conversationId && !conversation) throw new Error("Conversation not found");
      if (!conversation) conversation = await createConversation(ctx.user.id, titleFromPrompt(input.content), input.mode, input.model);
      if (!conversation) throw new Error("Unable to create conversation");

      const userContent = input.attachments.length > 0 ? `${input.content}\n\nAttached files: ${input.attachments.map(file => file.name).join(", ")}` : input.content;
      await insertMessage({ conversationId: conversation.id, userId: ctx.user.id, role: "user", content: userContent, attachments: input.attachments });
      await touchConversation(conversation.id);

      const previous = await getConversationMessages(ctx.user.id, conversation.id);
      const llmMessages: LLMMessage[] = [
        { role: "system", content: `You are NOVA AI, a premium assistant. ${modeInstructions[input.mode]}\n\nUse Markdown when it improves readability. Be honest about uncertainty, unavailable tools, and freshness. Do not claim to have searched the web unless a search tool is actually configured.` },
        ...previous.slice(-24).map(message => ({ role: message.role as "user" | "assistant" | "system", content: message.content })),
      ];
      const imageParts = input.attachments.filter(file => file.type.startsWith("image/")).map(file => ({ type: "image_url" as const, image_url: { url: file.url, detail: "auto" as const } }));
      if (imageParts.length > 0) {
        llmMessages[llmMessages.length - 1] = { role: "user", content: [{ type: "text", text: userContent }, ...imageParts] };
      }

      const model = input.model === "nova-fast" ? "gemini-3-flash-preview" : input.model === "nova-reasoning" ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      let response;
      try {
        response = await invokeLLM({ model, messages: llmMessages, maxTokens: 1800 });
      } catch (error) {
        console.error("[Chat] LLM request failed", error);
        throw new Error("NOVA is temporarily unavailable. Please try again in a moment.");
      }
      const answer = contentToText(response.choices[0]?.message?.content).trim();
      if (!answer) throw new Error("NOVA returned an empty response. Please try again.");
      const assistantMessageId = await insertMessage({ conversationId: conversation.id, userId: ctx.user.id, role: "assistant", content: answer, attachments: [] });
      await insertUsage({ userId: ctx.user.id, model, inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0 });
      await touchConversation(conversation.id);
      return { conversationId: conversation.id, assistantMessageId, title: conversation.title, content: answer, model };
    }),
  }),
});

export type AppRouter = typeof appRouter;
