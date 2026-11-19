"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

/**
 * The site footer as a lit stage: a dimmed rack grid sits behind the
 * content, a veil covers it, and the veil opens a window wherever the
 * cursor rests. The veil never takes a pointer event, so every link
 * beneath it stays clickable, and under reduced motion the window sits
 * open at a fixed spot and never moves.
 */
export function SiteFooter() {
  const stage = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const node = stage.current
    if (!node) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = node.getBoundingClientRect()
        node.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`)
        node.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`)
      })
    }
    node.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      node.removeEventListener("pointermove", onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <footer ref={stage} className="footer-stage border-t border-white/10 px-5 py-10 sm:px-8 lg:px-12">
      <div className="footer-backdrop" aria-hidden="true" />
      <div className="footer-veil" aria-hidden="true" />
      <div className="relative z-[2] grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-3xl tracking-[-0.04em]">Quay</p>
          <p className="mt-3 max-w-sm text-silver">
            A slotting notebook. The loaded face is a demo; the arithmetic is not.
          </p>
          <p className="mt-3 text-sm text-silver">Built by Sukrut Nadigotti</p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Your own rack</p>
          <p className="mt-3 text-paper">Point the engine at your face</p>
          <p className="text-silver">Paste a face document into the workbench</p>
          <p className="text-silver">Call the web service from your own code</p>
          <p className="text-silver">Run the jar from the command line</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Index</p>
          <Link href="/" className="sweep w-fit text-silver hover:text-signal">
            01 Index
          </Link>
          <Link href="/floor" className="sweep w-fit text-silver hover:text-signal">
            02 The face
          </Link>
          <Link href="/putaway" className="sweep w-fit text-silver hover:text-signal">
            03 The dock
          </Link>
          <Link href="/#method" className="sweep w-fit text-silver hover:text-signal">
            04 The score
          </Link>
        </nav>
      </div>
    </footer>
  )
}
