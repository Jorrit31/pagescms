"use client";

/**
 * Webstudio: a small question mark next to a field's name. Tapping it shows one
 * or two short sentences in plain words about how that kind of field works.
 *
 * It only shows when the website builder wrote no `description` for the field
 * (that text is already shown under the field) and when there is something
 * useful to say. A plain one-line text box needs no explanation.
 */

import { CircleHelp } from "lucide-react";
import type { Field } from "@/types/field";
import { uiLanguage } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Lang = "nl" | "en";

const tips: Record<Lang, Record<string, string>> = {
  nl: {
    alt: "Schrijf in een paar woorden wat er op de foto staat, bijvoorbeeld: Rode rozen in een glazen vaas. Dat helpt blinde bezoekers en Google.",
    image: "Kies onder de foto een andere: een nieuwe van je telefoon of computer, of een foto die al op je site staat. Grote foto's maken we vanzelf kleiner.",
    images: "Tik op het plusje om foto's toe te voegen. Sleep een foto om de volgorde te veranderen.",
    "rich-text": "Typ je tekst. Selecteer een paar woorden en kies bovenaan bijvoorbeeld vet, een kopje of een link.",
    date: "Tik op het vakje en kies een dag in de kalender.",
    boolean: "Tik op het schuifje om dit aan of uit te zetten.",
    select: "Tik op het vakje en kies er een uit de lijst.",
    link: "Kies een pagina van je eigen website, of plak een webadres.",
    number: "Typ alleen een getal, zonder euroteken of andere tekens.",
    file: "Kies een bestand, bijvoorbeeld een pdf met je prijslijst.",
    reference: "Tik op het vakje en kies er een uit de lijst.",
    focus: "Tik op het belangrijkste stukje van de foto. Dat blijft altijd in beeld, ook als de foto op een telefoon wordt bijgesneden.",
    list: "Met Toevoegen maak je er een bij. Met de pijltjes of door te slepen verander je de volgorde.",
  },
  en: {
    alt: "Describe the photo in a few words, for example: Red roses in a glass vase. It helps blind visitors and Google.",
    image: "Pick another photo below it: a new one from your phone or computer, or one already on your site. Large photos are made smaller automatically.",
    images: "Tap the plus to add photos. Drag a photo to change the order.",
    "rich-text": "Type your text. Select a few words and pick bold, a heading or a link at the top.",
    date: "Tap the box and pick a day in the calendar.",
    boolean: "Tap the switch to turn this on or off.",
    select: "Tap the box and pick one from the list.",
    link: "Pick a page of your own website, or paste a web address.",
    number: "Type a number only, without a currency sign.",
    file: "Pick a file, for example a PDF with your price list.",
    reference: "Tap the box and pick one from the list.",
    focus: "Tap the most important part of the photo. It stays in view, even when the photo is cropped on a phone.",
    list: "Use Add to make another one. Use the arrows or drag to change the order.",
  },
};

const ui: Record<Lang, { more: string }> = {
  nl: { more: "Uitleg bij {label}" },
  en: { more: "Help for {label}" },
};

const lang = (): Lang => (uiLanguage === "en" ? "en" : "nl");

// A text box for a photo description, recognised by its name or label.
const isPhotoDescription = (field: Field) => {
  if (field.type !== "string" && field.type !== "text") return false;
  const name = String(field.name || "").toLowerCase();
  const label = typeof field.label === "string" ? field.label.toLowerCase() : "";
  return name === "alt" || /\balt\b|omschrijving van de foto|fotobeschrijving|beschrijving van de foto|alternative text/.test(label);
};

/** The tip for a field, or null when the field needs none. */
export function fieldTip(field: Field): string | null {
  if (!field || field.description || field.hidden) return null;
  if ((field.options as any)?.tip === false) return null;
  const list = tips[lang()];
  if (isPhotoDescription(field)) return list.alt;
  const type = String(field.type);
  if (field.list) {
    if (type === "image") return list.images;
    if (type === "object" || type === "block" || type === "string" || type === "text") return list.list;
  }
  return list[type] ?? null;
}

export function FieldTip({ field }: { field: Field }) {
  const tip = fieldTip(field);
  if (!tip) return null;
  const name = typeof field.label === "string" ? field.label : field.name;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-field-tip=""
          aria-label={ui[lang()].more.replace("{label}", String(name ?? ""))}
          className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-primary"
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-auto max-w-[min(20rem,calc(100vw-1.5rem))] p-3 text-sm leading-relaxed"
      >
        {tip}
      </PopoverContent>
    </Popover>
  );
}
