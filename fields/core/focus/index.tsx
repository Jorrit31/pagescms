import { z } from "zod";
import { Field } from "@/types/field";
import { EditComponent } from "./edit-component";

/**
 * Webstudio: focal point of a photo ("x% y%", for CSS object-position).
 *
 *   - { name: foto, type: image }
 *   - { name: focus, type: focus, options: { image: foto } }   # image = name of the photo field next to it (default "foto")
 *
 * The client taps the important part of the photo; the website keeps that part
 * in view when the photo is cropped (phone, wide banner, square card).
 */

export const FOCUS_PATTERN = /^(100|\d{1,2})% (100|\d{1,2})%$/;

const schema = (_field: Field) => z.union([z.literal(""), z.string().regex(FOCUS_PATTERN, "Invalid focal point")]).nullable().optional();

const defaultValue = "";
const label = "Focus";

export { label, schema, defaultValue, EditComponent };
