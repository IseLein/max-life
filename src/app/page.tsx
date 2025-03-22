import { redirect } from "next/navigation";
import { LoginButton } from "~/components/login-button";

import { LatestPost } from "~/app/_components/post";
import { WeeklyCalendar } from "~/app/_components/calendar";
import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/95 sticky top-0 z-50 w-full border-b backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-primary text-2xl">MaxLife</span>
          </div>
          <LoginButton loggedIn={!!session} />
        </div>
      </header>
      <main className="flex-1">
        <section className="container mx-auto py-24 md:py-32">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col justify-center space-y-4">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Plan your life with AI-powered calendar suggestions
              </h1>
              <p className="text-muted-foreground md:text-xl">
                Enter your goals, hobbies, and responsibilities. Our AI will
                suggest optimal calendar events to help you achieve your
                objectives.
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <LoginButton
                  loggedIn={!!session}
                  className="w-full min-[400px]:w-auto"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative h-[350px] w-[350px] sm:h-[400px] sm:w-[400px] md:h-[500px] md:w-[500px]">
                <div className="from-primary/20 to-secondary/20 absolute inset-0 rounded-full bg-gradient-to-r blur-3xl" />
                <div className="absolute inset-5 flex items-center justify-center rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-950">
                  <div className="w-full space-y-4">
                    <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
                      Calendar Preview
                    </div>
                    <div className="flex h-24 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
                      AI Chat Interface
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto py-12 md:py-24">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-card rounded-lg border p-6 shadow">
              <h3 className="text-xl font-bold">Set Goals</h3>
              <p className="text-muted-foreground mt-2">
                Define your long-term goals and watch as our AI helps you break
                them down into actionable calendar events.
              </p>
            </div>
            <div className="bg-card rounded-lg border p-6 shadow">
              <h3 className="text-xl font-bold">Balance Life</h3>
              <p className="text-muted-foreground mt-2">
                Add your hobbies and responsibilities to ensure a balanced
                schedule that includes work, rest, and play.
              </p>
            </div>
            <div className="bg-card rounded-lg border p-6 shadow">
              <h3 className="text-xl font-bold">Google Calendar Sync</h3>
              <p className="text-muted-foreground mt-2">
                Seamlessly integrate with your existing Google Calendar to keep
                all your events in one place.
              </p>
            </div>
          </div>

          {session?.user && (
            <div className="flex w-full max-w-4xl flex-col gap-8">
              <LatestPost />

              <div className="mt-8">
                <WeeklyCalendar />
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="border-t py-6 md:py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-muted-foreground text-center text-sm md:text-left">
            &copy; {new Date().getFullYear()} ProductivityCalendar. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
