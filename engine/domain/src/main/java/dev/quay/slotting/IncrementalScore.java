package dev.quay.slotting;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The slotter's incremental scorer. The full objective re-assesses every
 * placed carton and every affinity pair for every candidate slot, which is
 * what made warehouse-sized faces take days; this scorer keeps the
 * per-carton terms and the per-pair credits once, and scores a trial by
 * swapping only what the trial moves.
 *
 * Every expression here keeps the exact association order of the
 * corresponding term in {@link Objective}, so a trial's value is the full
 * objective's value up to floating-point summation order - the decisions
 * the slotter makes (better by more than the tie constant, first slot on a
 * tie) are preserved, and the reported figures still come from the full
 * assessment of the final placement.
 *
 * The slotter is the only caller; the class is deliberately not part of the
 * engine's public surface.
 */
final class IncrementalScore {

    private final Policy policy;
    private final List<Slot> slots;   // sorted by id, fixed order
    private final List<Sku> skus;     // the face's order, fixed
    private final Map<String, Integer> skuIndex = new HashMap<>();
    private final Map<String, Integer> slotIndex = new HashMap<>();

    // per-slot constants
    private final double[] slotReturn;
    private final double[] slotErgo;      // policy.ergo(slot.ergonomics())
    private final double[] slotCube;
    private final int[] slotAisle;
    private final int[] slotBay;
    private final boolean[] slotGolden;
    private final boolean[] slotFloor;
    private final String[] slotZone;      // null when the slot carries none

    // per-sku constants
    private final double[] travelPicks;   // travelWeight * picksPerDay
    private final double[] wastePicks;    // picksPerDay (the waste term's last factor)
    private final double[] goldenGap;     // slowPickCutoff - picks (may be negative)
    private final double[] lightPicks;    // lightFloorWeight * picks
    private final double[] cube;
    private final boolean[] heavy;        // weightKg >= heavyKg
    private final String[] skuZone;

    // affinity pairs, precomputed: strength * sqrt(picksA * picksB)
    private final int[] pairA;
    private final int[] pairB;
    private final double[] pairPull;
    private final int[][] pairsOfSku;     // sku index -> the pair indexes touching it

    // the state the trials play against
    private final int[] skuAt;            // sku index -> slot index, -1 unplaced
    private final int[] occupant;         // slot index -> sku index, -1 empty

    // the running category sums, in the objective's own five-way split
    private double travel;
    private double waste;
    private double golden;
    private double lightFloor;
    private double affinity;

    IncrementalScore(PickFace face) {
        this.policy = face.policy();
        this.slots = new ArrayList<>(face.slots());
        this.slots.sort(java.util.Comparator.comparing(Slot::id));
        this.skus = new ArrayList<>(face.skus());

        int slotCount = slots.size();
        slotReturn = new double[slotCount];
        slotErgo = new double[slotCount];
        slotCube = new double[slotCount];
        slotAisle = new int[slotCount];
        slotBay = new int[slotCount];
        slotGolden = new boolean[slotCount];
        slotFloor = new boolean[slotCount];
        slotZone = new String[slotCount];
        for (int i = 0; i < slotCount; i++) {
            Slot slot = slots.get(i);
            slotIndex.put(slot.id(), i);
            slotReturn[i] = slot.returnMeters();
            slotErgo[i] = policy.ergo(slot.ergonomics());
            slotCube[i] = slot.cubeLiters();
            slotAisle[i] = slot.aisleIndex();
            slotBay[i] = slot.bayIndex();
            slotGolden[i] = slot.ergonomics() == Ergonomics.GOLDEN;
            slotFloor[i] = slot.ergonomics() == Ergonomics.FLOOR;
            slotZone[i] = slot.zone().orElse(null);
        }

        int skuCount = skus.size();
        travelPicks = new double[skuCount];
        wastePicks = new double[skuCount];
        goldenGap = new double[skuCount];
        lightPicks = new double[skuCount];
        cube = new double[skuCount];
        heavy = new boolean[skuCount];
        skuZone = new String[skuCount];
        for (int i = 0; i < skuCount; i++) {
            Sku sku = skus.get(i);
            skuIndex.put(sku.id(), i);
            travelPicks[i] = policy.travelWeight() * sku.picksPerDay();
            wastePicks[i] = sku.picksPerDay();
            goldenGap[i] = policy.slowPickCutoff() - sku.picksPerDay();
            lightPicks[i] = policy.lightFloorWeight() * sku.picksPerDay();
            cube[i] = sku.cubeLiters();
            heavy[i] = sku.weightKg() >= policy.heavyKg();
            skuZone[i] = sku.zone().orElse(null);
        }

        List<Affinity> affinities = face.affinities();
        pairA = new int[affinities.size()];
        pairB = new int[affinities.size()];
        pairPull = new double[affinities.size()];
        List<List<Integer>> bySku = new ArrayList<>(skuCount);
        for (int i = 0; i < skuCount; i++) {
            bySku.add(new ArrayList<>());
        }
        for (int i = 0; i < affinities.size(); i++) {
            Affinity affinity = affinities.get(i);
            Integer a = skuIndex.get(affinity.skuA());
            Integer b = skuIndex.get(affinity.skuB());
            // a pair naming an unknown SKU cannot score; the face's own
            // rules refuse it before the slotter runs
            pairA[i] = a == null ? -1 : a;
            pairB[i] = b == null ? -1 : b;
            if (a != null && b != null) {
                // strength * sqrt(picksA * picksB), the pull's first factors
                pairPull[i] = affinity.strength()
                        * Math.sqrt(skus.get(a).picksPerDay() * skus.get(b).picksPerDay());
                bySku.get(a).add(i);
                if (b != a) {
                    bySku.get(b).add(i);
                }
            }
        }
        pairsOfSku = new int[skuCount][];
        for (int i = 0; i < skuCount; i++) {
            List<Integer> pairs = bySku.get(i);
            pairsOfSku[i] = new int[pairs.size()];
            for (int p = 0; p < pairs.size(); p++) {
                pairsOfSku[i][p] = pairs.get(p);
            }
        }

        skuAt = new int[skuCount];
        occupant = new int[slotCount];
        java.util.Arrays.fill(skuAt, -1);
        java.util.Arrays.fill(occupant, -1);
    }

    /** Ingests a complete placement (improve mode's incumbent). */
    void ingest(Map<String, String> skuToSlot) {
        for (Map.Entry<String, String> entry : skuToSlot.entrySet()) {
            Integer sku = skuIndex.get(entry.getKey());
            Integer slot = slotIndex.get(entry.getValue());
            if (sku == null || slot == null) {
                throw new IllegalStateException("the placement names an unknown SKU or slot");
            }
            if (skuAt[sku] != -1 || occupant[slot] != -1) {
                throw new IllegalStateException("slot or SKU is already assigned");
            }
            commitAssign(sku, slot);
        }
    }

    int slotIndexOf(String slotId) {
        Integer index = slotIndex.get(slotId);
        return index == null ? -1 : index;
    }

    int skuIndexOf(String skuId) {
        Integer index = skuIndex.get(skuId);
        return index == null ? -1 : index;
    }

    int slotCount() {
        return slots.size();
    }

    String slotId(int slotIx) {
        return slots.get(slotIx).id();
    }

    String skuId(int skuIx) {
        return skus.get(skuIx).id();
    }

    /** Ingests a placement: every slot entry, in the placement's own order. */
    void ingestPlacement(Placement placement) {
        for (Map.Entry<String, String> entry : placement.slotToSku().entrySet()) {
            commitAssign(skuIndexOf(entry.getValue()), slotIndexOf(entry.getKey()));
        }
    }

    int occupantAt(int slotIx) {
        return occupant[slotIx];
    }

    int slotOf(int skuIx) {
        return skuAt[skuIx];
    }

    /** The fit law of FaceRules, on precomputed constants. */
    boolean fits(int skuIx, int slotIx) {
        if (!(cube[skuIx] > 0) || cube[skuIx] > slotCube[slotIx]) {
            return false;
        }
        if (heavy[skuIx] && slots.get(slotIx).level() > policy.maxLevelForHeavy()) {
            return false;
        }
        if ((skuZone[skuIx] == null) != (slotZone[slotIx] == null)) {
            return false;
        }
        return skuZone[skuIx] == null || skuZone[skuIx].equals(slotZone[slotIx]);
    }

    /** Scores placing an unplaced SKU into an empty slot. */
    double trialAssign(int skuIx, int slotIx) {
        double total = basePlus(skuIx, slotIx);
        for (int pair : pairsOfSku[skuIx]) {
            int other = other(pair, skuIx);
            if (other != -1 && skuAt[other] != -1) {
                total -= affinityTerm(pair, slotIx, skuAt[other]);
            }
        }
        return total;
    }

    /** Scores moving a placed SKU into an empty slot. */
    double trialMove(int skuIx, int toIx) {
        int from = skuAt[skuIx];
        double total = baseMinusPlus(skuIx, from, toIx);
        for (int pair : pairsOfSku[skuIx]) {
            int other = other(pair, skuIx);
            if (other != -1 && skuAt[other] != -1 && other != skuIx) {
                total += affinityTerm(pair, from, skuAt[other]);
                total -= affinityTerm(pair, toIx, skuAt[other]);
            }
        }
        return total;
    }

    /** Scores swapping two placed SKUs' slots. */
    double trialSwap(int skuIx, int otherIx) {
        int fromA = skuAt[skuIx];
        int fromB = skuAt[otherIx];
        double total = base()
                - perSku(skuIx, fromA) + perSku(skuIx, fromB)
                - perSku(otherIx, fromB) + perSku(otherIx, fromA);
        for (int pair : pairsOfSku[skuIx]) {
            int third = other(pair, skuIx);
            if (third == -1 || skuAt[third] == -1) {
                continue;
            }
            if (third == otherIx) {
                // the swapped pair trades slots; the bay distance is
                // symmetric, so the credit is unchanged - computed, not assumed
                total += affinityTerm(pair, fromA, fromB);
                total -= affinityTerm(pair, fromB, fromA);
            } else {
                total += affinityTerm(pair, fromA, skuAt[third]);
                total -= affinityTerm(pair, fromB, skuAt[third]);
            }
        }
        for (int pair : pairsOfSku[otherIx]) {
            int third = other(pair, otherIx);
            if (third == -1 || skuAt[third] == -1 || third == skuIx) {
                continue;
            }
            total += affinityTerm(pair, fromB, skuAt[third]);
            total -= affinityTerm(pair, fromA, skuAt[third]);
        }
        return total;
    }

    /** Applies an assignment to the kept state. */
    void commitAssign(int skuIx, int slotIx) {
        occupant[slotIx] = skuIx;
        skuAt[skuIx] = slotIx;
        travel += travelTerm(skuIx, slotIx);
        waste += wasteTerm(skuIx, slotIx);
        if (slotGolden[slotIx] && goldenGap[skuIx] > 0) {
            golden += policy.goldenWeight() * goldenGap[skuIx];
        }
        if (slotFloor[slotIx] && skus.get(skuIx).weightKg() <= policy.lightKg()) {
            lightFloor += lightPicks[skuIx];
        }
        for (int pair : pairsOfSku[skuIx]) {
            int mate = other(pair, skuIx);
            if (mate != -1 && skuAt[mate] != -1 && mate != skuIx) {
                affinity += affinityTerm(pair, slotIx, skuAt[mate]);
            }
        }
    }

    /** Applies a move (one SKU, one empty target). */
    void commitMove(int skuIx, int toIx) {
        int from = skuAt[skuIx];
        commitRemove(skuIx);
        commitAssign(skuIx, toIx);
        occupant[from] = -1;
    }

    /** Applies a swap (two SKUs trade slots). */
    void commitSwap(int skuIx, int otherIx) {
        int fromA = skuAt[skuIx];
        int fromB = skuAt[otherIx];
        commitRemove(skuIx);
        commitRemove(otherIx);
        // remove cleared both slots; re-add each into the other's place
        occupant[fromA] = -1;
        occupant[fromB] = -1;
        commitAssign(skuIx, fromB);
        commitAssign(otherIx, fromA);
    }

    private void commitRemove(int skuIx) {
        int from = skuAt[skuIx];
        travel -= travelTerm(skuIx, from);
        waste -= wasteTerm(skuIx, from);
        if (slotGolden[from] && goldenGap[skuIx] > 0) {
            golden -= policy.goldenWeight() * goldenGap[skuIx];
        }
        if (slotFloor[from] && skus.get(skuIx).weightKg() <= policy.lightKg()) {
            lightFloor -= lightPicks[skuIx];
        }
        for (int pair : pairsOfSku[skuIx]) {
            int mate = other(pair, skuIx);
            if (mate != -1 && skuAt[mate] != -1 && mate != skuIx) {
                affinity -= affinityTerm(pair, from, skuAt[mate]);
            }
        }
        skuAt[skuIx] = -1;
    }

    private double base() {
        return travel + waste + golden + lightFloor - affinity;
    }

    private double basePlus(int skuIx, int slotIx) {
        return base() + perSku(skuIx, slotIx);
    }

    private double baseMinusPlus(int skuIx, int fromIx, int toIx) {
        return base() - perSku(skuIx, fromIx) + perSku(skuIx, toIx);
    }

    /** The four per-SKU terms for one (sku, slot), in the objective's order. */
    private double perSku(int skuIx, int slotIx) {
        return travelTerm(skuIx, slotIx)
                + wasteTerm(skuIx, slotIx)
                + goldenTerm(skuIx, slotIx)
                + lightFloorTerm(skuIx, slotIx);
    }

    private double travelTerm(int skuIx, int slotIx) {
        return travelPicks[skuIx] * slotReturn[slotIx] * slotErgo[slotIx];
    }

    private double wasteTerm(int skuIx, int slotIx) {
        double wasteRatio = (slotCube[slotIx] - cube[skuIx]) / slotCube[slotIx];
        return policy.wasteWeight() * wasteRatio * wastePicks[skuIx];
    }

    private double goldenTerm(int skuIx, int slotIx) {
        if (slotGolden[slotIx] && goldenGap[skuIx] > 0) {
            return policy.goldenWeight() * goldenGap[skuIx];
        }
        return 0.0;
    }

    private double lightFloorTerm(int skuIx, int slotIx) {
        if (slotFloor[slotIx] && skus.get(skuIx).weightKg() <= policy.lightKg()) {
            return lightPicks[skuIx];
        }
        return 0.0;
    }

    /** One pair's credit for two slots, in the objective's association. */
    private double affinityTerm(int pair, int slotA, int slotB) {
        int steps = Math.abs(slotAisle[slotA] - slotAisle[slotB])
                + Math.abs(slotBay[slotA] - slotBay[slotB]);
        return policy.affinityWeight()
                * (pairPull[pair] * Math.exp(-steps / policy.affinityDecayBays()));
    }

    private int other(int pair, int skuIx) {
        return pairA[pair] == skuIx ? pairB[pair] : pairA[pair];
    }
}
