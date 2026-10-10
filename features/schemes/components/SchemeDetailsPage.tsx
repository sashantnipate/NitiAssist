"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle } from "lucide-react";
import { useUserScheme } from "@/hooks/useUserSchemes";
import type { Id } from "@/convex/_generated/dataModel";
import { MessageResponse } from "@/components/ai-elements/message";

export default function SchemeDetailsPage() {
  const params = useParams<{ schemeId: string }>();
  const scheme = useUserScheme(params.schemeId as Id<"dashboardSchemes">);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 md:px-10">
      <Link className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" href="/dashboard">
        <ArrowLeft className="size-4" /> Back to schemes
      </Link>
      {scheme === undefined ? (
        <div className="flex items-center gap-3 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading scheme…</div>
      ) : scheme === null ? (
        <section className="rounded-xl border border-dashed p-10 text-center">
          <h1 className="text-xl font-semibold">Scheme not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This scheme is unavailable or does not belong to your account.</p>
        </section>
      ) : (
        <article>
          {scheme.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="mb-8 max-h-96 w-full rounded-xl object-cover" src={scheme.imageUrl} />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight">{scheme.title}</h1>
          <MessageResponse className="mt-5 text-sm leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_ol]:my-3 [&_p]:my-3 [&_ul]:my-3">{scheme.description}</MessageResponse>
          <a className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" href={scheme.websiteUrl} rel="noreferrer" target="_blank">
            Visit official website <ExternalLink className="size-4" />
          </a>
        </article>
      )}
    </main>
  );
}
