"use client";

// Based on Aceternity UI's Resizable Navbar: full width at the top, a floating pill once you scroll.

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useId, useState } from "react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ButtonLink } from "./Button";
import { Logo } from "./Logo";
import { PauseMotion } from "./MotionPrefs";

export const NAV_LINKS = [
  { name: "How it works", href: "/#how" },
  { name: "Hear it", href: "/#hear" },
  { name: "City dashboard", href: "/map" },
];

export function Navbar({ links = NAV_LINKS }: { links?: typeof NAV_LINKS }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const menuId = useId();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex items-center justify-between gap-3 rounded-full border py-2 pr-2 pl-4 transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-water motion-reduce:transition-none",
          scrolled || open
            ? "max-w-4xl border-line bg-abyss/85 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.6)] md:backdrop-blur-lg"
            : "max-w-6xl border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="rounded-full px-1 py-1" aria-label="beluga home">
          <Logo />
        </Link>

        <ul className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
          {links.map((link, i) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onMouseEnter={() => setHovered(i)}
                className="relative flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-foreground/85 transition-colors hover:text-foreground"
              >
                {hovered === i && (
                  <motion.span
                    layoutId="nav-hover"
                    className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  />
                )}
                <span className="relative">{link.name}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <PauseMotion className="hidden lg:inline-flex" />
          <ButtonLink href="/walk" className="hidden min-h-11 rounded-full px-5 text-sm sm:inline-flex">
            Try beluga
          </ButtonLink>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line text-foreground lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconX aria-hidden size={22} /> : <IconMenu2 aria-hidden size={22} />}
          </button>
        </div>
      </nav>

      <div
        id={menuId}
        hidden={!open}
        className="mx-auto mt-2 max-w-4xl rounded-3xl border border-line bg-abyss/95 p-3 shadow-2xl md:backdrop-blur-lg lg:hidden"
      >
        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-2xl px-4 text-lg font-semibold hover:bg-white/10"
              >
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-1 pt-3">
          <ButtonLink href="/walk" onClick={() => setOpen(false)} className="flex-1 sm:hidden">
            Try beluga
          </ButtonLink>
          <PauseMotion />
        </div>
      </div>
    </header>
  );
}
