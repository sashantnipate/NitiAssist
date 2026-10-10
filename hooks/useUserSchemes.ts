import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useUserSchemes() {
  return useQuery(api.dashboardSchemes.listMine);
}

export function useUserScheme(schemeId: Id<"dashboardSchemes"> | null) {
  return useQuery(api.dashboardSchemes.getMine, schemeId ? { schemeId } : "skip");
}
