import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "~/env";

const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

export const geminiRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prompt } = input;

      const response = await gemini.generateContent(prompt);
      return response;
    }),
});