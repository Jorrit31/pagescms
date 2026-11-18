/**
 * Webstudio: a recognisable icon per part of the website in the sidebar.
 * Set `icon:` on a content item in .pages.yml (one of the names below), or we
 * guess from its name/label (home, pagina's, nieuws, instellingen, ...).
 */

import {
  BookOpen, Briefcase, CalendarDays, Car, FileStack, FileText, Flower2, House, Image as ImageIcon,
  Mail, MapPin, Megaphone, MessageSquareQuote, Newspaper, Package, Settings2, ShoppingBag,
  Signpost, Sparkles, Star, Store, Tag, Users, UtensilsCrossed, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: House, pagina: FileText, paginas: FileStack, nieuws: Newspaper, instellingen: Settings2,
  bedrijf: Store, doorverwijzingen: Signpost, team: Users, agenda: CalendarDays, workshop: CalendarDays,
  aanbod: ShoppingBag, producten: Package, prijzen: Tag, diensten: Briefcase, reviews: MessageSquareQuote,
  fotos: ImageIcon, contact: Mail, locatie: MapPin, menu: UtensilsCrossed, autos: Car, bloemen: Flower2,
  acties: Megaphone, uitgelicht: Star, blog: BookOpen, nieuw: Sparkles,
};

const GUESSES: [RegExp, LucideIcon][] = [
  [/^(home|homepage|start|voorpagina)/, House],
  [/doorverwijz|redirect/, Signpost],
  [/instelling|algemeen|gegevens|settings/, Settings2],
  [/nieuws|blog|bericht/, Newspaper],
  [/team|medewerker|over/, Users],
  [/agenda|workshop|evenement|event/, CalendarDays],
  [/aanbod|product|winkel|shop/, ShoppingBag],
  [/prijs|tarief/, Tag],
  [/dienst|behandeling/, Briefcase],
  [/review|ervaring|recensie/, MessageSquareQuote],
  [/foto|galerij|portfolio/, ImageIcon],
  [/contact/, Mail],
  [/menu|kaart|gerecht/, UtensilsCrossed],
  [/auto|occasion/, Car],
  [/pagina/, FileStack],
];

export const contentIcon = (node: { type: string; name: string; label?: string; icon?: string }): LucideIcon => {
  if (node.icon && ICONS[node.icon]) return ICONS[node.icon];
  const text = `${node.name} ${node.label ?? ""}`.toLowerCase();
  const guess = GUESSES.find(([pattern]) => pattern.test(text));
  if (guess) return guess[1];
  return node.type === "collection" ? FileStack : FileText;
};

export const CONTENT_ICON_NAMES = Object.keys(ICONS);
