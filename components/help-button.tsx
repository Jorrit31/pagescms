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
import { useState } from "react";
import { History, LifeBuoy, Mail, MousePointerClick, Rocket, Save, Sparkles, Upload } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { restartTour } from "@/components/tour";

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
      text: "Onder elke foto staan knoppen om een andere te kiezen, van je telefoon of computer. Grote foto's worden vanzelf kleiner gemaakt.",
    },
    {
      icon: <Save className="size-5" />,
      title: "Opslaan",
      text: "Klik op de knop Opslaan: rechtsboven op de computer, onderaan op je telefoon. Zolang je niet opslaat, verandert er niets.",
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
      text: "Below each photo are buttons to pick another one, from your phone or computer. Large photos are made smaller automatically.",
    },
    {
      icon: <Save className="size-5" />,
      title: "Save",
      text: "Click Save: at the top right on a computer, at the bottom on a phone. Nothing changes until you save.",
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

  const [open, setOpen] = useState(false);
  const { setOpenMobile } = useSidebar();
  const showTour = () => {
    setOpen(false);
    setOpenMobile(false);
    restartTour();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-tour="hulp">
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
        <Button variant="outline" onClick={showTour}>
          <Sparkles className="size-4" />
          {uiLanguage === "nl" ? "Laat de rondleiding nog eens zien" : "Show the tour again"}
        </Button>
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
