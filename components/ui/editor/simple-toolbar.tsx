"use client";

/**
 * A fixed toolbar for the simple text editor: always visible above the text,
 * with only the buttons the website builder allowed (rich-text `options.toolbar`).
 * Made for people who have never used a CMS: words next to the icons, big touch
 * targets, and no hidden menus or "/" commands.
 */
import { useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Check,
  ChevronDownIcon,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  MoveVertical,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { ImagePickerHandler, ImagePickerResult } from "./slash-command/suggestion";
import { SPACE_CLASS, type EditorTextStyle } from "./site-extensions";

export const SIMPLE_TOOLBAR_ITEMS = [
  "heading",
  "subheading",
  "bold",
  "italic",
  "underline",
  "bullets",
  "numbers",
  "quote",
  "link",
  "image",
  "line",
  "space",
] as const;

export type SimpleToolbarItem = (typeof SIMPLE_TOOLBAR_ITEMS)[number];

export const cleanToolbar = (toolbar: unknown): SimpleToolbarItem[] | null => {
  if (toolbar === true) return [...SIMPLE_TOOLBAR_ITEMS];
  if (!Array.isArray(toolbar)) return null;
  return SIMPLE_TOOLBAR_ITEMS.filter((item) => toolbar.includes(item));
};

type Props = {
  editor: TiptapEditor;
  items: SimpleToolbarItem[];
  textStyles: EditorTextStyle[];
  disabled?: boolean;
  onRequestImage?: ImagePickerHandler;
  onInsertImageFile?: (file: File) => void;
};

const buttonClass =
  "inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";
const selectClass =
  "h-9 w-full appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base";
const inputClass =
  "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm [@media(pointer:coarse)]:h-11";
const separator = <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />;

// What a client types as a link: an address, a phone number or an email address.
export const normalizeLink = (input: string) => {
  const value = input.trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^\+?[\d\s()-]{6,}$/.test(value)) return `tel:${value.replace(/[^\d+]/g, "")}`;
  return `https://${value}`;
};

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("relative block shrink-0", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={selectClass}
        title={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 opacity-50"
        aria-hidden="true"
      />
    </label>
  );
}

export function SimpleToolbar({ editor, items, textStyles, disabled, onRequestImage, onInsertImageFile }: Props) {
  const has = (item: SimpleToolbarItem) => items.includes(item);
  const [panel, setPanel] = useState<"link" | "alt" | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [altValue, setAltValue] = useState("");
  const panelInputRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 })
        ? "heading"
        : e.isActive("heading", { level: 3 })
          ? "subheading"
          : "paragraph",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullets: e.isActive("bulletList"),
      numbers: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      image: e.isActive("image"),
      style: (e.getAttributes("siteStyle").class as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  useEffect(() => {
    if (panel) requestAnimationFrame(() => panelInputRef.current?.focus());
  }, [panel]);

  useEffect(() => {
    if (panel === "alt" && !state?.image) setPanel(null);
  }, [panel, state?.image]);

  if (!state) return null;

  const blockOptions = [
    { value: "paragraph", label: t("Normal text") },
    ...(has("heading") ? [{ value: "heading", label: t("Subheading") }] : []),
    ...(has("subheading") ? [{ value: "subheading", label: t("Small subheading") }] : []),
  ];

  const setBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === "heading") chain.setHeading({ level: 2 }).run();
    else if (value === "subheading") chain.setHeading({ level: 3 }).run();
    else chain.setParagraph().run();
  };

  // A style applies to the selected words; with nothing selected, to the whole paragraph.
  const setStyle = (className: string) => {
    let chain = editor.chain().focus();
    const { selection } = editor.state;
    if (selection.empty && selection.$from.parent.textContent.length > 0) {
      chain = chain.setTextSelection({ from: selection.$from.start(), to: selection.$from.end() });
    }
    if (className) chain.setMark("siteStyle", { class: className }).run();
    else chain.unsetMark("siteStyle").run();
  };

  const openLink = () => {
    if (panel === "link") return setPanel(null);
    const href = editor.getAttributes("link").href;
    setLinkValue(typeof href === "string" ? href : "");
    setPanel("link");
  };

  const applyLink = () => {
    const href = normalizeLink(linkValue);
    if (!href) return removeLink();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: put the address itself in the text as the link.
      const text = linkValue.trim();
      const { from } = editor.state.selection;
      chain.insertContent(text).setTextSelection({ from, to: from + text.length }).setLink({ href }).run();
      editor.commands.setTextSelection(from + text.length);
    } else {
      chain.setLink({ href }).run();
    }
    setPanel(null);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setPanel(null);
  };

  const openAlt = () => {
    if (panel === "alt") return setPanel(null);
    const alt = editor.getAttributes("image").alt;
    setAltValue(typeof alt === "string" ? alt : "");
    setPanel("alt");
  };

  const applyAlt = () => {
    editor.chain().focus().updateAttributes("image", { alt: altValue.trim() || null }).run();
    setPanel(null);
  };

  const addImage = async () => {
    if (!onRequestImage) return;
    const { from, to } = editor.state.selection;
    const result: ImagePickerResult | null = await onRequestImage({ editor, range: { from, to } });
    if (!result) return;
    if (result.kind === "file") {
      onInsertImageFile?.(result.file);
      return;
    }
    editor
      .chain()
      .focus()
      .setImage({ src: result.src, ...(result.alt ? { alt: result.alt } : {}) })
      .run();
  };

  const button = (
    key: string,
    label: string,
    Icon: LucideIcon,
    onClick: () => void,
    options: { pressed?: boolean; showLabel?: boolean; disabled?: boolean } = {},
  ) => (
    <button
      key={key}
      type="button"
      className={buttonClass}
      onClick={onClick}
      // Clicking a button must not take the cursor out of the text.
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled || options.disabled}
      aria-pressed={options.pressed === undefined ? undefined : options.pressed}
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" aria-hidden="true" />
      {options.showLabel ? <span>{label}</span> : null}
    </button>
  );

  const markButtons = [
    has("bold") && button("bold", t("Bold"), Bold, () => editor.chain().focus().toggleBold().run(), { pressed: state.bold }),
    has("italic") && button("italic", t("Italic"), Italic, () => editor.chain().focus().toggleItalic().run(), { pressed: state.italic }),
    has("underline") && button("underline", t("Underline"), UnderlineIcon, () => editor.chain().focus().toggleUnderline().run(), { pressed: state.underline }),
  ].filter(Boolean);

  const blockButtons = [
    has("bullets") && button("bullets", t("Bulleted list"), List, () => editor.chain().focus().toggleBulletList().run(), { pressed: state.bullets }),
    has("numbers") && button("numbers", t("Numbered list"), ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), { pressed: state.numbers }),
    has("quote") && button("quote", t("Quote"), Quote, () => editor.chain().focus().toggleBlockquote().run(), { pressed: state.quote }),
  ].filter(Boolean);

  const insertButtons = [
    has("link") && button("link", t("Link"), LinkIcon, openLink, { pressed: panel === "link" || state.link, showLabel: true }),
    has("image") && onRequestImage && button("image", t("Photo"), ImageIcon, () => void addImage(), { showLabel: true }),
    has("line") && button("line", t("Line"), Minus, () => editor.chain().focus().setHorizontalRule().run(), { showLabel: true }),
    has("space") &&
      button("space", t("Space"), MoveVertical, () =>
        editor.chain().focus().insertContent({ type: "horizontalRule", attrs: { class: SPACE_CLASS } }).run(),
        { showLabel: true },
      ),
  ].filter(Boolean);

  return (
    <div className="mb-2 space-y-1.5" data-simple-toolbar="">
      <div className="space-y-1 rounded-md border bg-muted/40 p-1">
        {blockOptions.length > 1 || textStyles.length > 0 ? (
          <div className="flex items-center gap-1">
            {blockOptions.length > 1 ? (
              <Select
                label={t("Kind of text")}
                value={state.block}
                onChange={setBlock}
                options={blockOptions}
                disabled={disabled}
                className="min-w-0 flex-1 sm:w-44 sm:flex-none"
              />
            ) : null}
            {textStyles.length > 0 ? (
              <Select
                label={t("Font")}
                value={textStyles.some((style) => style.class === state.style) ? state.style : ""}
                onChange={setStyle}
                options={[
                  { value: "", label: t("Normal font") },
                  ...textStyles.map((style) => ({ value: style.class, label: style.label })),
                ]}
                disabled={disabled}
                className="min-w-0 flex-1 sm:w-44 sm:flex-none"
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {markButtons}
          {markButtons.length > 0 && blockButtons.length > 0 ? separator : null}
          {blockButtons}
          {markButtons.length + blockButtons.length > 0 && insertButtons.length > 0 ? separator : null}
          {insertButtons}
          {state.image
            ? button("alt", t("Describe photo"), ImageIcon, openAlt, { pressed: panel === "alt", showLabel: true })
            : null}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {button("undo", t("Undo"), Undo2, () => editor.chain().focus().undo().run(), { disabled: !state.canUndo })}
            {button("redo", t("Redo"), Redo2, () => editor.chain().focus().redo().run(), { disabled: !state.canRedo })}
          </span>
        </div>
      </div>

      {panel === "link" ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 p-1.5">
          <input
            ref={panelInputRef}
            className={inputClass}
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                applyLink();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            placeholder={t("Web address, email address or phone number")}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            disabled={disabled}
          />
          {button("apply-link", t("Done"), Check, applyLink, { showLabel: true })}
          {state.link ? button("remove-link", t("Remove link"), X, removeLink, { showLabel: true }) : button("close-link", t("Cancel"), X, () => setPanel(null))}
        </div>
      ) : null}

      {panel === "alt" && state.image ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 p-1.5">
          <input
            ref={panelInputRef}
            className={inputClass}
            value={altValue}
            onChange={(event) => setAltValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                applyAlt();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            placeholder={t("What is in the photo?")}
            disabled={disabled}
          />
          {button("apply-alt", t("Done"), Check, applyAlt, { showLabel: true })}
        </div>
      ) : null}
    </div>
  );
}
