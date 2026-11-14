"use client";

import { useConfig } from "@/contexts/config-context";
import { brand } from "@/lib/brand";
import { t, uiLanguage } from "@/lib/i18n";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, LifeBuoy, Mail, MousePointerClick, Rocket, Save, Upload } from "lucide-react";

type Step = { icon: React.ReactNode; title: string; text: string };

const steps: Record<"nl" | "en", Step[]> = {
  nl: [
    {
      icon: <MousePointerClick className="size-5" />,
      title: "Iets aanpassen",
      text: "Kies links wat je wilt aanpassen. Rechts zie je je website. Klik daar op een tekst of foto, dan spring je naar het juiste vakje.",
    },
    {
      icon: <Upload className="size-5" />,
      title: "Een foto vervangen",
      text: "Klik bij de foto op het plusje of sleep een foto erin. Grote foto's van je telefoon worden vanzelf kleiner gemaakt.",
    },
    {
      icon: <Save className="size-5" />,
      title: "Opslaan",
      text: "Klik rechtsboven op de groene knop Opslaan. Zolang je niet opslaat, verandert er niets.",
    },
    {
      icon: <Rocket className="size-5" />,
      title: "Online zetten",
      text: "Zie je bovenaan de knop Zet online? Dan zien bezoekers je wijzigingen pas als je daarop klikt. Na ongeveer een minuut staat het op je website.",
    },
    {
      icon: <History className="size-5" />,
      title: "Iets ongedaan maken",
      text: "Klik rechtsboven op het klokje en kies een eerdere versie. Bekijk hem in het voorbeeld en klik op Opslaan om hem terug te zetten.",
    },
  ],
  en: [
    {
      icon: <MousePointerClick className="size-5" />,
      title: "Change something",
      text: "Pick what to change on the left. Your website shows on the right. Click a text or photo there to jump to its field.",
    },
    {
      icon: <Upload className="size-5" />,
      title: "Replace a photo",
      text: "Click the plus next to the photo or drop a photo on it. Large phone photos are made smaller automatically.",
    },
    {
      icon: <Save className="size-5" />,
      title: "Save",
      text: "Click the green Save button at the top right. Nothing changes until you save.",
    },
    {
      icon: <Rocket className="size-5" />,
      title: "Put online",
      text: "See a Put online button at the top? Visitors only see your changes after you click it. About a minute later it is on your website.",
    },
    {
      icon: <History className="size-5" />,
      title: "Undo something",
      text: "Click the clock at the top right and pick an earlier version. Check it in the preview and click Save to put it back.",
    },
  ],
};

export function HelpButton() {
  const { config } = useConfig();
  const list = steps[uiLanguage === "nl" ? "nl" : "en"];
  const subject = t("Help with my website {site}", { site: config?.repo ?? "" });
  const mailto = brand.supportEmail
    ? `mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}`
    : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <LifeBuoy className="size-4" />
          {t("Need help?")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("How it works")}</DialogTitle>
          <DialogDescription>{t("Five things you need to know.")}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4">
          {list.map((step) => (
            <li key={step.title} className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent">{step.icon}</div>
              <div className="text-sm">
                <div className="font-medium">{step.title}</div>
                <div className="text-muted-foreground">{step.text}</div>
              </div>
            </li>
          ))}
        </ol>
        {mailto && (
          <a href={mailto} className={buttonVariants({ variant: "default" })}>
            <Mail className="size-4" />
            {t("Still stuck? Send an email")}
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
