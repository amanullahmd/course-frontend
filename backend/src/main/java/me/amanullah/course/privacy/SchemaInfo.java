package me.amanullah.course.privacy;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Whether optional tables exist (messaging, certificates and later features are added by other modules), so the
 * export and the deletion can include their data without a compile-time dependency.
 */
@Component
class SchemaInfo {

    private final JdbcClient jdbc;
    private final Map<String, Boolean> cache = new ConcurrentHashMap<>();

    SchemaInfo(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    boolean hasTable(String table) {
        return cache.computeIfAbsent(table.toLowerCase(Locale.ROOT), t -> jdbc
                .sql("select count(*) from information_schema.tables where lower(table_name) = :t")
                .param("t", t).query(Long.class).single() > 0);
    }

    boolean hasColumn(String table, String column) {
        return cache.computeIfAbsent(table.toLowerCase(Locale.ROOT) + "." + column.toLowerCase(Locale.ROOT), k -> jdbc
                .sql("select count(*) from information_schema.columns where lower(table_name) = :t and lower(column_name) = :c")
                .param("t", table.toLowerCase(Locale.ROOT)).param("c", column.toLowerCase(Locale.ROOT))
                .query(Long.class).single() > 0);
    }
}
