package dev.quay.slotting.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.quay.slotting.app.FixtureLibrary;
import dev.quay.slotting.app.PutawayLibrary;
import io.javalin.Javalin;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class QuayServerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newHttpClient();
    private Javalin app;
    private String base;

    @BeforeEach
    void start() {
        app = QuayServer.create(FixtureLibrary.fromClasspath());
        app.start(0);
        base = "http://127.0.0.1:" + app.port();
    }

    @AfterEach
    void stop() {
        app.stop();
    }

    @Test
    void healthAndOpenApi() throws Exception {
        HttpResponse<String> health = send("GET", "/health", null);
        assertEquals(200, health.statusCode());
        assertEquals("up", mapper.readTree(health.body()).get("status").asText());
        HttpResponse<String> spec = send("GET", "/v1/openapi.yaml", null);
        assertEquals(200, spec.statusCode());
        assertTrue(spec.body().contains("/v1/slotting"));
        assertTrue(spec.body().contains("/v1/putaway"));
    }

    @Test
    void laneFixtureReturnsTheChillSlotAndALowerWalk() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/slotting", "{\"fixture\":\"lane\"}");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("lane", body.get("faceId").asText());
        JsonNode yogurt = row(body.get("proposal").get("assignment"), "LN-02");
        assertEquals("B-01-L2", yogurt.get("slotId").asText());
        assertEquals("chill", yogurt.get("zone").asText());
        assertTrue(body.get("comparison").get("travelReduction").asDouble() > 0);
    }

    @Test
    void unknownFixtureIsAProblemAndNotALayout() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/slotting", "{\"fixture\":\"no-such-face\"}");
        assertEquals(400, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElse("").contains("application/problem+json"));
        JsonNode body = mapper.readTree(response.body());
        assertEquals("Unknown fixture", body.get("title").asText());
        assertTrue(body.get("detail").asText().contains("no-such-face"));
        assertFalse(body.has("assignment"));
        assertFalse(body.has("proposal"));
    }

    @Test
    void impossibleInlineFaceIsRejected() throws Exception {
        String body = """
                {"face":{"id":"bad","name":"Bad","slots":[
                  {"id":"only","aisle":"A","aisleIndex":0,"bay":1,"bayIndex":0,"level":1,"cubeLiters":10,"returnMeters":4,"ergonomics":"floor"}
                ],"skus":[
                  {"id":"huge","name":"Bolt of cloth","picksPerDay":3,"cubeLiters":900,"weightKg":2}
                ],"policy":{"travelWeight":1,"wasteWeight":1,"affinityWeight":0,"goldenWeight":0,"lightFloorWeight":0,
                "slowPickCutoff":10,"lightKg":1,"heavyKg":12,"maxLevelForHeavy":1,"ergoGolden":1,"ergoFloor":1,"ergoBeam":1.2,
                "affinityDecayBays":2,"maxPasses":1}}}
                """;
        HttpResponse<String> response = send("POST", "/v1/slotting", body);
        assertEquals(400, response.statusCode());
        JsonNode problem = mapper.readTree(response.body());
        assertEquals(400, problem.get("status").asInt());
        assertTrue(problem.get("detail").asText().contains("Bolt of cloth"));
        assertFalse(problem.has("proposal"));
    }

    @Test
    void putawayFixtureRunsAllThreePolicies() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/putaway", "{\"fixture\":\"putaway-day\"}");
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("putaway-day", body.get("dayId").asText());
        JsonNode outcomes = body.get("outcomes");
        assertEquals(3, outcomes.size());
        JsonNode velocity = outcomes.get(0);
        assertEquals("velocity", velocity.get("policy").asText());
        assertEquals(0, velocity.get("totals").get("refused").asInt());
        assertEquals(226, velocity.get("totals").get("cartons").asInt());
        assertTrue(velocity.get("totals").get("putawayMeters").asDouble() < outcomes.get(2).get("totals").get("putawayMeters").asDouble());
    }

    @Test
    void unknownPutawayFixtureIsAProblem() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/putaway", "{\"fixture\":\"no-such-day\"}");
        assertEquals(400, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElse("").contains("application/problem+json"));
        JsonNode body = mapper.readTree(response.body());
        assertEquals("urn:quay:putaway:unknown-day", body.get("type").asText());
        assertEquals("Unknown putaway day", body.get("title").asText());
        assertFalse(body.has("outcomes"));
    }

    @Test
    void anInlinePutawayDayThatCannotRunIsRejected() throws Exception {
        HttpResponse<String> response = send("POST", "/v1/putaway", "{\"day\":{\"id\":\"bad\",\"name\":\"Bad\"}}");
        assertEquals(400, response.statusCode());
        JsonNode problem = mapper.readTree(response.body());
        assertEquals("urn:quay:putaway:invalid-day", problem.get("type").asText());
        assertEquals("Invalid putaway day", problem.get("title").asText());
        assertTrue(problem.get("reasons").size() > 0);
        assertFalse(problem.has("outcomes"));
    }

    @Test
    void workbenchIsServedAtTheRoot() throws Exception {
        HttpResponse<String> page = send("GET", "/", null);
        assertEquals(200, page.statusCode());
        assertTrue(page.headers().firstValue("content-type").orElse("").contains("text/html"));
        assertTrue(page.body().contains("engine workbench"));
        assertTrue(page.body().contains("/v1/slotting"));
    }

    @Test
    void metricsAreServedInPrometheusText() throws Exception {
        send("GET", "/health", null);
        HttpResponse<String> metrics = send("GET", "/metrics", null);
        assertEquals(200, metrics.statusCode());
        assertTrue(metrics.headers().firstValue("content-type").orElse("").contains("text/plain"));
        String body = metrics.body();
        assertTrue(body.contains("# TYPE quay_http_requests_total counter"));
        assertTrue(body.contains("quay_http_requests_total{"));
        assertTrue(body.contains("# TYPE quay_http_request_latency_ms histogram"));
        assertTrue(body.contains("quay_uptime_seconds"));
    }

    @Test
    void readinessReportsThePublishedFixtures() throws Exception {
        HttpResponse<String> response = send("GET", "/ready", null);
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertEquals("ready", body.get("status").asText());
        assertTrue(body.get("faces").asInt() > 0);
        assertTrue(body.get("days").asInt() > 0);
    }

    @Test
    void aTokenLocksTheApiAndKeepsThePublicRoutesOpen() throws Exception {
        Javalin tokened = QuayServer.create(FixtureLibrary.fromClasspath(), PutawayLibrary.fromClasspath(),
                new OpsShell.Options("sesame", 600, 1024 * 1024));
        tokened.start(0);
        String tokenedBase = "http://127.0.0.1:" + tokened.port();
        try {
            HttpResponse<String> refused = send(tokenedBase, "GET", "/v1/fixtures", null);
            assertEquals(401, refused.statusCode());
            assertTrue(refused.headers().firstValue("content-type").orElse("").contains("application/problem+json"));
            assertTrue(mapper.readTree(refused.body()).get("title").asText().contains("token"));

            HttpRequest allowed = HttpRequest.newBuilder(URI.create(tokenedBase + "/v1/fixtures"))
                    .header("authorization", "Bearer sesame").GET().build();
            assertEquals(200, client.send(allowed, HttpResponse.BodyHandlers.ofString()).statusCode());

            for (String open : List.of("/health", "/ready", "/metrics", "/")) {
                HttpResponse<String> page = send(tokenedBase, "GET", open, null);
                assertEquals(200, page.statusCode(), open + " should stay open for probes and the workbench page");
            }
        } finally {
            tokened.stop();
        }
    }

    @Test
    void theRateLimitRefusesWithRetryAfter() throws Exception {
        Javalin limited = QuayServer.create(FixtureLibrary.fromClasspath(), PutawayLibrary.fromClasspath(),
                new OpsShell.Options("sesame", 3, 1024 * 1024));
        limited.start(0);
        String limitedBase = "http://127.0.0.1:" + limited.port();
        try {
            for (int i = 0; i < 3; i++) {
                HttpRequest request = HttpRequest.newBuilder(URI.create(limitedBase + "/v1/fixtures"))
                        .header("authorization", "Bearer sesame").GET().build();
                assertEquals(200, client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
            }
            HttpRequest fourth = HttpRequest.newBuilder(URI.create(limitedBase + "/v1/fixtures"))
                    .header("authorization", "Bearer sesame").GET().build();
            HttpResponse<String> refused = client.send(fourth, HttpResponse.BodyHandlers.ofString());
            assertEquals(429, refused.statusCode());
            assertTrue(Integer.parseInt(refused.headers().firstValue("Retry-After").orElse("0")) > 0);
            assertEquals("Too many requests", mapper.readTree(refused.body()).get("title").asText());
        } finally {
            limited.stop();
        }
    }

    @Test
    void anOversizeBodyIsRefusedBeforeItIsRead() throws Exception {
        Javalin capped = QuayServer.create(FixtureLibrary.fromClasspath(), PutawayLibrary.fromClasspath(),
                new OpsShell.Options(null, 600, 512));
        capped.start(0);
        String cappedBase = "http://127.0.0.1:" + capped.port();
        try {
            HttpResponse<String> response = send(cappedBase, "POST", "/v1/slotting", "x".repeat(2048));
            assertEquals(413, response.statusCode());
            assertEquals("The request body is too large",
                    mapper.readTree(response.body()).get("title").asText());
        } finally {
            capped.stop();
        }
    }

    @Test
    void fixturesEndpointListsThePublishedFacesAndDays() throws Exception {
        HttpResponse<String> response = send("GET", "/v1/fixtures", null);
        assertEquals(200, response.statusCode());
        JsonNode body = mapper.readTree(response.body());
        assertTrue(contains(body.get("faces"), "lane"));
        assertTrue(contains(body.get("faces"), "forward-pick"));
        assertTrue(contains(body.get("days"), "putaway-day"));
    }

    private static JsonNode row(JsonNode assignment, String skuId) {
        for (JsonNode row : assignment) {
            if (skuId.equals(row.get("skuId").asText())) {
                return row;
            }
        }
        throw new AssertionError(skuId);
    }

    private static boolean contains(JsonNode array, String value) {
        for (JsonNode item : array) {
            if (value.equals(item.asText())) {
                return true;
            }
        }
        return false;
    }

    private HttpResponse<String> send(String method, String path, String body) throws Exception {
        return send(base, method, path, body);
    }

    private HttpResponse<String> send(String base, String method, String path, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(base + path));
        if ("POST".equals(method)) {
            builder.header("content-type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        } else {
            builder.GET();
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
}
