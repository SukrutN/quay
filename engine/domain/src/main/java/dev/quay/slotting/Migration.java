package dev.quay.slotting;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * The re-slot migration planner: the staged move sequence from the floor's
 * current layout to a proposed one, ordered so no slot is ever double-booked
 * and no carton lands on an occupied face.
 *
 * The rules the sequence answers to:
 *
 *   - a SKU only moves when its target slot is empty at that moment, so the
 *     plan is applied top to bottom and the floor is walkable after every
 *     step;
 *   - when the remaining moves form a loop (A wants B's slot, B wants A's),
 *     one carton is staged through an empty slot that no target claims, and
 *     that staging is reported, never hidden;
 *   - locked SKUs never move, and a target that tries to move one is refused
 *     in words;
 *   - a target that sends a SKU onto a slot whose occupant stays put is
 *     refused as the contradiction it is.
 *
 * The labor figure is a stated proxy, not a measurement: every move is one
 * dock-to-dock trip, out to the from-slot and out to the to-slot at a
 * walking pace, plus a fixed handling time. A buffered move costs two trips,
 * because the carton is handled twice. The model's constants ride in the
 * response so the reader can check the arithmetic.
 */
public final class Migration {

    /** Walking pace for the labor proxy, metres per second. */
    public static final double WALK_MPS = 1.15;

    /** Handling time per carton, minutes. */
    public static final double HANDLE_MINUTES = 2.0;

    /** One step of the sequence: a carton, a from, a to, and its cost. */
    public record Move(
            int step,
            String skuId,
            String skuName,
            String from,
            String to,
            boolean buffered,
            double minutes,
            String note) {}

    /** The whole plan: the steps in order, the labor, and the notes. */
    public record Plan(int moves, int bufferedMoves, double laborMinutes, List<Move> steps, List<String> notes) {}

    private Migration() {}

    /**
     * Plans the migration from the face's current layout to the target.
     *
     * @param face  the floor as it stands: slots, SKUs, the current layout,
     *              and the locks
     * @param target skuId to slotId for every SKU that moves; SKUs absent
     *              from the target stay where they stand
     */
    public static Plan plan(PickFace face, Map<String, String> target) {
        List<String> problems = new ArrayList<>();
        if (!face.hasCurrent()) {
            problems.add("The face carries no current layout, so there is nothing to migrate from.");
        }
        validate(face, target, problems);
        if (!problems.isEmpty()) {
            throw new FaceRejection(problems);
        }

        // the floor as it stands, mutated step by step as the plan runs
        Map<String, String> occupied = new LinkedHashMap<>(face.current());          // slot -> sku
        Map<String, String> position = invert(face.current());                        // sku -> slot
        TreeMap<String, String> wants = new TreeMap<>();                              // sku -> target, sorted for determinism
        for (Map.Entry<String, String> entry : target.entrySet()) {
            String sku = entry.getKey();
            String to = entry.getValue();
            if (position.containsKey(sku) && !to.equals(position.get(sku))) {
                wants.put(sku, to);
            }
        }

        // a buffer slot is empty now and claimed by no target, so it is free
        // for the whole plan
        Set<String> claimed = new LinkedHashSet<>(target.values());
        List<String> buffers = new ArrayList<>();
        for (Slot slot : face.slots()) {
            if (!occupied.containsKey(slot.id()) && !claimed.contains(slot.id())) {
                buffers.add(slot.id());
            }
        }

        List<Move> steps = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        notes.add("The labor figure is a proxy: each move is one dock-to-dock trip at "
                + WALK_MPS + " m/s plus " + HANDLE_MINUTES + " minutes of handling; a staged move costs two trips.");
        if (wants.isEmpty()) {
            notes.add("The target matches the current layout, so no carton moves.");
        }

        int bufferedMoves = 0;
        while (!wants.isEmpty()) {
            // one pass: every SKU whose target is empty right now can move
            boolean progress = false;
            for (String sku : new ArrayList<>(wants.keySet())) {
                String to = wants.get(sku);
                if (!occupied.containsKey(to)) {
                    steps.add(move(steps.size() + 1, face, position, sku, to, false));
                    apply(occupied, position, sku, to);
                    wants.remove(sku);
                    progress = true;
                }
            }
            if (progress) {
                continue;
            }

            // no direct move exists: the rest form loops, so stage one
            // carton through a buffer to break the first loop
            String stuck = wants.firstKey();
            if (buffers.isEmpty()) {
                throw new FaceRejection(List.of(
                        "The remaining moves form a loop and no empty slot is free to break it. "
                                + "Free a slot or drop a target and plan again."));
            }
            String buffer = buffers.remove(0);
            steps.add(move(steps.size() + 1, face, position, stuck, buffer, true));
            apply(occupied, position, stuck, buffer);
            bufferedMoves++;
            notes.add("Carton " + face.sku(stuck).map(Sku::name).orElse(stuck)
                    + " was staged through " + buffer + " to break a loop of mutually blocking targets.");
        }

        // the proof: replaying the steps reaches the target exactly
        for (Map.Entry<String, String> entry : target.entrySet()) {
            String sku = entry.getKey();
            if (position.containsKey(sku) && !entry.getValue().equals(position.get(sku))) {
                throw new IllegalStateException("the migration end state disagrees with the target for " + sku);
            }
        }

        double labor = steps.stream().mapToDouble(Move::minutes).sum();
        return new Plan(steps.size(), bufferedMoves, labor, List.copyOf(steps), List.copyOf(notes));
    }

    private static void validate(PickFace face, Map<String, String> target, List<String> problems) {
        Set<String> targetSlots = new LinkedHashSet<>();
        for (Map.Entry<String, String> entry : target.entrySet()) {
            String sku = entry.getKey();
            String to = entry.getValue();
            if (face.sku(sku).isEmpty()) {
                problems.add("The target names SKU " + sku + ", which the face does not carry.");
                continue;
            }
            if (!face.current().containsValue(sku)) {
                problems.add(face.sku(sku).map(Sku::name).orElse(sku)
                        + " is not standing on the floor today, so the migration cannot move it. "
                        + "The target can only re-place what the current layout holds.");
                continue;
            }
            if (face.locked().containsKey(sku) && !face.locked().get(sku).equals(to)) {
                problems.add(face.sku(sku).map(Sku::name).orElse(sku)
                        + " is locked to " + face.locked().get(sku) + " and cannot be moved.");
            }
            if (face.slot(to).isEmpty()) {
                problems.add("The target sends " + face.sku(sku).map(Sku::name).orElse(sku)
                        + " to slot " + to + ", which the face does not have.");
                continue;
            }
            if (!targetSlots.add(to)) {
                problems.add("The target sends two SKUs to slot " + to + ".");
            }
        }
        // an occupant that stays put blocks any target aimed at its slot
        for (Map.Entry<String, String> entry : target.entrySet()) {
            String to = entry.getValue();
            String occupant = face.current().get(to);
            if (occupant == null || occupant.equals(entry.getKey())) {
                continue;
            }
            boolean occupantMoves = target.containsKey(occupant)
                    && !target.get(occupant).equals(to);
            boolean occupantStaysElsewhere = target.containsKey(occupant) && target.get(occupant).equals(to);
            if (!occupantMoves && !occupantStaysElsewhere) {
                problems.add("The target sends " + face.sku(entry.getKey()).map(Sku::name).orElse(entry.getKey())
                        + " to " + to + ", but " + face.sku(occupant).map(Sku::name).orElse(occupant)
                        + " stays there.");
            } else if (occupantStaysElsewhere) {
                problems.add("The target leaves " + face.sku(occupant).map(Sku::name).orElse(occupant)
                        + " on " + to + " and also sends " + face.sku(entry.getKey()).map(Sku::name).orElse(entry.getKey())
                        + " there.");
            }
        }
    }

    private static Move move(int step, PickFace face, Map<String, String> position, String sku, String to, boolean buffered) {
        String from = position.get(sku);
        Slot fromSlot = face.slot(from).orElseThrow();
        Slot toSlot = face.slot(to).orElseThrow();
        double metres = fromSlot.returnMeters() + toSlot.returnMeters();
        double minutes = (metres / WALK_MPS) / 60.0 + HANDLE_MINUTES;
        if (buffered) {
            minutes *= 2;
        }
        String note = buffered
                ? "Staged through " + to + "; the carton moves on to its target once the loop clears."
                : "One dock-to-dock trip: " + String.format(java.util.Locale.ROOT, "%.0f", metres) + " m out and back, plus handling.";
        return new Move(step, sku, face.sku(sku).map(Sku::name).orElse(sku), from, to, buffered, minutes, note);
    }

    private static void apply(Map<String, String> occupied, Map<String, String> position, String sku, String to) {
        String from = position.get(sku);
        occupied.remove(from);
        occupied.put(to, sku);
        position.put(sku, to);
    }

    private static Map<String, String> invert(Map<String, String> slotToSku) {
        Map<String, String> skuToSlot = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : slotToSku.entrySet()) {
            skuToSlot.put(entry.getValue(), entry.getKey());
        }
        return skuToSlot;
    }
}
