import { api } from "./client";
import type { CatalogQuery, CoursePublicDto, CourseSummaryDto, Page } from "./types";

export const publicApi = {
  courses: (query: CatalogQuery = {}) =>
    api.get<Page<CourseSummaryDto>>("/api/public/courses", { ...query }, { auth: false }),
  course: (slug: string) =>
    api.get<CoursePublicDto>(`/api/public/courses/${encodeURIComponent(slug)}`, undefined, { auth: false }),
};
