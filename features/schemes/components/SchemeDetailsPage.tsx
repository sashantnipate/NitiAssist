"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
} from "lucide-react"
import { useUserScheme } from "@/hooks/useUserSchemes"
import type { Id } from "@/convex/_generated/dataModel"
function ListSection({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="border-t pt-6">
      <h2 className="font-medium">{title}</h2>
      {items?.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Not provided by the available sources.
        </p>
      )}
    </section>
  )
}
export default function SchemeDetailsPage() {
  const params = useParams<{ schemeId: string }>()
  const scheme = useUserScheme(params.schemeId as Id<"userSchemes">)
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 md:px-10">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to schemes
      </Link>
      {scheme === undefined ? (
        <div className="flex items-center gap-3 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading scheme details...
        </div>
      ) : scheme === null ? (
        <section className="rounded-xl border border-dashed p-10 text-center">
          <h1 className="text-xl font-semibold">Scheme not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This scheme is unavailable or does not belong to your account.
          </p>
        </section>
      ) : (
        <article>
          <header className="pb-8">
            <div className="mb-3 text-sm text-muted-foreground">
              {[scheme.department, scheme.category]
                .filter(Boolean)
                .join(" · ") || "Government scheme"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {scheme.title}
            </h1>
            {scheme.schemeKey.startsWith("demo:nitiassist:") && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Demo data — not verified. All sample benefits, dates,
                  eligibility and instructions are illustrative only.
                </p>
              </div>
            )}
            <div className="mt-4 inline-flex rounded-full bg-muted px-3 py-1 text-sm capitalize">
              Application status: {scheme.applicationStatus ?? "unknown"}
            </div>
          </header>
          <div className="space-y-7">
            <section>
              <h2 className="font-medium">Description</h2>
              <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                {scheme.description || "Not provided by the available sources."}
              </p>
            </section>
            <section className="border-t pt-6">
              <h2 className="font-medium">Benefits and assistance</h2>
              <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                {scheme.benefitDetails ||
                  "Not provided by the available sources."}
              </p>
            </section>
            <ListSection title="Eligibility" items={scheme.eligibility} />
            <ListSection
              title="Required documents"
              items={scheme.requiredDocuments}
            />
            <ListSection
              title="Application steps"
              items={scheme.applicationSteps}
            />
            <section className="border-t pt-6">
              <h2 className="font-medium">Deadline</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {scheme.deadlineText || "No deadline was provided."}
              </p>
            </section>
            {scheme.applicationUrl && (
              <section className="border-t pt-6">
                <a
                  href={scheme.applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  Open official application page
                  <ExternalLink className="size-4" />
                </a>
              </section>
            )}
            <section className="border-t pt-6">
              <h2 className="font-medium">Sources</h2>
              {scheme.sourceUrls.length ? (
                <ul className="mt-3 space-y-2">
                  {scheme.sourceUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm break-all text-primary hover:underline"
                      >
                        {url}
                        <ExternalLink className="ml-1 inline size-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No supporting source links were provided.
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                {scheme.lastVerifiedAt
                  ? "Last verified " +
                    new Date(scheme.lastVerifiedAt).toLocaleDateString()
                  : "Verification date not provided; confirm details with the responsible department."}
              </p>
            </section>
          </div>
        </article>
      )}
    </main>
  )
}
