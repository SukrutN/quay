import Link from "next/link"
import { Marquee, SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"

const PRINCIPLES = [
  {
    n: "01",
    code: "001",
    title: "Reach",
    body: "Daily picks multiply the return walk from the south dock. A fast tin pays dearly for a northern bay. A slow mortar does not.",
  },
  {
    n: "02",
    code: "002",
    title: "Mass",
    body: "Sacks and iron stay on the floor. The top beam is refused to anything heavy, and a light vial should not occupy that strong shelf.",
  },
  {
    n: "03",
    code: "003",
    title: "Kinship",
    body: "Coffee, filters, and cloves leave together. After an anchor is placed, its companions will accept a slightly longer walk to sit nearby.",
  },
  {
    n: "04",
    code: "004",
    title: "Fit",
    body: "The carton has to fit the bay. Among holes that can hold it, a tighter leftover wins, so a vial does not take a deep floor slot.",
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
    meta: "Levels 2–3",
    body: "Waist to shoulder. Anchors — a little over half of all picks — are offered these bays before anywhere else.",
  },
  {
    n: "03",
    title: "The south dock",
    meta: "Return walk",
    body: "Every estimate is out and back, once per pick line. Quay does not pretend to know a batched route.",
  },
  {
    n: "04",
    title: "The proposal",
    meta: "After",
    body: "Run the placement and read the face bay by bay. The walk should fall. A few bays will hold a little more air.",
  },
]

const SPECS = [
  ["Aisles", "Five. A sits nearest the dock."],
  ["Bays", "Eight. Bay 01 meets the south mouth."],
  ["Levels", "Four. The golden band is 2 and 3."],
  ["Cartons", "Thirty invented SKUs, with a handful of co-pick ties."],
  ["Walk", "Out and back to the south dock, counted per pick line."],
]

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <section className="flex min-h-[calc(100svh-4.25rem)] flex-col justify-between px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">01 — Forward pick face</p>
          <h1 className="rise max-w-[12ch] text-[clamp(4.4rem,12vw,9.2rem)] leading-[0.84] font-medium tracking-[-0.05em]">
            Shorten
            <br />
            the walk.
          </h1>
          <div className="rise-late flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg leading-snug text-silver sm:text-xl">
              Marrow Goods is invented. House 4 is not a building you can visit. Quay still treats its forward face seriously: thirty cartons, five aisles, and a south dock, re-slotted in the browser.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/floor" className={buttonVariants({ size: "lg" })}>
                Open the floor
              </Link>
              <a href="#method" className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase hover:text-paper">
                Read the score
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.3fr_0.7fr] lg:gap-20">
            <div>
              <p className="max-w-3xl text-[clamp(1.7rem,3.4vw,2.8rem)] leading-[1.15] tracking-[-0.04em]">
                A picker should spend the hour on the order, not on the aisle. Quay reads a small forward face and proposes where each carton should stand.
              </p>
              <p className="mt-8 max-w-xl text-silver">
                The sample is deliberately clumsy at the start. Fast tins sit far from the dock. Heavy sacks have been allowed onto the beam. The proposal is a heuristic you can inspect, not a claim that the floor is solved.
              </p>
            </div>
            <div>
              <FaceSketch />
              <dl className="mt-8">
                {SPECS.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-white/10 py-3">
                    <dt className="font-mono text-[11px] tracking-[0.14em] text-signal uppercase">{label}</dt>
                    <dd className="text-sm text-silver">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="method" className="border-t border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.9] tracking-[-0.045em]">
              Four pressures,
              <br />
              one bay.
            </h2>
            <p className="max-w-sm text-silver">
              Quay does not hand the nearest hole to the fastest carton and stop. Each open bay is scored, and the carton takes the lowest score.
            </p>
          </div>
          <ol className="mt-14 grid gap-px bg-white/10 sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <li key={item.code} className="flex min-h-64 flex-col justify-between bg-deep p-6 transition-colors hover:bg-smoke sm:p-8">
                <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-signal">
                  <span>{item.n}</span>
                  <span>[ {item.code} ]</span>
                </div>
                <div className="mt-10">
                  <h3 className="text-4xl tracking-[-0.04em]">{item.title}</h3>
                  <p className="mt-3 max-w-md text-silver">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">Floor notes</p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.9] tracking-[-0.045em]">
            What the sample
            <br />
            is willing to show.
          </h2>
          <ul className="mt-12">
            {NOTES.map((note) => (
              <li key={note.n} className="grid gap-3 border-t border-white/10 py-7 sm:grid-cols-[4rem_1fr_8rem] sm:items-baseline sm:gap-8">
                <span className="font-mono text-sm text-signal">{note.n}</span>
                <div>
                  <h3 className="text-3xl tracking-[-0.04em] sm:text-4xl">{note.title}</h3>
                  <p className="mt-2 max-w-xl text-silver">{note.body}</p>
                </div>
                <span className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{note.meta}</span>
              </li>
            ))}
            <li className="border-t border-white/10" />
          </ul>
        </section>

        <section className="border-t border-white/10 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">House 4 is loaded</p>
          <h2 className="mt-4 max-w-4xl text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
            The face
            <br />
            is waiting.
          </h2>
          <p className="mt-6 max-w-lg text-lg text-silver">
            Open the floor, place it, and click a bay. The before and after stay on the page so you can argue with the score.
          </p>
          <Link href="/floor" className={`${buttonVariants({ size: "lg" })} mt-8`}>
            Open the floor
          </Link>
        </section>
        <Marquee />
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
