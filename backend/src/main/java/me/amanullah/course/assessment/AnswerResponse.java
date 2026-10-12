package me.amanullah.course.assessment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.json.JsonMapper;

/**
 * Structured response of a learner to a CLOZE ({@code blanks}: blank index to text), WORD_BANK ({@code blanks}: blank
 * index to chip option id), MATCHING ({@code pairs}: left option id to right option id) or ORDERING ({@code order}:
 * option ids) question, stored as JSON in {@code attempt_answers.response_json}.
 */
public record AnswerResponse(Map<String, String> blanks, Map<String, String> pairs, List<String> order) {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();
    public static final AnswerResponse EMPTY = new AnswerResponse(Map.of(), Map.of(), List.of());

    public AnswerResponse {
        blanks = blanks == null ? Map.of() : blanks;
        pairs = pairs == null ? Map.of() : pairs;
        order = order == null ? List.of() : order;
    }

    public static AnswerResponse parse(String json) {
        if (json == null || json.isBlank()) {
            return EMPTY;
        }
        try {
            return MAPPER.readValue(json, AnswerResponse.class);
        } catch (RuntimeException e) {
            return EMPTY;
        }
    }

    public boolean isEmpty() {
        return blanks.values().stream().allMatch(String::isBlank) && pairs.isEmpty() && order.isEmpty();
    }

    /** JSON for storage, {@code null} when there is nothing to store. */
    public String toJson() {
        if (isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if (!blanks.isEmpty()) {
            out.put("blanks", blanks);
        }
        if (!pairs.isEmpty()) {
            out.put("pairs", pairs);
        }
        if (!order.isEmpty()) {
            out.put("order", new ArrayList<>(order));
        }
        return MAPPER.writeValueAsString(out);
    }
}
