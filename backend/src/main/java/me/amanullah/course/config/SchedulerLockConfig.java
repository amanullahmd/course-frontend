package me.amanullah.course.config;

import javax.sql.DataSource;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Cluster-safe scheduled jobs with ShedLock (JDBC, table {@code shedlock} from V11). Annotate every
 * {@code @Scheduled} method that must run on one instance only:
 *
 * <pre>
 * &#64;Scheduled(fixedDelayString = "...")
 * &#64;SchedulerLock(name = "AnnouncementScheduler.sendDue", lockAtMostFor = "PT5M", lockAtLeastFor = "PT5S")
 * public void scheduledRun() { ... }
 * </pre>
 *
 * Lock times use the database clock ({@code usingDbTime}), so instances with skewed clocks agree.
 * {@code lockAtMostFor} must be longer than the longest expected run; jobs that only touch per-instance memory
 * (e.g. the rate limiter's eviction) are not locked.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class SchedulerLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .withTableName("shedlock")
                .usingDbTime()
                .build());
    }
}
