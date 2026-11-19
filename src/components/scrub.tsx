"use client"

import { useEffect } from "react"

/**
 * The scroll-scrub driver. Every element marked data-scrub is a scroll
 * reveal that ships settled in the static export. The driver writes only
 * its two style properties (opacity and transform) from the scroll
 * position: an element leaves its from-state when its top edge crosses
 * the viewport bottom and settles once it has traveled 62 percent of the
 * viewport up the screen, and the motion reverses on the way back.
 *
 * New elements discovered after mount (streamed segments, opened panels)
 * are measured by the re-anchor pass but left untouched until the next
 * scroll event, so a write never lands on markup the framework has not
 * finished hydrating. Under reduced motion the driver never runs and
 * every reveal is fully static.
 */
export function ScrubDriver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const TRAVEL = 0.62
    const FROM_Y = 24
    type Item = { el: HTMLElement; top: number; managed: boolean }
    let items: Item[] = []
    let frame = 0

    const measure = () => {
      items = [...document.querySelectorAll<HTMLElement>("[data-scrub]")].map((el) => {
        const known = items.find((item) => item.el === el)
        return { el, top: el.getBoundingClientRect().top + window.scrollY, managed: known?.managed ?? false }
      })
    }

    const write = (item: Item, eased: number) => {
      item.el.style.opacity = eased.toFixed(3)
      item.el.style.transform = `translateY(${(FROM_Y * (1 - eased)).toFixed(1)}px)`
    }

    const easedAt = (item: Item) => {
      const span = TRAVEL * window.innerHeight
      const bottom = window.scrollY + window.innerHeight
      const linear = Math.min(1, Math.max(0, (bottom - item.top) / span))
      return 1 - (1 - linear) ** 3
    }

    const sample = (managedOnly: boolean) => {
      frame = 0
      for (const item of items) {
        if (managedOnly && !item.managed) continue
        write(item, easedAt(item))
        item.managed = true
      }
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => sample(false))
    }

    let reanchorTimer: number | undefined
    const reanchor = new ResizeObserver(() => {
      window.clearTimeout(reanchorTimer)
      reanchorTimer = window.setTimeout(() => {
        measure()
        sample(true)
      }, 150)
    })

    measure()
    sample(true)
    window.addEventListener("scroll", onScroll, { passive: true })
    reanchor.observe(document.body)

    return () => {
      window.removeEventListener("scroll", onScroll)
      reanchor.disconnect()
      window.clearTimeout(reanchorTimer)
      if (frame) cancelAnimationFrame(frame)
      for (const item of items) {
        if (!item.managed) continue
        item.el.style.opacity = ""
        item.el.style.transform = ""
      }
    }
  }, [])

  return null
}
