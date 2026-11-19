"use client";

/**
 * Webstudio: a short guided tour the first time a client opens the CMS.
 *
 * Two small tours, each shown once per device:
 *   - "start": on the start screen. What this is, where to pick what to change,
 *     where the menu and help are.
 *   - "bewerken": the first time an editing screen opens. Fields, preview, save.
 *
 * Each step points at something on the screen (a dark layer with a hole around
 * it) and explains it in one or two plain sentences. When the thing is not on
 * the screen (a phone layout, a site without preview) the step is skipped, or
 * shown as a card in the middle. Website builders don't get the tour unless they
 * look at the CMS as a client; anyone can start it again from "Hulp nodig?".
 *
 * Targets are found with selectors on what is already on the page, so the tour
 * needs (almost) no changes in other components.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { useIsBuilderView } from "@/lib/client-view";
import { uiLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TourName = "start" | "bewerken";

type Step = {
  /** Selectors tried in order; the first visible match is pointed at. */
  targets?: string[];
  /** Skip the step when none of the targets is on the screen. */
  optional?: boolean;
  title: string;
  text: string;
  /** Different text on phones (narrow screens). */
  phoneText?: string;
};

type Lang = "nl" | "en";
const lang = (): Lang => (uiLanguage === "en" ? "en" : "nl");

const words: Record<Lang, Record<string, string>> = {
  nl: {
    next: "Volgende",
    back: "Terug",
    skip: "Overslaan",
    done: "Aan de slag",
    begin: "Laat zien",
    noThanks: "Nee, dank je",
    step: "Stap {n} van {total}",
    label: "Rondleiding",
  },
  en: {
    next: "Next",
    back: "Back",
    skip: "Skip",
    done: "Let's go",
    begin: "Show me",
    noThanks: "No, thanks",
    step: "Step {n} of {total}",
    label: "Tour",
  },
};

// The first box to type in (not a whole group of fields).
const FIRST_BOX = "#entry-form [data-field] :is(input[type='text'], input:not([type]), textarea, [contenteditable='true'])";
const SAVE = 'button[type="submit"][form="entry-form"]';

const tours: Record<Lang, Record<TourName, Step[]>> = {
  nl: {
    start: [
      {
        title: "Welkom!",
        text: "Hier pas je zelf je website aan. In een halve minuut laten we zien hoe het werkt.",
      },
      {
        targets: ['[data-tour="tegels"]'],
        optional: true,
        title: "Kies wat je wilt aanpassen",
        text: "Elk vak is een stuk van je website. Klik erop om de teksten en foto's te veranderen.",
        phoneText: "Elk vak is een stuk van je website. Tik erop om de teksten en foto's te veranderen.",
      },
      {
        targets: ['[data-sidebar="trigger"]', '[data-slot="sidebar-container"]'],
        optional: true,
        title: "Het menu",
        text: "Hier vind je altijd alles terug. Klik op Start om weer naar dit scherm te gaan.",
        phoneText: "Tik hier om het menu te openen. Daar vind je alles terug, en ook de knop Hulp nodig?",
      },
      {
        targets: ['[data-tour="hulp"]'],
        optional: true,
        title: "Hulp nodig?",
        text: "Kom je er niet uit? Klik hier voor uitleg, of om ons een mailtje te sturen.",
      },
      {
        title: "Je kunt niks kapotmaken",
        text: "Zolang je niet op Opslaan klikt, verandert er niets aan je website. En een eerdere versie kun je altijd terugzetten.",
        phoneText: "Zolang je niet op Opslaan tikt, verandert er niets aan je website. En een eerdere versie kun je altijd terugzetten.",
      },
    ],
    bewerken: [
      {
        targets: [FIRST_BOX, "#entry-form [data-field]"],
        title: "Hier pas je het aan",
        text: "Klik in een vak en typ. Onder een foto staan knoppen om een andere te kiezen.",
        phoneText: "Tik in een vak en typ. Onder een foto staan knoppen om een andere te kiezen.",
      },
      {
        targets: ["#entry-form [data-field-tip]"],
        optional: true,
        title: "Even kijken wat het is",
        text: "Zie je dit vraagteken? Klik erop voor een korte uitleg bij dat vakje.",
        phoneText: "Zie je dit vraagteken? Tik erop voor een korte uitleg bij dat vakje.",
      },
      {
        targets: ["div.fixed [role='tablist'] > [role='tab']:last-child", "main iframe"],
        optional: true,
        title: "Zo ziet het eruit",
        text: "Hier zie je meteen je website. Klik op een tekst om hem daar te veranderen, of op een foto om naar het juiste vakje te gaan.",
        phoneText: "Tik op Voorbeeld om je website te zien. Daar kun je ook op een tekst tikken om hem meteen te veranderen.",
      },
      {
        targets: [SAVE],
        title: "Klaar? Opslaan!",
        text: "Heb je iets veranderd? Klik dan op Opslaan. Na ongeveer een minuut staat het op je website.",
        phoneText: "Heb je iets veranderd? Tik dan op Opslaan. Na ongeveer een minuut staat het op je website.",
      },
    ],
  },
  en: {
    start: [
      { title: "Welcome!", text: "This is where you change your own website. Half a minute, and you know how it works." },
      {
        targets: ['[data-tour="tegels"]'],
        optional: true,
        title: "Pick what to change",
        text: "Each tile is a part of your website. Click one to change its texts and photos.",
      },
      {
        targets: ['[data-sidebar="trigger"]', '[data-slot="sidebar-container"]'],
        optional: true,
        title: "The menu",
        text: "Everything is always here. Click Start to come back to this screen.",
        phoneText: "Tap here to open the menu. Everything is there, including Need help?",
      },
      {
        targets: ['[data-tour="hulp"]'],
        optional: true,
        title: "Need help?",
        text: "Stuck? Click here for a short explanation, or to send us an email.",
      },
      {
        title: "You can't break anything",
        text: "Nothing changes on your website until you click Save. And you can always put an earlier version back.",
      },
    ],
    bewerken: [
      {
        targets: [FIRST_BOX, "#entry-form [data-field]"],
        title: "Change it here",
        text: "Click a box and type. Below a photo are buttons to pick another one.",
      },
      {
        targets: ["#entry-form [data-field-tip]"],
        optional: true,
        title: "What is this?",
        text: "See this question mark? Click it for a short explanation of that box.",
      },
      {
        targets: ["div.fixed [role='tablist'] > [role='tab']:last-child", "main iframe"],
        optional: true,
        title: "This is how it looks",
        text: "Your website shows here right away. Click a text to change it there, or a photo to jump to its box.",
        phoneText: "Tap Preview to see your website. You can tap a text there to change it right away.",
      },
      {
        targets: [SAVE],
        title: "Done? Save!",
        text: "Changed something? Click Save. About a minute later it is on your website.",
      },
    ],
  },
};

// ---------- remembering ----------

const STORAGE = "webstudio-rondleiding";
const RESTART_EVENT = "webstudio-rondleiding";
const storageKey = (tour: TourName, userId: string) => `${STORAGE}:${tour}:${userId || "anon"}`;

const hasSeen = (tour: TourName, userId: string) => {
  try {
    return window.localStorage.getItem(storageKey(tour, userId)) === "1";
  } catch {
    return true; // No storage (private mode): rather no tour than a tour every time.
  }
};

const markSeen = (tour: TourName, userId: string) => {
  try {
    window.localStorage.setItem(storageKey(tour, userId), "1");
  } catch {
    // Ignore.
  }
};

/** Start the tour again (from the help dialog). */
export const restartTour = () => {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(`${STORAGE}:`)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
  window.dispatchEvent(new Event(RESTART_EVENT));
};

// ---------- finding things on the screen ----------

const isVisible = (el: Element) => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
  // Off-canvas (the closed phone menu sits left of the screen).
  if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
  return true;
};

const findTarget = (step: Step): Element | null => {
  for (const selector of step.targets ?? []) {
    let matches: Element[] = [];
    try {
      matches = Array.from(document.querySelectorAll(selector));
    } catch {
      continue; // A browser without :has() support.
    }
    const hit = matches.find(isVisible);
    if (hit) return hit;
  }
  return null;
};

const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  // Very tall things (the whole form, the preview) get a hole clipped to the screen.
  const top = Math.max(r.top - PAD, 8);
  const bottom = Math.min(r.bottom + PAD, window.innerHeight - 8);
  const left = Math.max(r.left - PAD, 4);
  const right = Math.min(r.right + PAD, window.innerWidth - 4);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
};

// ---------- the overlay ----------

function TourOverlay({
  steps,
  intro,
  onClose,
}: {
  steps: Step[];
  intro: boolean;
  onClose: () => void;
}) {
  const w = words[lang()];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [phone, setPhone] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Follow the target while the page moves (scrolling, the preview opening).
  useLayoutEffect(() => {
    let frame = 0;
    let scrolled = false;
    const tick = () => {
      setPhone(isPhone());
      const el = findTarget(step);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          const r = el.getBoundingClientRect();
          if (r.top < 64 || r.bottom > window.innerHeight - 96) {
            el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
        const next = rectOf(el);
        setRect((prev) =>
          prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5
            && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5
            ? prev
            : next,
        );
      } else {
        setRect(null);
      }
      if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [index]);

  const next = useCallback(() => {
    if (last) onClose();
    else setIndex((i) => i + 1);
  }, [last, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onClose]);

  // Where the card goes: next to the hole on a computer, at the top or bottom
  // edge of the screen on a phone (wherever the hole isn't).
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const cardWidth = Math.min(380, vw - 24);
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = phone
      ? { left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))" }
      : { left: (vw - cardWidth) / 2, top: Math.max(24, (vh - cardHeight) / 2), width: cardWidth };
  } else if (phone) {
    const holeCenter = rect.top + rect.height / 2;
    cardStyle = holeCenter > vh / 2
      ? { left: 12, right: 12, top: "calc(12px + env(safe-area-inset-top))" }
      : { left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))" };
  } else {
    const gap = 14;
    const below = rect.top + rect.height + gap;
    const above = rect.top - gap - cardHeight;
    const clampLeft = (x: number) => Math.min(Math.max(12, x), vw - cardWidth - 12);
    if (below + cardHeight < vh - 12) {
      cardStyle = { top: below, left: clampLeft(rect.left), width: cardWidth };
    } else if (above > 12) {
      cardStyle = { top: above, left: clampLeft(rect.left), width: cardWidth };
    } else if (rect.left + rect.width + gap + cardWidth < vw - 12) {
      cardStyle = { top: Math.max(12, Math.min(rect.top, vh - cardHeight - 12)), left: rect.left + rect.width + gap, width: cardWidth };
    } else if (rect.left - gap - cardWidth > 12) {
      cardStyle = { top: Math.max(12, Math.min(rect.top, vh - cardHeight - 12)), left: rect.left - gap - cardWidth, width: cardWidth };
    } else {
      cardStyle = { bottom: 24, left: (vw - cardWidth) / 2, width: cardWidth };
    }
  }

  const text = phone && step.phoneText ? step.phoneText : step.text;
  const isIntro = intro && index === 0;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={w.label} aria-describedby="tour-text">
      {/* The dark layer. With a target it is one big shadow around the hole. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent motion-safe:transition-all motion-safe:duration-300"
          style={{ ...rect, boxShadow: "0 0 0 200vmax rgb(8 9 14 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(8_9_14/0.62)]" />
      )}
      {/* Clicks around the card do nothing: no accidental changes during the tour. */}
      <div className="fixed inset-0" onClick={(event) => event.stopPropagation()} />
      <div
        ref={cardRef}
        key={index}
        className="fixed rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200"
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {w.step.replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}
          </span>
          <span className="flex gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")}
              />
            ))}
          </span>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{step.title}</h2>
        <p id="tour-text" className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
        <div className="mt-5 flex items-center gap-2">
          {isIntro ? (
            <Button variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={onClose}>
              {w.noThanks}
            </Button>
          ) : index > 0 ? (
            <Button variant="ghost" className="h-11 px-3" onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeft className="size-4" />
              {w.back}
            </Button>
          ) : (
            <Button variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={onClose}>
              {w.skip}
            </Button>
          )}
          <Button ref={primaryRef} className="ml-auto h-11 px-5 text-base font-semibold" onClick={next}>
            {isIntro ? w.begin : last ? w.done : w.next}
            {last ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
          </Button>
        </div>
        {!isIntro && !last && index > 0 && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {w.skip}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- which tour, when ----------

const tourForPath = (pathname: string): TourName | null => {
  if (/\/start\/?$/.test(pathname)) return "start";
  if (/\/collection\/[^/]+\/(edit|new)(\/|$)/.test(pathname) || /\/file\/[^/]+/.test(pathname)) return "bewerken";
  return null;
};

// The page's own parts (the form, the tiles) load a moment after the route.
const READY: Record<TourName, string> = {
  start: '[data-tour="tegels"]',
  bewerken: "#entry-form [data-field]",
};

export function Tour() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { config } = useConfig();
  const { user } = useUser();
  const isBuilder = useIsBuilderView();
  const userId = String((user as any)?.id ?? "");
  const [open, setOpen] = useState<{ name: TourName; steps: Step[] } | null>(null);
  const tour = tourForPath(pathname);

  const begin = useCallback((name: TourName) => {
    const all = tours[lang()][name];
    // Leave out steps that point at something this screen doesn't have.
    const steps = all.filter((step) => !step.optional || findTarget(step));
    if (steps.length) setOpen({ name, steps });
  }, []);

  // First visit: wait until the page has loaded its parts, then start.
  useEffect(() => {
    if (!tour || isBuilder || open) return;
    if (hasSeen(tour, userId)) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const ready = document.querySelector(READY[tour]);
      if (ready && isVisible(ready)) {
        timer = setTimeout(() => begin(tour), 700);
        return;
      }
      if (++tries < 40) timer = setTimeout(check, 250);
    };
    check();
    return () => clearTimeout(timer);
  }, [tour, isBuilder, userId, open, begin]);

  // "Show the tour again" from the help dialog.
  useEffect(() => {
    const onRestart = () => {
      if (tour) {
        // Let the help dialog and the phone menu close first.
        setTimeout(() => begin(tour), 350);
      } else if (config) {
        router.push(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/start`);
      }
    };
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, [tour, config, router, begin]);

  // Leaving the page ends the tour.
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  const close = useCallback(() => {
    if (open) markSeen(open.name, userId);
    setOpen(null);
  }, [open, userId]);

  if (!open) return null;
  return <TourOverlay key={open.name} steps={open.steps} intro={open.name === "start"} onClose={close} />;
}
