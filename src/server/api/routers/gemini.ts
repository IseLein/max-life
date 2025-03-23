import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ChatSession, GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "~/env";

const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

export const geminiRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      history: z.array(z.object({
        role: z.string(),
        parts: z.array(z.object({ text: z.string() }))
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const { prompt, history } = input;
      const chat = gemini.startChat({ history });

      const response = await chat.sendMessage(prompt);
      return response;
    }),
});