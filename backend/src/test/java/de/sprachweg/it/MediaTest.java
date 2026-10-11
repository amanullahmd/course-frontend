package de.sprachweg.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

class MediaTest extends IntegrationTestSupport {

    private static String pathAndQuery(String url) {
        URI uri = URI.create(url);
        return uri.getRawPath() + "?" + uri.getRawQuery();
    }

    @Test
    void uploadSignedDownloadAndRange() throws Exception {
        String token = signUp(uniqueEmail("media"), "INSTRUCTOR");
        String other = signUp(uniqueEmail("media-other"), "INSTRUCTOR");
        byte[] content = "0123456789abcdefghij".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "../Übung 1.txt", "text/plain", content);

        MvcResult uploaded = mvc.perform(multipart("/api/media").file(file).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileName").value("Übung 1.txt"))
                .andExpect(jsonPath("$.kind").value("DOCUMENT"))
                .andExpect(jsonPath("$.sizeBytes").value(20))
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("http://localhost:8080/api/media/")))
                .andReturn();
        String id = read(uploaded, "$.id");
        String url = read(uploaded, "$.url");

        mvc.perform(auth(get("/api/media/" + id), token)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/media/" + id), other)).andExpect(status().isNotFound());

        // full download, no auth header needed
        MvcResult full = mvc.perform(get(pathAndQuery(url)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, org.hamcrest.Matchers.startsWith("text/plain")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("inline; filename=\"Ubung 1.txt\"; filename*=UTF-8''%C3%9Cbung%201.txt")))
                .andReturn();
        assertThat(full.getResponse().getContentAsByteArray()).isEqualTo(content);

        // range request → 206
        MvcResult partial = mvc.perform(get(pathAndQuery(url)).header(HttpHeaders.RANGE, "bytes=5-9"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 5-9/20"))
                .andReturn();
        assertThat(partial.getResponse().getContentAsString()).isEqualTo("56789");

        // download flag → attachment
        mvc.perform(get(pathAndQuery(url) + "&download=true"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("attachment;")));

        // tampered signature / expired link
        mvc.perform(get(pathAndQuery(url).replaceAll("sig=[^&]+", "sig=AAAA")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INVALID_SIGNATURE"));
        mvc.perform(get("/api/media/" + id + "/content").param("expires", "1").param("sig", "x"))
                .andExpect(status().isForbidden());

        // delete
        mvc.perform(auth(delete("/api/media/" + id), other)).andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/media/" + id), token)).andExpect(status().isNoContent());
        mvc.perform(get(pathAndQuery(url))).andExpect(status().isNotFound());
    }
}
