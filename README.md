# Quay

Quay is a small slotting notebook for a fictional forward pick face. House 4 at Coldwater Reach belongs to Marrow Goods, a dry-goods wholesaler that does not exist. Thirty invented cartons sit on five aisles. You can compare the clumsy layout that arrived with a proposal, then click any bay.

The sample never leaves the browser. There is no account and no database.

## Run it

```bash
npm install
npm run dev
```

The dev server listens on [http://127.0.0.1:24641](http://127.0.0.1:24641).

```bash
npm test
npm run lint
```

## The score

Quay uses a heuristic called kinship reach. It is not a proof of the best floor.

Cartons that add up to a little over half of all picks are anchors. They are placed first, and only in the golden band (levels 2 and 3) unless no golden bay can hold them. Every other carton follows, strongest co-pick tie to the placed set first.

For each open bay the score adds:

- pick-weighted return walk from the south dock, sterner on the floor and the top beam
- a penalty when a heavy carton is high, or a light carton takes the floor
- leftover cube, so a tight fit beats a cavern
- a premium if a slow carton wants a golden bay

It then subtracts a pull toward cartons already sitting nearby that leave on the same orders. The carton takes the lowest score. Travel is an out-and-back per pick line, not a batched tour.

## What is fictional

Aisles, bays, liters, kilograms, pick counts, and co-pick ties are synthetic. Do not treat the percentages as a study of a real warehouse.
