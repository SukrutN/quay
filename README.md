# Quay

Quay is a slotting engine for a forward pick face. You hand it a rack, your
cartons, and the orders they leave on, and it hands back a placement proposal
you can argue with: less walking per pick, heavy goods kept low, and co-picked
goods seated together.

Live site: https://sukrutn.github.io/quay/

## The problem

Pick travel is the largest controllable cost in order picking: roughly half of
a picker's shift is walking, and where a carton sits decides most of that
walk. Re-slotting a forward face — re-seating stock by velocity, weight, cube,
and co-pick affinity — is therefore one of the highest-leverage jobs in a
warehouse, and one of the easiest to get wrong by hand, because the terms
interact: the golden band is worth real walk savings, heavy cartons belong
low, a tight cube fit preserves bays, and goods that leave on the same orders
should sit together.

Quay turns that into one deterministic scoring pass and shows its work: every
placement on the demo face carries the exact terms that earned it.

## How it works

Quay scores every open bay with a heuristic called **kinship reach**. The
carton takes the lowest score.

Cartons that add up to a little over half of all picks are anchors. They go
first, and only into the golden band (levels 2 and 3) unless no golden bay can
hold them. Every other carton follows, strongest co-pick tie to the placed set
first.

For each open bay the score adds:

- pick-weighted return walk from the south dock, sterner on the floor and the top beam
- a penalty when a heavy carton is high, or a light carton takes the floor
- leftover cube, so a tight fit beats a cavern
- a premium if a slow carton wants a golden bay

It then subtracts a pull toward cartons already nearby that leave on the same
orders. Travel is an out-and-back per pick line, not a batched tour.

The classic single-criterion rule this generalizes is the cube-per-order index
[Heskett, 1963]: seat each item by its cube-to-pick-frequency ratio. Kinship
reach keeps that velocity term and adds the four above. The site's method
section runs the same score live in the browser, on the same locked data the
tests assert.

## The dock

[Aisle F to H](/putaway) is the reserve rack behind the face: one day of
receipts, 226 cartons, directed three ways — a velocity skim, an affinity
pull, and a seeded random fork to measure the other two against. The page
re-runs the day the engine ships as `engine/fixtures/putaway-day.json`, and
tests lock its figures to the engine's printed reading.

## The engine

The slotting service lives at [`engine/`](engine/): a Java build with its own
tests, a CLI, an HTTP API, and a self-contained workbench page. The site reads
the engine's published fixtures instead of hand-copied numbers, and the dock
page's figures are locked in one chain, inside one CI run:

1. the engine prints its reading for the day: `java -jar engine/cli/target/quay.jar putaway engine/fixtures/putaway-day.json --json`
2. that reading is stored as `engine-golden/putaway-day.json`: `node scripts/golden.mjs regen`
3. the site's tests replay the day through the TypeScript port and must match the golden copy figure for figure

A change on either side that moves a number fails the build.

The same engine, given a full-size floor, seats 10,000 cartons across a rack of
12,500 slots in one deterministic pass: `ScaleTest` re-proves that size on
every CI run against a ten-minute budget.

```bash
mvn -B -f engine verify        # the engine's own tests
java -jar engine/api/target/quay-api.jar
# open http://127.0.0.1:8091/ for the engine's workbench: select a fixture or
# paste a document, run it, and read the plan
```

## Build and run the site

```bash
npm install
npm run dev      # http://127.0.0.1:24641
npm test
npm run lint
```

The site runs one demo face end to end in the browser — House 4 at Coldwater
Reach, thirty invented cartons on five aisles, re-slotted on the spot. The demo
never leaves the browser: there is no account and no database.

## Data provenance

Aisles, bays, liters, kilograms, pick counts, and co-pick ties are synthetic
fixtures invented for this demonstration. Do not read the percentages as a
study of a real warehouse.

## References

- Heskett, J. L. (1963). *Cube-per-order index — a key to warehouse stock
  location.* Transportation and Distribution Management. The classic
  velocity-per-cube slotting rule that kinship reach generalizes.
- Bartholdi, J. J., & Hackman, S. T. *Warehouse & Distribution Science* (free
  textbook). <https://www.warehouse-science.com> — covers forward-area design,
  slotting, and the travel models the score's walk terms approximate.

## License

MIT — see [LICENSE](LICENSE).
