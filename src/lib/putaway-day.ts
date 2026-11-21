/**
 * Harbor & Lane day 07: the putaway day, read from the engine's published
 * fixture (engine/fixtures/putaway-day.json) instead of a hand-carried copy.
 * The engine's field names (picksPerDay, skuA/skuB, the rack block) become
 * the site's; the numbers have one home. Not a real warehouse.
 */
import dayJson from "../../engine/fixtures/putaway-day.json"

export type PutawaySlot = {
  id: string
  aisle: string
  aisleIndex: number
  bay: number
  bayIndex: number
  level: number
  cubeLiters: number
  ergonomics: "golden" | "floor" | "beam"
}

export type PutawaySku = {
  id: string
  name: string
  picks: number
  cubeLiters: number
  weightKg: number
}

export type PutawayAffinity = { a: string; b: string; strength: number }

export type PutawayReceipt = { id: string; skuId: string; units: number; uom: string }

export type PutawayThreshold = { minCartons: number; maxCartons: number; hysteresisCartons: number }

export type PutawayWeights = {
  goldenWeight: number
  lowWeight: number
  affinityWeight: number
  affinityDecayBays: number
  ergoGolden: number
  ergoFloor: number
  ergoBeam: number
  heavyKg: number
  maxLevelForHeavy: number
}

export type PutawayForward = {
  onHand: Record<string, number>
  thresholds: Record<"A" | "B" | "C", PutawayThreshold>
  openings: { skuId: string; cartons: number }[]
}

export type PutawayDay = {
  id: string
  name: string
  slots: PutawaySlot[]
  skus: PutawaySku[]
  affinities: PutawayAffinity[]
  uoms: Record<string, Record<string, number>>
  receipts: PutawayReceipt[]
  bands: { aCutoff: number; bCutoff: number }
  weights: PutawayWeights
  forward: PutawayForward
  startState: Record<string, { skuId: string; cartons: number }>
  seed: number
}

const RACK_SPEC = dayJson.rack
const CUBE_BY_LEVEL: Record<string, number> = RACK_SPEC.cubeLitersByLevel

export const RACK = {
  dockToFirstAisleMeters: RACK_SPEC.dockToFirstAisleMeters,
  aislePitchMeters: RACK_SPEC.aislePitchMeters,
  mouthToFirstBayMeters: RACK_SPEC.mouthToFirstBayMeters,
  bayPitchMeters: RACK_SPEC.bayPitchMeters,
  wideMultiplier: RACK_SPEC.wideMultiplier,
} as const

export type Band = "A" | "B" | "C"

export function bandOf(picks: number, bands: { aCutoff: number; bCutoff: number }): Band {
  if (picks >= bands.aCutoff) return "A"
  if (picks >= bands.bCutoff) return "B"
  return "C"
}

export function oneWayMeters(slot: { aisleIndex: number; bayIndex: number }) {
  const across = RACK.dockToFirstAisleMeters + slot.aisleIndex * RACK.aislePitchMeters
  const into = RACK.mouthToFirstBayMeters + slot.bayIndex * RACK.bayPitchMeters
  return across + into
}

/** The reserve rack the day document describes: three aisles x eight bays x four levels, in plan order. */
export function buildReserveSlots(): PutawaySlot[] {
  const wideBays = new Set<number>(RACK_SPEC.wideBays)
  const goldenLevels = new Set<number>(RACK_SPEC.goldenLevels)
  const slots: PutawaySlot[] = []
  RACK_SPEC.aisles.forEach((aisle, aisleIndex) => {
    RACK_SPEC.bays.forEach((bay, bayIndex) => {
      RACK_SPEC.levels.forEach((level) => {
        const wide = wideBays.has(bay)
        const ergonomics = level === RACK_SPEC.floorLevel ? "floor" : goldenLevels.has(level) ? "golden" : "beam"
        slots.push({
          id: `${aisle}-${String(bay).padStart(2, "0")}-L${level}`,
          aisle,
          aisleIndex,
          bay,
          bayIndex,
          level,
          cubeLiters: CUBE_BY_LEVEL[String(level)] * (wide ? RACK.wideMultiplier : 1),
          ergonomics,
        })
      })
    })
  })
  return slots
}

export const PUTAWAY_DAY: PutawayDay = {
  id: dayJson.id,
  name: dayJson.name,
  slots: buildReserveSlots(),
  skus: dayJson.skus.map((sku) => ({
    id: sku.id,
    name: sku.name,
    picks: sku.picksPerDay,
    cubeLiters: sku.cubeLiters,
    weightKg: sku.weightKg,
  })),
  affinities: dayJson.affinities.map((edge) => ({ a: edge.skuA, b: edge.skuB, strength: edge.strength })),
  uoms: dayJson.uoms,
  receipts: dayJson.receipts,
  bands: dayJson.bands,
  weights: dayJson.weights,
  forward: dayJson.forward,
  startState: dayJson.startState,
  seed: dayJson.seed,
}
