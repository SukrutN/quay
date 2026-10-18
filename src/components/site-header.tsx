"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Mark } from "@/components/mark"
import { Button } from "@/components/ui/button"

const LINKS = [
  { n: "01", label: "Index", href: "/" },
  { n: "02", label: "The face", href: "/floor" },
  { n: "03", label: "The score", href: "/#method" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[70] focus:bg-signal focus:px-3 focus:py-2 focus:text-deep"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-deep/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3 text-paper" aria-label="Quay, home">
            <Mark />
            <span className="text-lg tracking-[-0.04em]">Quay</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <p className="hidden font-mono text-[11px] tracking-[0.16em] text-silver uppercase sm:block">
              House 4 · synthetic
            </p>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
            </Button>
          </div>
        </div>
      </header>
      {open ? (
        <div id="site-menu" className="fixed inset-0 z-50 flex flex-col bg-deep">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 sm:px-8 lg:px-12">
            <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
              <Mark />
              <span className="text-lg tracking-[-0.04em]">Quay</span>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <nav className="flex flex-1 flex-col justify-between px-5 py-10 sm:px-8 lg:px-12" aria-label="Primary">
            <ul className="flex flex-col gap-2">
              {LINKS.map((link) => {
                const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`group flex items-baseline gap-5 text-[clamp(3.2rem,8vw,6.4rem)] leading-[0.9] tracking-[-0.045em] transition-colors hover:text-signal ${active ? "text-signal" : "text-paper"}`}
                    >
                      <span className="font-mono text-sm tracking-[0.16em] text-signal">{link.n}</span>
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-2">
              <p className="max-w-sm text-silver">
                Coldwater Reach is not a port. Marrow Goods is not a company. Thirty cartons, five aisles, and a south dock — a sample you can re-slot in this browser.
              </p>
              <p className="font-mono text-[11px] leading-6 tracking-[0.14em] text-silver uppercase">
                No account
                <br />
                No warehouse feed
                <br />
                Placement stays on this machine
              </p>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  )
}
