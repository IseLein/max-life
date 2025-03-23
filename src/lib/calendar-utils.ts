import type { GenerateContentResult, Part } from "@google/generative-ai"

type ParsedGeminiResponse = {
  message: string
  suggestions: Suggestion[]
  parts: Array<Part>
  getEventArgs?: {
    startDate: Date
    endDate: Date
  }
}

export function parseGeminiResponse(response: GenerateContentResult): ParsedGeminiResponse | undefined  {
  const ai_responses = response.response.candidates
  if (!ai_responses || !ai_responses[0]) return undefined
  const parts = ai_responses[0].content?.parts
  if (!parts) return undefined
  
  let message = "";
  let getEventArgs;
  let suggestions: Suggestion[] = [];
  let key = 0
  for (const part of parts) {
    key++;
    if (part.text) {
      message = part.text
    } else if (part.functionCall) {
      const { name, args } = part.functionCall
      console.log(name, args)
      if (name === 'getCalendarEvents' && args) {
        const argsObj = args as { startDate: string; endDate: string };
        const startDateList = argsObj.startDate.split('-')
        const endDateList = argsObj.endDate.split('-')
        if (startDateList.length === 3 && endDateList.length === 3) {
          getEventArgs = {
            startDate: new Date(Number(startDateList[0]), Number(startDateList[1]) - 1, Number(startDateList[2])),
            endDate: new Date(Number(endDateList[0]), Number(endDateList[1]) - 1, Number(endDateList[2]))
          }
        }
      } else if (name === 'addEventToCalendar' && args) {
        const argsObj = args as { title: string; description: string; year: number; month: number; day: number; startTime: number; endTime: number };
        suggestions.push({
          id: (Date.now() + 1).toString() + key.toString(),
          action: "add",
          title: argsObj.title,
          year: argsObj.year,
          month: argsObj.month,
          day: argsObj.day,
          startTime: argsObj.startTime,
          endTime: argsObj.endTime,
          description: argsObj.description
        } as AddSuggestion)
      } else if (name === 'editEventInCalendar' && args) {
        const argsObj = args as { eventId: string; changes: { title?: string; year?: number; month?: number; day?: number; startTime?: number; endTime?: number } };
        suggestions.push({
          id: (Date.now() + 1).toString() + key.toString(),
          action: "edit",
          eventId: argsObj.eventId,
          changes: argsObj.changes
        } as EditSuggestion)
      } else if (name === 'deleteEventFromCalendar' && args) {
        const argsObj = args as { eventId: string };
        suggestions.push({
          id: (Date.now() + 1).toString() + key.toString(),
          action: "delete",
          eventId: argsObj.eventId
        } as DeleteSuggestion)
      }
    }
  }

  return { message, suggestions, parts, getEventArgs };
}

export type Message = {
  id: string
  content: string
  sender: "user" | "model" | "info"
  timestamp: Date
}

export interface Suggestion {
  id: string
  action: "add" | "edit" | "delete"
}

export interface AddSuggestion extends Suggestion {
  action: "add"
  title: string
  year: number
  month: number
  day: number
  startTime: Number
  endTime: Number
  description?: string
}

export interface EditSuggestion extends Suggestion {
  action: "edit"
  eventId: string
  changes: {
    title?: string
    year?: number
    month?: number
    day?: number
    startTime?: Number
    endTime?: Number
  }
}

export interface DeleteSuggestion extends Suggestion {
  action: "delete"
  eventId: string
  title?: string
  year?: number
  month?: number
  day?: number
  startTime?: Number
  endTime?: Number
  description?: string
}

export interface SuggestionResponse {
  name: string
  input: any
  response: any
}