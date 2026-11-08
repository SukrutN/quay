/**
 * The putaway engine, ported from quay-engine's putaway module. Three policies
 * direct one day's receipts: velocity, affinity, and the seeded random fork the
 * two are measured against. The random fork replays java.util.Random exactly —
 * a 48-bit LCG plus the shuffle Collections.shuffle specifies — so the site
 * carries the engine's numbers into its plots.
 */
import {
  type Band,
  type PutawayDay,
  type PutawayReceipt,
  type PutawaySlot,
  type PutawaySku,
  bandOf,
  oneWayMeters,
} from "./putaway-day"

export type PutawayDirective = {
  receiptId: string
  skuId: string
  skuName: string
  band: Band
  destination: "forward" | "reserve"
  units: number
  uom: string
  cartons: number
  slotId: string
  putawayMeters: number
}

export type PutawaySignal = {
  skuId: string
  onHand: number
  action: "raise" | "quiet"
  cartons: number
}

export type PutawayTotals = {
  receipts: number
  refused: number
  cartons: number
  cartonsForward: number
  cartonsReserve: number
  goldenShare: number
  putawayMeters: number
  baysTouched: number
}

export type PutawayResult = {
  policy: string
  directives: PutawayDirective[]
  refusals: { receiptId: string; reason: string }[]
  signals: PutawaySignal[]
  endState: Record<string, { skuId: string; cartons: number }>
  totals: PutawayTotals
}

/** The cartons one receipt line carries, by the unit of measure it names. */
export function cartonsOf(day: PutawayDay, receipt: PutawayReceipt): number | null {
  if (receipt.uom === "carton" || receipt.uom === "each") return receipt.units
  const conversion = day.uoms[receipt.skuId]?.[receipt.uom]
  if (!Number.isFinite(conversion) || conversion <= 0) return null
  const cartons = receipt.units * conversion
  return Math.abs(cartons - Math.round(cartons)) < 1.0e-9 ? Math.round(cartons) : null
}

/** java.util.Random, faithfully: a 48-bit LCG run on BigInt so the bits stay whole. */
const MASK48 = (BigInt(1) << BigInt(48)) - BigInt(1)
const MUL = BigInt("0x5DEECE66D")
const ADD = BigInt("0xB")

class JavaRandom {
  private state: bigint

  constructor(seed: number) {
    this.state = (BigInt(seed) ^ MUL) & MASK48
  }

  private next(bits: number): number {
    this.state = (this.state * MUL + ADD) & MASK48
    return Number((this.state >> BigInt(48 - bits)) & ((BigInt(1) << BigInt(bits)) - BigInt(1)))
  }

  nextInt(bound: number): number {
    if ((bound & (bound - 1)) === 0) {
      return Math.floor((bound * this.next(31)) / 2 ** 31)
    }
    let bits = 0
    let val = 0
    do {
      bits = this.next(31)
      val = bits % bound
    } while (bits - val + (bound - 1) < 0)
    return val
  }
}

const TIE = 1.0e-9

/** Ergonomics sets the walk price; band penalties keep slow goods out of golden. */
function skim(
  day: PutawayDay,
  sku: PutawaySku,
  slot: PutawaySlot,
  band: Band,
  landing: Map<string, PutawaySlot>,
): number {
  const weights = day.weights
  const ergo =
    slot.ergonomics === "golden"
      ? weights.ergoGolden
      : slot.ergonomics === "floor"
        ? weights.ergoFloor
        : weights.ergoBeam
  let cost = oneWayMeters(slot) * ergo
  if (slot.ergonomics === "golden") {
    if (band === "C") cost += weights.goldenWeight * (day.bands.bCutoff - sku.picks)
  } else if (band === "A") {
    cost += weights.lowWeight * sku.picks
  }
  if (landing.size === 0 || day.affinities.length === 0) return cost
  let credit = 0
  for (const edge of day.affinities) {
    const partnerId = edge.a === sku.id ? edge.b : edge.b === sku.id ? edge.a : null
    if (!partnerId) continue
    const placed = landing.get(partnerId)
    if (!placed) continue
    const partner = day.skus.find((item) => item.id === partnerId)
    if (!partner) continue
    const steps = Math.abs(slot.aisleIndex - placed.aisleIndex) + Math.abs(slot.bayIndex - placed.bayIndex)
    credit += edge.strength * Math.sqrt(sku.picks * partner.picks) * Math.exp(-steps / weights.affinityDecayBays)
  }
  return cost - weights.affinityWeight * credit
}

function fits(
  state: Map<string, { skuId: string; cartons: number }>,
  slot: PutawaySlot,
  sku: PutawaySku,
  cartons: number,
  day: PutawayDay,
): string | null {
  if (cartons <= 0) return `${sku.name} has no cartons to put away.`
  if (sku.weightKg >= day.weights.heavyKg && slot.level > day.weights.maxLevelForHeavy) {
    return `${sku.name} cannot claim a level above ${day.weights.maxLevelForHeavy}.`
  }
  const fill = state.get(slot.id)
  if (fill && fill.skuId !== sku.id) {
    return `${slot.id} already holds ${fill.skuId}; a bay carries one SKU.`
  }
  const needed = cartons * sku.cubeLiters
  const free = slot.cubeLiters - (fill ? fill.cartons * sku.cubeLiters : 0)
  if (needed > free + TIE) {
    return `${slot.id} has ${free.toFixed(1)} liters free; ${sku.name} needs ${needed.toFixed(1)}.`
  }
  return null
}

function codepoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Velocity reads the manifest fastest first; SKU id breaks ties, then receipt id. */
export function velocityOrder(day: PutawayDay): PutawayReceipt[] {
  const picks = (skuId: string) => day.skus.find((sku) => sku.id === skuId)?.picks ?? 0
  return [...day.receipts].sort(
    (a, b) => picks(b.skuId) - picks(a.skuId) || codepoint(a.skuId, b.skuId) || codepoint(a.id, b.id),
  )
}

type Landing = Map<string, PutawaySlot>
type Pick = (
  state: Map<string, { skuId: string; cartons: number }>,
  landing: Landing,
  sku: PutawaySku,
  cartons: number,
) => string | null

function runCore(policy: string, day: PutawayDay, ordered: PutawayReceipt[], pick: Pick): PutawayResult {
  const byId = new Map(day.skus.map((sku) => [sku.id, sku]))
  const slotById = new Map(day.slots.map((slot) => [slot.id, slot]))
  const onHand: Map<string, number> = new Map(Object.entries(day.forward.onHand))
  const armed = new Set<string>()
  const signals: PutawaySignal[] = []

  for (const move of day.forward.openings) {
    onHand.set(move.skuId, (onHand.get(move.skuId) ?? 0) + move.cartons)
  }
  for (const sku of day.skus) {
    const threshold = day.forward.thresholds[bandOf(sku.picks, day.bands)]
    const on = onHand.get(sku.id) ?? 0
    if (on < threshold.minCartons) {
      armed.add(sku.id)
      signals.push({
        skuId: sku.id,
        onHand: on,
        action: "raise",
        cartons: Math.max(0, Math.ceil(threshold.maxCartons - on - TIE)),
      })
    }
  }

  const directives: PutawayDirective[] = []
  const refusals: { receiptId: string; reason: string }[] = []
  const state: Map<string, { skuId: string; cartons: number }> = new Map(
    Object.entries(day.startState).map(([slotId, fill]) => [slotId, { ...fill }]),
  )
  const landing: Landing = new Map()
  const picked = new Set<string>()
  let forward = 0
  let reserve = 0
  let goldenCartons = 0
  let meters = 0

  for (const receipt of ordered) {
    const sku = byId.get(receipt.skuId)
    const cartonsLine = sku ? cartonsOf(day, receipt) : null
    if (!sku || cartonsLine === null) {
      refusals.push({
        receiptId: receipt.id,
        reason: `${sku?.name ?? receipt.skuId} cannot be read off the manifest.`,
      })
      continue
    }
    const band = bandOf(sku.picks, day.bands)
    const threshold = day.forward.thresholds[band]
    let cartons = cartonsLine

    if (armed.has(sku.id)) {
      const toMax = Math.max(0, Math.ceil(threshold.maxCartons - (onHand.get(sku.id) ?? 0) - TIE))
      const taken = Math.min(cartons, toMax)
      if (taken > 0) {
        cartons -= taken
        forward += taken
        onHand.set(sku.id, (onHand.get(sku.id) ?? 0) + taken)
        directives.push({
          receiptId: receipt.id,
          skuId: sku.id,
          skuName: sku.name,
          band,
          destination: "forward",
          units: receipt.units,
          uom: receipt.uom,
          cartons: taken,
          slotId: "",
          putawayMeters: 0,
        })
      }
      const on = onHand.get(sku.id) ?? 0
      if (on >= threshold.minCartons + threshold.hysteresisCartons) {
        armed.delete(sku.id)
        signals.push({ skuId: sku.id, onHand: on, action: "quiet", cartons: 0 })
      }
    }

    if (cartons > 0) {
      const slotId = pick(state, landing, sku, cartons)
      if (slotId === null) {
        refusals.push({ receiptId: receipt.id, reason: `${sku.name} has no bay left that can hold it.` })
        continue
      }
      const slot = slotById.get(slotId)
      if (!slot) continue
      const put = oneWayMeters(slot)
      directives.push({
        receiptId: receipt.id,
        skuId: sku.id,
        skuName: sku.name,
        band,
        destination: "reserve",
        units: receipt.units,
        uom: receipt.uom,
        cartons,
        slotId,
        putawayMeters: put,
      })
      const fill = state.get(slotId)
      state.set(slotId, { skuId: sku.id, cartons: (fill?.cartons ?? 0) + cartons })
      if (!landing.has(sku.id)) landing.set(sku.id, slot)
      picked.add(slotId)
      meters += put
      reserve += cartons
      if (slot.ergonomics === "golden") goldenCartons += cartons
    }
  }

  const endState: Record<string, { skuId: string; cartons: number }> = {}
  for (const [slotId, fill] of state) endState[slotId] = fill
  return {
    policy,
    directives,
    refusals,
    signals,
    endState,
    totals: {
      receipts: day.receipts.length,
      refused: refusals.length,
      cartons: forward + reserve,
      cartonsForward: forward,
      cartonsReserve: reserve,
      goldenShare: reserve > 0 ? goldenCartons / reserve : 0,
      putawayMeters: meters,
      baysTouched: picked.size,
    },
  }
}

const EMPTY_LANDING: Landing = new Map()

/** Velocity picks the feasible bay with the lowest skimmed cost, nearest ties by id. */
export function velocity(day: PutawayDay): PutawayResult {
  return runCore("velocity", day, velocityOrder(day), (state, _landing, sku, cartons) => {
    const band = bandOf(sku.picks, day.bands)
    let best: { id: string; cost: number } | null = null
    for (const slot of day.slots) {
      if (fits(state, slot, sku, cartons, day)) continue
      const cost = skim(day, sku, slot, band, EMPTY_LANDING)
      if (!best || cost < best.cost - TIE || (cost <= best.cost + TIE && codepoint(slot.id, best.id) < 0)) {
        best = { id: slot.id, cost }
      }
    }
    return best?.id ?? null
  })
}

/** Affinity runs the velocity cost, then lets partners already landed pull the bay. */
export function affinity(day: PutawayDay): PutawayResult {
  return runCore("affinity", day, velocityOrder(day), (state, landing, sku, cartons) => {
    const band = bandOf(sku.picks, day.bands)
    let best: { id: string; score: number } | null = null
    for (const slot of day.slots) {
      if (fits(state, slot, sku, cartons, day)) continue
      const score = skim(day, sku, slot, band, landing)
      if (!best || score < best.score - TIE || (score <= best.score + TIE && codepoint(slot.id, best.id) < 0)) {
        best = { id: slot.id, score }
      }
    }
    return best?.id ?? null
  })
}

/**
 * The fork: the manifest in arrival order, the bays in one fixed shuffle.
 * Seed 1998 draws the same plan every run.
 */
export function randomPutaway(day: PutawayDay): PutawayResult {
  const shuffled = [...day.slots]
  const random = new JavaRandom(day.seed)
  for (let i = shuffled.length; i > 1; i--) {
    const j = random.nextInt(i)
    const a = shuffled[i - 1]
    shuffled[i - 1] = shuffled[j]
    shuffled[j] = a
  }
  return runCore("random", day, day.receipts, (state, _landing, sku, cartons) => {
    for (const slot of shuffled) {
      if (!fits(state, slot, sku, cartons, day)) return slot.id
    }
    return null
  })
}

export function allThree(day: PutawayDay): PutawayResult[] {
  return [velocity(day), affinity(day), randomPutaway(day)]
}
