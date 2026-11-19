"use client"

import { useEffect, useRef } from "react"

/**
 * The velocity curve draws itself as it enters the viewport, scrubbed to
 * the scroll position exactly like the text reveals: it ships fully
 * drawn in the static export, this driver writes only its own two style
 * properties (stroke-dashoffset and opacity) from the scroll position,
 * each policy trails the one before it, and the motion reverses on the
 * way back. Under reduced motion the chart is simply there.
 */
export function VelocityCurve({
  paths,
  colors,
  names,
  curveMax,
}: {
  paths: string[]
  colors: string[]
  names: string[]
  curveMax: string
}) {
  const stage = useRef<HTMLDivElement>(null)
  const lines = useRef<(SVGPathElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const current = lines.current
    let frame = 0
    let top = 0

    const measure = () => {
      if (stage.current) top = stage.current.getBoundingClientRect().top + window.scrollY
    }

    const sample = () => {
      frame = 0
      const span = 0.62 * window.innerHeight
      const bottom = window.scrollY + window.innerHeight
      current.forEach((line, index) => {
        if (!line) return
        const trail = index * 0.14
        const linear = Math.min(1, Math.max(0, (bottom - top) / span - trail))
        const eased = 1 - (1 - linear) ** 3
        line.style.strokeDashoffset = (1 - eased).toFixed(3)
        line.style.opacity = Math.min(1, linear * 4).toFixed(2)
      })
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sample)
    }

    let reanchorTimer: number | undefined
    const reanchor = new ResizeObserver(() => {
      window.clearTimeout(reanchorTimer)
      reanchorTimer = window.setTimeout(() => {
        measure()
        sample()
      }, 150)
    })

    measure()
    sample()
    window.addEventListener("scroll", onScroll, { passive: true })
    reanchor.observe(document.body)
    return () => {
      window.removeEventListener("scroll", onScroll)
      reanchor.disconnect()
      window.clearTimeout(reanchorTimer)
      if (frame) cancelAnimationFrame(frame)
      for (const line of current) {
        if (!line) continue
        line.style.strokeDashoffset = ""
        line.style.opacity = ""
      }
    }
  }, [])

  return (
    <div ref={stage} className="mt-10 max-w-4xl">
      <svg
        viewBox="0 0 100 54"
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label="Putaway meters per carton from fastest to slowest, three policies"
      >
        <line x1="2" y1="52" x2="98" y2="52" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="2" y1="6" x2="98" y2="6" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {paths.map((d, index) => (
          <path
            key={names[index]}
            ref={(node) => {
              lines.current[index] = node
            }}
            d={d}
            fill="none"
            stroke={colors[index]}
            strokeWidth="1.5"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
        {names.map((name, index) => (
          <span key={name} className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-6 rounded" style={{ backgroundColor: colors[index] }} />
            {name}
          </span>
        ))}
        <span className="ml-auto">fastest at the left · slowest at the right</span>
      </div>
      <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
        Eyeline is the dock · the top of the chart is {curveMax} m
      </p>
    </div>
  )
}
