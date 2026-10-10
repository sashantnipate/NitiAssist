"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Landmark,
  LoaderCircle,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import {
  useLatestSchemeDiscovery,
  useUserSchemes,
} from "@/hooks/useUserSchemes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const categoryFilters = [
  "Scholarship",
  "Business",
  "Subsidy",
  "Tax Benefit",
  "Grant",
  "Other",
] as const
const isDevelopment = process.env.NODE_ENV === "development"
const isDemo = (schemeKey: string) => schemeKey.startsWith("demo:nitiassist:")
const categoryFilterValue = (category?: string) =>
  categoryFilters.find(
    (value) => value.toLowerCase() === category?.trim().toLowerCase()
  ) ?? "Other"
const dateLabel = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(timestamp)
  )

export function SchemesDashboard() {
  const schemes = useUserSchemes()
  const job = useLatestSchemeDiscovery()
  const seedDemo = useMutation(api.userSchemes.seedDevelopmentDemo)
  const removeDemo = useMutation(api.userSchemes.removeDevelopmentDemo)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState("all")
  const [busy, setBusy] = useState(false)
  const loading = schemes === undefined
  const running = job?.status === "queued" || job?.status === "running"
  const demoCount = (schemes ?? []).filter((scheme) =>
    isDemo(scheme.schemeKey)
  ).length
  const filtered = useMemo(
    () =>
      (schemes ?? []).filter((scheme) => {
        const query = search.trim().toLocaleLowerCase()
        const matchesText =
          !query ||
          scheme.title.toLocaleLowerCase().includes(query) ||
          (scheme.department ?? "").toLocaleLowerCase().includes(query)
        const matchesCategory =
          category === "all" ||
          categoryFilterValue(scheme.category) === category
        const matchesStatus =
          status === "all" || (scheme.applicationStatus ?? "unknown") === status
        return matchesText && matchesCategory && matchesStatus
      }),
    [schemes, search, category, status]
  )

  async function seedExamples() {
    setBusy(true)
    try {
      const result = await seedDemo({})
      if (!result.seeded) toast.message(result.reason)
      else
        toast.success(
          result.added
            ? "Demo schemes added to your account"
            : "Demo schemes are already loaded"
        )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load demo schemes"
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeExamples() {
    setBusy(true)
    try {
      const result = await removeDemo({})
      toast.success(
        result.removed ? "Demo schemes removed" : "No demo schemes to remove"
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove demo schemes"
      )
    } finally {
      setBusy(false)
    }
  }

  function clearFilters() {
    setSearch("")
    setCategory("all")
    setStatus("all")
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-9 md:px-8 lg:py-11">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary">
            YOUR OPPORTUNITIES
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Schemes for You
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Government support saved for your account.
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl border bg-card px-4 py-2.5">
              <span className="text-2xl font-semibold tabular-nums">
                {schemes.length}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                saved {schemes.length === 1 ? "scheme" : "schemes"}
              </span>
            </div>
            {isDevelopment && demoCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={removeExamples}
                disabled={busy}
              >
                <Trash2 />
                Remove demo data
              </Button>
            )}
          </div>
        )}
      </header>
      {running && (
        <div
          role="status"
          className="mb-5 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
        >
          <LoaderCircle className="size-4 animate-spin text-primary" />
          Finding government schemes relevant to you...
        </div>
      )}
      {job?.status === "failed" && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p className="font-medium">Scheme discovery failed</p>
          <p className="mt-1 text-muted-foreground">
            {job.errorMessage || "The search could not be completed."} A retry
            is not available until a discovery workflow is connected.
          </p>
        </div>
      )}
      {schemes?.length ? (
        <section aria-label="Saved schemes">
          <div className="mb-5 grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(220px,1fr)_210px_190px] md:p-3.5">
            <label className="relative">
              <Search
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label="Search scheme title or department"
                placeholder="Search title or department"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </label>
            <Select
              value={category}
              onValueChange={(value) => value && setCategory(value)}
            >
              <SelectTrigger aria-label="Filter by category" className="w-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryFilters.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => value && setStatus(value)}
            >
              <SelectTrigger
                aria-label="Filter by application status"
                className="w-full"
              >
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
              <h2 className="font-medium">No schemes match your filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or clear the selected filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((scheme) => {
                const demo = isDemo(scheme.schemeKey)
                const state = scheme.applicationStatus ?? "unknown"
                const statusClass =
                  state === "open"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : state === "closed"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                return (
                  <Card
                    key={scheme._id}
                    className="flex h-full min-h-[330px] flex-col rounded-xl border border-border/80 shadow-none"
                  >
                    <CardHeader className="gap-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex max-w-[75%] items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {scheme.category || "Other"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Bookmark className="size-3.5" />
                          Saved
                        </span>
                      </div>
                      {demo && (
                        <span className="w-fit rounded bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Demo data — not verified
                        </span>
                      )}
                      <CardTitle className="line-clamp-2 min-h-12 text-base leading-6">
                        {scheme.title}
                      </CardTitle>
                      <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
                        <Landmark className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {scheme.department || "Department not specified"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col pt-1">
                      <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">
                        {scheme.description || "Description not specified."}
                      </p>
                      <div className="mt-3 min-h-[3.75rem] rounded-lg bg-muted/60 px-3 py-2.5">
                        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          Benefit details
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium">
                          {scheme.benefitDetails || "Not specified"}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={
                            "rounded-full px-2.5 py-1 text-xs font-medium capitalize " +
                            statusClass
                          }
                        >
                          {demo ? state + " · demo" : state}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          {scheme.deadlineTimestamp
                            ? dateLabel(scheme.deadlineTimestamp)
                            : scheme.deadlineText || "Deadline not confirmed"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {scheme.applicationUrl
                            ? "Application link available"
                            : scheme.sourceUrls.length
                              ? scheme.sourceUrls.length +
                                " source link" +
                                (scheme.sourceUrls.length === 1 ? "" : "s")
                              : "Sources not provided"}
                        </span>
                        <span>
                          {scheme.lastVerifiedAt
                            ? "Verified " + dateLabel(scheme.lastVerifiedAt)
                            : "Not confirmed"}
                        </span>
                      </div>
                      <Link
                        href={"/schemes/" + scheme._id}
                        className="mt-auto flex items-center justify-between border-t pt-4 text-sm font-medium text-primary hover:underline"
                      >
                        <span>View details</span>
                        <ArrowRight className="size-4" />
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      ) : loading ? (
        <div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading saved schemes"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-[330px] animate-pulse rounded-xl border bg-muted/50"
            />
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <h2 className="text-lg font-semibold">
            Your saved schemes will appear here
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Ask NitiAssist about government support, or load clearly marked demo
            records to preview the dashboard. Scheme discovery is not yet
            connected to saved dashboard results.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Ask NitiAssist
              <ArrowRight className="size-4" />
            </Link>
            {isDevelopment && (
              <Button onClick={seedExamples} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Load six demo schemes
              </Button>
            )}
          </div>
          {isDevelopment && (
            <p className="mt-4 text-xs text-muted-foreground">
              Demo records are synthetic, unverified, and removable from this
              page.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
