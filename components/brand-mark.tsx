import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

// Same drawing as app/icon.svg. Its colours come from the theme (--primary and
// --brand-dot in app/globals.css), so a new brand only needs new colours.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={cn("size-6", className)} viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="480" height="480" rx="120" style={{ fill: "var(--brand-mark, var(--primary))" }} />
      <path d="M96 150h42l30 132 34-132h36l34 132 30-132h42l-52 190h-38l-34-126-34 126h-38z" fill="#FFFFFF" />
      <circle cx="374" cy="320" r="24" style={{ fill: "var(--brand-dot)" }} />
    </svg>
  );
}

export function BrandWordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <BrandMark className={cn("size-8", markClassName)} />
      <span>{brand.name}</span>
    </span>
  );
}
