import { z } from "zod";
import { Field } from "@/types/field";
import { planningTime } from "@/lib/planning-shared";
import { EditComponent } from "./edit-component";
import { ViewComponent } from "./view-component";

/**
 * Webstudio: "Inplannen". Online vanaf / Offline na for a block, item or page.
 *
 *   - { name: planning, label: Inplannen, type: planning }
 *
 * Empty = always on the website. See lib/planning-shared.ts.
 */

const time = z.string().optional().nullable()
  .refine((value) => !value || planningTime(value) !== null, "Invalid date");

const schema = (_field: Field) => z.union([
  z.literal(""),
  z.object({ vanaf: time, tot: time }).refine((value) => {
    const from = planningTime(value.vanaf);
    const until = planningTime(value.tot, true);
    return !from || !until || until.getTime() > from.getTime();
  }, "Offline must come after online."),
]).nullable().optional();

// Only what is filled in is saved; nothing filled in = "".
const write = (value: any) => {
  if (!value || typeof value !== "object") return "";
  const result: Record<string, string> = {};
  if (typeof value.vanaf === "string" && value.vanaf) result.vanaf = value.vanaf;
  if (typeof value.tot === "string" && value.tot) result.tot = value.tot;
  return Object.keys(result).length ? result : "";
};

const defaultValue = "";
const label = "Planning";

export { label, schema, write, defaultValue, EditComponent, ViewComponent };
