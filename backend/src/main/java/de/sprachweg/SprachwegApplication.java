package de.sprachweg;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SprachwegApplication {

    public static void main(String[] args) {
        SpringApplication.run(SprachwegApplication.class, args);
    }
}
