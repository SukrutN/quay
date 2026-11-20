import faceJson from "../../engine/fixtures/forward-pick.json"

export type Level = 1 | 2 | 3 | 4

export type Slot = {
  id: string
  aisle: string
  aisleIndex: number
  bay: number
  bayIndex: number
  level: Level
  cubeLiters: number
  wide: boolean
  golden: boolean
}

export type Sku = {
  id: string
  name: string
  short: string
  picks: number
  cubeLiters: number
  weightKg: number
}

export type Affinity = {
  a: string
  b: string
  strength: number
}

export type Assignment = Record<string, string>

const RACK_SPEC = faceJson.rack
const CUBE_BY_LEVEL: Record<string, number> = RACK_SPEC.cubeLitersByLevel

export const AISLES = RACK_SPEC.aisles
export const BAYS = RACK_SPEC.bays
export const LEVELS = RACK_SPEC.levels as Level[]

/**
 * The geometry and the heavy/light lines are the engine document's. The
 * anchor share and the slow-companion cutoff are the studio's own walkthrough
 * knobs — the engine's slotting policy carries its own, different, weights.
 */
export const RULES = {
  heavyKg: faceJson.policy.heavyKg,
  lightKg: faceJson.policy.lightKg,
  anchorPickShare: 0.55,
  slowCompanionCutoff: 40,
  dockToAisleA: RACK_SPEC.dockToFirstAisleMeters,
  aislePitch: RACK_SPEC.aislePitchMeters,
  mouthToBay1: RACK_SPEC.mouthToFirstBayMeters,
  bayPitch: RACK_SPEC.bayPitchMeters,
} as const

const WIDE_BAYS = new Set<number>(RACK_SPEC.wideBays)

const GOLDEN_LEVELS = new Set<number>(RACK_SPEC.goldenLevels)

function isWideBay(bay: number) {
  return WIDE_BAYS.has(bay)
}

export function buildSlots(): Slot[] {
  const slots: Slot[] = []
  AISLES.forEach((aisle, aisleIndex) => {
    BAYS.forEach((bay, bayIndex) => {
      LEVELS.forEach((level) => {
        const wide = isWideBay(bay)
        const cubeLiters = Math.round(CUBE_BY_LEVEL[String(level)] * (wide ? RACK_SPEC.wideMultiplier : 1))
        slots.push({
          id: `${aisle}-${String(bay).padStart(2, "0")}-L${level}`,
          aisle,
          aisleIndex,
          bay,
          bayIndex,
          level,
          cubeLiters,
          wide,
          golden: GOLDEN_LEVELS.has(level),
        })
      })
    })
  })
  return slots
}

export const SLOTS = buildSlots()

export const slotById = new Map(SLOTS.map((slot) => [slot.id, slot]))

/** The short shelf names the studio draws on the face. */
const SHORT_NAMES: Record<string, string> = {
  "MG-01": "Coffee",
  "MG-02": "Filters",
  "MG-03": "Cloves",
  "MG-04": "Crackers",
  "MG-05": "Salt",
  "MG-06": "Pepper",
  "MG-07": "Soap",
  "MG-08": "Lemon oil",
  "MG-09": "Wraps",
  "MG-10": "Towels",
  "MG-11": "Oats",
  "MG-12": "Beans",
  "MG-13": "Vinegar",
  "MG-14": "Syrup",
  "MG-15": "Candles",
  "MG-16": "Lamp oil",
  "MG-17": "Citrus",
  "MG-18": "Spoons",
  "MG-19": "Dryer balls",
  "MG-20": "Cups",
  "MG-21": "Millet",
  "MG-22": "Ink",
  "MG-23": "Chalk",
  "MG-24": "Mailers",
  "MG-25": "Pans",
  "MG-26": "Saucers",
  "MG-27": "Mortar",
  "MG-28": "Crate lids",
  "MG-29": "Ticking",
  "MG-30": "Corks",
}

/** Fictional dry goods for Marrow Goods, House 4 — the engine's catalog, not a real one. */
export const SKUS: Sku[] = faceJson.skus.map((sku) => ({
  id: sku.id,
  name: sku.name,
  short: SHORT_NAMES[sku.id] ?? sku.name,
  picks: sku.picksPerDay,
  cubeLiters: sku.cubeLiters,
  weightKg: sku.weightKg,
}))

export const skuById = new Map(SKUS.map((sku) => [sku.id, sku]))

export const AFFINITIES: Affinity[] = faceJson.affinities.map((edge) => ({
  a: edge.skuA,
  b: edge.skuB,
  strength: edge.strength,
}))

export function partnersOf(skuId: string) {
  const partners: { id: string; strength: number }[] = []
  for (const edge of AFFINITIES) {
    if (edge.a === skuId) partners.push({ id: edge.b, strength: edge.strength })
    else if (edge.b === skuId) partners.push({ id: edge.a, strength: edge.strength })
  }
  return partners.sort((a, b) => b.strength - a.strength)
}

export function returnWalkMeters(slot: Slot) {
  const across = RULES.dockToAisleA + slot.aisleIndex * RULES.aislePitch
  const intoAisle = RULES.mouthToBay1 + slot.bayIndex * RULES.bayPitch
  return 2 * (across + intoAisle)
}

export function baySteps(a: Slot, b: Slot) {
  return Math.abs(a.aisleIndex - b.aisleIndex) + Math.abs(a.bayIndex - b.bayIndex)
}

export function levelName(level: Level) {
  if (level === 1) return "Floor"
  if (level === 4) return "Top beam"
  return "Golden band"
}

export function weightWord(kg: number) {
  if (kg >= RULES.heavyKg) return "Heavy"
  if (kg <= RULES.lightKg) return "Light"
  return "Moderate"
}

export function slotOf(assignment: Assignment, skuId: string) {
  for (const [slotId, id] of Object.entries(assignment)) {
    if (id === skuId) return slotById.get(slotId)
  }
  return undefined
}

export function tornExtract(): Sku[] {
  return SKUS.map((sku) => {
    if (sku.id === "MG-03") return { ...sku, picks: -4 }
    if (sku.id === "MG-29") return { ...sku, cubeLiters: 900 }
    return sku
  })
}
