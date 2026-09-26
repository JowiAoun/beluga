import Image from "next/image";
import { cn } from "@/lib/utils";

// The surfing beluga from `images/image.png`, cut to sizes in `public/icons`. The files sit under
// /icons so the service worker keeps them for offline walks. Decorative unless `title` is given.
export function BelugaMark({ className, title, size = 64 }: { className?: string; title?: string; size?: number }) {
  const src = size <= 64 ? "/icons/logo-128.png" : size <= 128 ? "/icons/logo-256.webp" : "/icons/logo-512.webp";
  return <Image src={src} alt={title ?? ""} width={size} height={size} unoptimized className={className} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-[-0.03em]", className)}>
      <BelugaMark size={40} className="size-10" />
      beluga
    </span>
  );
}
