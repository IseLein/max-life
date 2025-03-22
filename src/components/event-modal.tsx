"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Clock, Trash2 } from "lucide-react";
import { Switch } from "~/components/ui/switch";

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  location?: string;
  isAllDay?: boolean;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  mode: "view" | "edit" | "create";
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export function EventModal({
  isOpen,
  onClose,
  event,
  mode,
  onSave,
  onDelete,
}: EventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CalendarEvent>(
    event || {
      summary: "",
      description: "",
      start: {
        dateTime: new Date().toISOString(),
      },
      end: {
        dateTime: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
      },
      isAllDay: false,
    },
  );

  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const isCreateMode = mode === "create";

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;

    if (formData.isAllDay) {
      setFormData((prev) => ({
        ...prev,
        start: { ...prev.start, date: date.toISOString().split("T")[0] },
      }));
    } else {
      const currentStart = formData.start.dateTime
        ? new Date(formData.start.dateTime)
        : new Date();
      const newDate = new Date(date);
      newDate.setHours(currentStart.getHours(), currentStart.getMinutes());

      setFormData((prev) => ({
        ...prev,
        start: { ...prev.start, dateTime: newDate.toISOString() },
      }));
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (!date) return;

    if (formData.isAllDay) {
      setFormData((prev) => ({
        ...prev,
        end: { ...prev.end, date: date.toISOString().split("T")[0] },
      }));
    } else {
      const currentEnd = formData.end.dateTime
        ? new Date(formData.end.dateTime)
        : new Date();
      const newDate = new Date(date);
      newDate.setHours(currentEnd.getHours(), currentEnd.getMinutes());

      setFormData((prev) => ({
        ...prev,
        end: { ...prev.end, dateTime: newDate.toISOString() },
      }));
    }
  };

  const handleStartTimeChange = (time: string) => {
    if (!time) return;

    const [hours, minutes] = time.split(":").map(Number);
    const currentStart = formData.start.dateTime
      ? new Date(formData.start.dateTime)
      : new Date();
    currentStart.setHours(hours, minutes);

    setFormData((prev) => ({
      ...prev,
      start: { ...prev.start, dateTime: currentStart.toISOString() },
    }));
  };

  const handleEndTimeChange = (time: string) => {
    if (!time) return;

    const [hours, minutes] = time.split(":").map(Number);
    const currentEnd = formData.end.dateTime
      ? new Date(formData.end.dateTime)
      : new Date();
    currentEnd.setHours(hours, minutes);

    setFormData((prev) => ({
      ...prev,
      end: { ...prev.end, dateTime: currentEnd.toISOString() },
    }));
  };

  const handleAllDayChange = (checked: boolean) => {
    if (checked) {
      // Convert to all-day event
      const startDate = formData.start.dateTime
        ? new Date(formData.start.dateTime).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const endDate = formData.end.dateTime
        ? new Date(formData.end.dateTime).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      setFormData((prev) => ({
        ...prev,
        isAllDay: true,
        start: { date: startDate },
        end: { date: endDate },
      }));
    } else {
      // Convert to time-based event
      const startDateTime = formData.start.date
        ? `${formData.start.date}T09:00:00.000Z`
        : new Date().toISOString();

      const endDateTime = formData.end.date
        ? `${formData.end.date}T10:00:00.000Z`
        : new Date(new Date().getTime() + 60 * 60 * 1000).toISOString();

      setFormData((prev) => ({
        ...prev,
        isAllDay: false,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.summary.trim()) return;

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    try {
      setIsSubmitting(true);
      if (onDelete) {
        await onDelete(event.id);
      }
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    // Switch to edit mode
    if (mode === "view" && event) {
      setFormData(event);
    }
  };

  const formatEventTime = (dateString?: string) => {
    if (!dateString) return "";
    return format(new Date(dateString), "h:mm a");
  };

  const formatEventDate = (dateString?: string) => {
    if (!dateString) return "";
    return format(new Date(dateString), "EEEE, MMMM d, yyyy");
  };

  const getStartDate = (): Date => {
    if (formData.isAllDay && formData.start.date) {
      return new Date(formData.start.date);
    }
    return formData.start.dateTime
      ? new Date(formData.start.dateTime)
      : new Date();
  };

  const getEndDate = (): Date => {
    if (formData.isAllDay && formData.end.date) {
      return new Date(formData.end.date);
    }
    return formData.end.dateTime ? new Date(formData.end.dateTime) : new Date();
  };

  const getStartTime = (): string => {
    if (formData.start.dateTime) {
      const date = new Date(formData.start.dateTime);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return "09:00";
  };

  const getEndTime = (): string => {
    if (formData.end.dateTime) {
      const date = new Date(formData.end.dateTime);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return "10:00";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isViewMode
              ? "Event Details"
              : isCreateMode
                ? "Create Event"
                : "Edit Event"}
          </DialogTitle>
          <DialogDescription>
            {isViewMode
              ? "View the details of this calendar event."
              : "Fill in the details for your calendar event."}
          </DialogDescription>
        </DialogHeader>

        {isViewMode ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{event?.summary}</h3>

            <div className="flex items-start gap-2">
              <CalendarIcon className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div>
                {event?.isAllDay || event?.start.date ? (
                  <div>
                    <p>All day</p>
                    <p>
                      {formatEventDate(
                        event?.start.date || event?.start.dateTime,
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p>{formatEventDate(event?.start.dateTime)}</p>
                    <p>
                      {formatEventTime(event?.start.dateTime)} -{" "}
                      {formatEventTime(event?.end.dateTime)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {event?.location && (
              <div className="flex items-start gap-2">
                <Clock className="text-muted-foreground mt-0.5 h-5 w-5" />
                <p>{event.location}</p>
              </div>
            )}

            {event?.description && (
              <div className="mt-4">
                <h4 className="mb-1 text-sm font-medium">Description</h4>
                <p className="text-muted-foreground text-sm whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="summary">Event Title</Label>
                <Input
                  id="summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  placeholder="Add title"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="isAllDay">All day</Label>
                <Switch
                  id="isAllDay"
                  checked={formData.isAllDay}
                  onCheckedChange={handleAllDayChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !getStartDate() && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {getStartDate()
                          ? format(getStartDate(), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={getStartDate()}
                        onSelect={handleStartDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {!formData.isAllDay && (
                  <div className="grid gap-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={getStartTime()}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !getEndDate() && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {getEndDate()
                          ? format(getEndDate(), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={getEndDate()}
                        onSelect={handleEndDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {!formData.isAllDay && (
                  <div className="grid gap-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={getEndTime()}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location || ""}
                  onChange={handleInputChange}
                  placeholder="Add location"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description || ""}
                  onChange={handleInputChange}
                  placeholder="Add description"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              {isEditMode && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="mr-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !formData.summary.trim()}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {isViewMode && (
          <DialogFooter>
            {onDelete && event?.id && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}

            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>

            <Button type="button" onClick={handleEdit}>
              Edit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
