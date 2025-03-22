import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getCalendarEventsForCurrentWeek,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "~/server/api/services/googleCalendar";

export const calendarRouter = createTRPCRouter({
  getCurrentWeekEvents: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const events = await getCalendarEventsForCurrentWeek(userId);
      return events;
    } catch (error) {
      console.error("Error in getCurrentWeekEvents procedure:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch calendar events",
        cause: error,
      });
    }
  }),

  getEventsForDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const events = await getCalendarEvents(userId, input.startDate, input.endDate);
        return events;
      } catch (error) {
        console.error("Error in getEventsForDateRange procedure:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch calendar events for date range",
          cause: error,
        });
      }
    }),

  createEvent: protectedProcedure
    .input(
      z.object({
        summary: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }),
        end: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }),
        isAllDay: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        
        // Remove isAllDay as it's not part of the Google Calendar API
        const { isAllDay, ...eventData } = input;
        
        const event = await createCalendarEvent(userId, eventData);
        return event;
      } catch (error) {
        console.error("Error in createEvent procedure:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create calendar event",
          cause: error,
        });
      }
    }),

  updateEvent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z
          .object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          })
          .optional(),
        end: z
          .object({
            dateTime: z.string().optional(),
            date: z.string().optional(),
            timeZone: z.string().optional(),
          })
          .optional(),
        isAllDay: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const { id, isAllDay, ...eventData } = input;
        
        const event = await updateCalendarEvent(userId, id, eventData);
        return event;
      } catch (error) {
        console.error("Error in updateEvent procedure:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update calendar event",
          cause: error,
        });
      }
    }),

  deleteEvent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        await deleteCalendarEvent(userId, input.id);
      } catch (error) {
        console.error("Error in deleteEvent procedure:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete calendar event",
          cause: error,
        });
      }
    }),
});
