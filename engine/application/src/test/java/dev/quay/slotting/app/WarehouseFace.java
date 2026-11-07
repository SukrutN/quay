package dev.quay.slotting.app;

import dev.quay.slotting.Affinity;
import dev.quay.slotting.Ergonomics;
import dev.quay.slotting.PickFace;
import dev.quay.slotting.Policy;
import dev.quay.slotting.Sku;
import dev.quay.slotting.Slot;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A warehouse-scale face, generated deterministically: a 50-aisle rack, 50
 * bays deep, 5 levels tall (12,500 slots), carrying the asked number of
 * cartons with a fixed spread of velocity, cube, and weight, plus a chain
 * of co-pick affinities. Same numbers in, same face out, every time: no
 * randomness, so the scale figures are comparable across machines and runs.
 */
final class WarehouseFace {

    private WarehouseFace() {}

    static PickFace of(int cartons) {
        List<Slot> slots = new ArrayList<>(12_500);
        for (int aisle = 0; aisle < 50; aisle++) {
            for (int bay = 1; bay <= 50; bay++) {
                for (int level = 1; level <= 5; level++) {
                    Ergonomics ergonomics = level <= 2 ? Ergonomics.GOLDEN
                            : level == 5 ? Ergonomics.BEAM : Ergonomics.FLOOR;
                    slots.add(new Slot(
                            String.format("%c-%02d-L%d", 'A' + aisle, bay, level),
                            String.valueOf((char) ('A' + aisle)), aisle, bay, bay - 1, level,
                            switch (level) { case 1 -> 60; case 2 -> 46; case 3 -> 30; case 4 -> 18; default -> 10; },
                            12 + 4 * bay + 3 * aisle,
                            ergonomics, Optional.empty()));
                }
            }
        }
        List<Sku> skus = new ArrayList<>(cartons);
        for (int i = 0; i < cartons; i++) {
            // velocity by a fixed mixed-radix pattern, not a random one: the
            // face is the same on every machine and in every CI run
            int picks = 240 - (i % 200);
            double cube = 1 + (i % 37) * 0.8;
            double weight = 0.3 + (i % 29) * 0.62;
            skus.add(new Sku(
                    String.format("WS-%05d", i),
                    "Warehouse carton " + i,
                    picks, cube, weight, Optional.empty()));
        }
        List<Affinity> affinities = new ArrayList<>();
        for (int i = 0; i + 1 < cartons; i += 7) {
            affinities.add(new Affinity(
                    String.format("WS-%05d", i), String.format("WS-%05d", i + 1),
                    0.3 + (i % 5) * 0.12));
        }
        return new PickFace(
                "warehouse-" + cartons,
                "The generated warehouse",
                slots, skus, affinities,
                new Policy(1, 4, 4, 2, 8, 30, 2.2, 12, 3, 1, 1.12, 1.35, 2.5, 4),
                dev.quay.slotting.Mode.REPLAN, Map.of(), Map.of());
    }
}
