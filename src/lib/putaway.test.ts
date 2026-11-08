import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PUTAWAY_DAY } from "./putaway-day"
import { affinity, cartonsOf, randomPutaway, velocity, velocityOrder } from "./putaway"

describe("putaway day 07", () => {
  const [directed, together, fork] = [
    velocity(PUTAWAY_DAY),
    affinity(PUTAWAY_DAY),
    randomPutaway(PUTAWAY_DAY),
  ]

  it("answers all thirty lines without a refusal under every policy", () => {
    for (const result of [directed, together, fork]) {
      assert.equal(result.totals.receipts, 30, result.policy)
      assert.equal(result.totals.refused, 0, result.policy)
      assert.equal(result.totals.cartons, 226, result.policy)
      assert.equal(result.totals.cartonsForward, 52, result.policy)
      assert.equal(result.totals.cartonsReserve, 174, result.policy)
      assert.equal(result.totals.baysTouched, 26, result.policy)
      assert.equal(result.directives.length, 32, result.policy)
    }
  })

  it("the velocity fork walks 531.2 meters", () => {
    assert.ok(Math.abs(directed.totals.putawayMeters - 531.2) < 1.0e-6)
    assert.ok(Math.abs(directed.totals.goldenShare - 0.5287356321839081) < 1.0e-9)
    row(directed, 0, "R-01", "MG-01", "reserve", "F-01-L3", 8, 14.8)
    row(directed, 5, "R-06", "MG-06", "forward", "", 6, 0.0)
    row(directed, 14, "R-15", "MG-15", "forward", "", 19, 0.0)
    row(directed, 15, "R-15", "MG-15", "reserve", "F-04-L2", 17, 23.8)
    row(directed, 10, "R-11", "MG-11", "reserve", "F-02-L1", 2, 17.8)
    row(directed, 24, "R-23", "MG-23", "reserve", "G-02-L4", 36, 21.4)
    row(directed, 26, "R-25", "MG-25", "reserve", "H-02-L1", 2, 25.0)
    assert.ok(directed.directives.filter((r) => r.destination === "reserve").some((r) => r.slotId === "F-01-L2"))
  })

  it("the affinity fork pays 4.8 meters to walk partners together", () => {
    assert.ok(Math.abs(together.totals.putawayMeters - 536.0) < 1.0e-6)
    assert.ok(Math.abs(together.totals.goldenShare - 0.43103448275862066) < 1.0e-9)
    row(together, 9, "R-10", "MG-10", "reserve", "F-03-L1", 4, 20.8)
    row(together, 1, "R-02", "MG-02", "reserve", "F-01-L1", 12, 14.8)
    assert.ok(Math.abs(together.totals.putawayMeters - directed.totals.putawayMeters - 4.8) < 1.0e-6)
  })

  it("the random fork walks 208.8 meters further and replays itself", () => {
    assert.ok(Math.abs(fork.totals.putawayMeters - 740.0) < 1.0e-6)
    assert.ok(Math.abs(fork.totals.goldenShare - 0.6839080459770115) < 1.0e-9)
    row(fork, 0, "R-01", "MG-01", "reserve", "F-03-L4", 8, 20.8)
    row(fork, 1, "R-02", "MG-02", "reserve", "H-06-L2", 12, 37.0)
    row(fork, 15, "R-15", "MG-15", "reserve", "G-06-L4", 17, 33.4)
    assert.ok(Math.abs(fork.totals.putawayMeters - directed.totals.putawayMeters - 208.8) < 1.0e-6)
    assert.equal(
      Math.round((100 * (fork.totals.putawayMeters - directed.totals.putawayMeters)) / fork.totals.putawayMeters),
      28,
    )
    const again = randomPutaway(PUTAWAY_DAY)
    assert.deepEqual(again.directives, fork.directives)
    assert.deepEqual(again.signals, fork.signals)
    assert.deepEqual(again.totals, fork.totals)
  })

  it("the signal trace is the same under every policy", () => {
    const expected = [
      { skuId: "MG-06", onHand: 22, action: "raise", cartons: 50 },
      { skuId: "MG-09", onHand: 9, action: "raise", cartons: 21 },
      { skuId: "MG-15", onHand: 11, action: "raise", cartons: 19 },
      { skuId: "MG-19", onHand: 5, action: "raise", cartons: 10 },
      { skuId: "MG-22", onHand: 4, action: "raise", cartons: 11 },
      { skuId: "MG-30", onHand: 2, action: "raise", cartons: 13 },
      { skuId: "MG-09", onHand: 18, action: "quiet", cartons: 0 },
      { skuId: "MG-15", onHand: 30, action: "quiet", cartons: 0 },
      { skuId: "MG-19", onHand: 9, action: "quiet", cartons: 0 },
      { skuId: "MG-22", onHand: 15, action: "quiet", cartons: 0 },
    ]
    for (const result of [directed, together, fork]) {
      assert.deepEqual(
        result.signals.map((s) => ({ skuId: s.skuId, onHand: s.onHand, action: s.action, cartons: s.cartons })),
        expected,
        result.policy,
      )
    }
  })

  it("the end state keeps the starting fills and lands the new ones", () => {
    assert.deepEqual(directed.endState["F-01-L3"], { skuId: "MG-01", cartons: 8 })
    assert.deepEqual(directed.endState["G-01-L2"], { skuId: "MG-01", cartons: 20 })
    assert.deepEqual(directed.endState["H-02-L1"], { skuId: "MG-25", cartons: 3 })
    assert.deepEqual(directed.endState["F-01-L2"], { skuId: "MG-05", cartons: 22 })
    assert.deepEqual(directed.endState["F-02-L1"], { skuId: "MG-11", cartons: 5 })
    assert.deepEqual(directed.endState["F-02-L2"], { skuId: "MG-04", cartons: 7 })
    const keys = directed.endState
    const expected = new Set<string>([
      ...Object.keys(PUTAWAY_DAY.startState),
      ...directed.directives.filter((r) => r.destination === "reserve").map((r) => r.slotId),
    ])
    assert.deepEqual(Object.keys(keys).sort(), [...expected].sort())
  })

  it("case lines convert to whole cartons and unknown measures refuse", () => {
    assert.equal(cartonsOf(PUTAWAY_DAY, { id: "X", skuId: "MG-15", units: 9, uom: "case" }), 36)
    assert.equal(cartonsOf(PUTAWAY_DAY, { id: "Y", skuId: "MG-01", units: 8, uom: "carton" }), 8)
    assert.equal(cartonsOf(PUTAWAY_DAY, { id: "Z", skuId: "MG-01", units: 2, uom: "pallet" }), null)
  })

  it("the velocity order reads the manifest fastest first", () => {
    const order = velocityOrder(PUTAWAY_DAY).map((r) => r.skuId)
    assert.equal(order[0], "MG-01")
    assert.equal(order[7], "MG-08")
    assert.ok(order.indexOf("MG-09") < order.indexOf("MG-15"))
    assert.ok(order.lastIndexOf("MG-29") > order.lastIndexOf("MG-28"))
  })
})

function row(
  result: { directives: { receiptId: string; skuId: string; destination: string; slotId: string; cartons: number; putawayMeters: number }[] },
  index: number,
  receiptId: string,
  skuId: string,
  destination: string,
  slotId: string,
  cartons: number,
  meters: number,
) {
  const line = result.directives[index]
  assert.equal(line.receiptId, receiptId, `row ${index}`)
  assert.equal(line.skuId, skuId, `row ${index}`)
  assert.equal(line.destination, destination, `row ${index}`)
  assert.equal(line.slotId, slotId, `row ${index}`)
  assert.equal(line.cartons, cartons, `row ${index}`)
  assert.ok(Math.abs(line.putawayMeters - meters) < 1.0e-9, `row ${index} meters`)
}
