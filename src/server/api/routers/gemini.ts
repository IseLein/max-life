import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";

import { env } from "~/env";
import { 
  calendarFunctionDeclarations, 
  calendarFunctions,
  createCalendarAssistant 
} from "~/lib/gemini";

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

  calendarChat: protectedProcedure
    .input(z.object({
      message: z.string(),
      history: z.array(z.object({
        role: z.string(),
        parts: z.array(z.object({ text: z.string() }))
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the user ID from the session
      const userId = ctx.session.user.id;
      
      // Create a calendar assistant with the user's ID
      const assistant = createCalendarAssistant(userId, input.history);
      
      // Send the message to the assistant and get the response
      const response = await assistant.sendMessage(input.message);
      
      return response;
    }),
    
  calendarFunctionCall: protectedProcedure
    .input(z.object({
      functionName: z.enum([
        "getCalendarEvents", 
        "createCalendarEvent", 
        "updateCalendarEvent", 
        "deleteCalendarEvent"
      ]),
      args: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { functionName, args } = input;
      
      // Validate that the function exists
      if (!calendarFunctions[functionName]) {
        throw new Error(`Function ${functionName} not found`);
      }
      
      try {
        // Call the function with the arguments and user ID
        const result = await calendarFunctions[functionName](args, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error(`Error executing ${functionName}:`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        };
      }
    }),
});