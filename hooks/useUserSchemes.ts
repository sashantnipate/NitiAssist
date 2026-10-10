import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
export function useUserSchemes() {
  return useQuery(api.userSchemes.listMine)
}
export function useLatestSchemeDiscovery() {
  return useQuery(api.userSchemes.latestDiscovery)
}
export function useUserScheme(schemeId: Id<"userSchemes"> | null) {
  return useQuery(api.userSchemes.getMine, schemeId ? { schemeId } : "skip")
}
