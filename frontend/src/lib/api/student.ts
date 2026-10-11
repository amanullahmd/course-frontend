import { api } from "./client";
import type {
  AttemptResultDto,
  AttemptSessionDto,
  AttemptSummaryDto,
  EnrollmentDto,
  LearnCourseDto,
  LearnItemDto,
  StudentEnrollmentDto,
  SubmitAttemptRequest,
} from "./types";

const base = "/api/student";

export const studentApi = {
  apply: (courseId: string, message: string | null) =>
    api.post<EnrollmentDto>(`${base}/courses/${courseId}/enrollments`, { message }),
  enrollment: (courseId: string) => api.get<EnrollmentDto>(`${base}/courses/${courseId}/enrollment`),
  enrollments: () => api.get<StudentEnrollmentDto[]>(`${base}/enrollments`),
  withdraw: (enrollmentId: string) => api.post<EnrollmentDto>(`${base}/enrollments/${enrollmentId}/withdraw`),

  learnCourse: (courseId: string) => api.get<LearnCourseDto>(`${base}/courses/${courseId}/learn`),
  item: (itemId: string) => api.get<LearnItemDto>(`${base}/items/${itemId}`),
  complete: (itemId: string) => api.post<void>(`${base}/items/${itemId}/complete`),
  uncomplete: (itemId: string) => api.delete(`${base}/items/${itemId}/complete`),

  attempts: (itemId: string) => api.get<AttemptSummaryDto[]>(`${base}/items/${itemId}/attempts`),
  startAttempt: (itemId: string) => api.post<AttemptSessionDto>(`${base}/items/${itemId}/attempts`),
  submitAttempt: (attemptId: string, body: SubmitAttemptRequest) =>
    api.post<AttemptResultDto>(`${base}/attempts/${attemptId}/submit`, body),
  attempt: (attemptId: string) => api.get<AttemptResultDto>(`${base}/attempts/${attemptId}`),
};
