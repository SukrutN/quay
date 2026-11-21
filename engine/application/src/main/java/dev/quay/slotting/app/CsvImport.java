package dev.quay.slotting.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.quay.slotting.FaceRejection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads a SKU master as CSV and splices it into a face or putaway-day
 * document. The CSV is the data a WMS export actually carries (ids, names,
 * velocity, cube, weight); the rack and the policy stay with the document,
 * because the importer never invents structure.
 *
 * Everything the splice changes is reported: accepted rows, rejected rows
 * with reasons, and every dangling reference the new master orphans
 * (affinities, uoms, receipts, on-hand, start states, assignments), pruned
 * one by one with the count carried in the report. The resulting document
 * is re-read through the same readers the engine uses, so what leaves this
 * class is what the engine accepts, or the refusal says why not.
 */
public final class CsvImport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** One rejected CSV row, with the physical line and the reasons. */
    public record RowRejection(int line, String sku, List<String> reasons) {}

    /**
     * The whole import's paper trail: row counts, row rejections, what the
     * splice pruned, and the notes worth reading before running the engine.
     */
    public record Report(
            int rowsRead,
            int rowsAccepted,
            int rowsRejected,
            List<RowRejection> rejections,
            Map<String, Integer> pruned,
            List<String> notes) {

        public Map<String, Object> toJson() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("rowsRead", rowsRead);
            out.put("rowsAccepted", rowsAccepted);
            out.put("rowsRejected", rowsRejected);
            out.put("rejections", rejections);
            out.put("pruned", pruned);
            out.put("notes", notes);
            return out;
        }
    }

    /** The import's result: the new document and the report that produced it. */
    public record Outcome(JsonNode document, Report report) {}

    private static final Set<String> REQUIRED = Set.of("id", "name", "picksPerDay", "cubeLiters", "weightKg");
    private static final Set<String> OPTIONAL = Set.of("zone", "case");

    private CsvImport() {}

    /**
     * Replaces the document's SKU master with the CSV's rows.
     *
     * @param document the face or day document, as read from a fixture or
     *                 sent inline
     * @param kind     "face" or "day", which decides whether the case
     *                 column is meaningful
     * @param csv      the raw CSV text, header row first
     */
    public static Outcome skus(JsonNode document, String kind, String csv) {
        List<String> fileProblems = new ArrayList<>();
        ParsedCsv parsed = parseCsv(csv, fileProblems);
        if (!fileProblems.isEmpty()) {
            throw new FaceRejection(fileProblems);
        }

        // Map header names to column indexes; strict, because a typo'd
        // column would silently drop a constraint.
        Map<String, Integer> columns = new LinkedHashMap<>();
        String[] header = parsed.rows().getFirst();
        for (int i = 0; i < header.length; i++) {
            String name = header[i].trim();
            if (!REQUIRED.contains(name) && !OPTIONAL.contains(name)) {
                fileProblems.add("The CSV header has an unknown column: " + name + ".");
            } else if (columns.containsKey(name)) {
                fileProblems.add("The CSV header lists " + name + " twice.");
            } else {
                columns.put(name, i);
            }
        }
        for (String need : REQUIRED) {
            if (!columns.containsKey(need)) {
                fileProblems.add("The CSV header is missing the " + need + " column.");
            }
        }
        if (columns.containsKey("case") && "face".equals(kind)) {
            fileProblems.add("The case column applies to putaway days only; a face has no case unit.");
        }
        if (!fileProblems.isEmpty()) {
            throw new FaceRejection(fileProblems);
        }

        List<RowRejection> rejections = new ArrayList<>();
        ArrayNode skus = MAPPER.createArrayNode();
        ObjectNode uoms = MAPPER.createObjectNode();
        Set<String> ids = new LinkedHashSet<>();
        Map<String, Integer> caseById = new LinkedHashMap<>();
        for (int r = 1; r < parsed.rows().size(); r++) {
            String[] row = parsed.rows().get(r);
            int line = parsed.lines().get(r);
            String id = column(row, columns, "id").trim();
            List<String> reasons = new ArrayList<>();

            String name = column(row, columns, "name").trim();
            if (name.isEmpty()) {
                reasons.add("name is empty.");
            }
            if (id.isEmpty()) {
                reasons.add("id is empty.");
            } else if (ids.contains(id)) {
                reasons.add(id + " is listed twice in this file.");
            }
            double picks = number(column(row, columns, "picksPerDay"), "picksPerDay", reasons);
            if (picks < 0) {
                reasons.add("picksPerDay cannot be negative.");
            }
            double cube = number(column(row, columns, "cubeLiters"), "cubeLiters", reasons);
            if (cube <= 0 && Double.isFinite(cube)) {
                reasons.add("cubeLiters must be greater than zero.");
            }
            double weight = number(column(row, columns, "weightKg"), "weightKg", reasons);
            if (weight < 0) {
                reasons.add("weightKg cannot be negative.");
            }
            String zone = column(row, columns, "zone").trim();
            if (columns.containsKey("zone") && zone.isEmpty()) {
                reasons.add("zone is present in the header but empty for this row; omit the column or name one.");
            }
            String caseValue = column(row, columns, "case").trim();
            int caseCount = -1;
            if (!caseValue.isEmpty()) {
                try {
                    caseCount = Integer.parseInt(caseValue);
                    if (caseCount < 1) {
                        reasons.add("case must be a whole number of one or more.");
                    }
                } catch (NumberFormatException exception) {
                    reasons.add("case must be a whole number of one or more.");
                }
            }

            if (!reasons.isEmpty()) {
                rejections.add(new RowRejection(line, id, reasons));
                continue;
            }
            ids.add(id);
            if (caseCount > 0) {
                caseById.put(id, caseCount);
            }
            ObjectNode sku = skus.addObject();
            sku.put("id", id);
            sku.put("name", name);
            sku.put("picksPerDay", picks);
            sku.put("cubeLiters", cube);
            sku.put("weightKg", weight);
            if (!zone.isEmpty()) {
                sku.put("zone", zone);
            }
        }

        if (skus.isEmpty()) {
            fileProblems.add("The CSV carried no usable SKU rows.");
            throw new FaceRejection(fileProblems);
        }

        // ---- the splice: new master in, orphaned references out ----
        ObjectNode next = (ObjectNode) document.deepCopy();
        List<String> notes = new ArrayList<>();
        Map<String, Integer> pruned = new LinkedHashMap<>();
        next.set("skus", skus);

        if (next.has("affinities") && next.get("affinities").isArray()) {
            ArrayNode kept = MAPPER.createArrayNode();
            for (JsonNode link : next.get("affinities")) {
                if (ids.contains(link.path("skuA").asText()) && ids.contains(link.path("skuB").asText())) {
                    kept.add(link);
                }
            }
            int dropped = next.get("affinities").size() - kept.size();
            if (dropped > 0) {
                pruned.put("affinities", dropped);
            }
            next.set("affinities", kept);
        }

        if ("day".equals(kind)) {
            ObjectNode kept = MAPPER.createObjectNode();
            if (next.has("uoms") && next.get("uoms").isObject()) {
                next.get("uoms").fields().forEachRemaining(entry -> {
                    if (ids.contains(entry.getKey())) {
                        kept.set(entry.getKey(), entry.getValue());
                    }
                });
                int dropped = next.get("uoms").size() - kept.size();
                if (dropped > 0) {
                    pruned.put("uoms", dropped);
                }
            }
            if (!caseById.isEmpty()) {
                caseById.forEach((id, count) -> kept.putObject(id).put("case", count));
            }
            if (!kept.isEmpty() || next.has("uoms")) {
                next.set("uoms", kept);
            }
            pruned.putAll(pruneArrayByField(next, "receipts", "skuId", ids));
            if (next.has("forward") && next.get("forward").isObject()) {
                ObjectNode forward = (ObjectNode) next.get("forward");
                pruned.putAll(pruneObjectKeys(forward, "onHand", ids));
                pruned.putAll(pruneArrayByField(forward, "openings", "skuId", ids));
            }
            pruned.putAll(pruneStartState(next, ids));
        } else {
            // current maps slot -> sku; locked maps sku -> slot.
            if (next.has("current") && next.get("current").isObject()) {
                boolean sameSet = true;
                Set<String> currentSkus = new LinkedHashSet<>();
                next.get("current").fields().forEachRemaining(entry -> currentSkus.add(entry.getValue().asText()));
                if (!currentSkus.equals(ids)) {
                    sameSet = false;
                }
                if (sameSet) {
                    notes.add("The current assignments cover the imported master unchanged.");
                } else {
                    next.remove("current");
                    notes.add("The current assignments were dropped: the imported master changed the SKU set, "
                            + "and a partial assignment is not an assignment.");
                }
            }
            if (next.has("locked") && next.get("locked").isObject()) {
                pruned.putAll(pruneObjectKeys(next, "locked", ids));
            }
        }

        Report report = new Report(
                parsed.rows().size() - 1,
                skus.size(),
                rejections.size(),
                rejections,
                pruned,
                notes);
        return new Outcome(next, report);
    }

    private static Map<String, Integer> pruneArrayByField(ObjectNode document, String arrayName, String field, Set<String> ids) {
        if (!document.has(arrayName) || !document.get(arrayName).isArray()) {
            return Map.of();
        }
        ArrayNode kept = MAPPER.createArrayNode();
        for (JsonNode row : document.get(arrayName)) {
            if (ids.contains(row.path(field).asText())) {
                kept.add(row);
            }
        }
        int dropped = document.get(arrayName).size() - kept.size();
        document.set(arrayName, kept);
        return dropped > 0 ? Map.of(arrayName, dropped) : Map.of();
    }

    private static Map<String, Integer> pruneObjectKeys(ObjectNode parent, String name, Set<String> ids) {
        if (!parent.has(name) || !parent.get(name).isObject()) {
            return Map.of();
        }
        ObjectNode kept = MAPPER.createObjectNode();
        parent.get(name).fields().forEachRemaining(entry -> {
            if (ids.contains(entry.getKey())) {
                kept.set(entry.getKey(), entry.getValue());
            }
        });
        int dropped = parent.get(name).size() - kept.size();
        parent.set(name, kept);
        return dropped > 0 ? Map.of(name, dropped) : Map.of();
    }

    private static Map<String, Integer> pruneStartState(ObjectNode document, Set<String> ids) {
        if (!document.has("startState") || !document.get("startState").isObject()) {
            return Map.of();
        }
        ObjectNode kept = MAPPER.createObjectNode();
        document.get("startState").fields().forEachRemaining(entry -> {
            if (ids.contains(entry.getValue().path("skuId").asText())) {
                kept.set(entry.getKey(), entry.getValue());
            }
        });
        int dropped = document.get("startState").size() - kept.size();
        document.set("startState", kept);
        return dropped > 0 ? Map.of("startState", dropped) : Map.of();
    }

    private static String column(String[] row, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        if (index == null || index >= row.length) {
            return "";
        }
        return row[index];
    }

    private static double number(String raw, String field, List<String> reasons) {
        try {
            double value = Double.parseDouble(raw.trim());
            if (!Double.isFinite(value)) {
                reasons.add(field + " is not a usable number.");
                return Double.NaN;
            }
            return value;
        } catch (NumberFormatException exception) {
            reasons.add(field + " is not a usable number: " + (raw.isBlank() ? "the column is empty." : "\"" + raw.trim() + "\"."));
            return Double.NaN;
        }
    }

    /** The parsed CSV: rows of cells, with the physical line each row began on. */
    private record ParsedCsv(List<String[]> rows, List<Integer> lines) {}

    /**
     * A small honest CSV reader: quoted fields, doubled quotes inside them,
     * either line ending, blank lines skipped. Line numbers are physical.
     */
    private static ParsedCsv parseCsv(String csv, List<String> problems) {
        List<String[]> rows = new ArrayList<>();
        List<Integer> lines = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        int line = 1;
        boolean inQuotes = false;
        boolean quotedCell = false;
        boolean rowStarted = false;

        for (int i = 0; i <= csv.length(); i++) {
            char c = i < csv.length() ? csv.charAt(i) : '\n';
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < csv.length() && csv.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cell.append(c);
                    if (c == '\n') {
                        line++;
                    }
                }
                continue;
            }
            switch (c) {
                case '"' -> {
                    if (cell.isEmpty() && !quotedCell) {
                        inQuotes = true;
                        quotedCell = true;
                    } else {
                        cell.append(c);
                    }
                }
                case ',' -> {
                    cells.add(cell.toString());
                    cell.setLength(0);
                    quotedCell = false;
                    rowStarted = true;
                }
                case '\r' -> {
                    // wait for the newline; a lone carriage return is still a line end
                    if (i + 1 < csv.length() && csv.charAt(i + 1) == '\n') {
                        continue;
                    }
                    finishRow(rows, lines, cells, cell, line);
                    line++;
                }
                case '\n' -> {
                    finishRow(rows, lines, cells, cell, line);
                    line++;
                }
                default -> {
                    cell.append(c);
                    rowStarted = true;
                }
            }
        }
        if (inQuotes) {
            problems.add("The CSV ends inside an unterminated quoted field.");
        }
        return new ParsedCsv(rows, lines);
    }

    private static void finishRow(List<String[]> rows, List<Integer> lines, List<String> cells,
                                  StringBuilder cell, int line) {
        boolean blank = cell.isEmpty() && cells.stream().allMatch(String::isEmpty);
        cells.add(cell.toString());
        cell.setLength(0);
        if (!blank) {
            rows.add(cells.toArray(new String[0]));
            lines.add(line);
        }
        cells.clear();
    }
}
