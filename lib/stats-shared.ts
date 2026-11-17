/**
 * Webstudio: visitor statistics, shared by server and browser.
 * See lib/stats.ts for how counting works.
 */

/** Name used in collaborator permissions for "may see Bezoekers". */
export const STATS_PERMISSION = "_bezoekers";

export type StatsRow = { label: string; count: number };

export type SiteStats = {
  days: number;
  visitors: number;
  views: number;
  previousVisitors: number;
  previousViews: number;
  /** One entry per day, oldest first (YYYY-MM-DD in Dutch time). */
  perDay: { day: string; visitors: number; views: number }[];
  pages: StatsRow[];
  sources: StatsRow[];
  devices: StatsRow[];
};
