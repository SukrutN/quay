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

export const AISLES = ["A", "B", "C", "D", "E"] as const
export const BAYS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const LEVELS: Level[] = [1, 2, 3, 4]

export const RULES = {
  heavyKg: 12,
  lightKg: 2.2,
  anchorPickShare: 0.55,
  slowCompanionCutoff: 40,
  dockToAisleA: 4.2,
  aislePitch: 3.6,
  mouthToBay1: 2.4,
  bayPitch: 2.5,
} as const

const BASE_CUBE: Record<Level, number> = {
  1: 46,
  2: 30,
  3: 22,
  4: 12,
}

function isWideBay(bay: number) {
  return bay === 2 || bay === 5 || bay === 8
}

export function buildSlots(): Slot[] {
  const slots: Slot[] = []
  AISLES.forEach((aisle, aisleIndex) => {
    BAYS.forEach((bay, bayIndex) => {
      LEVELS.forEach((level) => {
        const wide = isWideBay(bay)
        const cubeLiters = Math.round(BASE_CUBE[level] * (wide ? 1.4 : 1))
        slots.push({
          id: `${aisle}-${String(bay).padStart(2, "0")}-L${level}`,
          aisle,
          aisleIndex,
          bay,
          bayIndex,
          level,
          cubeLiters,
          wide,
          golden: level === 2 || level === 3,
        })
      })
    })
  })
  return slots
}

export const SLOTS = buildSlots()

export const slotById = new Map(SLOTS.map((slot) => [slot.id, slot]))

/** Fictional dry goods for Marrow Goods, House 4. Not a real catalog. */
export const SKUS: Sku[] = [
  { id: "MG-01", name: "Blue tin coffee", short: "Coffee", picks: 240, cubeLiters: 4.2, weightKg: 1.6 },
  { id: "MG-02", name: "Paper sleeve filters", short: "Filters", picks: 188, cubeLiters: 1.4, weightKg: 0.3 },
  { id: "MG-03", name: "Matchbox cloves", short: "Cloves", picks: 156, cubeLiters: 0.9, weightKg: 0.2 },
  { id: "MG-04", name: "Rye cracker crates", short: "Crackers", picks: 142, cubeLiters: 18, weightKg: 6.4 },
  { id: "MG-05", name: "Fennel salt tins", short: "Salt", picks: 128, cubeLiters: 3.1, weightKg: 2.8 },
  { id: "MG-06", name: "Peppercorn drums", short: "Pepper", picks: 110, cubeLiters: 6.5, weightKg: 3.2 },
  { id: "MG-07", name: "Cedar soap bars", short: "Soap", picks: 96, cubeLiters: 5, weightKg: 2.4 },
  { id: "MG-08", name: "Lemon oil vials", short: "Lemon oil", picks: 90, cubeLiters: 1.2, weightKg: 0.5 },
  { id: "MG-09", name: "Honeycomb wraps", short: "Wraps", picks: 84, cubeLiters: 2.4, weightKg: 0.4 },
  { id: "MG-10", name: "Linen tea towels", short: "Towels", picks: 72, cubeLiters: 8, weightKg: 1.1 },
  { id: "MG-11", name: "River oat sacks", short: "Oats", picks: 64, cubeLiters: 28, weightKg: 14.5 },
  { id: "MG-12", name: "White bean sacks", short: "Beans", picks: 58, cubeLiters: 26, weightKg: 15.2 },
  { id: "MG-13", name: "Cask vinegar jugs", short: "Vinegar", picks: 52, cubeLiters: 16, weightKg: 13.4 },
  { id: "MG-14", name: "Birch syrup bottles", short: "Syrup", picks: 48, cubeLiters: 11, weightKg: 9.6 },
  { id: "MG-15", name: "Pilot candle tins", short: "Candles", picks: 44, cubeLiters: 3.6, weightKg: 1.8 },
  { id: "MG-16", name: "Glass lamp oil", short: "Lamp oil", picks: 40, cubeLiters: 9.5, weightKg: 12.8 },
  { id: "MG-17", name: "Citrus peel jars", short: "Citrus", picks: 36, cubeLiters: 7.2, weightKg: 4.4 },
  { id: "MG-18", name: "Ash wood spoons", short: "Spoons", picks: 32, cubeLiters: 4.8, weightKg: 0.9 },
  { id: "MG-19", name: "Wool dryer balls", short: "Dryer balls", picks: 28, cubeLiters: 10, weightKg: 0.7 },
  { id: "MG-20", name: "Copper measuring cups", short: "Cups", picks: 24, cubeLiters: 3.4, weightKg: 2.6 },
  { id: "MG-21", name: "Millet grain bags", short: "Millet", picks: 22, cubeLiters: 24, weightKg: 13.8 },
  { id: "MG-22", name: "Ink bottle black", short: "Ink", picks: 18, cubeLiters: 1.1, weightKg: 0.6 },
  { id: "MG-23", name: "Night chalk sticks", short: "Chalk", picks: 16, cubeLiters: 2, weightKg: 1.4 },
  { id: "MG-24", name: "Canvas mailers", short: "Mailers", picks: 14, cubeLiters: 12, weightKg: 0.8 },
  { id: "MG-25", name: "Iron pan blanks", short: "Pans", picks: 12, cubeLiters: 20, weightKg: 16.4 },
  { id: "MG-26", name: "Clay planter saucers", short: "Saucers", picks: 11, cubeLiters: 22, weightKg: 14.1 },
  { id: "MG-27", name: "Stone mortar", short: "Mortar", picks: 9, cubeLiters: 15, weightKg: 18.2 },
  { id: "MG-28", name: "Folding crate lids", short: "Crate lids", picks: 8, cubeLiters: 34, weightKg: 4.2 },
  { id: "MG-29", name: "Bolt of ticking cloth", short: "Ticking", picks: 8, cubeLiters: 40, weightKg: 7.5 },
  { id: "MG-30", name: "Rain boot corks", short: "Corks", picks: 7, cubeLiters: 14, weightKg: 1.2 },
]

export const skuById = new Map(SKUS.map((sku) => [sku.id, sku]))

export const AFFINITIES: Affinity[] = [
  { a: "MG-01", b: "MG-02", strength: 0.92 },
  { a: "MG-01", b: "MG-03", strength: 0.74 },
  { a: "MG-01", b: "MG-04", strength: 0.48 },
  { a: "MG-01", b: "MG-11", strength: 0.36 },
  { a: "MG-05", b: "MG-04", strength: 0.81 },
  { a: "MG-05", b: "MG-06", strength: 0.7 },
  { a: "MG-05", b: "MG-13", strength: 0.52 },
  { a: "MG-05", b: "MG-17", strength: 0.45 },
  { a: "MG-07", b: "MG-08", strength: 0.66 },
  { a: "MG-07", b: "MG-10", strength: 0.73 },
  { a: "MG-07", b: "MG-09", strength: 0.6 },
  { a: "MG-11", b: "MG-12", strength: 0.7 },
  { a: "MG-16", b: "MG-15", strength: 0.78 },
  { a: "MG-03", b: "MG-14", strength: 0.3 },
]

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
