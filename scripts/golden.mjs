#!/usr/bin/env node
/**
 * Prints or checks engine-golden/putaway-day.json from the engine's own CLI,
 * so the golden copy is what the engine printed, never a hand-typed figure.
 *
 *   node scripts/golden.mjs regen   rewrite the golden after an engine change
 *   node scripts/golden.mjs check   fail if the golden no longer matches
 *
 * Needs engine/cli/target/quay.jar first:
 *
 *   mvn -B -f engine -DskipTests package
 *
 * Java 21 must be the java on PATH (or JAVA_HOME), same as the engine build.
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const mode = process.argv[2] ?? "check"
if (mode !== "regen" && mode !== "check") {
  console.error("usage: node scripts/golden.mjs regen|check")
  process.exit(2)
}

const jar = "engine/cli/target/quay.jar"
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", "java") : "java"
const run = spawnSync(java, ["-jar", jar, "putaway", "engine/fixtures/putaway-day.json", "--json"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})

if (run.error || run.status !== 0) {
  console.error(run.error ?? run.stderr)
  console.error(`Could not print the day from ${jar}. Build it first: mvn -B -f engine -DskipTests package`)
  process.exit(2)
}

const fresh = JSON.parse(run.stdout)
const goldenPath = "engine-golden/putaway-day.json"

if (mode === "regen") {
  mkdirSync("engine-golden", { recursive: true })
  writeFileSync(goldenPath, `${JSON.stringify(fresh, null, 2)}\n`, "utf8")
  console.log(`regenerated ${goldenPath}`)
} else {
  const stored = JSON.parse(readFileSync(goldenPath, "utf8"))
  if (JSON.stringify(fresh) !== JSON.stringify(stored)) {
    console.error(
      `${goldenPath} is stale: the engine prints a different day than the golden copy. ` +
        `Rebuild the engine, run "node scripts/golden.mjs regen", and commit the result with the engine change.`,
    )
    process.exit(1)
  }
  console.log("the golden copy matches the engine's reading")
}
