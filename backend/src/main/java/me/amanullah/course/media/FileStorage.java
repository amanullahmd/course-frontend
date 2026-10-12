package me.amanullah.course.media;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;

/** Storage abstraction (local disk today; S3/MinIO adapters can be added later). */
public interface FileStorage {

    /** Stores the stream and returns the number of bytes written. */
    long store(String key, InputStream in) throws IOException;

    Resource load(String key);

    void delete(String key);
}
