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
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns2,
  Heading,
  Plus,
  RectangleHorizontal,
  Rows2,
  Trash2,
  Check,
  ChevronDownIcon,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
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
import {
  BUTTON_CLASS,
  PHOTO_PLACES,
  SPACE_CLASS,
  videoEmbedUrl,
  type AlignClass,
  type EditorTextStyle,
} from "./site-extensions";
import { SitePageSelect } from "@/components/site-page-select";
import { isPageLink, normalizeLink, type SitePage } from "@/lib/site-pages";

export const SIMPLE_TOOLBAR_ITEMS = [
  "heading",
  "subheading",
  "bold",
  "italic",
  "underline",
  "bullets",
  "numbers",
  "quote",
  "align",
  "link",
  "button",
  "image",
  "video",
  "table",
  "line",
  "space",
] as const;

export type SimpleToolbarItem = (typeof SIMPLE_TOOLBAR_ITEMS)[number];

// Webstudio: every client gets the simple editor with all buttons, unless the site
// lists its own buttons or turns it off with `toolbar: false` (then: the original editor).
export const cleanToolbar = (toolbar: unknown): SimpleToolbarItem[] | null => {
  if (toolbar === false) return null;
  if (toolbar === true || toolbar == null) return [...SIMPLE_TOOLBAR_ITEMS];
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
  /** Pages of the site the client can link to by name. */
  pages?: SitePage[];
};

const buttonClass =
  "inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";
const selectClass =
  "h-9 w-full appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base";
const inputClass =
  "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm [@media(pointer:coarse)]:h-11";
const separator = <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />;

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

export function SimpleToolbar({
  editor,
  items,
  textStyles,
  disabled,
  onRequestImage,
  onInsertImageFile,
  pages = [],
}: Props) {
  const has = (item: SimpleToolbarItem) => items.includes(item);
  const [panel, setPanel] = useState<"link" | "alt" | "video" | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [linkText, setLinkText] = useState("");
  const [asButton, setAsButton] = useState(false);
  const [altValue, setAltValue] = useState("");
  const [videoValue, setVideoValue] = useState("");
  const [videoError, setVideoError] = useState(false);
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
      align: ((e.isActive("heading") ? e.getAttributes("heading").align : e.getAttributes("paragraph").align) ??
        "") as string,
      link: e.isActive("link"),
      button: e.isActive("link", { class: BUTTON_CLASS }),
      empty: e.state.selection.empty,
      image: e.isActive("image"),
      imageHref: e.isActive("image") ? ((e.getAttributes("image").href as string | null | undefined) ?? "") : "",
      imagePlace: e.isActive("image") ? ((e.getAttributes("image").place as string | null | undefined) ?? "") : "",
      video: e.isActive("siteVideo"),
      table: e.isActive("table"),
      style: (e.getAttributes("siteStyle").class as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  useEffect(() => {
    // With a page list, don't open the keyboard on a phone: most people pick a page.
    if (panel && !(panel === "link" && pages.length > 0)) requestAnimationFrame(() => panelInputRef.current?.focus());
  }, [panel, pages.length]);

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

  const setAlign = (align: AlignClass | null) => editor.chain().focus().setAlign(align).run();

  const linkAllowed = has("link") || has("button");

  const openLink = (button = false) => {
    if (panel === "link" && asButton === button) return setPanel(null);
    const onImage = editor.isActive("image");
    const href = onImage ? editor.getAttributes("image").href : editor.getAttributes("link").href;
    setLinkValue(typeof href === "string" ? href : "");
    setLinkText("");
    setAsButton(onImage ? false : button || editor.isActive("link", { class: BUTTON_CLASS }));
    setPanel("link");
  };

  // A page picked from the list: its name becomes the text when nothing is selected.
  const applyLink = (picked?: string) => {
    const href = picked ?? normalizeLink(linkValue);
    if (!href) return removeLink();
    if (editor.isActive("image")) {
      // A photo in the text links as a whole.
      editor.chain().focus().updateAttributes("image", { href }).run();
      setPanel(null);
      return;
    }
    const attrs = { href, class: asButton ? BUTTON_CLASS : null };
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: the typed text, else the page name or the address itself, becomes the link.
      const text =
        linkText.trim() ||
        (picked || isPageLink(href) ? (pages.find((page) => page.value === href)?.label ?? href) : linkValue.trim());
      const { from } = editor.state.selection;
      chain
        .insertContent(text)
        .setTextSelection({ from, to: from + text.length })
        .setLink(attrs)
        .run();
      editor.chain().setTextSelection(from + text.length).unsetMark("link").run();
    } else {
      chain.setLink(attrs).run();
    }
    setPanel(null);
  };

  const removeLink = () => {
    if (editor.isActive("image")) editor.chain().focus().updateAttributes("image", { href: null }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
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

  const openVideo = () => {
    setVideoValue("");
    setVideoError(false);
    setPanel(panel === "video" ? null : "video");
  };

  const applyVideo = () => {
    if (!videoEmbedUrl(videoValue)) return setVideoError(true);
    editor.chain().focus().setVideo(videoValue).run();
    setPanel(null);
  };

  // Like the line, but marked as empty space. The cursor goes on below it, so typing can't replace it.
  const insertSpace = () =>
    editor
      .chain()
      .focus()
      .setHorizontalRule()
      .command(({ tr }) => {
        const $from = tr.selection.$from;
        const start = $from.depth > 0 ? $from.before($from.depth) : $from.pos;
        const rule = tr.doc.resolve(start).nodeBefore;
        if (rule?.type.name === "horizontalRule") {
          tr.setNodeMarkup(start - rule.nodeSize, undefined, { ...rule.attrs, class: SPACE_CLASS });
        }
        return true;
      })
      .run();

  const insertOptions = [
    has("image") && onRequestImage ? { value: "image", label: t("Photo"), run: () => void addImage() } : null,
    has("video") ? { value: "video", label: t("Video (YouTube or Vimeo)"), run: openVideo } : null,
    has("button") ? { value: "button", label: t("Button"), run: () => openLink(true) } : null,
    has("table") && !state.table
      ? {
          value: "table",
          label: t("Table"),
          run: () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
        }
      : null,
    has("line") ? { value: "line", label: t("Line"), run: () => editor.chain().focus().setHorizontalRule().run() } : null,
    has("space") ? { value: "space", label: t("Space"), run: insertSpace } : null,
  ].filter((option): option is { value: string; label: string; run: () => void } => option !== null);

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

  const alignButtons = has("align") && !state.image && !state.video
    ? [
        button("align-left", t("Align left"), AlignLeft, () => setAlign(null), { pressed: !state.align }),
        button("align-center", t("Center"), AlignCenter, () => setAlign("midden"), { pressed: state.align === "midden" }),
        button("align-right", t("Align right"), AlignRight, () => setAlign("rechts"), { pressed: state.align === "rechts" }),
      ]
    : [];

  const linkButton = linkAllowed
    ? button("link", state.image ? t("Link the photo") : t("Link"), LinkIcon, () => openLink(false), {
        pressed: (panel === "link" && !asButton) || (state.link && !state.button) || Boolean(state.imageHref),
        showLabel: true,
      })
    : null;

  const groups = [markButtons, blockButtons, alignButtons].filter((group) => group.length > 0);

  // What the cursor is on: a photo, a video or a table gets its own row of choices.
  const contextRow = state.image ? (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
      <span className="px-1.5 text-sm font-medium">{t("Photo")}</span>
      <Select
        label={t("Where the photo goes")}
        value={state.imagePlace}
        onChange={(value) => editor.chain().focus().updateAttributes("image", { place: value || null }).run()}
        options={[
          { value: "", label: t("Full width") },
          { value: PHOTO_PLACES[0], label: t("Left, text beside it") },
          { value: PHOTO_PLACES[1], label: t("Right, text beside it") },
          { value: PHOTO_PLACES[2], label: t("Small, in the middle") },
        ]}
        disabled={disabled}
        className="min-w-0 flex-1 sm:w-56 sm:flex-none"
      />
      {button("alt", t("Describe photo"), ImageIcon, openAlt, { pressed: panel === "alt", showLabel: true })}
      {button("remove-image", t("Remove photo"), Trash2, () => editor.chain().focus().deleteSelection().run())}
    </div>
  ) : state.video ? (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
      <span className="px-1.5 text-sm font-medium">{t("Video")}</span>
      {button("remove-video", t("Remove video"), Trash2, () => editor.chain().focus().deleteSelection().run(), { showLabel: true })}
    </div>
  ) : state.table ? (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
      <span className="px-1.5 text-sm font-medium">{t("Table")}</span>
      {button("add-row", t("Row below"), Plus, () => editor.chain().focus().addRowAfter().run(), { showLabel: true })}
      {button("remove-row", t("Remove row"), Rows2, () => editor.chain().focus().deleteRow().run())}
      {button("add-column", t("Column next to it"), Plus, () => editor.chain().focus().addColumnAfter().run(), { showLabel: true })}
      {button("remove-column", t("Remove column"), Columns2, () => editor.chain().focus().deleteColumn().run())}
      {button("header-row", t("Top row as header"), Heading, () => editor.chain().focus().toggleHeaderRow().run())}
      {button("remove-table", t("Remove table"), Trash2, () => editor.chain().focus().deleteTable().run())}
    </div>
  ) : null;

  return (
    <div className="z-10 mb-2 space-y-1.5 bg-background sm:sticky sm:top-14 sm:pt-1" data-simple-toolbar="">
      <div className="space-y-1 rounded-md border bg-muted/40 p-1">
        {blockOptions.length > 1 || textStyles.length > 0 || insertOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
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
            {insertOptions.length > 0 ? (
              <label className="relative block min-w-0 basis-full sm:ml-auto sm:w-40 sm:basis-auto">
                <span className="sr-only">{t("Add to the text")}</span>
                <Plus
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <select
                  value=""
                  onChange={(event) => {
                    insertOptions.find((option) => option.value === event.target.value)?.run();
                    event.target.value = "";
                  }}
                  disabled={disabled}
                  className={cn(selectClass, "pl-8 font-medium")}
                  title={t("Add to the text")}
                >
                  <option value="" disabled>
                    {t("Add")}
                  </option>
                  {insertOptions.map((option) => (
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
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {groups.map((group, index) => (
            <span key={index} className="contents">
              {index > 0 ? separator : null}
              {group}
            </span>
          ))}
          {linkButton ? (
            <>
              {groups.length > 0 ? separator : null}
              {linkButton}
            </>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {button("undo", t("Undo"), Undo2, () => editor.chain().focus().undo().run(), { disabled: !state.canUndo })}
            {button("redo", t("Redo"), Redo2, () => editor.chain().focus().redo().run(), { disabled: !state.canRedo })}
          </span>
        </div>
      </div>

      {contextRow}

      {panel === "link" ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 p-1.5">
          {asButton ? <p className="w-full px-1 text-sm font-medium">{t("Button")}</p> : null}
          {state.empty && !state.link && !state.image ? (
            <input
              className={cn(inputClass, "w-full flex-none basis-full")}
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
              placeholder={asButton ? t("Text on the button, e.g. Make an appointment") : t("Text of the link (may stay empty)")}
              disabled={disabled}
            />
          ) : null}
          {pages.length > 0 ? (
            <SitePageSelect
              pages={pages}
              value={isPageLink(linkValue) ? linkValue : ""}
              onChange={(value) => {
                if (!value) return;
                setLinkValue(value);
                // With a selection the link is done at once; a new link waits for its text.
                if (!state.empty || state.link || state.image) applyLink(value);
              }}
              disabled={disabled}
              className="w-full"
            />
          ) : null}
          <input
            ref={panelInputRef}
            className={cn(inputClass, "basis-full sm:basis-0")}
            value={isPageLink(linkValue) ? "" : linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                applyLink();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            placeholder={pages.length > 0 ? t("Or type an address") : t("Web address, email address or phone number")}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            disabled={disabled}
          />
          {has("button") && !state.image ? (
            <label className="flex h-9 items-center gap-2 px-1 text-sm [@media(pointer:coarse)]:h-11">
              <input
                type="checkbox"
                checked={asButton}
                onChange={(event) => setAsButton(event.target.checked)}
                className="size-4 accent-primary"
                disabled={disabled}
              />
              <RectangleHorizontal className="size-4" aria-hidden="true" />
              {t("Show as a button")}
            </label>
          ) : null}
          {button("apply-link", t("Done"), Check, () => applyLink(), { showLabel: true })}
          {state.link || state.imageHref ? button("remove-link", t("Remove link"), X, removeLink, { showLabel: true }) : button("close-link", t("Cancel"), X, () => setPanel(null))}
        </div>
      ) : null}

      {panel === "video" ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 p-1.5">
          <input
            ref={panelInputRef}
            className={inputClass}
            value={videoValue}
            onChange={(event) => {
              setVideoValue(event.target.value);
              setVideoError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                applyVideo();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            placeholder={t("Paste the link of a YouTube or Vimeo video")}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            disabled={disabled}
          />
          {button("apply-video", t("Done"), Check, applyVideo, { showLabel: true })}
          {button("close-video", t("Cancel"), X, () => setPanel(null))}
          {videoError ? (
            <p className="w-full px-1 text-sm text-destructive">
              {t("That is not a YouTube or Vimeo link. Copy the address of the video and paste it here.")}
            </p>
          ) : null}
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
