import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { bandOf, type Band, type PutawayDay, PUTAWAY_DAY } from "@/lib/putaway-day"
import { allThree, velocityOrder, type PutawayDirective, type PutawayResult } from "@/lib/putaway"

export const metadata: Metadata = {
  title: "The dock",
  description:
    "One putaway day at Harbor & Lane: thirty receipt lines, 226 cartons, three policies. Compare the velocity skim, the affinity pull, and a seeded random fork on walk meters, golden-band share, and the replenish trace.",
}

const BAND_FILL: Record<Band, string> = {
  A: "rgba(81, 224, 118, 0.85)",
  B: "rgba(247, 247, 247, 0.5)",
  C: "rgba(163, 163, 163, 0.32)",
}
const BAND_DIM: Record<Band, string> = {
  A: "rgba(81, 224, 118, 0.22)",
  B: "rgba(247, 247, 247, 0.16)",
  C: "rgba(163, 163, 163, 0.12)",
}

type Landing = { skuId: string; band: Band; fresh: boolean }

function landings(day: PutawayDay, result: PutawayResult): Map<string, Landing> {
  const map = new Map<string, Landing>()
  for (const [slotId, fill] of Object.entries(day.startState)) {
    const sku = day.skus.find((item) => item.id === fill.skuId)
    if (sku) map.set(slotId, { skuId: sku.id, band: bandOf(sku.picks, day.bands), fresh: false })
  }
  for (const directive of result.directives) {
    if (directive.destination !== "reserve") continue
    map.set(directive.slotId, { skuId: directive.skuId, band: directive.band, fresh: true })
  }
  return map
}

function lineOf(result: PutawayResult, receiptId: string, destination: string): PutawayDirective {
  return result.directives.filter((d) => d.receiptId === receiptId && d.destination === destination)[0]
}

function meters(number: number) {
  return number.toFixed(1)
}

/**
 * The velocity curve: per SKU in mobility order, how far its first reserve
 * landing sits from the dock. Directed policies climb; the fork is a jagged
 * mess — that shape is the argument for direction.
 */
function curve(day: PutawayDay, result: PutawayResult): number[] {
  const first = new Map<string, number>()
  for (const directive of result.directives) {
    if (directive.destination === "reserve" && !first.has(directive.skuId)) {
      first.set(directive.skuId, directive.putawayMeters)
    }
  }
  const points: number[] = []
  for (const receipt of velocityOrder(day)) {
    const landing = first.get(receipt.skuId)
    if (landing !== undefined) points.push(landing)
  }
  return points
}

const CURVE_COLORS = ["#51e076", "rgba(247, 247, 247, 0.8)", "rgba(163, 163, 163, 0.6)"]
const CURVE_NAMES = ["Velocity", "Affinity", "The fork"]

export default function PutawayPage() {
  const day = PUTAWAY_DAY
  const [directed, together, fork] = allThree(day)
  const speeds = [directed.totals.putawayMeters, together.totals.putawayMeters, fork.totals.putawayMeters]
  const slowest = speeds[2]
  const width = (value: number) => `${((value / slowest) * 100).toFixed(1)}%`
  const saving = fork.totals.putawayMeters - directed.totals.putawayMeters
  const percent = Math.round((100 * saving) / fork.totals.putawayMeters)
  const r01Directed = lineOf(directed, "R-01", "reserve")
  const r01Fork = lineOf(fork, "R-01", "reserve")
  const r10Directed = lineOf(directed, "R-10", "reserve")
  const r10Together = lineOf(together, "R-10", "reserve")
  const r07Together = lineOf(together, "R-07", "reserve")
  const r07Bay = r07Together.slotId.split("-").slice(0, 2).join("-")
  const r15Forward = lineOf(directed, "R-15", "forward")
  const r15Reserve = lineOf(directed, "R-15", "reserve")
  const r23Reserve = lineOf(directed, "R-23", "reserve")
  const r25Reserve = lineOf(directed, "R-25", "reserve")

  const panels = [
    {
      name: "Velocity",
      result: directed,
      note: "Reads the manifest fastest first and takes the cheapest feasible bay. Slow goods pay a premium for golden levels; fast goods pay a small one for the floor.",
    },
    {
      name: "Affinity",
      result: together,
      note: "Runs the velocity skim, then lets partners already landed this day pull the choice. A hair of walk is the honest price for sitting near the work it leaves with.",
    },
    {
      name: "The fork",
      result: fork,
      note: "The manifest in arrival order, the bays in one shuffle of seed 1998. This is the day nobody directed — the control the other two have to beat.",
    },
  ]

  const walkthrough = [
    {
      receipt: "R-01",
      sku: "Blue tin coffee",
      load: "8 cartons",
      headline: `The same carton, twice the walk. Velocity lands it at ${r01Directed.slotId} for ${meters(r01Directed.putawayMeters)} m; the fork shuffles it to ${r01Fork.slotId} for ${meters(r01Fork.putawayMeters)} m.`,
    },
    {
      receipt: "R-10",
      sku: "Linen tea towels",
      load: "4 cartons",
      headline: `Cheapest floor is ${r10Directed.slotId} at ${meters(r10Directed.putawayMeters)} m — but cedar soap landed at ${r07Bay} under affinity, so the towels pay ${meters(
        r10Together.putawayMeters - r10Directed.putawayMeters,
      )} m more to sit in ${r10Together.slotId}, the same bay as the work they leave with.`,
    },
    {
      receipt: "R-15",
      sku: "Pilot candle tins",
      load: "9 cases · 36 cartons",
      headline: `A case line splits itself. The face was ${r15Forward.cartons} short of its line, so ${r15Forward.cartons} go forward and the remaining ${r15Reserve.cartons} claim ${r15Reserve.slotId} for ${meters(r15Reserve.putawayMeters)} m.`,
    },
    {
      receipt: "R-23",
      sku: "Night chalk sticks",
      load: "9 cases · 36 cartons",
      headline: `Slow chalk skips golden at a premium of half a point per pick and lands the whole case on the top beam, ${r23Reserve.slotId}, ${meters(r23Reserve.putawayMeters)} m out.`,
    },
    {
      receipt: "R-25",
      sku: "Iron pan blanks",
      load: "2 cartons",
      headline: `Twelve-kilogram iron may not rise a level, and ${r25Reserve.slotId} already held its own stock — so today's ${r25Reserve.cartons} top off the floor bay the pan opened the day in.`,
    },
  ]

  const armedSkuIds = new Set(
    directed.signals.filter((s) => s.action === "raise").map((s) => s.skuId).filter((skuId) => !directed.signals.some((q) => q.action === "quiet" && q.skuId === skuId)),
  )
  const curves = [curve(day, directed), curve(day, together), curve(day, fork)]
  const curveMax = Math.max(...curves.flat())
  const toPath = (points: number[]) =>
    points
      .map((metersToBay, index) => {
        const x = points.length > 1 ? (index / (points.length - 1)) * 96 + 2 : 50
        const y = 52 - (metersToBay / curveMax) * 46
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(" ")

  return (
    <>
      <SiteHeader />
      <main id="content">
        <header className="px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">03 — Harbor &amp; Lane, reserve aisles F–H</p>
          <h1 className="rise mt-4 max-w-5xl text-[clamp(3.5rem,8vw,7.2rem)] leading-[0.86] tracking-[-0.05em]">
            The dock.
          </h1>
          <p className="rise-late mt-6 max-w-2xl text-lg text-silver">
            Behind the pick face, one day of receipts: thirty lines, 226 cartons. Three ways to direct them — a velocity
            skim, an affinity pull, and a seeded random fork to measure the other two against.
          </p>
        </header>

        <div className="border-y border-white/10 px-5 py-8 sm:px-8 lg:px-12">
          <dl className="grid gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Manifest lines", "30"],
              ["Cartons", "226"],
              ["To the face", "52"],
              ["To reserve", "174"],
              ["Directed walk", `${meters(speeds[0])} m`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">{label}</dt>
                <dd className="mt-2 text-3xl tracking-[-0.03em]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            One day, three directors.
          </h2>
          <div className="mt-10 grid gap-px border border-white/10 bg-white/10 lg:grid-cols-3">
            {panels.map((panel) => (
              <article key={panel.name} className="bg-deep p-6 sm:p-8">
                <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">{panel.name}</p>
                <p className="mt-4 text-4xl tracking-[-0.03em] text-paper">{meters(panel.result.totals.putawayMeters)} m</p>
                <p className="mt-1 text-silver">
                  golden-band share {(panel.result.totals.goldenShare * 100).toFixed(0)}%
                </p>
                <p className="mt-4 text-silver">{panel.note}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 space-y-2 border-l-2 border-signal pl-5">
            <p>
              Directed against the fork: {meters(saving)} m less to walk — {percent}% of the day&apos;s travel.
            </p>
            <p className="text-silver">
              Affinity against velocity: +{meters(speeds[1] - speeds[0])} m to pull partners together, and the
              golden-band share drops to {(together.totals.goldenShare * 100).toFixed(0)}%. The pull is visible; the price
              is printed next to it.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            The velocity curve.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            Each point is one SKU&apos;s first reserve landing, drawn left to right in mobility order — the fastest tin
            at the left edge, the last mortar at the right. Directed plans climb in an orderly ramp; the fork fills the
            same chart with noise. Eyeline is the dock; the top of the chart is {meters(curveMax)} m.
          </p>
          <div className="mt-10 max-w-4xl">
            <svg
              viewBox="0 0 100 54"
              preserveAspectRatio="none"
              className="h-44 w-full"
              role="img"
              aria-label="Putaway meters per SKU from fastest to slowest, three policies"
            >
              <line x1="2" y1="52" x2="98" y2="52" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1="2" y1="6" x2="98" y2="6" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {curves.map((points, index) => (
                <path
                  key={CURVE_NAMES[index]}
                  d={toPath(points)}
                  fill="none"
                  stroke={CURVE_COLORS[index]}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
              {CURVE_NAMES.map((name, index) => (
                <span key={name} className="flex items-center gap-2">
                  <span className="inline-block h-[3px] w-6 rounded" style={{ backgroundColor: CURVE_COLORS[index] }} />
                  {name}
                </span>
              ))}
              <span className="ml-auto">fastest at the left · slowest at the right</span>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            Where the day landed.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            Three aisles, eight bays, four levels — bright cells arrived today, dim cells opened the day with stock.
            Color is the receipt&apos;s velocity band: A runs green, B runs paper, C runs silver.
          </p>
          <div className="mt-10 space-y-10">
            {panels.map((panel) => {
              const landing = landings(day, panel.result)
              return (
                <div key={panel.name}>
                  <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
                    {panel.name} — {meters(panel.result.totals.putawayMeters)} m
                  </p>
                  <div className="mt-3 flex gap-6 overflow-x-auto pb-2">
                    {day.slots
                      .filter((slot) => slot.bay === 1 && slot.level === 1)
                      .map((aisleSlot) => (
                        <div key={aisleSlot.aisle} className="shrink-0">
                          <div className="grid grid-cols-8 gap-[3px]">
                            {Array.from({ length: 8 }, (_, bayIndex) => (
                              <div key={bayIndex} className="flex flex-col gap-[3px]">
                                {[4, 3, 2, 1].map((level) => {
                                  const cell = day.slots.find(
                                    (slot) => slot.aisle === aisleSlot.aisle && slot.bayIndex === bayIndex && slot.level === level,
                                  )
                                  const landed = cell ? landing.get(cell.id) : undefined
                                  return (
                                    <div
                                      key={level}
                                      className="h-[13px] w-[13px] rounded-[2px]"
                                      style={{ backgroundColor: landed ? (landed.fresh ? BAND_FILL[landed.band] : BAND_DIM[landed.band]) : "rgba(255, 255, 255, 0.045)" }}
                                      title={cell ? `${cell.id}${landed ? ` · ${landed.skuId}` : ""}` : ""}
                                    />
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-center font-mono text-[11px] text-silver">{aisleSlot.aisle}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-silver">
            <span className="flex items-center gap-2">
              <span className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: BAND_FILL.A }} /> band A
              <span className="ml-4 inline-block h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: BAND_FILL.B }} /> band B
              <span className="ml-4 inline-block h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: BAND_FILL.C }} /> band C
              <span className="ml-4 inline-block h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: "rgba(255, 255, 255, 0.045)" }} /> empty
            </span>
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            The walk, compared.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            Putaway meters are one-way dock-to-bay. The fork pays full price; direction discounts the day.
          </p>
          <div className="mt-10 max-w-4xl space-y-6">
            {panels.map((panel, index) => (
              <div key={panel.name}>
                <div className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
                  <span>{panel.name}</span>
                  <span>
                    {meters(speeds[index])} m · share {(panel.result.totals.goldenShare).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 h-3 w-full rounded-[2px] bg-white/5">
                  <div
                    className="h-3 rounded-[2px]"
                    style={{
                      width: width(speeds[index]),
                      backgroundColor: index === 0 ? "#51e076" : index === 1 ? "rgba(247, 247, 247, 0.75)" : "rgba(163, 163, 163, 0.5)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            The replenish ledger.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            The face opens six lines short. One of them was fine until today&apos;s opening moved eight cartons out to the
            cross-dock; another picks a line that never gets a second receipt and closes the day still armed.
          </p>
          <div className="mt-10 max-w-3xl">
            <div className="grid grid-cols-[4.5rem_2.5rem_5rem_5rem_1fr] gap-x-4 border-b border-white/10 pb-2 font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
              <span>sku</span>
              <span>band</span>
              <span>on hand</span>
              <span>action</span>
              <span>asks</span>
            </div>
            {directed.signals.map((signal) => {
              const sku = day.skus.find((item) => item.id === signal.skuId)
              const band = sku ? bandOf(sku.picks, day.bands) : "C"
              return (
                <div
                  key={`${signal.action}-${signal.skuId}-${signal.onHand}`}
                  className="grid grid-cols-[4.5rem_2.5rem_5rem_5rem_1fr] gap-x-4 border-b border-white/10 py-2.5"
                >
                  <span className="font-mono text-sm">{signal.skuId}</span>
                  <span className="font-mono text-sm text-silver">{band}</span>
                  <span className="font-mono text-sm text-silver">{signal.onHand}</span>
                  <span className={`font-mono text-sm ${signal.action === "raise" ? "text-signal" : "text-silver"}`}>
                    {signal.action === "raise" ? "+" : "−"} {signal.action}
                  </span>
                  <span className="text-silver">
                    {signal.action === "raise" ? `${signal.cartons} cartons to the face line` : "the line settles"}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-6 max-w-2xl text-silver">
            {armedSkuIds.size ? [...armedSkuIds].join(" and ") : "Nothing"} leave{armedSkuIds.size === 1 ? "s" : ""} the day
            still armed — quiet needs not just the minimum, but the minimum plus hysteresis, and the day
            can&apos;t always buy that.
          </p>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            Five lines, read aloud.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            The directives the engine prints, a few of them at length. Split lines, case conversion, beam refusals, and a
            top-off all appear in this one day.
          </p>
          <div className="mt-10 max-w-4xl">
            {walkthrough.map((row, index) => (
              <article key={row.receipt} className={`border-t border-white/10 py-8 ${index === walkthrough.length - 1 ? "border-b" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-x-6">
                  <span className="font-mono text-sm text-signal">{row.receipt}</span>
                  <span className="text-xl tracking-[-0.02em]">{row.sku}</span>
                  <span className="font-mono text-sm text-silver">{row.load}</span>
                </div>
                <p className="mt-3 max-w-2xl text-silver">{row.headline}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">
            What the day refuses.
          </h2>
          <p className="mt-4 max-w-2xl text-silver">
            Zero refusals today — the rack had room. The checks ran anyway, and they are why the ending state adds up:
          </p>
          <ul className="mt-8 max-w-3xl space-y-3 text-silver">
            <li>
              <span className="text-paper">No negative stock.</span> An opening may move cartons out, but not below zero.
            </li>
            <li>
              <span className="text-paper">One SKU a bay.</span> A landing tops off its own bay or takes an empty one; it
              never shares.
            </li>
            <li>
              <span className="text-paper">No over-cube.</span> Cartons cannot exceed the liters the level publishes.
            </li>
            <li>
              <span className="text-paper">Heavy stays low.</span> Anything at twelve kilograms or more is refused above
              level one.
            </li>
            <li>
              <span className="text-paper">No double allocation.</span> A bay filled by one line is never handed to a second.
            </li>
          </ul>
        </section>

        <section className="border-t border-white/10 px-5 py-16 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.04em]">Lineage.</h2>
          <p className="mt-4 max-w-2xl text-silver">
            The three policies are the classic trio the slotting literature compares — dedicated placement by velocity,
            correlated placement by affinity, and a randomized control. The corridor cost model, the band premiums, and
            the forward-pick thresholds are all textbook fare.
          </p>
          <ul className="mt-8 max-w-3xl space-y-2 text-silver">
            <li>van den Berg, 1999 — a literature survey of storage and assignment planning.</li>
            <li>de Koster, 2007 — the order-picking reviews that frame directed versus undirected travel.</li>
            <li>Gu, Goetschalckx &amp; McGinnis, 2007 — warehouse operation research reviews.</li>
            <li>Bartholdi &amp; Hackman — <span className="italic">Warehouse &amp; Distribution Science</span>, the open textbook.</li>
          </ul>
          <p className="mt-8 max-w-2xl text-silver">
            The extract is invented. The face these aisles feed is <Link href="/floor" className="text-paper underline decoration-white/20 underline-offset-4 hover:text-signal">the floor</Link>, and the
            score that prices it <Link href="/#method" className="text-paper underline decoration-white/20 underline-offset-4 hover:text-signal">the method</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
