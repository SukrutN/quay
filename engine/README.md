# Quay slotting

Quay slots one forward pick face. You send the slots (or a rectangular rack), the SKUs, the co-pick affinities, and the objective weights. It returns a placement, the travel and fit readings, and a comparison when you include the layout that is on the floor today.

It does not keep inventory, orders, labor standards, or a user directory. Nothing is stored after the response. This engine lives at `engine/` in the [quay](https://github.com/SukrutN/quay) site repository, its full history carried over from the old `quay-engine` repository. The site's pages are a visual walkthrough of one fictional face; the figures on them are locked to this engine's own printed reading. This service prints the figures for the document you give it.

## Run the tests

Java 21 and Maven 3.9 or newer. From the repository root (or from `engine/`, with the paths dropped):

```bash
mvn -B -f engine verify
```

## Slot a face from a file

```bash
mvn -B -f engine -DskipTests package
java -jar engine/cli/target/quay.jar place engine/fixtures/lane.json
java -jar engine/cli/target/quay.jar place engine/fixtures/forward-pick.json
```

`lane.json` is a chill corner with an incumbent layout, a locked stockpot, and four SKUs. `forward-pick.json` is a 160-slot rack and thirty cartons. Both are data. The solver has no building of its own.

## Direct a putaway day

```bash
java -jar engine/cli/target/quay.jar putaway engine/fixtures/putaway-day.json
java -jar engine/cli/target/quay.jar putaway engine/fixtures/putaway-day.json --json
```

A putaway day directs one day's receipts onto a reserve rack under three policies — a velocity skim, an affinity pull, and a seeded random fork to measure the other two against — while the forward face raises and settles through its replenish thresholds. The reading prints the walk meters, the golden-band share, the signal trace, and every directive. The day format is [docs/putaway.md](docs/putaway.md). `--json` prints the machine reading, full precision and no clock — the copy the site stores as its golden and locks its port against.

## Serve the API

```bash
java -jar engine/api/target/quay-api.jar
```

The process listens on port 8091. `PORT` changes it.

```bash
curl -s http://127.0.0.1:8091/health
curl -s http://127.0.0.1:8091/v1/slotting -H 'content-type: application/json' -d '{"fixture":"lane"}'
```

An unknown fixture name is HTTP 400 with `application/problem+json`. The body is a problem document, not a made-up layout. Send an inline face under `face` when you do not want a published fixture. The OpenAPI document is at `/v1/openapi.yaml`.

## Open the workbench

The API jar serves a workbench page at its root — a browser tab for the engine, in the site's own clothes:

```bash
java -jar engine/api/target/quay-api.jar
# then open http://127.0.0.1:8091/
```

Pick a published fixture or paste your own face or day document, run it, and read the same numbers the CLI prints: the scorecards, the placement table, the policy comparison, the replenish trace. A refused document shows its problem document on the page, reasons and all. The page rides inside the jar — one binary, one tab, no build step, no dependencies.

## Where to read next

- [docs/architecture.md](docs/architecture.md) — why the domain is separate, and why there is no database
- [docs/customizing.md](docs/customizing.md) — the file format, walked through `fixtures/lane.json`
- [docs/putaway.md](docs/putaway.md) — the putaway day format and the three policies
- [docs/adr/0001-scored-placement.md](docs/adr/0001-scored-placement.md) — why this search, and the size of face it is for
