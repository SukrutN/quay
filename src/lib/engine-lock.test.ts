import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { PUTAWAY_DAY } from "./putaway-day"
import { affinity, randomPutaway, velocity } from "./putaway"

/**
 * The port against the engine's own reading. The engine prints
 * engine-golden/putaway-day.json (`putaway fixtures/putaway-day.json --json`,
 * via `node scripts/golden.mjs regen`), and this file proves the site's port
 * replays it figure for figure. Numbers compare within 1e-9; everything else
 * must be identical. The port's endState is directives plus startState, so it
 * stays covered by putaway.test.ts.
 */
type GoldenOutcome = {
  policy: string
  directives: Record<string, unknown>[]
  refusals: Record<string, unknown>[]
  signals: Record<string, unknown>[]
  totals: Record<string, unknown>
}

const golden = JSON.parse(
  readFileSync(new URL("../../engine-golden/putaway-day.json", import.meta.url), "utf8"),
) as { dayId: string; dayName: string; outcomes: GoldenOutcome[] }

const ports: Record<string, () => ReturnType<typeof velocity>> = {
  velocity: () => velocity(PUTAWAY_DAY),
  affinity: () => affinity(PUTAWAY_DAY),
  random: () => randomPutaway(PUTAWAY_DAY),
}

describe("the port against the engine's reading", () => {
  it("carries the engine's day id and name", () => {
    assert.equal(PUTAWAY_DAY.id, golden.dayId)
    assert.equal(PUTAWAY_DAY.name, golden.dayName)
  })

  for (const outcome of golden.outcomes) {
    it(`replays the ${outcome.policy} policy exactly`, () => {
      const make = ports[outcome.policy]
      assert.ok(make, `the port has no policy named ${outcome.policy}`)
      const mine = make()
      same(mine.directives, outcome.directives, `${outcome.policy}.directives`)
      same(mine.refusals, outcome.refusals, `${outcome.policy}.refusals`)
      same(mine.signals, outcome.signals, `${outcome.policy}.signals`)
      same(mine.totals, outcome.totals, `${outcome.policy}.totals`)
    })
  }
})

const CLOSE = 1.0e-9

function same(actual: unknown, expected: unknown, path: string) {
  if (typeof actual === "number" && typeof expected === "number") {
    assert.ok(Math.abs(actual - expected) <= CLOSE, `${path}: ${actual} vs ${expected}`)
    return
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, `${path} length`)
    actual.forEach((row, index) => same(row, expected[index], `${path}[${index}]`))
    return
  }
  if (actual !== null && expected !== null && typeof actual === "object" && typeof expected === "object") {
    const keys = Object.keys(actual)
    assert.deepEqual(keys.sort(), Object.keys(expected).sort(), `${path} fields`)
    for (const key of keys) {
      same((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], `${path}.${key}`)
    }
    return
  }
  assert.deepEqual(actual, expected, path)
}
