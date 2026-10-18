import {
  type Affinity,
  type Assignment,
  type Sku,
  type Slot,
  RULES,
  baySteps,
  returnWalkMeters,
  skuById,
} from "@/lib/warehouse"

export class ExtractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtractError"
  }
}

export type Proposal = {
  assignment: Assignment
  notes: Record<string, string>
  anchors: string[]
}

type AffinityMap = Map<string, Map<string, number>>

function affinityMap(edges: Affinity[]): AffinityMap {
  const map: AffinityMap = new Map()
  const put = (from: string, to: string, strength: number) => {
    const row = map.get(from) ?? new Map<string, number>()
    row.set(to, strength)
    map.set(from, row)
  }
  for (const edge of edges) {
    put(edge.a, edge.b, edge.strength)
    put(edge.b, edge.a, edge.strength)
  }
  return map
}

function link(map: AffinityMap, a: string, b: string) {
  return map.get(a)?.get(b) ?? 0
}

export function assertExtract(skus: Sku[], slots: Slot[]) {
  const problems: string[] = []
  for (const sku of skus) {
    if (!Number.isFinite(sku.picks) || sku.picks < 0) {
      problems.push(`${sku.name} has an unreadable pick count.`)
    }
    if (!Number.isFinite(sku.weightKg) || sku.weightKg < 0) {
      problems.push(`${sku.name} has an unreadable weight.`)
    }
    if (!Number.isFinite(sku.cubeLiters) || sku.cubeLiters <= 0) {
      problems.push(`${sku.name} has no usable cube.`)
    } else if (!slots.some((slot) => slot.cubeLiters >= sku.cubeLiters)) {
      problems.push(`${sku.name} is larger than every bay on the face.`)
    }
  }
  if (problems.length > 0) {
    throw new ExtractError(problems.slice(0, 3).join(" "))
  }
}

function badness(slot: Slot) {
  const levelBias = slot.level === 4 ? 48 : slot.level === 1 ? 20 : slot.level === 3 ? 6 : 0
  return slot.aisleIndex * 24 + slot.bayIndex * 8 + levelBias
}

/** The layout that "arrived" with the extract: fast cartons pushed into the worst hole that fits. */
export function arrivedLayout(skus: Sku[], slots: Slot[]): Assignment {
  assertExtract(skus, slots)
  const open = [...slots].sort((a, b) => badness(b) - badness(a))
  const ordered = [...skus].sort((a, b) => b.picks - a.picks || a.id.localeCompare(b.id))
  const assignment: Assignment = {}
  for (const sku of ordered) {
    const index = open.findIndex((slot) => slot.cubeLiters >= sku.cubeLiters)
    if (index < 0) {
      throw new ExtractError(`${sku.name} is larger than every remaining bay.`)
    }
    const [slot] = open.splice(index, 1)
    assignment[slot.id] = sku.id
  }
  return assignment
}

function ergo(slot: Slot) {
  if (slot.golden) return 1
  if (slot.level === 1) return 1.16
  return 1.4
}

type Score = {
  reach: number
  mass: number
  fit: number
  kinship: number
  band: number
  total: number
}

function score(
  sku: Sku,
  slot: Slot,
  placed: Map<string, Slot>,
  links: AffinityMap,
  anchor: boolean,
): Score | null {
  if (sku.cubeLiters > slot.cubeLiters) return null
  const reach = sku.picks * returnWalkMeters(slot) * ergo(slot)

  let mass = 0
  if (sku.weightKg >= RULES.heavyKg) {
    if (slot.level === 4) mass = 50000
    else if (slot.level === 3) mass = 9000
    else if (slot.level === 2) mass = 2800
    else mass = -350
  } else if (sku.weightKg <= RULES.lightKg) {
    if (slot.level === 1) mass = 2200
    else if (slot.level === 4 && sku.picks >= 30) mass = 1600
  } else if (slot.level === 4 && sku.weightKg >= 6) {
    mass = 3200
  }

  const waste = (slot.cubeLiters - sku.cubeLiters) / slot.cubeLiters
  const fit = waste * 240 * Math.log2(1 + sku.picks)

  let kinship = 0
  for (const [otherId, otherSlot] of placed) {
    const strength = link(links, sku.id, otherId)
    if (strength <= 0) continue
    const other = skuById.get(otherId)
    const otherPicks = other?.picks ?? sku.picks
    const steps = baySteps(slot, otherSlot)
    kinship += strength * Math.sqrt(sku.picks * otherPicks) * Math.exp(-steps / 2.1) * 8
  }

  const band =
    slot.golden && !anchor && sku.picks < RULES.slowCompanionCutoff
      ? (RULES.slowCompanionCutoff - sku.picks) * 80
      : 0

  return {
    reach,
    mass,
    fit,
    kinship,
    band,
    total: reach + mass + fit + band - kinship,
  }
}

function choose(
  sku: Sku,
  open: Map<string, Slot>,
  placed: Map<string, Slot>,
  links: AffinityMap,
  anchor: boolean,
  goldenOnly: boolean,
) {
  let best: { slot: Slot; scored: Score } | null = null
  for (const slot of open.values()) {
    if (goldenOnly && !slot.golden) continue
    const scored = score(sku, slot, placed, links, anchor)
    if (!scored) continue
    if (!best || scored.total < best.scored.total || (scored.total === best.scored.total && slot.id < best.slot.id)) {
      best = { slot, scored }
    }
  }
  return best
}

function writeNote(
  sku: Sku,
  slot: Slot,
  assignment: Assignment,
  slots: Map<string, Slot>,
  links: AffinityMap,
  anchor: boolean,
) {
  const pace = sku.picks >= 90 ? "fast" : sku.picks >= 30 ? "steady" : "slow"
  const where = slot.golden ? "in the golden band" : slot.level === 1 ? "on the floor" : "on the top beam"
  const walk = Math.round(returnWalkMeters(slot))
  const fit = Math.round((sku.cubeLiters / slot.cubeLiters) * 100)
  let note = `${sku.name} is a ${pace} carton, ${sku.picks} picks a day. Quay set it ${where} at ${slot.id}, a ${walk} m return from the south dock. The bay is ${fit}% full.`
  if (anchor && slot.golden) {
    note += " Anchors are offered the golden band first."
  }
  if (sku.weightKg >= RULES.heavyKg && slot.level <= 2) {
    note += " The weight stays low."
  }
  if (sku.weightKg <= RULES.lightKg && slot.level !== 1) {
    note += " A light carton stays off the floor."
  }

  let closest: { name: string; steps: number } | null = null
  for (const [slotId, otherId] of Object.entries(assignment)) {
    if (otherId === sku.id) continue
    const strength = link(links, sku.id, otherId)
    if (strength <= 0) continue
    const otherSlot = slots.get(slotId)
    const other = skuById.get(otherId)
    if (!otherSlot || !other) continue
    const steps = baySteps(slot, otherSlot)
    if (!closest || steps < closest.steps) closest = { name: other.name, steps }
  }
  if (closest && closest.steps <= 2) {
    const relation =
      closest.steps === 0 ? "shares this bay" : closest.steps === 1 ? "is one step away" : "is two steps away"
    note += ` ${closest.name} ${relation} — they show up on the same orders often enough to sit together.`
  }
  return note
}

/**
 * Kinship Reach.
 * Anchors (the cartons that make up just over half of picks) take the lowest-scoring
 * golden bay. Companions follow, strongest kinship to the placed set first.
 * The score adds pick-weighted return walk, weight-by-level, leftover cube, and a
 * premium for slow cartons entering the golden band, then subtracts a pull toward
 * cartons already placed nearby.
 */
export function proposeLayout(skus: Sku[], slots: Slot[], edges: Affinity[]): Proposal {
  assertExtract(skus, slots)
  const links = affinityMap(edges)
  const byId = new Map(skus.map((sku) => [sku.id, sku]))
  const ranked = [...skus].sort((a, b) => b.picks - a.picks || a.id.localeCompare(b.id))
  const totalPicks = ranked.reduce((sum, sku) => sum + sku.picks, 0)
  const anchors: string[] = []
  let covered = 0
  for (const sku of ranked) {
    if (covered >= totalPicks * RULES.anchorPickShare && anchors.length >= 5) break
    anchors.push(sku.id)
    covered += sku.picks
  }
  const anchorSet = new Set(anchors)

  const open = new Map(slots.map((slot) => [slot.id, slot]))
  const placed = new Map<string, Slot>()
  const assignment: Assignment = {}

  const commit = (sku: Sku, slot: Slot) => {
    open.delete(slot.id)
    placed.set(sku.id, slot)
    assignment[slot.id] = sku.id
  }

  for (const id of anchors) {
    const sku = byId.get(id)
    if (!sku) continue
    const chosen = choose(sku, open, placed, links, true, true) ?? choose(sku, open, placed, links, true, false)
    if (!chosen) throw new ExtractError(`${sku.name} has nowhere left that can hold it.`)
    commit(sku, chosen.slot)
  }

  const remaining = new Set(ranked.filter((sku) => !anchorSet.has(sku.id)).map((sku) => sku.id))
  while (remaining.size > 0) {
    let nextId = ""
    let bestKin = -1
    let bestPicks = -1
    for (const id of remaining) {
      let kin = 0
      for (const placedId of placed.keys()) kin = Math.max(kin, link(links, id, placedId))
      const picks = byId.get(id)?.picks ?? 0
      if (kin > bestKin || (kin === bestKin && picks > bestPicks)) {
        nextId = id
        bestKin = kin
        bestPicks = picks
      }
    }
    remaining.delete(nextId)
    const sku = byId.get(nextId)
    if (!sku) continue
    const chosen = choose(sku, open, placed, links, false, false)
    if (!chosen) throw new ExtractError(`${sku.name} has nowhere left that can hold it.`)
    commit(sku, chosen.slot)
  }

  const slotMap = new Map(slots.map((slot) => [slot.id, slot]))
  const notes: Record<string, string> = {}
  for (const [slotId, skuId] of Object.entries(assignment)) {
    const sku = byId.get(skuId)
    const slot = slotMap.get(slotId)
    if (!sku || !slot) continue
    notes[skuId] = writeNote(sku, slot, assignment, slotMap, links, anchorSet.has(skuId))
  }

  return { assignment, notes, anchors }
}
