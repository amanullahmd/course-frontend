import { api } from "./client";
import type {
  AddStudentsRequest,
  AddStudentsResult,
  AssessmentDto,
  AttemptResultDto,
  AttemptSummaryDto,
  BulkEnrollmentRequest,
  CloneRequest,
  ContentItemDto,
  CourseDto,
  CourseUpsert,
  DuplicateItemRequest,
  EnrollmentDto,
  EnrollmentStatus,
  GradeRequest,
  InstructorCourseDto,
  InstructorDashboardDto,
  ItemUpsert,
  ModuleDto,
  ModuleUpsert,
  PublicationRequest,
  ReleaseRulesRequest,
  ScheduleEventDto,
  ScheduleQuery,
} from "./types";

const base = "/api/instructor";

export const instructorApi = {
  dashboard: () => api.get<InstructorDashboardDto>(`${base}/dashboard`),

  // Courses
  courses: () => api.get<InstructorCourseDto[]>(`${base}/courses`),
  course: (id: string) => api.get<CourseDto>(`${base}/courses/${id}`),
  createCourse: (body: CourseUpsert) => api.post<CourseDto>(`${base}/courses`, body),
  updateCourse: (id: string, body: CourseUpsert) => api.put<CourseDto>(`${base}/courses/${id}`, body),
  deleteCourse: (id: string) => api.delete(`${base}/courses/${id}`),
  publishCourse: (id: string, body: PublicationRequest) => api.put<CourseDto>(`${base}/courses/${id}/publication`, body),

  cloneCourse: (id: string, body: CloneRequest) => api.post<CourseDto>(`${base}/courses/${id}/clone`, body),

  // Modules
  createModule: (courseId: string, body: ModuleUpsert) => api.post<ModuleDto>(`${base}/courses/${courseId}/modules`, body),
  orderModules: (courseId: string, ids: string[]) => api.put<void>(`${base}/courses/${courseId}/modules/order`, { ids }),
  updateModule: (id: string, body: ModuleUpsert) => api.put<ModuleDto>(`${base}/modules/${id}`, body),
  deleteModule: (id: string) => api.delete(`${base}/modules/${id}`),
  publishModule: (id: string, body: PublicationRequest) => api.put<ModuleDto>(`${base}/modules/${id}/publication`, body),
  duplicateModule: (id: string) => api.post<ModuleDto>(`${base}/modules/${id}/duplicate`),
  setModuleRelease: (id: string, body: ReleaseRulesRequest) => api.put<ModuleDto>(`${base}/modules/${id}/release`, body),

  // Items
  createItem: (moduleId: string, body: ItemUpsert) => api.post<ContentItemDto>(`${base}/modules/${moduleId}/items`, body),
  orderItems: (moduleId: string, ids: string[]) => api.put<void>(`${base}/modules/${moduleId}/items/order`, { ids }),
  item: (id: string) => api.get<ContentItemDto>(`${base}/items/${id}`),
  updateItem: (id: string, body: ItemUpsert) => api.put<ContentItemDto>(`${base}/items/${id}`, body),
  deleteItem: (id: string) => api.delete(`${base}/items/${id}`),
  publishItem: (id: string, body: PublicationRequest) => api.put<ContentItemDto>(`${base}/items/${id}/publication`, body),
  duplicateItem: (id: string, body: DuplicateItemRequest = {}) =>
    api.post<ContentItemDto>(`${base}/items/${id}/duplicate`, body),
  setItemRelease: (id: string, body: ReleaseRulesRequest) => api.put<ContentItemDto>(`${base}/items/${id}/release`, body),

  // Assessments
  assessment: (itemId: string) => api.get<AssessmentDto>(`${base}/items/${itemId}/assessment`),
  saveAssessment: (itemId: string, body: AssessmentDto) => api.put<AssessmentDto>(`${base}/items/${itemId}/assessment`, body),
  attempts: (itemId: string) => api.get<AttemptSummaryDto[]>(`${base}/items/${itemId}/attempts`),
  attempt: (attemptId: string) => api.get<AttemptResultDto>(`${base}/attempts/${attemptId}`),
  grade: (attemptId: string, body: GradeRequest) => api.post<AttemptResultDto>(`${base}/attempts/${attemptId}/grade`, body),

  // Enrollments
  enrollments: (courseId: string, status?: EnrollmentStatus) =>
    api.get<EnrollmentDto[]>(`${base}/courses/${courseId}/enrollments`, { status }),
  approve: (id: string) => api.post<EnrollmentDto>(`${base}/enrollments/${id}/approve`),
  reject: (id: string, reason: string | null) => api.post<EnrollmentDto>(`${base}/enrollments/${id}/reject`, { reason }),
  revoke: (id: string, reason: string | null) => api.post<EnrollmentDto>(`${base}/enrollments/${id}/revoke`, { reason }),
  bulk: (body: BulkEnrollmentRequest) => api.post<EnrollmentDto[]>(`${base}/enrollments/bulk`, body),
  addStudents: (courseId: string, body: AddStudentsRequest) =>
    api.post<AddStudentsResult>(`${base}/courses/${courseId}/enrollments/add`, body),

  // Schedule
  schedule: (query: ScheduleQuery) => api.get<ScheduleEventDto[]>(`${base}/schedule`, { ...query }),
};
