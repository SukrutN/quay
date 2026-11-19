"use client"

import { useMemo, useState } from "react"
import { arrivedLayout, proposeLayout, type Decision } from "@/lib/place"
import { returnWalkMeters, skuById, slotById, slotOf, AFFINITIES, SKUS, SLOTS } from "@/lib/warehouse"

const RANKED = [...SKUS].sort((a, b) => b.picks - a.picks || a.id.localeCompare(b.id))
const DEFAULT_ID = RANKED[0]?.id ?? SKUS[0].id

const TERMS: { key: keyof Pick<Decision, "reach" | "mass" | "fit" | "band" | "kinship">; label: string; gloss: string }[] = [
  { key: "reach", label: "Reach", gloss: "picks a day times the return walk, sterner on the floor and the top beam" },
  { key: "mass", label: "Mass", gloss: "the weight-by-level refusal: heavy stays low, light stays off the floor" },
  { key: "fit", label: "Fit", gloss: "the leftover air a bay would hold around this carton, priced" },
  { key: "band", label: "Band", gloss: "the premium a slow carton pays for a waist-high hole" },
  { key: "kinship", label: "Kinship pull", gloss: "the pull toward neighbors that leave on the same orders, subtracted" },
]

const point = (value: number) => Math.round(value).toLocaleString("en-US")

export function ScorerPanel() {
  const arrived = useMemo(() => arrivedLayout(SKUS, SLOTS), [])
  const proposal = useMemo(() => proposeLayout(SKUS, SLOTS, AFFINITIES), [])
  const [selected, setSelected] = useState(DEFAULT_ID)

  const sku = skuById.get(selected)
  const decision = proposal.trace.find((row) => row.skuId === selected)
  if (!sku || !decision) return null

  const chosen = slotById.get(decision.chosenSlotId)
  const chosenWalk = chosen ? returnWalkMeters(chosen) : 0
  const arrivedSlot = slotOf(arrived, selected)
  const arrivedWalk = arrivedSlot ? returnWalkMeters(arrivedSlot) : null
  const runnerGap =
    decision.runnerUpTotal !== null && decision.total > 0
      ? Math.round(((decision.runnerUpTotal - decision.total) / decision.total) * 100)
      : null
  const perLineSaving = arrivedWalk !== null ? Math.round(arrivedWalk - chosenWalk) : null

  return (
    <div className="border border-white/10">
      <div className="border-b border-white/10 p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">
          The score, live · House 4, the demo face
        </p>
        <label className="mt-4 block max-w-sm">
          <span className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">Pick a carton</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-2 w-full border border-white/20 bg-transparent px-3 py-2.5 font-mono text-sm text-paper outline-none focus:border-signal"
          >
            {RANKED.map((item) => (
              <option key={item.id} value={item.id} className="bg-deep text-paper">
                {item.short} · {item.picks} picks a day
              </option>
            ))}
          </select>
        </label>
        <p className="mt-6 max-w-3xl text-xl leading-snug tracking-[-0.02em] sm:text-2xl" aria-live="polite">
          You picked {sku.name}, {sku.picks} picks a day. The score seats it at{" "}
          <span className="text-signal">{decision.chosenSlotId}</span>
          {decision.candidates > 1
            ? `, and none of the ${decision.candidates} open bays that can hold it scores lower`
            : ", the only open bay that can hold it"}
          .
        </p>
      </div>
      <div className="grid gap-px bg-white/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-deep p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">The terms, lower is cheaper</p>
          <dl className="mt-4">
            {TERMS.map((term) => (
              <div key={term.key} className="grid grid-cols-[7rem_5rem_1fr] items-baseline gap-3 border-t border-white/10 py-3">
                <dt className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{term.label}</dt>
                <dd className="font-mono text-sm text-paper">{point(decision[term.key])}</dd>
                <dd className="text-xs leading-relaxed text-silver">{term.gloss}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[7rem_5rem_1fr] items-baseline gap-3 border-t border-white/10 py-3">
              <dt className="font-mono text-[11px] tracking-[0.14em] text-signal uppercase">Total</dt>
              <dd className="font-mono text-sm text-signal">{point(decision.total)}</dd>
              <dd className="text-xs leading-relaxed text-silver">
                reach plus mass plus fit plus band, minus the kinship pull{decision.runnerUpSlotId ? (
                  <>
                    ; the next-cheapest bay, {decision.runnerUpSlotId}
                    {runnerGap !== null ? `, scores ${runnerGap} percent higher` : ""}
                  </>
                ) : (
                  ""
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="bg-deep p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Against the layout that arrived</p>
          <p className="mt-4 text-sm leading-relaxed text-silver">
            The extract parked it at{" "}
            <span className="text-paper">{arrivedSlot ? arrivedSlot.id : "no bay"}</span>
            {arrivedWalk !== null ? `, a ${Math.round(arrivedWalk)} m return` : ""}. The proposal gives it{" "}
            <span className="text-paper">{decision.chosenSlotId}</span>, a {Math.round(chosenWalk)} m return.
          </p>
          {perLineSaving !== null ? (
            <p className="mt-3 text-sm leading-relaxed text-silver">
              That is {perLineSaving} m less walking on each of its {sku.picks} daily lines, so{" "}
              <span className="text-paper">{(perLineSaving * sku.picks).toLocaleString("en-US")} m</span> back from the
              aisle every day.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-silver">
            {decision.anchor
              ? "Anchors, the cartons that add up to a little over half of all picks, are seated first, and only into the golden band unless nothing there can hold them."
              : "Companions follow the anchors, drawn toward bays near the work they leave with."}
          </p>
        </div>
      </div>
    </div>
  )
}
