export type Message = {
  id: string
  content: string
  sender: "user" | "model"
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
  title: string
  year: number
  month: number
  day: number
  startTime: Number
  endTime: Number
  description?: string
}