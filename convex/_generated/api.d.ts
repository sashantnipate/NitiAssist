/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dashboardSchemes from "../dashboardSchemes.js";
import type * as documents from "../documents.js";
import type * as messages from "../messages.js";
import type * as userProfiles from "../userProfiles.js";
import type * as verifyAuth from "../verifyAuth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  conversations: typeof conversations;
  crons: typeof crons;
  dashboardSchemes: typeof dashboardSchemes;
  documents: typeof documents;
  messages: typeof messages;
  userProfiles: typeof userProfiles;
  verifyAuth: typeof verifyAuth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
