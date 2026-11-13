import { Loader } from "@/components/loader";
import { t } from "@/lib/i18n";

export default function Loading() {
  return <Loader className="absolute inset-0 text-muted-foreground text-sm bg-background rounded-md">{t("Loading")}</Loader>;
}
