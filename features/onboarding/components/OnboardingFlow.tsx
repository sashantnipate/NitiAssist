"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Library } from "@/features/chat/components/Library";
import { startSchemeDiscovery } from "@/features/schemes/actions/startDiscovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ageRanges = ["Under 18", "18-25", "26-35", "36-45", "46-60", "Over 60"];
const workTypes = ["Student", "Salaried", "Self-employed", "Business owner", "Farmer", "Unemployed", "Other"];

export function OnboardingFlow() {
  const profile = useUserProfile();
  const saveInfo = useMutation(api.userProfiles.saveOnboardingInfo);
  const completeOnboarding = useMutation(api.userProfiles.completeOnboarding);
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [workType, setWorkType] = useState("");
  const [income, setIncome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setState(profile.state ?? "");
    setAgeRange(profile.ageRange ?? "");
    setWorkType(profile.workType ?? "");
    setIncome(profile.annualHouseholdIncome?.toString() ?? "");
    if (profile.state && profile.ageRange && profile.workType && profile.annualHouseholdIncome !== undefined) setStep(2);
  }, [profile]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const annualHouseholdIncome = Number(income);
    if (!Number.isFinite(annualHouseholdIncome) || annualHouseholdIncome < 0) {
      toast.error("Enter a valid annual household income.");
      return;
    }
    setBusy(true);
    try {
      await saveInfo({ state, ageRange, workType, annualHouseholdIncome });
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your information.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await completeOnboarding({});
      try {
        await startSchemeDiscovery();
      } catch {
        toast.error("Your profile is saved, but scheme search did not start. You can retry from the dashboard.");
      }
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish onboarding.");
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-muted-foreground">Loading your profile...</div>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary">GET STARTED</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Find support that fits you</h1>
        <p className="mt-2 text-sm text-muted-foreground">A few details help us find relevant government schemes. You can add documents now or skip this step.</p>
        <div aria-label={`Step ${step} of 2`} className="mt-6 flex gap-2">
          <span className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      {step === 1 ? (
        <form className="mx-auto mt-8 max-w-2xl space-y-5 rounded-xl border bg-card p-5 sm:p-7" onSubmit={saveProfile}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="onboard-state">State or union territory</label>
            <Input id="onboard-state" autoComplete="address-level1" onChange={(event) => setState(event.target.value)} placeholder="e.g. Maharashtra" required value={state} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="onboard-age">Age range</label>
            <select id="onboard-age" className="h-10 w-full rounded-md border bg-background px-3 text-sm" onChange={(event) => setAgeRange(event.target.value)} required value={ageRange}>
              <option value="">Choose an age range</option>
              {ageRanges.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="onboard-work">Work type</label>
            <select id="onboard-work" className="h-10 w-full rounded-md border bg-background px-3 text-sm" onChange={(event) => setWorkType(event.target.value)} required value={workType}>
              <option value="">Choose what best describes you</option>
              {workTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="onboard-income">Annual household income (INR)</label>
            <Input id="onboard-income" inputMode="numeric" min="0" onChange={(event) => setIncome(event.target.value)} placeholder="e.g. 300000" required type="number" value={income} />
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={busy} type="submit">{busy ? "Saving..." : "Continue"}</Button>
          </div>
        </form>
      ) : (
        <div className="mt-8 rounded-xl border bg-card p-3 sm:p-5">
          <Library showUploadButton />
          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t px-4 pt-5">
            <Button disabled={busy} onClick={() => setStep(1)} variant="ghost">Back</Button>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void finish()} variant="outline">Skip for now</Button>
              <Button disabled={busy} onClick={() => void finish()}>{busy ? "Finishing..." : "Finish and find schemes"}</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
