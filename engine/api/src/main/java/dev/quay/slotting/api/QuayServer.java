package dev.quay.slotting.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.quay.slotting.FaceRejection;
import dev.quay.slotting.Migration;
import dev.quay.slotting.PickFace;
import dev.quay.slotting.PutawayDay;
import dev.quay.slotting.PutawayRejection;
import dev.quay.slotting.app.CsvImport;
import dev.quay.slotting.app.FaceJson;
import dev.quay.slotting.app.FixtureLibrary;
import dev.quay.slotting.app.PutawayJson;
import dev.quay.slotting.app.PutawayLibrary;
import dev.quay.slotting.app.RunPutaway;
import dev.quay.slotting.app.SlotFace;
import dev.quay.slotting.app.UnknownFixture;
import dev.quay.slotting.app.UnknownDay;
import io.javalin.Javalin;
import io.javalin.http.Context;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import net.logstash.logback.marker.Markers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** HTTP adapter. The slotting rules live in the domain, not in these routes. */
public final class QuayServer {

    private static final Logger log = LoggerFactory.getLogger(QuayServer.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> REQUEST_FIELDS = Set.of("fixture", "face");
    private static final Set<String> PUTAWAY_REQUEST_FIELDS = Set.of("fixture", "day");

    private QuayServer() {}

    public static void main(String[] args) {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8091"));
        create(
                FixtureLibrary.fromClasspath(),
                PutawayLibrary.fromClasspath(),
                OpsShell.Options.fromEnv("QUAY")).start("0.0.0.0", port);
    }

    public static Javalin create(FixtureLibrary library) {
        return create(library, PutawayLibrary.fromClasspath());
    }

    public static Javalin create(FixtureLibrary library, PutawayLibrary putawayLibrary) {
        return create(library, putawayLibrary, OpsShell.Options.defaults());
    }

    public static Javalin create(FixtureLibrary library, PutawayLibrary putawayLibrary, OpsShell.Options options) {
        String openApi = loadOpenApi();
        SlotFace slotFace = new SlotFace();
        RunPutaway runPutaway = new RunPutaway();
        OpsShell shell = new OpsShell(options, "quay");
        Javalin app = Javalin.create(config -> {
            config.showJavalinBanner = false;
            // the same cap the gate announces, enforced by the server itself
            // for bodies that lie about their length
            config.http.maxRequestSize = options.maxBodyBytes();
        });
        app.before(ctx -> {
            ctx.attribute("startedNanos", System.nanoTime());
            shell.gate(ctx);
        });
        app.after(shell::observed);
        app.exception(OpsShell.Refusal.class, (exception, ctx) -> {
            if (exception.retryAfterSeconds > 0) {
                ctx.header("Retry-After", String.valueOf(exception.retryAfterSeconds));
            }
            problem(ctx, exception.status, exception.type, exception.title, exception.detail, List.of());
        });
        app.exception(FaceRejection.class, (exception, ctx) -> problem(
                ctx, 400, "urn:quay:slotting:invalid-face", "Invalid face", exception.getMessage(), exception.reasons()));
        app.exception(PutawayRejection.class, (exception, ctx) -> problem(
                ctx, 400, "urn:quay:putaway:invalid-day", "Invalid putaway day", exception.getMessage(),
                exception.reasons()));
        app.exception(UnknownFixture.class, (exception, ctx) -> problem(
                ctx,
                400,
                "urn:quay:slotting:unknown-fixture",
                "Unknown fixture",
                exception.getMessage(),
                List.of()));
        app.exception(UnknownDay.class, (exception, ctx) -> problem(
                ctx,
                400,
                "urn:quay:putaway:unknown-day",
                "Unknown putaway day",
                exception.getMessage(),
                List.of()));
        app.exception(Exception.class, (exception, ctx) -> {
            log.error(Markers.append("path", ctx.path()), "request failed", exception);
            problem(ctx, 500, "urn:quay:slotting:internal", "Internal error", "The face could not be slotted.", List.of());
        });
        app.get("/health", ctx -> ctx.json(Map.of("status", "up")));
        app.get("/ready", ctx -> {
            boolean ready = !library.names().isEmpty() && !putawayLibrary.names().isEmpty();
            ctx.status(ready ? 200 : 503).json(Map.of(
                    "status", ready ? "ready" : "not-ready",
                    "faces", library.names().size(),
                    "days", putawayLibrary.names().size()));
        });
        app.get("/metrics", ctx -> ctx
                .contentType("text/plain; version=0.0.4; charset=utf-8")
                .result(shell.render()));
        app.get("/v1/openapi.yaml", ctx -> ctx.contentType("application/yaml").result(openApi));
        app.get("/v1/fixtures", ctx -> ctx.json(Map.of(
                "faces", library.names(),
                "days", putawayLibrary.names())));
        app.get("/", ctx -> ctx.contentType("text/html").result(loadWorkbench()));
        app.post("/v1/slotting", ctx -> {
            var report = slotFace.place(readRequest(ctx, library));
            shell.slottingRun();
            ctx.json(report);
        });
        app.post("/v1/putaway", ctx -> {
            var report = runPutaway.day(readPutawayRequest(ctx, library, putawayLibrary));
            shell.putawayRun();
            ctx.json(report);
        });
        app.post("/v1/import/skus", ctx -> {
            JsonNode body = readBody(ctx, Set.of("fixture", "face", "day", "csv"));
            if (body.hasNonNull("fixture") && (body.has("face") || body.has("day"))) {
                throw new FaceRejection(List.of("Name a fixture or send a document, not both."));
            }
            String kind;
            JsonNode source;
            if (body.hasNonNull("fixture")) {
                String fixture = body.get("fixture").asText();
                JsonNode face = library.readDocument(fixture);
                JsonNode day = putawayLibrary.readDocument(fixture);
                if (face != null) {
                    kind = "face";
                    source = face;
                } else if (day != null) {
                    kind = "day";
                    source = day;
                } else {
                    throw new UnknownFixture(fixture);
                }
            } else if (body.has("face")) {
                kind = "face";
                source = body.get("face");
            } else if (body.has("day")) {
                kind = "day";
                source = body.get("day");
            } else {
                throw new FaceRejection(List.of("Name a fixture or send a face or a day document."));
            }
            if (!body.hasNonNull("csv") || !body.get("csv").isTextual() || body.get("csv").asText().isBlank()) {
                throw new FaceRejection(List.of("Send the SKU master as a csv string."));
            }
            CsvImport.Outcome outcome = CsvImport.skus(source, kind, body.get("csv").asText());
            // Prove the spliced document through the engine's own readers,
            // so the importer cannot hand back something the run refuses.
            if ("face".equals(kind)) {
                FaceJson.parse(outcome.document());
                ctx.json(Map.of("kind", kind, "report", outcome.report().toJson(), "face", outcome.document()));
            } else {
                PutawayJson.parse(outcome.document());
                ctx.json(Map.of("kind", kind, "report", outcome.report().toJson(), "day", outcome.document()));
            }
        });
        app.post("/v1/migrate", ctx -> {
            JsonNode body = readBody(ctx, Set.of("fixture", "face", "target"));
            boolean named = body.hasNonNull("fixture");
            boolean inline = body.has("face");
            if (named && inline) {
                throw new FaceRejection(List.of("Name a fixture or send a face document, not both."));
            }
            if (!named && !inline) {
                throw new FaceRejection(List.of("Name a fixture or send a face document."));
            }
            PickFace face;
            if (named) {
                JsonNode fixture = body.get("fixture");
                if (!fixture.isTextual()) {
                    throw new FaceRejection(List.of("fixture must be a string."));
                }
                face = library.get(fixture.asText());
            } else {
                JsonNode document = body.get("face");
                if (!document.isObject()) {
                    throw new FaceRejection(List.of("face must be an object."));
                }
                face = FaceJson.parse(document);
            }
            JsonNode targetNode = body.get("target");
            if (targetNode == null || !targetNode.isObject() || targetNode.isEmpty()) {
                throw new FaceRejection(List.of(
                        "Send the target as an object of skuId to slotId, such as the slotting report's proposal."));
            }
            Map<String, String> target = new LinkedHashMap<>();
            Iterator<Map.Entry<String, JsonNode>> fields = targetNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (!field.getValue().isTextual()) {
                    throw new FaceRejection(List.of(
                            "The target for " + field.getKey() + " must be a slot id string."));
                }
                target.put(field.getKey(), field.getValue().asText());
            }
            Migration.Plan plan = Migration.plan(face, target);
            shell.slottingRun();
            ctx.json(Map.of(
                    "faceId", face.id(),
                    "faceName", face.name(),
                    "moves", plan.moves(),
                    "bufferedMoves", plan.bufferedMoves(),
                    "laborMinutes", plan.laborMinutes(),
                    "steps", plan.steps(),
                    "notes", plan.notes()));
        });
        return app;
    }

    private static JsonNode readBody(Context ctx, Set<String> allowed) {
        if (ctx.body().isBlank()) {
            throw new FaceRejection(List.of("Send a JSON object."));
        }
        JsonNode node;
        try {
            node = MAPPER.readTree(ctx.body());
        } catch (JsonProcessingException exception) {
            throw new FaceRejection(List.of("The request is not valid JSON."));
        }
        if (!node.isObject()) {
            throw new FaceRejection(List.of("The request must be a JSON object."));
        }
        Iterator<String> names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!allowed.contains(name)) {
                throw new FaceRejection(List.of("Request has unknown field " + name + "."));
            }
        }
        return node;
    }

    private static PickFace readRequest(Context ctx, FixtureLibrary library) {
        if (ctx.body().isBlank()) {
            throw new FaceRejection(List.of("Send a fixture name or a face document."));
        }
        JsonNode node;
        try {
            node = MAPPER.readTree(ctx.body());
        } catch (JsonProcessingException exception) {
            throw new FaceRejection(List.of("The request is not valid JSON."));
        }
        if (!node.isObject()) {
            throw new FaceRejection(List.of("The request must be a JSON object."));
        }
        Iterator<String> names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!REQUEST_FIELDS.contains(name)) {
                throw new FaceRejection(List.of("Request has unknown field " + name + "."));
            }
        }
        boolean named = node.hasNonNull("fixture");
        boolean inline = node.has("face");
        if (named && inline) {
            throw new FaceRejection(List.of("Send a fixture name or a face document, not both."));
        }
        if (!named && !inline) {
            throw new FaceRejection(List.of("Send a fixture name or a face document."));
        }
        if (named) {
            JsonNode fixture = node.get("fixture");
            if (!fixture.isTextual()) {
                throw new FaceRejection(List.of("fixture must be a string."));
            }
            return library.get(fixture.asText());
        }
        return FaceJson.parse(node.get("face"));
    }

    private static PutawayDay readPutawayRequest(Context ctx, FixtureLibrary library, PutawayLibrary putawayLibrary) {
        if (ctx.body().isBlank()) {
            throw new PutawayRejection(List.of("Send a fixture name or a putaway day document."));
        }
        JsonNode node;
        try {
            node = MAPPER.readTree(ctx.body());
        } catch (JsonProcessingException exception) {
            throw new PutawayRejection(List.of("The request is not valid JSON."));
        }
        if (!node.isObject()) {
            throw new PutawayRejection(List.of("The request must be a JSON object."));
        }
        Iterator<String> names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!PUTAWAY_REQUEST_FIELDS.contains(name)) {
                throw new PutawayRejection(List.of("Request has unknown field " + name + "."));
            }
        }
        boolean named = node.hasNonNull("fixture");
        boolean inline = node.has("day");
        if (named && inline) {
            throw new PutawayRejection(List.of("Send a fixture name or a putaway day document, not both."));
        }
        if (!named && !inline) {
            throw new PutawayRejection(List.of("Send a fixture name or a putaway day document."));
        }
        if (named) {
            JsonNode fixture = node.get("fixture");
            if (!fixture.isTextual()) {
                throw new PutawayRejection(List.of("fixture must be a string."));
            }
            return putawayLibrary.get(fixture.asText());
        }
        return PutawayJson.parse(node.get("day"));
    }

    private static void problem(Context ctx, int status, String type, String title, String detail, List<String> reasons) {
        ctx.status(status).json(Map.of(
                "type", type,
                "title", title,
                "status", status,
                "detail", detail,
                "instance", ctx.path(),
                "reasons", reasons));
        ctx.contentType("application/problem+json");
    }

    private static String loadOpenApi() {
        try (InputStream input = QuayServer.class.getResourceAsStream("/openapi.yaml")) {
            if (input == null) {
                throw new IllegalStateException("openapi.yaml is missing");
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("openapi.yaml could not be read", exception);
        }
    }

    /** The workbench rides inside the jar, like the OpenAPI document: one binary, one browser tab. */
    private static String loadWorkbench() {
        try (InputStream input = QuayServer.class.getResourceAsStream("/web/index.html")) {
            if (input == null) {
                throw new IllegalStateException("web/index.html is missing");
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("web/index.html could not be read", exception);
        }
    }
}
