import type { AdminUsersQuery, CatalogQuery, EnrollmentStatus, ScheduleQuery } from "@/lib/api/types";

export const qk = {
  me: ["me"] as const,
  public: {
    all: ["public"] as const,
    courses: (q: CatalogQuery) => ["public", "courses", q] as const,
    course: (slug: string) => ["public", "course", slug] as const,
  },
  instructor: {
    all: ["instructor"] as const,
    dashboard: ["instructor", "dashboard"] as const,
    courses: ["instructor", "courses"] as const,
    course: (id: string) => ["instructor", "course", id] as const,
    item: (id: string) => ["instructor", "item", id] as const,
    assessment: (itemId: string) => ["instructor", "assessment", itemId] as const,
    attempts: (itemId: string) => ["instructor", "attempts", itemId] as const,
    attempt: (attemptId: string) => ["instructor", "attempt", attemptId] as const,
    enrollments: (courseId: string, status?: EnrollmentStatus) =>
      ["instructor", "enrollments", courseId, status ?? "ALL"] as const,
    enrollmentsAll: (courseId: string) => ["instructor", "enrollments", courseId] as const,
    schedule: (q: ScheduleQuery) => ["instructor", "schedule", q] as const,
  },
  student: {
    all: ["student"] as const,
    enrollments: ["student", "enrollments"] as const,
    enrollment: (courseId: string) => ["student", "enrollment", courseId] as const,
    learn: (courseId: string) => ["student", "learn", courseId] as const,
    item: (itemId: string) => ["student", "item", itemId] as const,
    attempts: (itemId: string) => ["student", "attempts", itemId] as const,
    attempt: (attemptId: string) => ["student", "attempt", attemptId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (page: number, size: number) => ["notifications", "list", page, size] as const,
    unread: ["notifications", "unread"] as const,
  },
  admin: {
    stats: ["admin", "stats"] as const,
    users: (q: AdminUsersQuery) => ["admin", "users", q] as const,
  },
};
