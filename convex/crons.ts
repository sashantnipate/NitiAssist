import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "delete expired dashboard schemes",
  { hourUTC: 3, minuteUTC: 15 },
  internal.dashboardSchemes.deleteExpired
);

export default crons;
