import { SchemaType, type FunctionDeclaration } from "@google/generative-ai"

export const getCalendarEvents: FunctionDeclaration = {
    name: "getCalendarEvents",
    description: `Return all events on the calender between "startDate" (inclusive) and "endDate" (exclusive)`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            startDate: {
                type: SchemaType.STRING,
                description: "Start date in YYYY-MM-DD format"
            },
            endDate: {
                type: SchemaType.STRING,
                description: "End date in YYYY-MM-DD format"
            }
        },
        required: ["startDate", "endDate"]
    }
}

export const addEventToCalendar: FunctionDeclaration = {
    name: "addEventToCalendar",
    description: `Add a new event to the calendar given all the details`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            title: {
                type: SchemaType.STRING,
                description: "Event title"
            },
            description: {
                type: SchemaType.STRING,
                description: "Event description"
            },
            year: {
                type: SchemaType.INTEGER,
                description: "Event year"
            },
            month: {
                type: SchemaType.INTEGER,
                description: "Event month (0-11)"
            },
            day: {
                type: SchemaType.INTEGER,
                description: "Event day (1-31)"
            },
            startTime: {
                type: SchemaType.INTEGER,
                description: "Event start time in hours (0-23)"
            },
            endTime: {
                type: SchemaType.INTEGER,
                description: "Event end time in hours (0-23)"
            }
        },
        required: ["title", "year", "month", "day", "startTime", "endTime"]
    }
}

export const editEventInCalendar: FunctionDeclaration = {
    name: "editEventInCalendar",
    description: `Edit an existing event in the calendar given all the details`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            eventId: {
                type: SchemaType.STRING,
                description: "Event ID"
            },
            title: {
                type: SchemaType.STRING,
                description: "Event title"
            },
            description: {
                type: SchemaType.STRING,
                description: "Event description"
            },
            year: {
                type: SchemaType.INTEGER,
                description: "Event year"
            },
            month: {
                type: SchemaType.INTEGER,
                description: "Event month (0-11)"
            },
            day: {
                type: SchemaType.INTEGER,
                description: "Event day (1-31)"
            },
            startTime: {
                type: SchemaType.INTEGER,
                description: "Event start time in hours (0-23)"
            },
            endTime: {
                type: SchemaType.INTEGER,
                description: "Event end time in hours (0-23)"
            }
        },
        required: ["eventId"]
    }
}

export const deleteEventFromCalendar: FunctionDeclaration = {
    name: "deleteEventFromCalendar",
    description: `Delete an event from the calendar given the event ID`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            eventId: {
                type: SchemaType.STRING,
                description: "Event ID"
            }
        },
        required: ["eventId"]
    }
}