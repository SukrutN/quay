package dev.quay.slotting.app;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;

/** The reading a planner checks on the dock door. Rounding lives here; the API keeps full precision. */
public final class PutawayReading {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private PutawayReading() {}

    public static String text(PutawayReport report) {
        StringBuilder out = new StringBuilder();
        out.append(report.dayName()).append(" (").append(report.dayId()).append(")\n");
        out.append(report.elapsedMillis()).append(" ms\n");
        for (PutawayReport.Outcome outcome : report.outcomes()) {
            out.append('\n');
            section(out, outcome);
        }
        comparison(out, report);
        return out.toString();
    }

    /**
     * The reading a machine can check: every figure full precision, and no
     * clock. The site stores this output as its golden copy and locks its
     * port against it, so nothing that varies run to run may enter it.
     */
    public static String json(PutawayReport report) {
        ObjectNode root = MAPPER.createObjectNode();
        root.put("dayId", report.dayId());
        root.put("dayName", report.dayName());
        ArrayNode outcomes = root.putArray("outcomes");
        for (PutawayReport.Outcome outcome : report.outcomes()) {
            ObjectNode node = outcomes.addObject();
            node.put("policy", outcome.policy());
            ArrayNode directives = node.putArray("directives");
            for (PutawayReport.DirectiveRow row : outcome.directives()) {
                ObjectNode directive = directives.addObject();
                directive.put("receiptId", row.receiptId());
                directive.put("skuId", row.skuId());
                directive.put("skuName", row.skuName());
                directive.put("band", row.band());
                directive.put("destination", row.destination());
                directive.put("units", row.units());
                directive.put("uom", row.uom());
                directive.put("cartons", row.cartons());
                directive.put("slotId", row.slotId());
                directive.put("putawayMeters", row.putawayMeters());
            }
            ArrayNode refusals = node.putArray("refusals");
            for (PutawayReport.RefusalRow row : outcome.refusals()) {
                ObjectNode refusal = refusals.addObject();
                refusal.put("receiptId", row.receiptId());
                refusal.put("reason", row.reason());
            }
            ArrayNode signals = node.putArray("signals");
            for (PutawayReport.SignalRow row : outcome.signals()) {
                ObjectNode signal = signals.addObject();
                signal.put("skuId", row.skuId());
                signal.put("onHand", row.onHand());
                signal.put("action", row.action());
                signal.put("cartons", row.cartons());
            }
            PutawayReport.Totals totals = outcome.totals();
            ObjectNode total = node.putObject("totals");
            total.put("receipts", totals.receipts());
            total.put("refused", totals.refused());
            total.put("cartons", totals.cartons());
            total.put("cartonsForward", totals.cartonsForward());
            total.put("cartonsReserve", totals.cartonsReserve());
            total.put("goldenShare", totals.goldenShare());
            total.put("putawayMeters", totals.putawayMeters());
            total.put("baysTouched", totals.baysTouched());
        }
        try {
            return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(root) + "\n";
        } catch (JsonProcessingException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static void section(StringBuilder out, PutawayReport.Outcome outcome) {
        PutawayReport.Totals totals = outcome.totals();
        out.append(outcome.policy()).append('\n');
        out.append(String.format(Locale.US,
                "%d manifest lines, %d refused · %d cartons to the face, %d to reserve across %d bays%n",
                totals.receipts(), totals.refused(), totals.cartonsForward(),
                totals.cartonsReserve(), totals.baysTouched()));
        out.append(String.format(Locale.US,
                "putaway walk %.1f m · golden-band share %.2f%n",
                totals.putawayMeters(), totals.goldenShare()));
        for (PutawayReport.SignalRow signal : outcome.signals()) {
            if (signal.action().equals("raise")) {
                out.append(String.format(Locale.US,
                        "%s raise at %.0f on hand, asks %d cartons%n",
                        signal.skuId(), signal.onHand(), signal.cartons()));
            } else {
                out.append(String.format(Locale.US, "%s quiet at %.0f on hand%n", signal.skuId(), signal.onHand()));
            }
        }
        for (PutawayReport.DirectiveRow row : outcome.directives()) {
            if (row.destination().equals("forward")) {
                out.append(String.format(Locale.US, "%s %s %s %d %s -> the face, %d cartons%n",
                        row.receiptId(), row.skuId(), row.skuName(), row.units(), row.uom(), row.cartons()));
            } else {
                out.append(String.format(Locale.US, "%s %s %s %d %s -> %s, %d cartons, %.1f m%n",
                        row.receiptId(), row.skuId(), row.skuName(), row.units(), row.uom(),
                        row.slotId(), row.cartons(), row.putawayMeters()));
            }
        }
        for (PutawayReport.RefusalRow refusal : outcome.refusals()) {
            out.append("refused ").append(refusal.receiptId()).append(": ").append(refusal.reason()).append('\n');
        }
    }

    private static void comparison(StringBuilder out, PutawayReport report) {
        List<PutawayReport.Outcome> outcomes = report.outcomes();
        if (outcomes.size() < 2) {
            return;
        }
        PutawayReport.Totals velocity = report.outcome("velocity").totals();
        PutawayReport.Totals affinity = report.outcome("affinity").totals();
        PutawayReport.Totals random = report.outcome("random").totals();
        double saving = random.putawayMeters() - velocity.putawayMeters();
        double percent = random.putawayMeters() > 0 ? 100 * saving / random.putawayMeters() : 0;
        out.append('\n');
        out.append(String.format(Locale.US,
                "directed against the fork: walk %.1f m against %.1f m - %.1f m less (%.1f%%); "
                        + "golden-band share %.2f against %.2f%n",
                velocity.putawayMeters(), random.putawayMeters(), saving, percent,
                velocity.goldenShare(), random.goldenShare()));
        out.append(String.format(Locale.US,
                "affinity against velocity: %+.1f m to walk its partners together; "
                        + "golden-band share %.2f against %.2f%n",
                affinity.putawayMeters() - velocity.putawayMeters(),
                affinity.goldenShare(), velocity.goldenShare()));
    }
}
