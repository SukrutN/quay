package dev.quay.slotting.app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import dev.quay.slotting.FaceRejection;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The SKU-master importer, tested the way an operator meets it: a CSV that
 * mostly works, rows that do not, and a document whose references dangle
 * once the master changes.
 */
class CsvImportTest {

    private static JsonNode fixture(String name) throws Exception {
        try (InputStream input = CsvImportTest.class.getClassLoader()
                .getResourceAsStream("fixtures/" + name + ".json")) {
            assertNotNull(input, name + " should be on the classpath");
            return new com.fasterxml.jackson.databind.ObjectMapper().readTree(input);
        }
    }

    @Test
    void aCleanCsvSplicesAndPrunesTheFace() throws Exception {
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg
                MG-01,Blue tin coffee,240,4.2,1.6
                MG-02,Paper sleeve filters,188,1.4,0.3
                MG-05,Fennel salt tins,128,3.1,2.8
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);

        assertEquals(3, outcome.document().get("skus").size());
        assertEquals("MG-01", outcome.document().get("skus").get(0).get("id").asText());
        CsvImport.Report report = outcome.report();
        assertEquals(3, report.rowsRead());
        assertEquals(3, report.rowsAccepted());
        assertEquals(0, report.rowsRejected());
        // the fixture's affinities reach well beyond these three SKUs
        assertTrue(report.pruned().get("affinities") > 0);
        // and what the splice kept must be what the engine accepts
        assertNotNull(FaceJson.parse(outcome.document()));
    }

    @Test
    void theLaneFixtureNarratesTheDroppedAssignments() throws Exception {
        // the lane face carries current and locked assignments; importing a
        // master that changes the SKU set drops current (a partial assignment
        // is not an assignment) and prunes locked.
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg,zone
                LN-01,Oat milk,50,8,4,ambient
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("lane"), "face", csv);

        CsvImport.Report report = outcome.report();
        assertTrue(report.notes().stream().anyMatch(note -> note.contains("current assignments were dropped")),
                "the dropped assignment should be narrated: " + report.notes());
        assertTrue(report.pruned().get("locked") > 0);
        assertTrue(outcome.document().get("locked").isEmpty());
        assertFalse(outcome.document().has("current"));
        assertNotNull(FaceJson.parse(outcome.document()));
    }

    @Test
    void theSameMasterKeepsTheAssignments() throws Exception {
        // rebuild the lane face's own master as CSV, zone column included,
        // and import it back: nothing should dangle, nothing should drop
        JsonNode lane = fixture("lane");
        StringBuilder csv = new StringBuilder("id,name,picksPerDay,cubeLiters,weightKg,zone\n");
        for (JsonNode sku : lane.get("skus")) {
            csv.append(sku.get("id").asText()).append(',')
                    .append(sku.get("name").asText()).append(',')
                    .append(sku.get("picksPerDay").asDouble()).append(',')
                    .append(sku.get("cubeLiters").asDouble()).append(',')
                    .append(sku.get("weightKg").asDouble()).append(',')
                    .append(sku.get("zone").asText()).append('\n');
        }

        CsvImport.Outcome outcome = CsvImport.skus(lane, "face", csv.toString());

        assertEquals(4, outcome.report().rowsAccepted());
        assertTrue(outcome.report().notes().stream()
                .anyMatch(note -> note.contains("cover the imported master unchanged")));
        assertTrue(outcome.document().has("current"));
        assertEquals(1, outcome.document().get("locked").size(), "the lane's single locked entry survives untouched");
        assertFalse(outcome.report().pruned().containsKey("locked"), "nothing should dangle when the master is unchanged");
        assertNotNull(FaceJson.parse(outcome.document()));
    }

    @Test
    void badRowsAreRejectedWithLineNumbersAndReasons() throws Exception {
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg
                MG-01,Blue tin coffee,240,4.2,1.6
                MG-02,,188,1.4,0.3
                MG-03,Matchbox cloves,-5,0.9,0.2
                MG-04,Rye cracker crates,142,eighteen,6.4
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);

        CsvImport.Report report = outcome.report();
        assertEquals(4, report.rowsRead());
        assertEquals(1, report.rowsAccepted());
        assertEquals(3, report.rowsRejected());
        List<CsvImport.RowRejection> rejections = report.rejections();
        assertEquals(3, rejections.get(0).line(), "the empty name is on physical line 3");
        assertTrue(rejections.get(0).reasons().contains("name is empty."));
        assertEquals(4, rejections.get(1).line());
        assertTrue(rejections.get(1).reasons().contains("picksPerDay cannot be negative."));
        assertEquals(5, rejections.get(2).line());
        assertTrue(rejections.get(2).reasons().get(0).contains("cubeLiters is not a usable number"));
        assertNotNull(FaceJson.parse(outcome.document()));
    }

    @Test
    void duplicateIdsWithinTheFileAreRejected() throws Exception {
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg
                MG-01,Blue tin coffee,240,4.2,1.6
                MG-01,Blue tin coffee again,240,4.2,1.6
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);

        assertEquals(1, outcome.report().rowsAccepted());
        assertTrue(outcome.report().rejections().get(0).reasons().contains("MG-01 is listed twice in this file."));
    }

    @Test
    void quotedFieldsCarryCommasAndTheColumnOrderDoesNotMatter() throws Exception {
        String csv = """
                weightKg,id,name,picksPerDay,cubeLiters
                1.6,MG-01,"Coffee, blue tin, 250 g",240,4.2
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);

        assertEquals(1, outcome.report().rowsAccepted());
        JsonNode sku = outcome.document().get("skus").get(0);
        assertEquals("Coffee, blue tin, 250 g", sku.get("name").asText());
    }

    @Test
    void anUnknownHeaderColumnRefusesTheWholeFile() throws Exception {
        FaceRejection rejection = org.junit.jupiter.api.Assertions.assertThrows(
                FaceRejection.class,
                () -> CsvImport.skus(fixture("forward-pick"), "face",
                        "id,name,picksPerDay,cubeLiters,weightKg,colour\nMG-01,Blue,240,4.2,1.6,blue"));
        assertTrue(rejection.reasons().get(0).contains("unknown column: colour"));
    }

    @Test
    void aMissingHeaderColumnRefusesTheWholeFile() throws Exception {
        FaceRejection rejection = org.junit.jupiter.api.Assertions.assertThrows(
                FaceRejection.class,
                () -> CsvImport.skus(fixture("forward-pick"), "face", "id,name,picksPerDay\nMG-01,Blue,240"));
        assertTrue(rejection.reasons().stream().anyMatch(reason -> reason.contains("missing the cubeLiters column")));
    }

    @Test
    void theCaseColumnIsRefusedOnAFace() throws Exception {
        FaceRejection rejection = org.junit.jupiter.api.Assertions.assertThrows(
                FaceRejection.class,
                () -> CsvImport.skus(fixture("forward-pick"), "face",
                        "id,name,picksPerDay,cubeLiters,weightKg,case\nMG-01,Blue,240,4.2,1.6,4"));
        assertTrue(rejection.reasons().stream().anyMatch(reason -> reason.contains("case column applies to putaway days")));
    }

    @Test
    void aDayImportPrunesEveryDanglingReference() throws Exception {
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg,case
                MG-01,Blue tin coffee,240,4.2,1.6,6
                MG-05,Fennel salt tins,128,3.1,2.8,4
                """;

        CsvImport.Outcome outcome = CsvImport.skus(fixture("putaway-day"), "day", csv);

        CsvImport.Report report = outcome.report();
        assertEquals(2, report.rowsAccepted());
        assertEquals(2, outcome.document().get("skus").size());
        assertTrue(report.pruned().get("affinities") > 0);
        assertTrue(report.pruned().get("receipts") > 0);
        assertEquals(2, outcome.document().get("receipts").size(), "the kept receipts reference the two imported SKUs");
        assertTrue(report.pruned().get("onHand") > 0);
        assertTrue(report.pruned().get("startState") > 0);
        // the case column populated the uoms for exactly these two
        assertEquals(6, outcome.document().get("uoms").get("MG-01").get("case").asInt());
        assertEquals(4, outcome.document().get("uoms").get("MG-05").get("case").asInt());
        assertNotNull(PutawayJson.parse(outcome.document()));
    }

    @Test
    void anEmptyCsvRefusesRatherThanEmptyingTheFloor() throws Exception {
        FaceRejection rejection = org.junit.jupiter.api.Assertions.assertThrows(
                FaceRejection.class,
                () -> CsvImport.skus(fixture("forward-pick"), "face", "id,name,picksPerDay,cubeLiters,weightKg\n"));
        assertTrue(rejection.reasons().stream().anyMatch(reason -> reason.contains("no usable SKU rows")));
    }

    @Test
    void anSkuTooBigForAnySlotIsCaughtByTheEngineReader() {
        String csv = """
                id,name,picksPerDay,cubeLiters,weightKg
                MG-01,Blue tin coffee,240,99999,1.6
                """;
        // a cube no slot on the forward face can hold: the splice itself is
        // fine, the proof through the engine's reader is what refuses
        try {
            CsvImport.Outcome outcome;
            outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);
            org.junit.jupiter.api.Assertions.assertThrows(FaceRejection.class,
                    () -> FaceJson.parse(outcome.document()));
        } catch (Exception failure) {
            throw new RuntimeException(failure);
        }
    }

    private static String resource(String name) {
        try (InputStream input = CsvImportTest.class.getClassLoader().getResourceAsStream(name)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception failure) {
            throw new RuntimeException(failure);
        }
    }

    @Test
    void theParserHandlesCRLFAndBlankLines() throws Exception {
        String csv = "id,name,picksPerDay,cubeLiters,weightKg\r\n"
                + "\r\n"
                + "MG-01,Blue tin coffee,240,4.2,1.6\r\n"
                + "\r\n"
                + "MG-02,Paper sleeve filters,188,1.4,0.3\r\n";

        CsvImport.Outcome outcome = CsvImport.skus(fixture("forward-pick"), "face", csv);
        assertEquals(2, outcome.report().rowsAccepted());
        assertFalse(outcome.report().rowsRead() != 2, "blank lines are not data rows");
    }
}
