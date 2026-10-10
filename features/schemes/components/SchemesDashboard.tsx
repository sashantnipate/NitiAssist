"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, LoaderCircle, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUserSchemes } from "@/hooks/useUserSchemes";
import { useUserProfile } from "@/hooks/useUserProfile";
import { startSchemeDiscovery } from "@/features/schemes/actions/startDiscovery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageResponse } from "@/components/ai-elements/message";

export function SchemesDashboard() {
  const schemes = useUserSchemes();
  const profile = useUserProfile();
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState(false);
  const loading = schemes === undefined || profile === undefined;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (schemes ?? []).filter((scheme) => !query || scheme.title.toLocaleLowerCase().includes(query) || scheme.description.toLocaleLowerCase().includes(query));
  }, [schemes, search]);

  async function retryDiscovery() {
    setRetrying(true);
    try {
      await startSchemeDiscovery();
      toast.success("Scheme search started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start scheme search.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-9 md:px-8 lg:py-11">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary">YOUR OPPORTUNITIES</p>
          <h1 className="text-3xl font-semibold tracking-tight">Schemes for You</h1>
          <p className="mt-2 text-sm text-muted-foreground">Relevant government support based on your profile and documents.</p>
        </div>
        {!loading ? <div className="rounded-xl border bg-card px-4 py-2.5"><span className="text-2xl font-semibold tabular-nums">{schemes.length}</span><span className="ml-2 text-sm text-muted-foreground">of up to 20 schemes</span></div> : null}
      </header>

      {profile?.discoveryStatus === "queued" || profile?.discoveryStatus === "running" ? (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <LoaderCircle className="size-4 animate-spin text-primary" /> Searching official sources for schemes that fit your profile…
        </div>
      ) : null}
      {profile?.discoveryStatus === "failed" ? (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span>Scheme search did not finish. {profile.discoveryError || "Please try again."}</span>
          <Button disabled={retrying} onClick={() => void retryDiscovery()} size="sm" variant="outline">{retrying ? "Starting…" : "Retry search"}</Button>
        </div>
      ) : null}

      {schemes?.length ? (
        <section aria-label="Schemes for you">
          <label className="relative mb-5 block max-w-xl">
            <Search aria-hidden="true" className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input aria-label="Search schemes" className="pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Search schemes" value={search} />
          </label>
          {filtered.length ? (
            <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((scheme) => (
                <Card key={scheme._id} className="flex h-full min-h-[330px] flex-col overflow-hidden rounded-xl border border-border/80 shadow-none">
                  {scheme.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-40 w-full object-cover" loading="lazy" src={scheme.imageUrl} />
                  ) : <div aria-hidden="true" className="flex h-40 items-center justify-center bg-muted text-primary"><Sparkles className="size-8" /></div>}
                  <CardHeader className="pb-2"><CardTitle className="line-clamp-2 text-base leading-6">{scheme.title}</CardTitle></CardHeader>
                  <CardContent className="flex flex-1 flex-col pt-1">
                    <MessageResponse className="text-sm leading-6 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2">{scheme.description}</MessageResponse>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                      <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={`/schemes/${scheme._id}`}>Details <ArrowRight className="size-4" /></Link>
                      <a className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" href={scheme.websiteUrl} rel="noreferrer" target="_blank">Official website <ExternalLink className="size-3.5" /></a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No schemes match that search.</p>
          )}
        </section>
      ) : loading ? (
        <div aria-label="Loading schemes" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="h-[330px] animate-pulse rounded-xl border bg-muted/50" key={index} />)}</div>
      ) : (
        <section className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
          <h2 className="text-lg font-semibold">Your scheme matches will appear here</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">We search for current central and {profile?.state ? `${profile.state} ` : "state-specific "}schemes using your profile and ready documents.</p>
          {profile?.discoveryStatus === "completed" ? <Button className="mt-5" disabled={retrying} onClick={() => void retryDiscovery()}>{retrying ? "Starting…" : "Search again"}</Button> : null}
        </section>
      )}
    </main>
  );
}
