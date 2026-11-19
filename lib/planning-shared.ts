/**
 * Webstudio: "Inplannen" (schedule). A block, item or page with a planning
 * field only shows on the website between "Online vanaf" and "Offline na".
 *
 *   - { name: planning, label: Inplannen, type: planning }
 *
 * Value: { vanaf?: "2026-12-05T09:00+01:00", tot?: "2026-12-26T23:59+01:00" }.
 * The editor writes times with the offset of the client's own clock. Times
 * without an offset (typed by hand) count as Dutch time (Europe/Amsterdam).
 * The website's build.js leaves out what is not online at that moment, and the
 * CMS rebuilds the site at each of these times (lib/planning.ts).
 *
 * Shared by the browser (field) and the server (webhook, cron).
 */

export type Planning = { vanaf?: string; tot?: string };

export const PLANNING_TIME_ZONE = "Europe/Amsterdam";

export const isPlanning = (value: unknown): value is Planning => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length || !keys.every((key) => key === "vanaf" || key === "tot")) return false;
  return keys.every((key) => {
    const item = (value as Record<string, unknown>)[key];
    return item == null || typeof item === "string";
  });
};

/** Minutes the time zone is ahead of UTC at this moment. */
const zoneOffsetMinutes = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((local - Math.floor(date.getTime() / 60000) * 60000) / 60000);
};

/**
 * "2026-12-05T09:00+01:00" -> that moment. "2026-12-05T09:00" -> 09:00 Dutch time.
 * "2026-12-05" -> the start of that day, or the end of it for "Offline na".
 */
export const planningTime = (value: unknown, end = false, timeZone = PLANNING_TIME_ZONE): Date | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(text);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, zone] = match;
  if (zone) {
    const time = Date.parse(text.replace(" ", "T"));
    return Number.isNaN(time) ? null : new Date(time);
  }
  const dateOnly = h === undefined;
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d) + (dateOnly && end ? 1 : 0), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0));
  if (Number.isNaN(guess)) return null;
  let time = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  const corrected = guess - zoneOffsetMinutes(new Date(time), timeZone) * 60000;
  if (corrected !== time) time = corrected;
  return new Date(time);
};

export type PlanningState =
  | { state: "always" }
  | { state: "waiting"; from: Date; until: Date | null }
  | { state: "online"; from: Date | null; until: Date | null }
  | { state: "ended"; until: Date }
  | { state: "invalid"; from: Date; until: Date };

export const planningState = (planning: unknown, now = new Date()): PlanningState => {
  if (!isPlanning(planning)) return { state: "always" };
  const from = planningTime(planning.vanaf);
  const until = planningTime(planning.tot, true);
  if (!from && !until) return { state: "always" };
  if (from && until && until.getTime() <= from.getTime()) return { state: "invalid", from, until };
  if (until && now.getTime() >= until.getTime()) return { state: "ended", until };
  if (from && now.getTime() < from.getTime()) return { state: "waiting", from, until };
  return { state: "online", from, until };
};

/** Every planning field in a file, at any depth. */
export const findPlannings = (data: unknown): Planning[] => {
  const found: Planning[] = [];
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 30) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      if (isPlanning(item)) found.push(item);
      else walk(item, depth + 1);
    }
  };
  walk(data, 0);
  return found;
};

/** The moments after `now` at which the website has to be built again for this file. */
export const upcomingPlanningTimes = (data: unknown, now = new Date()): Date[] => {
  const times = new Map<number, Date>();
  for (const planning of findPlannings(data)) {
    for (const time of [planningTime(planning.vanaf), planningTime(planning.tot, true)]) {
      if (time && time.getTime() > now.getTime()) times.set(time.getTime(), time);
    }
  }
  return [...times.values()].sort((a, b) => a.getTime() - b.getTime());
};
