import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.UUID;

/** Test-only native PostgreSQL setup and committed-row evidence. Never imported by production. */
class BuyerLiveDatabase {
    static final String ORDER = "68220000-0000-4000-8000-000000000301";
    public static void main(String[] args) throws Exception {
        switch (args[0]) {
            case "seed" -> {
                for (String service : new String[]{"catalog", "commerce", "rating"})
                    try (var db = database(service); var statement = db.createStatement()) {
                        statement.execute(Files.readString(Path.of("tests/live-buyer/" + service + ".sql")));
                    }
                System.out.print("{}");
            }
            case "project" -> project();
            case "evidence" -> evidence();
            default -> throw new IllegalArgumentException("Expected seed, project or evidence");
        }
    }
    static Connection database(String service) throws Exception {
        var url = System.getenv("NEXUS_LIVE_" + service.toUpperCase() + "_JDBC_URL");
        if (url == null || !url.startsWith("jdbc:postgresql://127.0.0.1:"))
            throw new IllegalArgumentException("Provide a dedicated loopback test database for " + service);
        return DriverManager.getConnection(url, System.getenv().getOrDefault("NEXUS_LIVE_JDBC_USER", "postgres"),
                System.getenv().getOrDefault("NEXUS_LIVE_JDBC_PASSWORD", ""));
    }
    static void project() throws Exception {
        // Manual event delivery only: copy the actual committed commerce event into the rating projection.
        // Kafka/consumer transactions are tested separately; this harness does not claim broker evidence.
        try (var commerce = database("commerce"); var statement = commerce.createStatement();
             var event = statement.executeQuery("""
                 SELECT b.id, b.payload->'payload'->>'buyerId' AS buyer,
                        b.payload->'payload'->>'sellerId' AS seller,
                        b.payload->'payload'->>'completedAt' AS completed,
                        b.payload->'payload'->>'orderVersion' AS version
                 FROM outbox b JOIN orders o ON b.aggregate_id=o.id::text
                 WHERE o.id='%s' AND o.status='COMPLETED' AND b.event_type='OrderCompleted'
                 """.formatted(ORDER))) {
            if (!event.next()) throw new IllegalStateException("The real confirmation must commit OrderCompleted first");
            try (var rating = database("rating"); var insert = rating.prepareStatement("""
                INSERT INTO rating_eligibility(order_id,buyer_id,seller_id,completed_at,source_event_id,source_version)
                VALUES (?,?,?,?::timestamptz,?,?) ON CONFLICT(order_id) DO NOTHING
                """)) {
                insert.setObject(1, UUID.fromString(ORDER));
                insert.setObject(2, UUID.fromString(event.getString("buyer")));
                insert.setObject(3, UUID.fromString(event.getString("seller")));
                insert.setString(4, event.getString("completed"));
                insert.setObject(5, event.getObject("id", UUID.class));
                insert.setLong(6, event.getLong("version"));
                insert.executeUpdate();
            }
            if (event.next()) throw new IllegalStateException("Completion produced more than one event");
        }
        System.out.print("{}");
    }
    static long count(Connection db, String sql) throws Exception {
        try (var statement = db.createStatement(); var result = statement.executeQuery(sql)) {
            result.next(); return result.getLong(1);
        }
    }
    static void evidence() throws Exception {
        try (var commerce = database("commerce"); var rating = database("rating")) {
            long completed = count(commerce, "SELECT count(*) FROM orders WHERE id='" + ORDER + "' AND status='COMPLETED'");
            long histories = count(commerce, "SELECT count(*) FROM order_status_history WHERE order_id='" + ORDER + "' AND new_status='COMPLETED'");
            long events = count(commerce, "SELECT count(*) FROM outbox WHERE aggregate_id='" + ORDER + "' AND event_type='OrderCompleted'");
            long ratings = count(rating, "SELECT count(*) FROM ratings WHERE order_id='" + ORDER + "'");
            long ratedEvents = count(rating, "SELECT count(*) FROM outbox WHERE event_type='UserRated' AND payload->'payload'->>'orderId'='" + ORDER + "'");
            System.out.printf("{\"completed\":%d,\"completionHistories\":%d,\"completionEvents\":%d,\"ratings\":%d,\"ratingEvents\":%d}",
                    completed, histories, events, ratings, ratedEvents);
        }
    }
}
