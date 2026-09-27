"use client";

// The landonorris.com layout: the logo on the left; Pause motion, Try beluga and a Menu button on
// the right. Menu opens a full-screen native <dialog>, which traps focus, closes on Escape and
// hands focus back to the Menu button by itself.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { IconArrowUpRight, IconWalk, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ButtonLink, Roll } from "./Button";
import { LiveContours } from "./LiveContours";
import { DISPLAY, Name, Serif } from "./Display";
import { Logo } from "./Logo";
import { PauseMotion } from "./MotionPrefs";

export const NAV_LINKS = [
  { name: "How it works", href: "/#how" },
  { name: "Hear it", href: "/#hear" },
  { name: "City dashboard", href: "/map" },
];

// The last word of a menu link is set in the serif, and "beluga" stays lowercase.
function MenuLabel({ name }: { name: string }) {
  const words = name.split(" ");
  const last = words.pop();
  return (
    <span>
      {words.join(" ")} <Serif>{last === "beluga" ? <Name /> : last}</Serif>
    </span>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9h16M4 15h10" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar({ links = NAV_LINKS }: { links?: typeof NAV_LINKS }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const titleId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = () => {
    dialog.current?.showModal();
    close.current?.focus();
    setOpen(true);
  };
  const hide = () => dialog.current?.close();

  const all = [...links, { name: "Try beluga", href: "/walk" }];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ease-water motion-reduce:transition-none",
        scrolled ? "tone-dark border-line" : "border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-18 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="beluga home">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <PauseMotion compact />
          <ButtonLink href="/walk" className="hidden sm:inline-flex">
            <IconWalk aria-hidden size={20} />
            Try <Name />
          </ButtonLink>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={show}
            className="inline-flex size-12 items-center justify-center rounded-md border border-line-strong bg-background text-foreground transition-colors duration-300 ease-water hover:border-foreground"
          >
            <MenuIcon />
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </nav>

      <dialog
        ref={dialog}
        id={menuId}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="menu-dialog tone-ink fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain p-0"
      >
        <LiveContours variant="b" />
        <div className="relative mx-auto flex min-h-full max-w-[90rem] flex-col px-4 sm:px-6">
          <div className="flex h-18 shrink-0 items-center justify-between">
            <Logo />
            <h2 id={titleId} className="sr-only">
              Menu
            </h2>
            <button
              ref={close}
              type="button"
              onClick={hide}
              className="inline-flex size-12 items-center justify-center rounded-md border border-line-strong text-foreground transition-colors duration-300 ease-water hover:border-foreground"
            >
              <IconX aria-hidden size={24} />
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_minmax(0,30rem)]">
            <ul className="flex flex-col gap-2">
              {all.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={hide}
                    className={cn(DISPLAY, "group inline-flex items-center gap-4 rounded-md text-section")}
                  >
                    <Roll>
                      <MenuLabel name={link.name} />
                    </Roll>
                    <IconArrowUpRight
                      aria-hidden
                      className="size-[0.6em] shrink-0 text-accent transition-transform duration-600 ease-out-expo motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Image
              src="/3d/beluga.webp"
              alt=""
              width={960}
              height={767}
              unoptimized
              className="hidden h-auto w-full lg:block"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-line py-5">
            <PauseMotion />
            <p className="text-muted">Research prototype. Not a medical device.</p>
          </div>
        </div>
      </dialog>
    </header>
  );
}
