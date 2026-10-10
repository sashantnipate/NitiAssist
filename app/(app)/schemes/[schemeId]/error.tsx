"use client"
import { Button } from "@/components/ui/button"
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">
        We couldn’t load scheme information
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try loading this page again.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  )
}
