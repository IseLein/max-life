import { CalendarView } from "~/components/calendar-view"
import { CalendarChat } from "~/components/calendar-chat"
import { redirect } from "next/navigation"
import { LoginButton } from "~/components/login-button"
import { auth } from "~/server/auth"

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-primary text-2xl">Good morning, {session.user.name}</span>
          </div>
          <LoginButton loggedIn={!!session} />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <CalendarView />
        </div>
        <div>
          <CalendarChat />
        </div>
      </div>
    </div>
  )
}