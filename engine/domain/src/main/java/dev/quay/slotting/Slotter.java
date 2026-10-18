package dev.quay.slotting;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Places every SKU, then relocates and swaps while the objective falls.
 * Velocity order is picks per day, highest first, and SKU id breaks ties.
 * Equal scores keep the slot id that sorts first.
 *
 * Scoring is incremental: each candidate trial swaps only the moved
 * carton's own terms and its affinity partners' credits against the kept
 * running sums, instead of re-assessing the entire face per candidate (the
 * old full evaluation made the cost grow with cartons x slots x placement
 * size - days at warehouse scale). Every expression in
 * {@link IncrementalScore} keeps the objective's own association order, so
 * the decisions this class makes are the decisions the full evaluation
 * made, and the reported figures still come from the one full assessment
 * of the final placement.
 */
public final class Slotter {

    private static final double TIE = 1.0e-9;

    public Slotting slot(PickFace face) {
        FaceRules.check(face);
        Placement built = switch (face.mode()) {
            case REPLAN -> construct(face);
            case IMPROVE -> Placement.ofComplete(face.current());
        };
        Placement improved = improve(face, built);
        return new Slotting(improved, Measurements.measure(face, improved), Objective.assess(face, improved));
    }

    private static Placement construct(PickFace face) {
        IncrementalScore score = new IncrementalScore(face);
        Placement placement = Placement.empty();
        Set<String> lockedIds = new HashSet<>();
        List<String> lockSkus = new ArrayList<>(face.locked().keySet());
        lockSkus.sort(Comparator.naturalOrder());
        for (String skuId : lockSkus) {
            int slotIx = score.slotIndexOf(face.locked().get(skuId));
            placement = placement.assign(face.locked().get(skuId), skuId);
            score.commitAssign(score.skuIndexOf(skuId), slotIx);
            lockedIds.add(skuId);
        }
        List<Sku> order = new ArrayList<>(face.skus());
        order.sort(Comparator.comparingDouble(Sku::picksPerDay).reversed().thenComparing(Sku::id));
        for (Sku sku : order) {
            if (lockedIds.contains(sku.id())) {
                continue;
            }
            int skuIx = score.skuIndexOf(sku.id());
            int bestIx = -1;
            double best = Double.POSITIVE_INFINITY;
            for (int slotIx = 0; slotIx < score.slotCount(); slotIx++) {
                if (score.occupantAt(slotIx) != -1 || !score.fits(skuIx, slotIx)) {
                    continue;
                }
                double candidate = score.trialAssign(skuIx, slotIx);
                String slotId = score.slotId(slotIx);
                if (bestIx == -1 || candidate < best - TIE
                        || (Math.abs(candidate - best) <= TIE && slotId.compareTo(score.slotId(bestIx)) < 0)) {
                    best = candidate;
                    bestIx = slotIx;
                }
            }
            if (bestIx == -1) {
                throw new FaceRejection(List.of(sku.name() + " has nowhere left that can hold it."));
            }
            placement = placement.assign(score.slotId(bestIx), sku.id());
            score.commitAssign(skuIx, bestIx);
        }
        return placement;
    }

    private static Placement improve(PickFace face, Placement start) {
        IncrementalScore score = new IncrementalScore(face);
        score.ingestPlacement(start);
        Placement current = start;
        double running = Objective.total(face, current);
        List<Sku> skus = new ArrayList<>(face.skus());
        skus.sort(Comparator.comparing(Sku::id));
        Set<String> locked = face.locked().keySet();
        for (int pass = 0; pass < face.policy().maxPasses(); pass++) {
            boolean changed = false;
            for (Sku sku : skus) {
                if (locked.contains(sku.id())) {
                    continue;
                }
                int skuIx = score.skuIndexOf(sku.id());
                int fromIx = score.slotOf(skuIx);
                String fromId = score.slotId(fromIx);
                int bestIx = fromIx;
                double best = running;
                for (int candidateIx = 0; candidateIx < score.slotCount(); candidateIx++) {
                    if (candidateIx == fromIx || !score.fits(skuIx, candidateIx)) {
                        continue;
                    }
                    int occupantIx = score.occupantAt(candidateIx);
                    double next;
                    if (occupantIx == -1) {
                        next = score.trialMove(skuIx, candidateIx);
                    } else {
                        if (locked.contains(score.skuId(occupantIx))) {
                            continue;
                        }
                        if (!score.fits(occupantIx, fromIx)) {
                            continue;
                        }
                        next = score.trialSwap(skuIx, occupantIx);
                    }
                    if (next < best - TIE) {
                        best = next;
                        bestIx = candidateIx;
                    }
                }
                if (bestIx != fromIx) {
                    int occupantIx = score.occupantAt(bestIx);
                    if (occupantIx == -1) {
                        current = current.move(sku.id(), score.slotId(bestIx));
                        score.commitMove(skuIx, bestIx);
                    } else {
                        current = current.swap(sku.id(), score.skuId(occupantIx));
                        score.commitSwap(skuIx, occupantIx);
                    }
                    running = best;
                    changed = true;
                }
            }
            if (!changed) {
                break;
            }
        }
        return current;
    }
}
