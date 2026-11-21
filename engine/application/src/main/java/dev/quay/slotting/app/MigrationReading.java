package dev.quay.slotting.app;

import dev.quay.slotting.Migration;
import java.util.Locale;

/**
 * The migration plan a planner checks on a terminal. Rounding lives here; the
 * API keeps full precision.
 */
public final class MigrationReading {

    private MigrationReading() {}

    public static String text(String faceId, String faceName, Migration.Plan plan) {
        StringBuilder out = new StringBuilder();
        out.append("migration for ").append(faceName).append(" (").append(faceId).append(")\n");
        out.append(plan.moves()).append(" move").append(plan.moves() == 1 ? "" : "s");
        if (plan.bufferedMoves() > 0) {
            out.append(", ").append(plan.bufferedMoves()).append(" staged through an empty slot");
        }
        out.append(String.format(Locale.US, "%n%.1f labor minutes (proxy)%n%n", plan.laborMinutes()));
        for (Migration.Move move : plan.steps()) {
            out.append(String.format(Locale.US, "%2d. %-10s %-12s %-12s %5.1f min%s%n",
                    move.step(),
                    move.skuId(),
                    move.from(),
                    move.to(),
                    move.minutes(),
                    move.buffered() ? "  (staged)" : ""));
        }
        out.append('\n');
        for (String note : plan.notes()) {
            out.append(note).append('\n');
        }
        return out.toString();
    }
}
