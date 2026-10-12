"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { instructorApi } from "@/lib/api/instructor";
import type {
  AssessmentDto,
  AddStudentsRequest,
  BulkEnrollmentRequest,
  CloneRequest,
  ContentItemDto,
  CourseDto,
  CourseUpsert,
  EnrollmentStatus,
  GradeRequest,
  ItemUpsert,
  ModuleDto,
  ModuleUpsert,
  PublicationRequest,
  ReleaseRulesRequest,
  ScheduleQuery,
} from "@/lib/api/types";
import { computeVisibility } from "@/lib/dates";
import { qk } from "@/lib/query-keys";

// ---------------------------------------------------------------------------
// Cache helpers for the course tree
// ---------------------------------------------------------------------------
function updateCourse(qc: QueryClient, courseId: string, updater: (course: CourseDto) => CourseDto) {
  qc.setQueryData<CourseDto>(qk.instructor.course(courseId), (course) => (course ? updater(course) : course));
}

function replaceModule(course: CourseDto, module: ModuleDto): CourseDto {
  return { ...course, modules: course.modules.map((m) => (m.id === module.id ? { ...module, items: module.items ?? m.items } : m)) };
}

function replaceItem(course: CourseDto, item: ContentItemDto): CourseDto {
  return {
    ...course,
    modules: course.modules.map((m) => ({
      ...m,
      items: m.items.map((i) => (i.id === item.id ? item : i)),
    })),
  };
}

function invalidateOverview(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.instructor.courses });
  void qc.invalidateQueries({ queryKey: qk.instructor.dashboard });
  void qc.invalidateQueries({ queryKey: ["instructor", "schedule"] });
}

// ---------------------------------------------------------------------------
// Dashboard & courses
// ---------------------------------------------------------------------------
export function useInstructorDashboard() {
  return useQuery({ queryKey: qk.instructor.dashboard, queryFn: instructorApi.dashboard });
}

export function useInstructorCourses() {
  return useQuery({ queryKey: qk.instructor.courses, queryFn: instructorApi.courses });
}

export function useInstructorCourse(courseId: string) {
  return useQuery({ queryKey: qk.instructor.course(courseId), queryFn: () => instructorApi.course(courseId) });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CourseUpsert) => instructorApi.createCourse(body),
    meta: { suppressErrorToast: true },
    onSuccess: (course) => {
      qc.setQueryData(qk.instructor.course(course.id), course);
      invalidateOverview(qc);
    },
  });
}

export function useUpdateCourse(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CourseUpsert) => instructorApi.updateCourse(courseId, body),
    meta: { suppressErrorToast: true },
    onSuccess: (course) => {
      qc.setQueryData(qk.instructor.course(courseId), course);
      invalidateOverview(qc);
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => instructorApi.deleteCourse(courseId),
    onSuccess: (_d, courseId) => {
      qc.removeQueries({ queryKey: qk.instructor.course(courseId) });
      invalidateOverview(qc);
    },
  });
}

export function usePublishCourse(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PublicationRequest) => instructorApi.publishCourse(courseId, body),
    onSuccess: (course) => {
      qc.setQueryData(qk.instructor.course(courseId), course);
      invalidateOverview(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
export function useCreateModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ModuleUpsert) => instructorApi.createModule(courseId, body),
    onSuccess: (module) => {
      updateCourse(qc, courseId, (c) => ({ ...c, modules: [...c.modules, { ...module, items: module.items ?? [] }] }));
      void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
      invalidateOverview(qc);
    },
  });
}

export function useUpdateModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ModuleUpsert }) => instructorApi.updateModule(id, body),
    onSuccess: (module) => updateCourse(qc, courseId, (c) => replaceModule(c, module)),
  });
}

export function useDeleteModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instructorApi.deleteModule(id),
    onSuccess: (_d, id) => {
      updateCourse(qc, courseId, (c) => ({ ...c, modules: c.modules.filter((m) => m.id !== id) }));
      invalidateOverview(qc);
    },
  });
}

function applyPublication<T extends { publishStatus: string }>(entity: T, body: PublicationRequest): T {
  return {
    ...entity,
    publishStatus: body.publishStatus,
    publishAt: body.publishAt ?? null,
    unpublishAt: body.unpublishAt ?? null,
    visibility: computeVisibility(body.publishStatus, body.publishAt, body.unpublishAt),
  };
}

export function usePublishModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PublicationRequest }) => instructorApi.publishModule(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: qk.instructor.course(courseId) });
      const prev = qc.getQueryData<CourseDto>(qk.instructor.course(courseId));
      updateCourse(qc, courseId, (c) => ({
        ...c,
        modules: c.modules.map((m) => (m.id === id ? applyPublication(m, body) : m)),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.instructor.course(courseId), ctx.prev);
    },
    onSuccess: (module) => {
      updateCourse(qc, courseId, (c) => replaceModule(c, module));
      void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
      invalidateOverview(qc);
    },
  });
}

export function useOrderModules(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => instructorApi.orderModules(courseId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.instructor.course(courseId) });
      const prev = qc.getQueryData<CourseDto>(qk.instructor.course(courseId));
      updateCourse(qc, courseId, (c) => ({
        ...c,
        modules: ids
          .map((id) => c.modules.find((m) => m.id === id))
          .filter((m): m is ModuleDto => !!m)
          .map((m, position) => ({ ...m, position })),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.instructor.course(courseId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) }),
  });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export function useInstructorItem(itemId: string) {
  return useQuery({ queryKey: qk.instructor.item(itemId), queryFn: () => instructorApi.item(itemId) });
}

export function useCreateItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, body }: { moduleId: string; body: ItemUpsert }) => instructorApi.createItem(moduleId, body),
    onSuccess: (item) => {
      qc.setQueryData(qk.instructor.item(item.id), item);
      updateCourse(qc, courseId, (c) => ({
        ...c,
        modules: c.modules.map((m) => (m.id === item.moduleId ? { ...m, items: [...m.items, item] } : m)),
      }));
      invalidateOverview(qc);
    },
  });
}

export function useUpdateItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ItemUpsert }) => instructorApi.updateItem(id, body),
    meta: { suppressErrorToast: true },
    onSuccess: (item) => {
      qc.setQueryData(qk.instructor.item(item.id), item);
      updateCourse(qc, courseId, (c) => replaceItem(c, item));
    },
  });
}

export function useDeleteItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instructorApi.deleteItem(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.instructor.item(id) });
      updateCourse(qc, courseId, (c) => ({
        ...c,
        modules: c.modules.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== id) })),
      }));
      invalidateOverview(qc);
    },
  });
}

export function usePublishItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PublicationRequest }) => instructorApi.publishItem(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: qk.instructor.course(courseId) });
      const prev = qc.getQueryData<CourseDto>(qk.instructor.course(courseId));
      updateCourse(qc, courseId, (c) => ({
        ...c,
        modules: c.modules.map((m) => ({ ...m, items: m.items.map((i) => (i.id === id ? applyPublication(i, body) : i)) })),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.instructor.course(courseId), ctx.prev);
    },
    onSuccess: (item) => {
      qc.setQueryData(qk.instructor.item(item.id), item);
      updateCourse(qc, courseId, (c) => replaceItem(c, item));
      invalidateOverview(qc);
    },
  });
}

/** Persist item order of a module; ids may include items moved in from other modules. */
export function useOrderItems(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, ids }: { moduleId: string; ids: string[]; optimisticModules?: ModuleDto[] }) =>
      instructorApi.orderItems(moduleId, ids),
    onMutate: async ({ optimisticModules }) => {
      await qc.cancelQueries({ queryKey: qk.instructor.course(courseId) });
      const prev = qc.getQueryData<CourseDto>(qk.instructor.course(courseId));
      if (optimisticModules) updateCourse(qc, courseId, (c) => ({ ...c, modules: optimisticModules }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.instructor.course(courseId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) }),
  });
}

// ---------------------------------------------------------------------------
// Assessments & grading
// ---------------------------------------------------------------------------
export function useAssessment(itemId: string, enabled = true) {
  return useQuery({
    queryKey: qk.instructor.assessment(itemId),
    queryFn: () => instructorApi.assessment(itemId),
    enabled,
  });
}

export function useSaveAssessment(itemId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssessmentDto) => instructorApi.saveAssessment(itemId, body),
    meta: { suppressErrorToast: true },
    onSuccess: (assessment) => {
      qc.setQueryData(qk.instructor.assessment(itemId), assessment);
      void qc.invalidateQueries({ queryKey: qk.instructor.item(itemId) });
      void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
    },
  });
}

export function useItemAttempts(itemId: string, enabled = true) {
  return useQuery({ queryKey: qk.instructor.attempts(itemId), queryFn: () => instructorApi.attempts(itemId), enabled });
}

export function useInstructorAttempt(attemptId: string | null) {
  return useQuery({
    queryKey: qk.instructor.attempt(attemptId ?? ""),
    queryFn: () => instructorApi.attempt(attemptId as string),
    enabled: !!attemptId,
  });
}

export function useGradeAttempt(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, body }: { attemptId: string; body: GradeRequest }) => instructorApi.grade(attemptId, body),
    onSuccess: (result) => {
      qc.setQueryData(qk.instructor.attempt(result.id), result);
      void qc.invalidateQueries({ queryKey: qk.instructor.attempts(itemId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------
export function useCourseEnrollments(courseId: string, status?: EnrollmentStatus) {
  return useQuery({
    queryKey: qk.instructor.enrollments(courseId, status),
    queryFn: () => instructorApi.enrollments(courseId, status),
  });
}

function invalidateEnrollments(qc: QueryClient, courseId?: string) {
  if (courseId) {
    void qc.invalidateQueries({ queryKey: qk.instructor.enrollmentsAll(courseId) });
    void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
  } else {
    void qc.invalidateQueries({ queryKey: ["instructor", "enrollments"] });
  }
  void qc.invalidateQueries({ queryKey: qk.instructor.dashboard });
  void qc.invalidateQueries({ queryKey: qk.instructor.courses });
}

export function useEnrollmentActions(courseId?: string) {
  const qc = useQueryClient();
  const onSuccess = () => invalidateEnrollments(qc, courseId);
  const approve = useMutation({ mutationFn: (id: string) => instructorApi.approve(id), onSuccess });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) => instructorApi.reject(id, reason),
    onSuccess,
  });
  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) => instructorApi.revoke(id, reason),
    onSuccess,
  });
  const bulk = useMutation({ mutationFn: (body: BulkEnrollmentRequest) => instructorApi.bulk(body), onSuccess });
  return { approve, reject, revoke, bulk };
}

/** "Add learners" by e-mail; refreshes the enrollment lists afterwards. */
export function useAddStudents(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddStudentsRequest) => instructorApi.addStudents(courseId, body),
    onSuccess: () => invalidateEnrollments(qc, courseId),
  });
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
export function useSchedule(query: ScheduleQuery) {
  return useQuery({
    queryKey: qk.instructor.schedule(query),
    queryFn: () => instructorApi.schedule(query),
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Release rules, duplication and cloning
// ---------------------------------------------------------------------------
export function useSetItemRelease(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseRulesRequest }) => instructorApi.setItemRelease(id, body),
    meta: { suppressErrorToast: true },
    onSuccess: (item) => {
      qc.setQueryData(qk.instructor.item(item.id), item);
      updateCourse(qc, courseId, (c) => replaceItem(c, item));
    },
  });
}

export function useSetModuleRelease(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseRulesRequest }) => instructorApi.setModuleRelease(id, body),
    meta: { suppressErrorToast: true },
    onSuccess: (module) => updateCourse(qc, courseId, (c) => replaceModule(c, module)),
  });
}

export function useDuplicateItem(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetModuleId }: { id: string; targetModuleId?: string | null }) =>
      instructorApi.duplicateItem(id, { targetModuleId: targetModuleId ?? null }),
    onSuccess: (item) => {
      qc.setQueryData(qk.instructor.item(item.id), item);
      void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
      invalidateOverview(qc);
    },
  });
}

export function useDuplicateModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instructorApi.duplicateModule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.instructor.course(courseId) });
      invalidateOverview(qc);
    },
  });
}

export function useCloneCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CloneRequest }) => instructorApi.cloneCourse(id, body),
    meta: { suppressErrorToast: true },
    onSuccess: (course) => {
      qc.setQueryData(qk.instructor.course(course.id), course);
      invalidateOverview(qc);
    },
  });
}
