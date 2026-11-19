/**
 * Webstudio: the "Logboek" (who changed what, when), shared by server, browser
 * and the monthly report mail. Rows are written by lib/activity.ts.
 *
 * A row becomes a plain sentence such as "Jolande wijzigde Openingstijden",
 * with a time like "gisteren 14:02".
 */

import { t, uiLanguage } from "@/lib/i18n";

/** Name used in collaborator permissions for "may see the Logboek". */
export const ACTIVITY_PERMISSION = "_logboek";

export type ActivityAction = "create" | "update" | "delete" | "rename" | "upload" | "publish" | "settings";

export type ActivityEntry = {
  id: number;
  branch: string;
  userName: string | null;
  userEmail: string | null;
  action: ActivityAction | string;
  label: string | null;
  title: string | null;
  path: string | null;
  createdAt: string;
};

const TIME_ZONE = "Europe/Amsterdam";
const locale = () => (uiLanguage === "nl" ? "nl-NL" : "en-GB");

/** "Jolande", also when only an e-mail address is known ("jolande@..." -> "Jolande"). */
export const personName = (entry: Pick<ActivityEntry, "userName" | "userEmail">) => {
  const name = entry.userName?.trim();
  if (name && !name.includes("@")) return name.split(/\s+/)[0];
  const email = (name || entry.userEmail || "").trim();
  if (!email) return t("Someone");
  const local = email.split("@")[0].split(/[._+-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : email;
};

/** "Nieuws › Kerstbrood", "Openingstijden" or "kerst.jpg". */
export const activitySubject = (entry: Pick<ActivityEntry, "label" | "title">) => {
  const label = entry.label?.trim();
  const title = entry.title?.trim();
  if (label && title && title.toLowerCase() !== label.toLowerCase()) return `${label} › ${title}`;
  return label || title || t("a page");
};

/** "Jolande wijzigde Openingstijden" */
export const describeActivity = (entry: Pick<ActivityEntry, "userName" | "userEmail" | "action" | "label" | "title">) => {
  const who = personName(entry);
  const what = activitySubject(entry);
  switch (entry.action) {
    case "create": return t("{who} added {what}", { who, what });
    case "delete": return t("{who} removed {what}", { who, what });
    case "rename": return t("{who} renamed {what}", { who, what });
    case "upload": return entry.label && entry.title
      ? t("{who} added the photo {title} to {label}", { who, title: entry.title, label: entry.label })
      : t("{who} added a photo", { who });
    case "publish": return t("{who} put the changes online", { who });
    case "settings": return t("{who} changed the settings", { who });
    default: return t("{who} changed {what}", { who, what });
  }
};

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** "vandaag 14:02", "gisteren 14:02", "ma 16 nov 14:02", "16 nov 2025 14:02". */
export const formatActivityTime = (value: string | Date, now = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(locale(), { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const day = dayKey(date);
  if (day === dayKey(now)) return t("today {time}", { time });
  if (day === dayKey(new Date(now.getTime() - 86_400_000))) return t("yesterday {time}", { time });
  const sameYear = day.slice(0, 4) === dayKey(now).slice(0, 4);
  const recent = now.getTime() - date.getTime() < 6 * 86_400_000;
  const dayText = date.toLocaleDateString(locale(), {
    timeZone: TIME_ZONE,
    ...(recent ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${dayText} ${time}`;
};

/** Heading for a group of entries: "Vandaag", "Gisteren", "maandag 16 november". */
export const activityDayHeading = (value: string | Date, now = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const day = dayKey(date);
  if (day === dayKey(now)) return t("Today");
  if (day === dayKey(new Date(now.getTime() - 86_400_000))) return t("Yesterday");
  const sameYear = day.slice(0, 4) === dayKey(now).slice(0, 4);
  return date.toLocaleDateString(locale(), { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
};

export const activityDayKey = (value: string | Date) => dayKey(value instanceof Date ? value : new Date(value));
