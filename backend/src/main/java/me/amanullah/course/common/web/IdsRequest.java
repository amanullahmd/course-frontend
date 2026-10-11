package me.amanullah.course.common.web;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record IdsRequest(@NotNull List<@NotNull UUID> ids) {
}
