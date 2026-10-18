"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { BayDetail } from "@/components/bay-detail"
import { FloorMap } from "@/components/floor-map"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatDelta,
  formatFit,
  formatShare,
  formatSteps,
  formatWalk,
  measure,
  type FaceMetrics,
} from "@/lib/metrics"
import { ExtractError, arrivedLayout, proposeLayout, type Proposal } from "@/lib/place"
import {
  AFFINITIES,
  LEVELS,
  SKUS,
  SLOTS,
  skuById,
  slotOf,
  tornExtract,
  type Assignment,
  type Level,
} from "@/lib/warehouse"

type Mode = "arrived" | "proposed" | "empty" | "running" | "error"

const EMPTY: Assignment = {}

const LEVEL_COPY: Record<Level, string> = {
  1: "L1 Floor",
  2: "L2 Golden",
  3: "L3 Golden",
  4: "L4 Beam",
}

export function FloorStudio() {
  const arrived = useMemo(() => arrivedLayout(SKUS, SLOTS), [])
  const arrivedMetrics = useMemo(() => measure(arrived, SKUS, SLOTS, AFFINITIES), [arrived])
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [mode, setMode] = useState<Mode>("arrived")
  const [fault, setFault] = useState<string | null>(null)
  const [level, setLevel] = useState<Level>(2)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [scoreOpen, setScoreOpen] = useState(true)

  const shown: Assignment =
    mode === "proposed" && proposal
      ? proposal.assignment
      : mode === "empty" || mode === "error"
        ? EMPTY
        : arrived

  const shownMetrics = useMemo(() => measure(shown, SKUS, SLOTS, AFFINITIES), [shown])
  const proposalMetrics = useMemo(
    () => (proposal ? measure(proposal.assignment, SKUS, SLOTS, AFFINITIES) : null),
    [proposal],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...SKUS]
      .sort((a, b) => b.picks - a.picks)
      .filter((sku) => {
        if (!needle) return true
        return sku.name.toLowerCase().includes(needle) || sku.id.toLowerCase().includes(needle)
      })
  }, [query])

  function openSheetIfNarrow() {
    if (window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true)
  }

  function focusSku(skuId: string, assignment: Assignment) {
    setSelectedSku(skuId)
    const slot = slotOf(assignment, skuId)
    setSelectedSlot(slot?.id ?? null)
    if (slot) setLevel(slot.level)
    openSheetIfNarrow()
  }

  function focusSlot(slotId: string, assignment: Assignment) {
    setSelectedSlot(slotId)
    setSelectedSku(assignment[slotId] ?? null)
    openSheetIfNarrow()
  }

  function show(next: "arrived" | "proposed" | "empty") {
    const assignment = next === "proposed" && proposal ? proposal.assignment : next === "arrived" ? arrived : {}
    setMode(next)
    if (selectedSku) {
      const slot = slotOf(assignment, selectedSku)
      setSelectedSlot(slot?.id ?? null)
      if (slot) setLevel(slot.level)
    }
  }

  async function run() {
    setMode("running")
    setFault(null)
    await new Promise((resolve) => setTimeout(resolve, 720))
    try {
      const next = proposeLayout(SKUS, SLOTS, AFFINITIES)
      setProposal(next)
      setMode("proposed")
      const follow = selectedSku ?? "MG-01"
      setSelectedSku(follow)
      const slot = slotOf(next.assignment, follow)
      setSelectedSlot(slot?.id ?? null)
      if (slot) setLevel(slot.level)
    } catch (error) {
      setFault(error instanceof ExtractError ? error.message : "The placement stopped before a bay was chosen.")
      setMode("error")
    }
  }

  function openTorn() {
    try {
      proposeLayout(tornExtract(), SLOTS, AFFINITIES)
    } catch (error) {
      setFault(error instanceof Error ? error.message : "The extract failed a check.")
      setMode("error")
      setSheetOpen(false)
    }
  }

  const walkCut =
    proposalMetrics && arrivedMetrics.walkMeters > 0
      ? Math.round((1 - proposalMetrics.walkMeters / arrivedMetrics.walkMeters) * 100)
      : null

  const detail = (
    <BayDetail
      slotId={selectedSlot}
      skuId={selectedSku}
      assignment={mode === "running" ? arrived : shown}
      note={selectedSku ? proposal?.notes[selectedSku] : undefined}
      arrived={mode === "arrived" || mode === "running"}
      onFocusSku={(id) => focusSku(id, mode === "proposed" && proposal ? proposal.assignment : shown)}
    />
  )

  return (
    <div className="px-5 pb-16 sm:px-8 lg:px-12">
      <Collapsible open={scoreOpen} onOpenChange={setScoreOpen} className="border border-white/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase">How a bay is scored</span>
          <ChevronDown className={`size-4 text-signal transition-transform ${scoreOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-5">
          <div className="grid gap-6 border-t border-white/10 pt-4 lg:grid-cols-3">
            <p className="text-sm leading-relaxed text-silver">
              <span className="text-paper">Reach.</span> Daily picks multiply the return walk from the south dock, and a stoop or a ladder makes that walk count for more. Anchors — the cartons that add up to just over half of all picks — are placed first, and only in the golden band unless nothing there can hold them.
            </p>
            <p className="text-sm leading-relaxed text-silver">
              <span className="text-paper">Mass and fit.</span> Anything at 12 kg or more is pulled onto the floor and refused the top beam. Light cartons are nudged off the floor so that shelf stays free. A carton must fit. Among bays that can hold it, a tighter leftover scores better.
            </p>
            <p className="text-sm leading-relaxed text-silver">
              <span className="text-paper">Kinship.</span> After an anchor is down, cartons that leave on the same orders are drawn toward neighboring bays, even if the walk is a little longer. Slower companions pay extra to enter the golden band, so a bolt of cloth does not take a waist-high hole for free.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {mode === "error" ? (
        <div className="mt-8 border border-destructive/50 px-6 py-16 sm:px-10" role="alert">
          <p className="font-mono text-[11px] tracking-[0.18em] text-destructive uppercase">Torn extract</p>
          <h2 className="mt-4 max-w-3xl text-4xl tracking-[-0.04em] sm:text-5xl">This file cannot be placed.</h2>
          <p className="mt-5 max-w-xl text-silver">{fault}</p>
          <p className="mt-3 max-w-xl text-sm text-silver">
            Quay stopped before touching a bay. Restore the sample extract — thirty readable cartons — and run the placement again.
          </p>
          <Button className="mt-8" onClick={() => show("arrived")}>
            Restore the sample
          </Button>
        </div>
      ) : (
        <>
          {walkCut !== null && proposalMetrics ? (
            <p className="mt-8 max-w-4xl text-2xl tracking-[-0.04em] sm:text-3xl" aria-live="polite">
              The proposal walks {walkCut}% less than the layout that arrived — {formatWalk(proposalMetrics.walkMeters)} a day instead of {formatWalk(arrivedMetrics.walkMeters)}.
            </p>
          ) : (
            <p className="mt-8 max-w-3xl text-xl tracking-[-0.03em] text-silver sm:text-2xl">
              The arrived face still has the fast tins on the far beam. Place the floor to read a different house.
            </p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
            <Metric
              label="Return walk"
              hint="Each pick line walks out to its bay and back to the south dock. This is not a batched tour."
              value={shownMetrics.placed === 0 ? "—" : formatWalk(shownMetrics.walkMeters)}
              note={metricNote(shownMetrics, arrivedMetrics, proposalMetrics, mode, (m) => m.walkMeters, formatWalk)}
              good={better("down", shownMetrics.walkMeters, arrivedMetrics.walkMeters, mode)}
            />
            <Metric
              label="Golden picks"
              hint="Share of daily picks that land on level 2 or 3, between waist and shoulder."
              value={shownMetrics.placed === 0 ? "—" : formatShare(shownMetrics.goldenShare)}
              note={metricNote(shownMetrics, arrivedMetrics, proposalMetrics, mode, (m) => m.goldenShare, formatShare)}
              good={better("up", shownMetrics.goldenShare, arrivedMetrics.goldenShare, mode)}
            />
            <Metric
              label="Cube fit"
              hint="Average share of each occupied bay that the carton actually fills."
              value={shownMetrics.placed === 0 ? "—" : formatFit(shownMetrics.meanFit)}
              note={metricNote(shownMetrics, arrivedMetrics, proposalMetrics, mode, (m) => m.meanFit, formatFit)}
              good={better("up", shownMetrics.meanFit, arrivedMetrics.meanFit, mode)}
            />
            <Metric
              label="Heavy on the beam"
              hint="Cartons of 12 kg or more sitting on level 4."
              value={shownMetrics.placed === 0 ? "—" : String(shownMetrics.heavyOnBeam)}
              note={metricNote(shownMetrics, arrivedMetrics, proposalMetrics, mode, (m) => m.heavyOnBeam, (value) => String(value))}
              good={better("down", shownMetrics.heavyOnBeam, arrivedMetrics.heavyOnBeam, mode)}
            />
          </div>
          {shownMetrics.placed > 0 ? (
            <p className="mt-3 max-w-3xl text-sm text-silver">
              Co-picked pairs sit {formatSteps(shownMetrics.kinshipSteps)} aisle-and-bay steps apart
              {mode === "proposed"
                ? ` — ${formatSteps(arrivedMetrics.kinshipSteps)} on the arrived face.`
                : mode === "arrived" && proposalMetrics
                  ? ` — ${formatSteps(proposalMetrics.kinshipSteps)} after the proposal.`
                  : "."}
            </p>
          ) : null}
          {proposalMetrics && shownMetrics.meanFit < arrivedMetrics.meanFit && mode !== "empty" ? (
            <p className="mt-3 max-w-3xl text-sm text-silver">
              Cube fit can loosen when a fast tin leaves a shallow beam slot for the golden band. The walk is worth more than the leftover air.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button onClick={run} disabled={mode === "running"}>
                {mode === "running" ? "Scoring" : "Place the floor"}
              </Button>
              <Button
                variant="outline"
                onClick={() => show("arrived")}
                disabled={mode === "running"}
                aria-pressed={mode === "arrived"}
                className={mode === "arrived" ? "bg-signal text-deep" : ""}
              >
                Arrived layout
              </Button>
              <Button
                variant="outline"
                onClick={() => show("proposed")}
                disabled={!proposal || mode === "running"}
                aria-pressed={mode === "proposed"}
                className={mode === "proposed" ? "bg-signal text-deep" : ""}
              >
                Proposal
              </Button>
              <Button variant="ghost" onClick={() => show("empty")} disabled={mode === "running" || mode === "empty"}>
                Clear the face
              </Button>
            </div>
            <Button variant="ghost" onClick={openTorn} disabled={mode === "running"}>
              Preview a torn extract
            </Button>
          </div>

          <Separator className="mt-6 bg-white/10" />

          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              {mode === "running" ? (
                <div className="flex min-h-[28rem] flex-col justify-between border border-white/10 p-6 sm:p-10" role="status">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">Scoring</p>
                  <div>
                    <h2 className="max-w-xl text-4xl tracking-[-0.045em] sm:text-6xl">Walking the open bays.</h2>
                    <p className="mt-4 max-w-lg text-silver">
                      Each carton is tried against every hole that can hold it. Reach, mass, fit, and kinship are scored together.
                    </p>
                  </div>
                  <div className="h-px overflow-hidden bg-white/10">
                    <div className="quay-scan h-full w-1/3 bg-signal" />
                  </div>
                </div>
              ) : mode === "empty" ? (
                <div className="border border-white/10 px-6 py-16 sm:px-10">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">Open face</p>
                  <h2 className="mt-4 max-w-xl text-4xl tracking-[-0.04em] sm:text-5xl">Nothing is standing on the floor.</h2>
                  <p className="mt-4 max-w-md text-silver">
                    The extract is still loaded. Restore the layout that arrived, or place the floor from an empty face.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    <Button onClick={() => show("arrived")}>Restore the arrived layout</Button>
                    <Button variant="outline" onClick={run}>
                      Place the floor
                    </Button>
                  </div>
                </div>
              ) : (
                <Tabs
                  value={String(level)}
                  onValueChange={(value) => {
                    const next = Number(value)
                    if (next === 1 || next === 2 || next === 3 || next === 4) setLevel(next)
                  }}
                >
                  <TabsList variant="line" className="h-auto! w-full justify-start gap-0 rounded-none bg-transparent p-0">
                    {LEVELS.map((item) => (
                      <TabsTrigger
                        key={item}
                        value={String(item)}
                        className="h-11 shrink-0 rounded-none border-b-2 border-transparent px-3 font-mono text-[11px] tracking-[0.14em] uppercase after:hidden data-active:border-signal data-active:text-signal!"
                      >
                        {LEVEL_COPY[item]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value={String(level)} className="mt-4">
                    <FloorMap
                      level={level}
                      assignment={shown}
                      selected={selectedSlot}
                      onSelect={(slotId) => focusSlot(slotId, shown)}
                    />
                  </TabsContent>
                </Tabs>
              )}

              <div className="mt-8 lg:hidden">
                <SkuList
                  inputId="carton-find-mobile"
                  skus={filtered}
                  query={query}
                  onQuery={setQuery}
                  assignment={shown}
                  selected={selectedSku}
                  onSelect={(id) => focusSku(id, shown)}
                />
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-20 max-h-[calc(100svh-6.5rem)] overflow-y-auto border border-white/10 p-5">
                {detail}
                <Separator className="my-6 bg-white/10" />
                <SkuList
                  inputId="carton-find-desk"
                  skus={filtered}
                  query={query}
                  onQuery={setQuery}
                  assignment={shown}
                  selected={selectedSku}
                  onSelect={(id) => focusSku(id, shown)}
                />
              </div>
            </aside>
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto border-white/15 bg-deep">
              <SheetHeader className="pr-12 text-left">
                <SheetTitle className="font-mono text-[11px] tracking-[0.16em] uppercase">Bay reading</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">{detail}</div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}

function better(direction: "up" | "down", shown: number, arrived: number, mode: Mode) {
  if (mode !== "proposed") return false
  return direction === "down" ? shown < arrived : shown > arrived
}

function metricNote(
  shown: FaceMetrics,
  arrived: FaceMetrics,
  proposal: FaceMetrics | null,
  mode: Mode,
  pick: (metrics: FaceMetrics) => number,
  format: (value: number) => string,
) {
  if (mode === "empty" || shown.placed === 0) return "Nothing on the face"
  if (mode === "proposed") {
    return `${formatDelta(pick(shown), pick(arrived))} against arrived · was ${format(pick(arrived))}`
  }
  if (proposal && mode === "arrived") return `Proposal ${format(pick(proposal))}`
  return "Layout that arrived with the extract"
}

function Metric({
  label,
  hint,
  value,
  note,
  good,
}: {
  label: string
  hint: string
  value: string
  note: string
  good: boolean
}) {
  return (
    <div className="bg-deep px-4 py-5 sm:px-5">
      <Tooltip>
        <TooltipTrigger className="font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{label}</TooltipTrigger>
        <TooltipContent className="max-w-xs bg-paper text-deep">{hint}</TooltipContent>
      </Tooltip>
      <p className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">{value}</p>
      <p className={`mt-2 font-mono text-[10px] tracking-[0.08em] uppercase ${good ? "text-signal" : "text-silver"}`}>{note}</p>
    </div>
  )
}

function SkuList({
  inputId,
  skus,
  query,
  onQuery,
  assignment,
  selected,
  onSelect,
}: {
  inputId: string
  skus: typeof SKUS
  query: string
  onQuery: (value: string) => void
  assignment: Assignment
  selected: string | null
  onSelect: (skuId: string) => void
}) {
  return (
    <div>
      <label className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase" htmlFor={inputId}>
        Cartons
      </label>
      <input
        id={inputId}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Find a carton"
        className="mt-2 w-full border-b border-white/20 bg-transparent py-2 text-sm text-paper outline-none placeholder:text-silver focus:border-signal"
      />
      {skus.length === 0 ? (
        <p className="py-8 text-sm text-silver">No carton matches that name. Try coffee, oats, or an MG code.</p>
      ) : (
        <ScrollArea className="mt-3 h-80">
          <ul>
            {skus.map((sku) => {
              const slot = slotOf(assignment, sku.id)
              const active = selected === sku.id
              return (
                <li key={sku.id} className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => onSelect(sku.id)}
                    className={`flex w-full items-baseline justify-between gap-3 py-2.5 text-left ${active ? "text-signal" : "hover:text-signal"}`}
                  >
                    <span className="truncate">
                      {sku.short}
                      <span className="ml-2 font-mono text-[10px] text-silver">{sku.picks}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-silver uppercase">
                      {slot ? slot.id : "Unslotted"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
      <p className="mt-2 hidden text-xs text-silver lg:block">
        {skuById.size} fictional cartons. Click one to read its bay.
      </p>
    </div>
  )
}
