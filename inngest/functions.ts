import { inngest } from "./client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { createAgent, openai } from "@inngest/agent-kit";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);