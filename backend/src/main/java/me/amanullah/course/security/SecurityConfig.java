package me.amanullah.course.security;

import me.amanullah.course.common.exception.ErrorClassifier;
import me.amanullah.course.common.exception.Problems;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.firewall.RequestRejectedHandler;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.header.writers.frameoptions.XFrameOptionsHeaderWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

/** Stateless JWT security (HS256 via the OAuth2 resource server), CORS and RFC 7807 error responses. */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final RequestMatcher MEDIA_CONTENT =
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.GET, "/api/media/*/content");
    private static final RequestMatcher API_DOCS = PathPatternRequestMatcher.withDefaults().matcher("/v3/api-docs/**");
    private static final RequestMatcher SWAGGER_UI = new OrRequestMatcher(
            PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui/**"),
            PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui.html"));

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper, Problems problems,
                                                   LocaleResolver localeResolver,
                                                   CorsConfigurationSource corsConfigurationSource) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, ex) -> writeProblem(objectMapper, response,
                problems.of(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", localeResolver.resolveLocale(request)));
        AccessDeniedHandler deniedHandler = (request, response, ex) -> writeProblem(objectMapper, response,
                problems.of(HttpStatus.FORBIDDEN, "FORBIDDEN", localeResolver.resolveLocale(request)));

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                // nosniff and no-cache come from Spring Security's defaults. HSTS is only sent on HTTPS requests
                // (behind the TLS-terminating proxy, via X-Forwarded-Proto). Media content is embedded by the frontend
                // (PDF iframes), so it gets no X-Frame-Options; its framing is restricted by its own CSP instead.
                .headers(h -> h
                        .frameOptions(f -> f.disable())
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(
                                new NegatedRequestMatcher(MEDIA_CONTENT), new XFrameOptionsHeaderWriter(
                                        XFrameOptionsHeaderWriter.XFrameOptionsMode.DENY)))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(
                                new NegatedRequestMatcher(new OrRequestMatcher(MEDIA_CONTENT, API_DOCS, SWAGGER_UI)),
                                new StaticHeadersWriter("Content-Security-Policy",
                                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")))
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/media/*/content").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/calendar/*").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/instructor/**").hasAnyRole("INSTRUCTOR", "ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(rs -> rs
                        .bearerTokenResolver(bearerTokenResolver())
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler));
        return http.build();
    }

    /**
     * Ignores the Authorization header on public endpoints, so a stale/expired access token sent along with e.g.
     * {@code /api/auth/refresh} or the public catalog never causes a 401.
     */
    private static BearerTokenResolver bearerTokenResolver() {
        DefaultBearerTokenResolver delegate = new DefaultBearerTokenResolver();
        return request -> {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if (path.startsWith("/api/auth/") || path.startsWith("/api/public/")
                    || path.startsWith("/api/calendar/")
                    || (path.startsWith("/api/media/") && path.endsWith("/content"))) {
                return null;
            }
            return delegate.resolve(request);
        };
    }

    private static void writeProblem(ObjectMapper mapper, jakarta.servlet.http.HttpServletResponse response,
                                     ProblemDetail problem) throws java.io.IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(problem.getStatus());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(response.getOutputStream(), problem);
    }

    /** Requests rejected by the HTTP firewall (e.g. encoded slashes, ".." segments) get a ProblemDetail 400. */
    @Bean
    public RequestRejectedHandler requestRejectedHandler(ObjectMapper objectMapper, Problems problems,
                                                         LocaleResolver localeResolver) {
        return (request, response, ex) -> writeProblem(objectMapper, response, problems.of(
                ErrorClassifier.classify(ex), localeResolver.resolveLocale(request)));
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            String role = jwt.getClaimAsString(JwtService.CLAIM_ROLE);
            Collection<GrantedAuthority> authorities = role == null
                    ? List.of() : List.of(new SimpleGrantedAuthority("ROLE_" + role));
            return authorities;
        });
        return converter;
    }

    @Bean
    public SecretKey jwtSecretKey(AppProperties props) {
        return new SecretKeySpec(props.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSecretKey).algorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtSecretKey, AppProperties props, UserRepository users) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(props.jwt().issuer()), new AccountStatusJwtValidator(users)));
        return decoder;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(props.cors().allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Content-Disposition", "Content-Length", "Content-Range", "Accept-Ranges",
                "Retry-After"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
