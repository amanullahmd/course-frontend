# syntax=docker/dockerfile:1

# ---------- build ----------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 chmod +x mvnw && (./mvnw -q -B dependency:go-offline || true)
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -B -DskipTests package \
    && cp target/sprachweg-backend-*.jar /workspace/app.jar \
    && java -Djarmode=tools -jar /workspace/app.jar extract --layers --launcher --destination /workspace/extracted

# ---------- runtime ----------
FROM eclipse-temurin:25-jre
RUN groupadd --system sprachweg && useradd --system --gid sprachweg --home /app sprachweg \
    && mkdir -p /app /data/uploads && chown -R sprachweg:sprachweg /app /data
WORKDIR /app
COPY --from=build --chown=sprachweg:sprachweg /workspace/extracted/dependencies/ ./
COPY --from=build --chown=sprachweg:sprachweg /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=sprachweg:sprachweg /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=sprachweg:sprachweg /workspace/extracted/application/ ./
USER sprachweg
ENV SPRING_PROFILES_ACTIVE=prod \
    STORAGE_LOCATION=/data/uploads \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
VOLUME ["/data/uploads"]
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
