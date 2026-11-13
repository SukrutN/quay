"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

/**
 * The smooth scroll, built on Lenis. One instance on the document, native
 * scroll position underneath (the scrub driver keeps reading window
 * scroll), and nothing at all under reduced motion: the page falls back to
 * the browser's own scrolling.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const lenis = new Lenis({ autoRaf: true, anchors: true })
    return () => lenis.destroy()
  }, [])

  return null
}
