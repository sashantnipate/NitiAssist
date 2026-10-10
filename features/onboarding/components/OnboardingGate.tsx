"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useUserProfile } from "@/hooks/useUserProfile";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useUserProfile(isLoaded && Boolean(isSignedIn));
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || profile === undefined) return;
    const completed = Boolean(profile?.onboardingCompletedAt);
    if (!completed && pathname !== "/user-onboard") router.replace("/user-onboard");
    if (completed && pathname === "/user-onboard") router.replace("/dashboard");
  }, [isLoaded, isSignedIn, pathname, profile, router]);

  if (!isLoaded || (isSignedIn && profile === undefined)) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading your profile…</div>;
  }
  if (isSignedIn && profile === null && pathname !== "/user-onboard") return null;
  if (isSignedIn && !profile?.onboardingCompletedAt && pathname !== "/user-onboard") return null;
  if (isSignedIn && profile?.onboardingCompletedAt && pathname === "/user-onboard") return null;
  return children;
}
