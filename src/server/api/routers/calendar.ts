import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCalendarEventsForCurrentWeek } from "../services/googleCalendar";

export const calendarRouter = createTRPCRouter({
  getCurrentWeekEvents: protectedProcedure.query(async ({ ctx }) => {
    try {
      const events = await getCalendarEventsForCurrentWeek(ctx.session.user.id);
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
});
