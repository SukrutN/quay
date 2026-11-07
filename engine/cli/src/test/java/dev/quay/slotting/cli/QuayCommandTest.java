package dev.quay.slotting.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.junit.jupiter.api.Test;

class QuayCommandTest {

    @Test
    void placePrintsTheLaneReading() throws Exception {
        Path lane = Files.createTempFile("lane", ".json");
        try (InputStream input = QuayCommandTest.class.getResourceAsStream("/fixtures/lane.json")) {
            Files.copy(input, lane, StandardCopyOption.REPLACE_EXISTING);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = QuayCommand.run(
                new String[] {"place", lane.toString()},
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(0, code);
        String text = out.toString(StandardCharsets.UTF_8);
        assertTrue(text.contains("Lane chill corner"));
        assertTrue(text.contains("LN-02"));
        assertTrue(text.contains("B-01-L2"));
        assertTrue(text.contains("Travel is"));
        assertTrue(text.contains("lower"));
        assertEquals("", err.toString(StandardCharsets.UTF_8));
    }

    @Test
    void migratePrintsTheStagedMovePlanForTheLaneProposal() throws Exception {
        Path lane = Files.createTempFile("lane", ".json");
        try (InputStream input = QuayCommandTest.class.getResourceAsStream("/fixtures/lane.json")) {
            Files.copy(input, lane, StandardCopyOption.REPLACE_EXISTING);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = QuayCommand.run(
                new String[] {"migrate", lane.toString()},
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(0, code);
        String text = out.toString(StandardCharsets.UTF_8);
        assertTrue(text.contains("migration for Lane chill corner"));
        assertTrue(text.contains("labor minutes (proxy)"));
        assertTrue(text.contains("LN-"));
        // the locked stockpot never appears as a moving carton
        assertTrue(!text.contains("LN-03 "));
        assertTrue(text.contains("min"));
        assertTrue(text.contains("proxy"));
        assertEquals("", err.toString(StandardCharsets.UTF_8));
    }

    @Test
    void migrateRefusesAFaceWithNoCurrentLayout() throws Exception {
        Path fresh = Files.createTempFile("fresh", ".json");
        Files.writeString(fresh, """
                {
                  "id": "fresh",
                  "name": "Fresh face",
                  "rack": {
                    "aisles": ["A"],
                    "bays": [1, 2],
                    "levels": [1, 2],
                    "goldenLevels": [2],
                    "floorLevel": 1,
                    "wideBays": [],
                    "wideMultiplier": 1.0,
                    "cubeLitersByLevel": {"1": 40, "2": 24},
                    "dockToFirstAisleMeters": 4.0,
                    "aislePitchMeters": 3.6,
                    "mouthToFirstBayMeters": 2.4,
                    "bayPitchMeters": 2.5
                  },
                  "skus": [
                    {"id": "FR-01", "name": "Fresh tin", "picksPerDay": 10, "cubeLiters": 4, "weightKg": 1}
                  ],
                  "policy": {
                    "travelWeight": 1, "wasteWeight": 1, "affinityWeight": 0, "goldenWeight": 0,
                    "lightFloorWeight": 0, "slowPickCutoff": 5, "lightKg": 2, "heavyKg": 12,
                    "maxLevelForHeavy": 1, "ergoGolden": 1, "ergoFloor": 1.1, "ergoBeam": 1.3,
                    "affinityDecayBays": 2, "maxPasses": 2
                  }
                }
                """);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = QuayCommand.run(
                new String[] {"migrate", fresh.toString()},
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(2, code);
        assertTrue(err.toString(StandardCharsets.UTF_8).contains("nothing to migrate from"));
    }

    @Test
    void putawayPrintsTheDayReading() throws Exception {
        Path day = Files.createTempFile("putaway-day", ".json");
        try (InputStream input = QuayCommandTest.class.getResourceAsStream("/fixtures/putaway-day.json")) {
            Files.copy(input, day, StandardCopyOption.REPLACE_EXISTING);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = QuayCommand.run(
                new String[] {"putaway", day.toString()},
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(0, code);
        String text = out.toString(StandardCharsets.UTF_8);
        assertTrue(text.contains("Harbor & Lane day 07 (putaway-day)"));
        assertTrue(text.contains("directed against the fork: walk 531.2 m against 740.0 m - 208.8 m less (28.2%)"));
        assertTrue(text.contains("affinity against velocity: +4.8 m to walk its partners together"));
        assertTrue(text.contains("MG-15 raise at 11 on hand, asks 19 cartons"));
        assertEquals("", err.toString(StandardCharsets.UTF_8));
    }

    @Test
    void putawayPrintsTheMachineReadingUnderJson() throws Exception {
        Path day = Files.createTempFile("putaway-day", ".json");
        try (InputStream input = QuayCommandTest.class.getResourceAsStream("/fixtures/putaway-day.json")) {
            Files.copy(input, day, StandardCopyOption.REPLACE_EXISTING);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int code = QuayCommand.run(
                new String[] {"putaway", day.toString(), "--json"},
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(0, code);
        JsonNode root = new ObjectMapper().readTree(out.toString(StandardCharsets.UTF_8));
        assertEquals("putaway-day", root.get("dayId").asText());
        assertEquals(3, root.get("outcomes").size());
        assertEquals(531.2, putawayMeters(root, "velocity"), 1.0e-9);
        assertEquals(740.0, putawayMeters(root, "random"), 1.0e-9);
        assertEquals("", err.toString(StandardCharsets.UTF_8));
    }

    private static double putawayMeters(JsonNode root, String policy) {
        for (JsonNode node : root.get("outcomes")) {
            if (policy.equals(node.get("policy").asText())) {
                return node.get("totals").get("putawayMeters").asDouble();
            }
        }
        throw new AssertionError("no " + policy + " outcome in the reading");
    }

    @Test
    void missingFileAndBadUsageFail() {
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        int missing = QuayCommand.run(
                new String[] {"place", "missing-face.json"},
                new PrintStream(new ByteArrayOutputStream()),
                new PrintStream(err, true, StandardCharsets.UTF_8));
        assertEquals(2, missing);
        assertTrue(err.toString(StandardCharsets.UTF_8).contains("Could not read"));
        int usage = QuayCommand.run(new String[] {}, new PrintStream(new ByteArrayOutputStream()), new PrintStream(new ByteArrayOutputStream()));
        assertEquals(2, usage);
    }
}
