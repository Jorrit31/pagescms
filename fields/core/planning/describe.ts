import { planningState, type PlanningState } from "@/lib/planning-shared";
import { t, uiLanguage } from "@/lib/i18n";

/** "vrijdag 5 december om 09:00" (with the year when it is not this year). */
export const formatPlanningTime = (date: Date, now = new Date()) => {
  const locale = uiLanguage === "nl" ? "nl-NL" : "en-GB";
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  return t("{day} at {time}", { day, time });
};

export type PlanningSummary = { state: PlanningState["state"]; text: string };

export const describePlanning = (value: unknown, now = new Date()): PlanningSummary => {
  const result = planningState(value, now);
  const at = (date: Date) => formatPlanningTime(date, now);
  switch (result.state) {
    case "always":
      return { state: result.state, text: t("Always on the website.") };
    case "invalid":
      return { state: result.state, text: t("Offline must come after online.") };
    case "ended":
      return { state: result.state, text: t("Not on the website anymore since {time}.", { time: at(result.until) }) };
    case "waiting":
      return {
        state: result.state,
        text: result.until
          ? t("Not on the website yet. Goes online on {from} and offline again on {until}.", { from: at(result.from), until: at(result.until) })
          : t("Not on the website yet. Goes online on {from}.", { from: at(result.from) }),
      };
    case "online":
      return {
        state: result.state,
        text: result.until
          ? t("On the website until {until}.", { until: at(result.until) })
          : t("On the website."),
      };
  }
};
