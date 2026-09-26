import { cn } from "@/lib/utils";

// The beluga from `app/icon.svg`, without its square background.
export function BelugaMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="100 170 330 190"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        fill="#eef5f9"
        d="M118 268C112 222 150 192 196 196C250 200 318 212 366 246L408 214C414 236 410 256 398 268C412 282 418 300 414 318L364 280C318 306 250 318 196 312C160 309 124 296 118 268Z"
      />
      <path fill="#cfe3ee" d="M214 306C222 330 240 344 262 348C252 332 246 320 242 310Z" />
      <circle cx="168" cy="250" r="8" fill="#0b1320" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xl font-extrabold tracking-tight", className)}>
      <BelugaMark className="h-6 w-auto" />
      beluga
    </span>
  );
}
