import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

import { env } from "~/env";
import { addEventToCalendar, getCalendarEvents, editEventInCalendar, deleteEventFromCalendar } from "~/utils/functionCalls";
import { systemPrompt } from "~/utils/systemPrompt";

const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

export const geminiRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      history: z.array(z.object({
        role: z.string(),
        parts: z.array(z.any())
      })),
      personality: z.string(),
      functionResponse: z.object({
        name: z.string(),
        response: z.any()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { prompt, history, personality, functionResponse } = input;

      let message: string | Array<string | Part> = prompt;
      if (functionResponse) {
        message = [{
          functionResponse: {
            name: functionResponse.name,
            response: functionResponse?.response || {}
          }
        }];
      }

      const gemini = genai.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0
        },
        tools: [
          {
            functionDeclarations: [
              getCalendarEvents,
              addEventToCalendar,
              editEventInCalendar,
              deleteEventFromCalendar
            ]
          }
        ],
        systemInstruction: systemPrompt(personality)
      });
      const chat = gemini.startChat({ history });

      const response = await chat.sendMessage(prompt);
      return response;
    }),
});