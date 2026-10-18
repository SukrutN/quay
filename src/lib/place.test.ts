import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { measure } from "./metrics"
import { ExtractError, arrivedLayout, proposeLayout } from "./place"
import { AFFINITIES, SKUS, SLOTS, baySteps, slotById, tornExtract } from "./warehouse"

describe("kinship reach", () => {
  const arrived = arrivedLayout(SKUS, SLOTS)
  const proposal = proposeLayout(SKUS, SLOTS, AFFINITIES)
  const before = measure(arrived, SKUS, SLOTS, AFFINITIES)
  const after = measure(proposal.assignment, SKUS, SLOTS, AFFINITIES)

  it("places every carton in a bay that can hold it", () => {
    assert.equal(Object.keys(proposal.assignment).length, SKUS.length)
    for (const [slotId, skuId] of Object.entries(proposal.assignment)) {
      const slot = slotById.get(slotId)
      const sku = SKUS.find((item) => item.id === skuId)
      assert.ok(slot && sku)
      assert.ok(sku.cubeLiters <= slot.cubeLiters)
    }
  })

  it("shortens the return walk and keeps heavy cartons off the beam", () => {
    assert.ok(
      after.walkMeters < before.walkMeters * 0.75,
      `walk ${after.walkMeters.toFixed(0)} vs ${before.walkMeters.toFixed(0)}`,
    )
    assert.equal(after.heavyOnBeam, 0)
    assert.ok(after.goldenShare > before.goldenShare, `golden ${after.goldenShare} vs ${before.goldenShare}`)
  })

  it("draws kinship pairs closer than the arrived face", () => {
    assert.ok(
      after.kinshipSteps < before.kinshipSteps,
      `kinship ${after.kinshipSteps.toFixed(2)} vs ${before.kinshipSteps.toFixed(2)}`,
    )
    const coffee = Object.entries(proposal.assignment).find(([, id]) => id === "MG-01")
    const filters = Object.entries(proposal.assignment).find(([, id]) => id === "MG-02")
    assert.ok(coffee && filters)
    const steps = baySteps(slotById.get(coffee[0])!, slotById.get(filters[0])!)
    assert.ok(steps <= 2, `coffee and filters are ${steps} steps apart`)
  })

  it("refuses a torn extract", () => {
    assert.throws(() => proposeLayout(tornExtract(), SLOTS, AFFINITIES), ExtractError)
  })
})
