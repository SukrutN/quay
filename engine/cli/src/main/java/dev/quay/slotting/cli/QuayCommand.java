package dev.quay.slotting.cli;

import dev.quay.slotting.FaceRejection;
import dev.quay.slotting.Migration;
import dev.quay.slotting.PickFace;
import dev.quay.slotting.PutawayRejection;
import dev.quay.slotting.Slotter;
import dev.quay.slotting.app.FaceJson;
import dev.quay.slotting.app.FixtureLibrary;
import dev.quay.slotting.app.MigrationReading;
import dev.quay.slotting.app.PutawayLibrary;
import dev.quay.slotting.app.PutawayReading;
import dev.quay.slotting.app.PutawayReport;
import dev.quay.slotting.app.Reading;
import dev.quay.slotting.app.RunPutaway;
import dev.quay.slotting.app.SlotFace;
import java.io.PrintStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** `quay place <face.json>` and `quay putaway <day.json>` print the plans a planner can check;
 * `quay putaway <day.json> --json` prints the reading a machine can store;
 * `quay migrate <face.json>` prints the staged move plan from the document's
 * current layout to the engine's own proposal. */
public final class QuayCommand {

    private QuayCommand() {}

    public static void main(String[] args) {
        System.exit(run(args, System.out, System.err));
    }

    public static int run(String[] args, PrintStream out, PrintStream err) {
        if (args.length == 1 && ("--help".equals(args[0]) || "-h".equals(args[0]) || "help".equals(args[0]))) {
            usage(out);
            return 0;
        }
        if (args.length == 2 && "place".equals(args[0])) {
            return place(args[1], out, err);
        }
        if (args.length == 2 && "putaway".equals(args[0])) {
            return putaway(args[1], out, err, false);
        }
        if (args.length == 3 && "putaway".equals(args[0]) && "--json".equals(args[2])) {
            return putaway(args[1], out, err, true);
        }
        if (args.length == 2 && "migrate".equals(args[0])) {
            return migrate(args[1], out, err);
        }
        usage(err);
        return 2;
    }

    private static int place(String arg, PrintStream out, PrintStream err) {
        try {
            out.print(Reading.text(new SlotFace().place(FixtureLibrary.read(Path.of(arg)))));
            return 0;
        } catch (FaceRejection rejection) {
            err.println(rejection.getMessage());
            return 2;
        } catch (UncheckedIOException exception) {
            err.println(exception.getMessage());
            return 2;
        }
    }

    private static int migrate(String arg, PrintStream out, PrintStream err) {
        Path path = Path.of(arg);
        if (!Files.isRegularFile(path)) {
            err.println("Could not read " + path);
            return 2;
        }
        try {
            PickFace face = FaceJson.read(Files.readString(path));
            var proposal = new Slotter().slot(face);
            Map<String, String> target = new LinkedHashMap<>();
            for (var entry : proposal.placement().slotToSku().entrySet()) {
                target.put(entry.getValue(), entry.getKey());
            }
            out.print(MigrationReading.text(face.id(), face.name(), Migration.plan(face, target)));
            return 0;
        } catch (FaceRejection rejection) {
            err.println(rejection.getMessage());
            return 2;
        } catch (java.io.IOException | UncheckedIOException exception) {
            err.println(exception.getMessage());
            return 2;
        }
    }

    private static int putaway(String arg, PrintStream out, PrintStream err, boolean json) {
        Path path = Path.of(arg);
        if (!Files.isRegularFile(path)) {
            err.println("Could not read " + path);
            return 2;
        }
        try {
            PutawayReport report = new RunPutaway().day(PutawayLibrary.read(path));
            out.print(json ? PutawayReading.json(report) : PutawayReading.text(report));
            return 0;
        } catch (PutawayRejection rejection) {
            err.println(rejection.getMessage());
            return 2;
        } catch (UncheckedIOException exception) {
            err.println(exception.getMessage());
            return 2;
        }
    }

    private static void usage(PrintStream stream) {
        stream.println("usage: quay place <face.json> | quay putaway <day.json> [--json] | quay migrate <face.json>");
    }
}
