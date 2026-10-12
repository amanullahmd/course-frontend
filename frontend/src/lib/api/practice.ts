import { api } from "./client";
import { downloadFile } from "./reports";
import type {
  AssignmentDto,
  AssignmentUpsert,
  AttendanceSheetDto,
  AttendanceStatus,
  CalendarTokenDto,
  DeckDto,
  FlashcardGrade,
  FlashcardImportResult,
  FlashcardUpsert,
  LearnerAssignmentDto,
  LearnerDeckDto,
  LearnerLiveSessionDto,
  LiveSeriesRequest,
  LiveSessionDto,
  LiveSessionUpsert,
  ReviewResultDto,
  ReviewSessionDto,
  ReviewSummaryDto,
  SubmissionDetailDto,
  SubmissionDto,
  SubmissionReviewRequest,
  SubmissionStatus,
  SubmissionSummaryDto,
  SubmitRequest,
} from "./types";

/** Flashcards, assignments and live sessions (workstream C, see docs/PLAN.md §6). */
export const flashcardsApi = {
  deck: (itemId: string) => api.get<DeckDto>(`/api/instructor/items/${itemId}/flashcards`),
  saveDeck: (itemId: string, cards: FlashcardUpsert[]) =>
    api.put<DeckDto>(`/api/instructor/items/${itemId}/flashcards`, { cards }),
  importCsv: (itemId: string, file: File, commit: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<FlashcardImportResult>(`/api/instructor/items/${itemId}/flashcards/import?commit=${commit}`, form);
  },
  exportCsv: (itemId: string) => downloadFile(`/api/instructor/items/${itemId}/flashcards/export`, "flashcards.csv"),

  learnerDeck: (itemId: string) => api.get<LearnerDeckDto>(`/api/student/items/${itemId}/flashcards`),
  session: (courseId: string, limit?: number) =>
    api.get<ReviewSessionDto>(`/api/student/courses/${courseId}/review`, { limit }),
  review: (cardId: string, grade: FlashcardGrade) =>
    api.post<ReviewResultDto>(`/api/student/flashcards/${cardId}/review`, { grade }),
  summary: () => api.get<ReviewSummaryDto>("/api/student/review/summary"),
};

export const assignmentsApi = {
  settings: (itemId: string) => api.get<AssignmentDto>(`/api/instructor/items/${itemId}/assignment`),
  saveSettings: (itemId: string, body: AssignmentUpsert) =>
    api.put<AssignmentDto>(`/api/instructor/items/${itemId}/assignment`, body),
  itemSubmissions: (itemId: string, status?: SubmissionStatus) =>
    api.get<SubmissionSummaryDto[]>(`/api/instructor/items/${itemId}/submissions`, { status }),
  courseSubmissions: (courseId: string, status?: SubmissionStatus) =>
    api.get<SubmissionSummaryDto[]>(`/api/instructor/courses/${courseId}/submissions`, { status }),
  detail: (id: string) => api.get<SubmissionDetailDto>(`/api/instructor/submissions/${id}`),
  review: (id: string, body: SubmissionReviewRequest) =>
    api.post<SubmissionDetailDto>(`/api/instructor/submissions/${id}/review`, body),

  learnerView: (itemId: string) => api.get<LearnerAssignmentDto>(`/api/student/items/${itemId}/assignment`),
  mine: (itemId: string) => api.get<SubmissionDto[]>(`/api/student/items/${itemId}/submissions`),
  submit: (itemId: string, body: SubmitRequest) => api.post<SubmissionDto>(`/api/student/items/${itemId}/submissions`, body),
};

export const liveApi = {
  list: (courseId: string) => api.get<LiveSessionDto[]>(`/api/instructor/courses/${courseId}/live-sessions`),
  create: (courseId: string, body: LiveSessionUpsert) =>
    api.post<LiveSessionDto>(`/api/instructor/courses/${courseId}/live-sessions`, body),
  series: (courseId: string, body: LiveSeriesRequest) =>
    api.post<LiveSessionDto[]>(`/api/instructor/courses/${courseId}/live-sessions/series`, body),
  update: (id: string, body: LiveSessionUpsert) => api.put<LiveSessionDto>(`/api/instructor/live-sessions/${id}`, body),
  remove: (id: string) => api.delete(`/api/instructor/live-sessions/${id}`),
  attendance: (id: string) => api.get<AttendanceSheetDto>(`/api/instructor/live-sessions/${id}/attendance`),
  saveAttendance: (id: string, entries: { studentId: string; status: AttendanceStatus }[]) =>
    api.put<AttendanceSheetDto>(`/api/instructor/live-sessions/${id}/attendance`, { entries }),

  forCourse: (courseId: string) => api.get<LearnerLiveSessionDto[]>(`/api/student/courses/${courseId}/live-sessions`),
  upcoming: () => api.get<LearnerLiveSessionDto[]>("/api/student/live-sessions/upcoming"),
  calendarToken: () => api.get<CalendarTokenDto>("/api/users/me/calendar-token"),
  rotateCalendarToken: () => api.post<CalendarTokenDto>("/api/users/me/calendar-token"),
};
