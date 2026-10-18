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

export type FaceMetrics = {
  walkMeters: number
  goldenShare: number
  meanFit: number
  heavyOnBeam: number
  kinshipSteps: number
  placed: number
  picks: number
}

export function measure(
  assignment: Assignment,
  skus: Sku[],
  slots: Slot[],
  edges: Affinity[],
): FaceMetrics {
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]))
  const skuMap = new Map(skus.map((sku) => [sku.id, sku]))
  let walkMeters = 0
  let picks = 0
  let goldenPicks = 0
  let fitSum = 0
  let placed = 0
  let heavyOnBeam = 0
  const located = new Map<string, Slot>()

  for (const [slotId, skuId] of Object.entries(assignment)) {
    const slot = slotMap.get(slotId)
    const sku = skuMap.get(skuId)
    if (!slot || !sku) continue
    walkMeters += sku.picks * returnWalkMeters(slot)
    picks += sku.picks
    if (slot.golden) goldenPicks += sku.picks
    fitSum += sku.cubeLiters / slot.cubeLiters
    if (sku.weightKg >= RULES.heavyKg && slot.level === 4) heavyOnBeam += 1
    placed += 1
    located.set(sku.id, slot)
  }

  let kinWeighted = 0
  let kinWeight = 0
  for (const edge of edges) {
    const left = located.get(edge.a)
    const right = located.get(edge.b)
    if (!left || !right) continue
    kinWeighted += baySteps(left, right) * edge.strength
    kinWeight += edge.strength
  }

  return {
    walkMeters,
    goldenShare: picks > 0 ? goldenPicks / picks : 0,
    meanFit: placed > 0 ? fitSum / placed : 0,
    heavyOnBeam,
    kinshipSteps: kinWeight > 0 ? kinWeighted / kinWeight : 0,
    placed,
    picks,
  }
}

export function formatWalk(meters: number) {
  if (!Number.isFinite(meters)) return "—"
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export function formatShare(share: number) {
  return `${Math.round(share * 100)}%`
}

export function formatFit(fit: number) {
  return `${Math.round(fit * 100)}%`
}

export function formatSteps(steps: number) {
  return steps.toFixed(1)
}

export function formatDelta(next: number, base: number) {
  if (!Number.isFinite(next) || !Number.isFinite(base) || base === 0) return "—"
  const pct = Math.round(((next - base) / base) * 100)
  return `${pct > 0 ? "+" : ""}${pct}%`
}

export function skuName(id: string) {
  return skuById.get(id)?.name ?? id
}
