import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useUserProfile(enabled = true) {
  return useQuery(api.userProfiles.getMine, enabled ? {} : "skip");
}
