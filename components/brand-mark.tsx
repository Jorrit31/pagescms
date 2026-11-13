import { cn } from "@/lib/utils";

// Same drawing as app/icon.svg.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={cn("size-6", className)} viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="480" height="480" rx="104" fill="#1C1917" />
      <path d="M96 150h42l30 132 34-132h36l34 132 30-132h42l-52 190h-38l-34-126-34 126h-38z" fill="#FAFAF9" />
      <circle cx="374" cy="320" r="22" fill="#16A34A" />
    </svg>
  );
}
