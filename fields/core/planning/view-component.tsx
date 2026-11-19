"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { planningState } from "@/lib/planning-shared";
import { t } from "@/lib/i18n";
import { formatPlanningTime } from "./describe";

/** In lists: a small "Ingepland" / "Offline" badge, nothing when it is simply online. */
const ViewComponent = ({ value }: { value: unknown }) => {
  // Depends on the clock and time zone: only in the browser.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;
  const result = planningState(value, now);
  if (result.state === "always" || (result.state === "online" && !result.until)) return null;
  const label = result.state === "waiting"
    ? t("Online from {time}", { time: formatPlanningTime(result.from, now) })
    : result.state === "online"
      ? t("Online until {time}", { time: formatPlanningTime(result.until!, now) })
      : result.state === "ended"
        ? t("Offline")
        : t("Check the dates");
  return (
    <Badge variant="secondary">
      <CalendarClock />
      {label}
    </Badge>
  );
};

export { ViewComponent };
