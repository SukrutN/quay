package dev.quay.slotting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * The migration planner, tested the way an operator meets it: moves that
 * flow, loops that need a stage, locks that refuse, and targets that
 * contradict themselves. The floor mirrors the lane fixture: six slots, four
 * standing cartons, one of them locked.
 */
class MigrationTest {

    private static Slot slot(String id, String aisle, int aisleIndex, int bay, double cube, double returns, String zone) {
        return new Slot(id, aisle, aisleIndex, bay, bay - 1, 1, cube, returns, Ergonomics.FLOOR,
                zone == null ? Optional.empty() : Optional.of(zone));
    }

    /** the lane-shaped floor: A-01-L2 empty, A-01-L1 locked stock, A-03-L2 cloth,
     *  B-01-L2 empty, B-01-L1 yogurt, B-02-L1 oat milk. */
    private static PickFace lane() {
        List<Slot> slots = List.of(
                slot("A-01-L2", "A", 0, 1, 24, 8, "ambient"),
                slot("A-01-L1", "A", 0, 1, 40, 8, "ambient"),
                slot("A-03-L2", "A", 0, 3, 24, 20, "ambient"),
                slot("B-01-L2", "B", 1, 1, 16, 28, "chill"),
                slot("B-01-L1", "B", 1, 1, 30, 28, "chill"),
                slot("B-02-L1", "B", 1, 2, 40, 36, "ambient"));
        List<Sku> skus = List.of(
                new Sku("LN-01", "Oat milk", 50, 8, 4, Optional.of("ambient")),
                new Sku("LN-02", "Yogurt", 22, 4, 2.5, Optional.of("chill")),
                new Sku("LN-03", "Steel stockpot", 9, 18, 13.5, Optional.of("ambient")),
                new Sku("LN-04", "Cloth filters", 16, 1.5, 0.3, Optional.of("ambient")));
        Map<String, String> current = new LinkedHashMap<>();
        current.put("B-02-L1", "LN-01");
        current.put("B-01-L1", "LN-02");
        current.put("A-01-L1", "LN-03");
        current.put("A-03-L2", "LN-04");
        return new PickFace(
                "lane",
                "Lane chill corner",
                slots,
                skus,
                List.of(),
                new Policy(1, 10, 2, 0.5, 5, 15, 1, 12, 1, 1, 1.12, 1.3, 2, 4),
                Mode.IMPROVE,
                current,
                Map.of("LN-03", "A-01-L1"));
    }

    private static Map<String, String> target(String... pairs) {
        Map<String, String> target = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            target.put(pairs[i], pairs[i + 1]);
        }
        return target;
    }

    @Test
    void aMoveIntoAnEmptySlotIsOneStep() {
        Migration.Plan plan = Migration.plan(lane(), target("LN-01", "A-01-L2"));

        assertEquals(1, plan.moves());
        assertEquals(0, plan.bufferedMoves());
        Migration.Move only = plan.steps().get(0);
        assertEquals("LN-01", only.skuId());
        assertEquals("B-02-L1", only.from());
        assertEquals("A-01-L2", only.to());
        // dock-to-dock: 36 m out to the from-slot, 8 m out to the to-slot
        double expected = (36.0 + 8.0) / Migration.WALK_MPS / 60.0 + Migration.HANDLE_MINUTES;
        assertEquals(expected, only.minutes(), 1e-9);
    }

    @Test
    void aTargetThatMatchesTheCurrentLayoutMovesNothing() {
        Migration.Plan plan = Migration.plan(lane(), target("LN-01", "B-02-L1"));

        assertEquals(0, plan.moves());
        assertTrue(plan.notes().stream().anyMatch(note -> note.contains("no carton moves")));
    }

    @Test
    void aChainOrdersTheVacatingMoveFirst() {
        // LN-01 wants LN-02's slot; LN-02 wants an empty slot
        Migration.Plan plan = Migration.plan(lane(), target("LN-01", "B-01-L1", "LN-02", "A-01-L2"));

        assertEquals(2, plan.moves());
        assertEquals("LN-02", plan.steps().get(0).skuId(), "LN-02 must vacate before LN-01 lands");
        assertEquals("A-01-L2", plan.steps().get(0).to());
        assertEquals("LN-01", plan.steps().get(1).skuId());
        assertEquals("B-01-L1", plan.steps().get(1).to());
    }

    @Test
    void aLoopIsBrokenThroughAnEmptySlotAndReported() {
        // LN-01 and LN-02 want each other's slots
        Migration.Plan plan = Migration.plan(lane(), target("LN-01", "B-01-L1", "LN-02", "B-02-L1"));

        assertEquals(3, plan.moves(), "a loop needs one staged move");
        assertEquals(1, plan.bufferedMoves());
        Migration.Move staged = plan.steps().get(0);
        assertTrue(staged.buffered());
        assertTrue(staged.note().contains("Staged"));
        assertTrue(plan.notes().stream().anyMatch(note -> note.contains("staged through")
                && note.contains("to break a loop")));
        // the staged carton reaches its real target in the end
        Migration.Move last = plan.steps().get(2);
        assertEquals(staged.skuId(), last.skuId());
        // labor: the staged move costs two trips
        assertTrue(staged.minutes() > last.minutes() * 1.9);
    }

    @Test
    void aLockedSkuRefusesToMove() {
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(lane(), target("LN-03", "A-01-L2")));
        assertTrue(refusal.reasons().get(0).contains("Steel stockpot is locked to A-01-L1"));
    }

    @Test
    void aTargetOntoAStayingOccupantIsRefusedAsTheContradictionItIs() {
        // A-03-L2 holds LN-04, which the target does not move
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(lane(), target("LN-01", "A-03-L2")));
        assertTrue(refusal.reasons().get(0).contains("Cloth filters stays there"));
    }

    @Test
    void twoSkusSentToOneSlotAreRefused() {
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(lane(), target("LN-01", "A-01-L2", "LN-02", "A-01-L2")));
        assertTrue(refusal.reasons().stream().anyMatch(reason -> reason.contains("two SKUs to slot A-01-L2")));
    }

    @Test
    void aTargetForASlotTheFaceDoesNotHaveIsRefused() {
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(lane(), target("LN-01", "Z-99-L9")));
        assertTrue(refusal.reasons().stream().anyMatch(reason -> reason.contains("slot Z-99-L9")));
    }

    @Test
    void aSkuThatIsNotStandingTodayIsRefused() {
        // a face that carries a catalog SKU with no slot in the current
        // layout: the migration can move what stands, not what might
        Slot near = new Slot("near", "A", 0, 1, 0, 1, 20, 8, Ergonomics.FLOOR, Optional.empty());
        Slot far = new Slot("far", "A", 0, 2, 1, 1, 20, 28, Ergonomics.FLOOR, Optional.empty());
        Sku standing = new Sku("st-1", "Standing tin", 40, 2, 1, Optional.empty());
        Sku shelved = new Sku("sh-9", "Shelved tin", 4, 2, 1, Optional.empty());
        PickFace face = new PickFace(
                "shelf",
                "Shelf",
                List.of(near, far),
                List.of(standing, shelved),
                List.of(),
                new Policy(1, 0, 0, 0, 0, 0, 2, 12, 1, 1, 1.1, 1.3, 2, 2),
                Mode.IMPROVE,
                Map.of("far", "st-1"),
                Map.of());
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(face, target("sh-9", "near")));
        assertTrue(refusal.reasons().stream().anyMatch(reason -> reason.contains("not standing on the floor today")));
    }

    @Test
    void aLoopWithNoEmptySlotLeftRefusesRatherThanDoubleBooking() {
        // five slots, four standing cartons, one empty: the loop pair wants
        // each other's slots, and the only empty slot is claimed by a third
        // mover, so nothing is free to break the loop
        Slot[] slots = {
                new Slot("s1", "A", 0, 1, 0, 1, 20, 8, Ergonomics.FLOOR, Optional.empty()),
                new Slot("s2", "A", 0, 2, 1, 1, 20, 12, Ergonomics.FLOOR, Optional.empty()),
                new Slot("s3", "A", 0, 3, 2, 1, 20, 16, Ergonomics.FLOOR, Optional.empty()),
                new Slot("s4", "A", 0, 4, 3, 1, 20, 20, Ergonomics.FLOOR, Optional.empty()),
                new Slot("s5", "A", 0, 5, 4, 1, 20, 24, Ergonomics.FLOOR, Optional.empty()),
        };
        Sku[] skus = {
                new Sku("m-a", "Carton A", 40, 2, 1, Optional.empty()),
                new Sku("m-b", "Carton B", 30, 2, 1, Optional.empty()),
                new Sku("m-c", "Carton C", 20, 2, 1, Optional.empty()),
                new Sku("m-d", "Carton D", 10, 2, 1, Optional.empty()),
        };
        Map<String, String> current = new LinkedHashMap<>();
        current.put("s1", "m-a");
        current.put("s2", "m-b");
        current.put("s3", "m-c");
        current.put("s4", "m-d");
        PickFace face = new PickFace(
                "looped",
                "Looped",
                List.of(slots),
                List.of(skus),
                List.of(),
                new Policy(1, 0, 0, 0, 0, 0, 2, 12, 1, 1, 1.1, 1.3, 2, 2),
                Mode.IMPROVE,
                current,
                Map.of());
        // the loop: A wants B's slot, B wants A's; C claims the only empty
        FaceRejection refusal = assertThrows(FaceRejection.class,
                () -> Migration.plan(face, target("m-a", "s2", "m-b", "s1", "m-c", "s5")));
        assertTrue(refusal.reasons().get(0).contains("form a loop and no empty slot is free"),
                "the refusal words: " + refusal.reasons());
    }

    @Test
    void theRealSlottingTargetPlansAndReachesItsEndState() {
        PickFace face = lane();
        Slotting proposal = new Slotter().slot(face);
        Map<String, String> target = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : proposal.placement().slotToSku().entrySet()) {
            target.put(entry.getValue(), entry.getKey());
        }

        Migration.Plan plan = Migration.plan(face, target);

        // the locked SKU never moves
        for (Migration.Move move : plan.steps()) {
            assertTrue(!move.skuId().equals("LN-03"), "the locked SKU must not move");
        }
        // replaying the plan reaches the proposal exactly
        Map<String, String> occupied = new LinkedHashMap<>(face.current());
        for (Migration.Move move : plan.steps()) {
            String sku = occupied.remove(move.from());
            assertEquals(move.skuId(), sku, "the from-slot must hold the moving SKU at its step");
            occupied.put(move.to(), sku);
        }
        assertEquals(proposal.placement().slotToSku(), occupied, "the end state must be the proposal");
    }

    @Test
    void theLaborModelStatesItselfInTheNotes() {
        Migration.Plan plan = Migration.plan(lane(), target("LN-01", "A-01-L2"));
        assertTrue(plan.notes().get(0).contains("proxy"));
        assertTrue(plan.notes().get(0).contains(String.valueOf(Migration.WALK_MPS)));
    }
}
