import { api } from "../../../../convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";

export type UserContext = {
  profile: {
    state?: string;
    ageRange?: string;
    workType?: string;
    annualHouseholdIncome?: number;
  };
  documents: Array<{ id: string; filename: string; description: string; mimeType: string }>;
  pendingDocumentCount: number;
};

type StepRunner = {
  run(name: string, fn: () => Promise<unknown>): Promise<unknown>;
};

type UserContextOptions = {
  convex: ConvexHttpClient;
  ownerId: string;
  serviceSecret: string;
  step: StepRunner;
  attempt?: number;
};

export function getUserContext({ convex, ownerId, serviceSecret, step, attempt = -1 }: UserContextOptions) {
  const name = attempt < 0 ? "load-user-context" : `refresh-user-context-${attempt}`;
  return step.run(name, () => convex.query(api.userProfiles.getContextForDiscovery, { ownerId, serviceSecret })) as Promise<UserContext>;
}
