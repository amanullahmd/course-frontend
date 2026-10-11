package de.sprachweg.security;

import de.sprachweg.config.AppProperties;
import de.sprachweg.user.User;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    public static final String CLAIM_ROLE = "role";
    public static final String CLAIM_EMAIL = "email";
    public static final String CLAIM_NAME = "name";

    private final JwtEncoder encoder;
    private final AppProperties props;
    private final Clock clock;

    public JwtService(JwtEncoder encoder, AppProperties props, Clock clock) {
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    public String issueAccessToken(User user) {
        Instant now = Instant.now(clock);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(props.jwt().issuer())
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.jwt().accessTokenTtl()))
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_NAME, user.getFullName())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long accessTokenTtlSeconds() {
        return props.jwt().accessTokenTtl().toSeconds();
    }
}
