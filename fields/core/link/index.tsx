import { z } from "zod";
import { Field } from "@/types/field";
import { EditComponent } from "./edit-component";

// Webstudio: where a button, photo or card goes. A page of the site picked by
// name (stored as "pagina:..."), or another address. See lib/site-pages.ts.
const schema = (field: Field) => {
  let zodSchema = z.string();
  if (field.required) zodSchema = zodSchema.min(1, "This field is required");
  return zodSchema;
};

const label = "Link";
const defaultValue = "";

export { label, schema, defaultValue, EditComponent };
