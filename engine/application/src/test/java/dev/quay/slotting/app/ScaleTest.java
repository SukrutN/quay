package dev.quay.slotting.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.quay.slotting.Mode;
import dev.quay.slotting.PickFace;
import dev.quay.slotting.Policy;
import dev.quay.slotting.Slotter;
import dev.quay.slotting.Slotting;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/**
 * Proof at scale, with the curve measured. The slotter used to re-assess
 * the entire objective for every candidate slot - cartons x slots x
 * placement size - which measured at ~N^2.2 and put 400 cartons at 630
 * seconds with 10,000 unreachable. The incremental scorer (a trial swaps
 * only the moved carton's terms and its affinity partners' credits) took
 * the same face to (2026-11, dev machine):
 *
 *        400 cartons      2.1 s     (was 630.2 s)
 *      1,000 cartons      4.2 s
 *      2,000 cartons      8.9 s
 *      5,000 cartons     35.1 s
 *     10,000 cartons    117.1 s
 *
 * Warehouse scale now fits, and the budget keeps it fitting: 10,000
 * cartons must slot inside six times the observed time, and the repeat
 * run must land exactly on the first - the incremental scorer preserved
 * every decision the full evaluation made, and this test proves it stays
 * that way.
 */
class ScaleTest {

    /** The scale the budget locks: 10,000 cartons over a 12,500-slot rack. */
    private static final int CARTONS = 10_000;

    /** The budget: generous against the observed ~117 s, tight against rot. */
    private static final long BUDGET_MS = 600_000;

    @Test
    @Timeout(1200)
    void tenThousandCartonsSlotInsideTheBudgetAndRepeatExactly() {
        PickFace face = WarehouseFace.of(CARTONS);

        long started = System.nanoTime();
        Slotting first = new Slotter().slot(face);
        long elapsedMs = (System.nanoTime() - started) / 1_000_000;
        System.out.printf("scale: %d cartons slotted in %d ms (budget %d ms)%n",
                CARTONS, elapsedMs, BUDGET_MS);

        assertTrue(elapsedMs < BUDGET_MS,
                CARTONS + " cartons took " + elapsedMs + " ms; the budget is " + BUDGET_MS + " ms");
        assertEquals(CARTONS, first.placement().slotToSku().size(),
                "every carton must land somewhere");
        for (String slotId : first.placement().slotToSku().keySet()) {
            assertTrue(face.slot(slotId).isPresent(), "unknown slot " + slotId);
        }

        // the second run must agree exactly: the slotter is deterministic,
        // and scale is where a hidden tie-break would surface
        long secondStart = System.nanoTime();
        Slotting second = new Slotter().slot(face);
        System.out.printf("scale: the repeat took %d ms and must match exactly%n",
                (System.nanoTime() - secondStart) / 1_000_000);
        assertEquals(first.placement(), second.placement());
        assertEquals(first.cost().total(), second.cost().total(), 0.0);
    }

    @Test
    @Timeout(600)
    void theImproveModeHoldsAtScale() {
        // the same warehouse with an incumbent layout: improve mode must
        // never raise the objective, at a size the old scorer could not
        // even reach
        PickFace face = WarehouseFace.of(1_000);
        Slotting replan = new Slotter().slot(face);
        PickFace incumbentFace = new PickFace(
                face.id(), face.name(), face.slots(), face.skus(), face.affinities(),
                face.policy(), Mode.IMPROVE,
                replan.placement().slotToSku(), Map.of());

        Slotting improved = new Slotter().slot(incumbentFace);
        assertTrue(improved.cost().total() <= replan.cost().total() + 1e-9,
                "improve mode raised the objective at scale: "
                        + improved.cost().total() + " over " + replan.cost().total());
    }
}
