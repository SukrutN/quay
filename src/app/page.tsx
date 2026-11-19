import type { CSSProperties } from "react"
import Link from "next/link"
import { ScrubDriver } from "@/components/scrub"
import { ScorerPanel } from "@/components/scorer-panel"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"
import { measure } from "@/lib/metrics"
import { arrivedLayout, proposeLayout } from "@/lib/place"
import { AFFINITIES, SKUS, SLOTS } from "@/lib/warehouse"

const PRINCIPLES = [
  {
    n: "01",
    title: "Reach",
    body: "Daily picks multiply the return walk from the south dock. A fast tin pays dearly for a northern bay. A slow mortar does not.",
  },
  {
    n: "02",
    title: "Mass",
    body: "Sacks and iron stay on the floor. The top beam refuses anything heavy, and a light vial does not get that strong shelf.",
  },
  {
    n: "03",
    title: "Kinship",
    body: "Coffee, filters, and cloves leave together. After an anchor seats, its companions accept a slightly longer walk to sit nearby.",
  },
  {
    n: "04",
    title: "Fit",
    body: "The carton has to fit the bay. Among the holes that can hold it, a tighter leftover wins, so a vial never takes a deep floor slot.",
  },
]

const NOTES = [
  {
    n: "01",
    title: "The arrived face",
    meta: "Before",
    body: "Fast cartons were pushed north and up, into whatever hole could take their cube. Blue tin coffee starts on the far beam.",
  },
  {
    n: "02",
    title: "The golden band",
    meta: "Levels 2 and 3",
    body: "Waist to shoulder. Anchors, a little over half of all picks, are offered these bays before anywhere else.",
  },
  {
    n: "03",
    title: "The south dock",
    meta: "Return walk",
    body: "Each walk runs out to the bay and back to the south dock, once per pick line. The score never batches a tour.",
  },
  {
    n: "04",
    title: "The proposal",
    meta: "After",
    body: "Run the placement and read the face bay by bay. The walk falls, and a few bays hold a little more air in exchange.",
  },
]

const SPECS = [
  ["Aisles", "Five. Aisle A sits nearest the dock."],
  ["Bays", "Eight per aisle. Bay 01 meets the south mouth."],
  ["Levels", "Four. The golden band is levels 2 and 3."],
  ["Cartons", "Thirty invented stock-keeping units, with a handful of co-pick ties."],
  ["Walk", "Out and back to the south dock, counted once per pick line."],
]

export default function HomePage() {
  // The demo's own figures, from the same locked math the floor runs: a day
  // of picking under the layout that arrived, and under the proposal.
  const arrived = arrivedLayout(SKUS, SLOTS)
  const proposal = proposeLayout(SKUS, SLOTS, AFFINITIES)
  const arrivedKm = Math.round(measure(arrived, SKUS, SLOTS, AFFINITIES).walkMeters / 1000)
  const proposalKm = Math.round(measure(proposal.assignment, SKUS, SLOTS, AFFINITIES).walkMeters / 1000)

  return (
    <>
      <SiteHeader />
      <main id="content">
        <ScrubDriver />
        <section className="flex min-h-[calc(100svh-4.25rem)] flex-col justify-between px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">01 · Quay, a slotting notebook</p>
          <h1 className="max-w-[12ch] text-heading-3xl font-medium">
            <span className="hero-line">
              <span className="hero-word" style={{ "--i": 0 } as CSSProperties}>
                Shorten
              </span>
            </span>
            <br />
            <span className="hero-line">
              <span className="hero-word" style={{ "--i": 1 } as CSSProperties}>
                the walk
              </span>
            </span>
          </h1>
          <div className="hero-fade flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-lg leading-snug text-silver sm:text-xl">
                Every wasted step in your pick face is labor you pay for twice: once walking out, once walking back.
                Quay re-slots the face so your pickers spend the hour picking, with fast movers beside the dock,
                heavy goods at waist height, and goods that ship together, slotted together.
              </p>
              <p className="mt-5 text-lg leading-snug text-silver sm:text-xl">
                House 4, the demo face loaded below, makes it concrete: a day of pick walking falls from {arrivedKm} km
                to {proposalKm} km on the same rack, same cartons, same orders. See it in action below, then run the
                placement yourself and argue with it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/floor" className={buttonVariants({ size: "lg" })}>
                Open the floor
              </Link>
              <a
                href="#method"
                className="sweep font-mono text-[11px] tracking-[0.16em] text-silver uppercase hover:text-paper"
              >
                Read the score
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-[var(--fluid-xl)] sm:px-8 lg:px-12">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">02 · What you get</p>
          <div className="mt-6 grid gap-14 lg:grid-cols-[1.3fr_0.7fr] lg:gap-20">
            <div data-scrub>
              <p className="max-w-3xl text-heading-lg leading-[1.15]">
                Point Quay at your forward pick face and it answers the only question that matters, one carton at a
                time: where does this one cost us least?
              </p>
              <p className="mt-8 max-w-xl text-lg leading-relaxed">
                You get back a placement that cuts travel on every pick line, keeps the heavy work low, and seats
                goods that leave together next to each other. On the demo face below, that turns {arrivedKm} km of
                walking a day into {proposalKm} km, same rack, same orders.
              </p>
              <p className="mt-5 max-w-xl text-silver">
                The demo starts clumsy on purpose: fast tins on the far beam, heavy sacks riding a ladder. Both
                layouts stay on the page, so compare them bay by bay.
              </p>
              <p className="mt-5 max-w-xl text-silver">
                Your rack slots the same way. Hand the engine one document (JSON) with your aisles, bays, levels,
                cartons, and the orders they leave on.
              </p>
            </div>
            <div data-scrub>
              <FaceSketch />
              <p className="mt-8 font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
                This demo&apos;s configuration
              </p>
              <dl className="mt-4">
                {SPECS.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-white/10 py-3">
                    <dt className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{label}</dt>
                    <dd className="text-sm text-silver">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="method" className="border-t border-white/10 px-5 py-[var(--fluid-xl)] sm:px-8 lg:px-12">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">03 · The method</p>
          <div data-scrub className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl text-heading-2xl">How a bay is scored</h2>
            <p className="max-w-sm text-silver">
              Quay scores every open bay, then hands the carton the cheapest one. The nearest hole wins only when it
              also scores lowest.
            </p>
          </div>
          <ol className="mt-14">
            {PRINCIPLES.map((item) => (
              <li
                key={item.n}
                data-scrub
                className="grid gap-4 border-t border-white/10 py-[var(--fluid-sm)] transition-colors hover:bg-white/[0.03] sm:grid-cols-[5rem_14rem_1fr] sm:items-baseline sm:gap-8"
              >
                <span className="font-mono text-sm text-signal">{item.n}</span>
                <h3 className="text-heading-md">{item.title}</h3>
                <p className="max-w-2xl text-silver">{item.body}</p>
              </li>
            ))}
            <li className="border-t border-white/10" />
          </ol>
          <div data-scrub className="mt-16">
            <p className="mb-6 max-w-2xl text-silver">
              The score runs right here in your browser, on the same locked data the tests assert. Pick a carton from
              the demo face and read where it lands, and why.
            </p>
            <ScorerPanel />
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-[var(--fluid-xl)] sm:px-8 lg:px-12">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">
            04 · Reading the demo face
          </p>
          <div data-scrub className="mt-6">
            <h2 className="max-w-4xl text-heading-2xl">What you are looking at</h2>
          </div>
          <ul className="mt-12">
            {NOTES.map((note) => (
              <li
                key={note.n}
                data-scrub
                className="grid gap-3 border-t border-white/10 py-7 sm:grid-cols-[4rem_1fr_8rem] sm:items-baseline sm:gap-8"
              >
                <span className="font-mono text-sm text-signal">{note.n}</span>
                <div>
                  <h3 className="text-heading-sm">{note.title}</h3>
                  <p className="mt-2 max-w-xl text-silver">{note.body}</p>
                </div>
                <span className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{note.meta}</span>
              </li>
            ))}
            <li className="border-t border-white/10" />
          </ul>
        </section>

        <section className="border-t border-white/10 px-5 py-[var(--fluid-xl)] sm:px-8 lg:px-12">
          <div data-scrub>
            <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">05 · Capacity, locked by the tests</p>
            <h2 className="mt-4 max-w-4xl text-heading-2xl">Small demo, full-size engine</h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-silver">
              The demo face is thirty cartons. Yours may be ten thousand, and the engine is sized for that: 10,000
              cartons across a 12,500-slot rack, slotted in one pass, the same face in, the same plan out, every time.
              The test suite proves that size again on every run against a ten-minute budget, and the machine that
              first measured it took about two minutes.
            </p>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-silver">
              Point the engine at your own rack: paste a face document into its workbench, call its web service, or
              run the jar from the command line.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-[var(--fluid-2xl)] sm:px-8 lg:px-12">
          <div data-scrub>
            <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">06 · Your move</p>
            <h2 className="mt-4 max-w-4xl text-heading-3xl text-signal">Run the placement</h2>
            <p className="mt-6 max-w-lg text-lg text-silver">
              Open the floor, watch the re-slot land, and click any bay. The before and after stay on the page, so
              you can argue with the score.
            </p>
            <Link href="/floor" className={`${buttonVariants({ size: "lg" })} mt-8`}>
              Open the floor
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function FaceSketch() {
  const aisles = ["A", "B", "C", "D", "E"]
  return (
    <figure>
      <div className="grid grid-cols-5 gap-2" aria-hidden="true">
        {aisles.map((aisle, aisleIndex) => (
          <div key={aisle} className="flex flex-col-reverse gap-1">
            {Array.from({ length: 8 }).map((_, bay) => {
              const hot = aisleIndex === 0 && bay < 2
              return <span key={bay} className={`h-2.5 ${hot ? "bg-signal" : "bg-white/15"}`} />
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 h-px bg-signal" aria-hidden="true" />
      <figcaption className="mt-3 flex justify-between font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
        <span>Aisle A</span>
        <span>South dock</span>
        <span>Aisle E</span>
      </figcaption>
    </figure>
  )
}
