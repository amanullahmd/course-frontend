import { api, API_URL, ApiError, getAccessToken, getApiLocale, refreshSession } from "./client";
import type { AttemptStatus, EnrollmentStatus, ItemType, ProblemDetail, QuestionType } from "./types";

// ---------------------------------------------------------------------------
// DTOs (see docs/PLAN.md §6 "Reports"); percentages are 0–100, null = nothing to average
// ---------------------------------------------------------------------------
export interface CourseRef {
  id: string;
  slug: string;
  title: string;
}

export interface ReportBucket {
  label: string;
  from: number;
  to: number;
  count: number;
}

export interface ReportKpis {
  approvedLearners: number;
  pendingApplications: number;
  averageProgress: number | null;
  medianProgress: number | null;
  completionRate: number | null;
  completedLearners: number;
  assessments: number;
  averageBestScore: number | null;
  passRate: number | null;
  pendingGrading: number;
  activeLearners7d: number;
  totalLiveItems: number;
}

export interface ModuleCompletion {
  moduleId: string;
  title: string;
  itemCount: number;
  completionPercent: number | null;
}

export interface EnrollmentFunnel {
  applied: number;
  pending: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  revoked: number;
  approvalRate: number | null;
}

export interface WeekBucket {
  weekStart: string;
  applications: number;
  approvals: number;
}

export interface ItemEngagement {
  itemId: string;
  title: string;
  type: ItemType;
  moduleId: string;
  moduleTitle: string;
  completed: number;
  completedPercent: number | null;
  taken: number | null;
  takenPercent: number | null;
  passed: number | null;
  averagePercent: number | null;
}

export interface OverviewReport {
  course: CourseRef;
  generatedAt: string;
  kpis: ReportKpis;
  progressDistribution: ReportBucket[];
  modules: ModuleCompletion[];
  funnel: EnrollmentFunnel;
  enrollmentTimeline: WeekBucket[];
  items: ItemEngagement[];
}

export interface ColumnStats {
  graded: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  passRate: number | null;
  attempts: number;
  pendingGrading: number;
}

export interface GradebookColumn {
  itemId: string;
  title: string;
  type: "QUIZ" | "EXAM";
  maxScore: number;
  passingScore: number;
  stats: ColumnStats;
}

export type CellStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED_PENDING" | "GRADED";
export type ActivityStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "INACTIVE";

export interface GradebookCell {
  itemId: string;
  bestPercent: number | null;
  bestScore: number | null;
  attempts: number;
  passed: boolean | null;
  status: CellStatus;
  latestAttemptId: string | null;
  lastSubmittedAt: string | null;
}

export interface GradebookRow {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  enrolledAt: string | null;
  progressPercent: number;
  completedItems: number;
  totalLiveItems: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  quizzesTaken: number;
  quizzesTotal: number;
  examsTaken: number;
  examsTotal: number;
  averageQuizPercent: number | null;
  averageExamPercent: number | null;
  lastActivityAt: string | null;
  activity: ActivityStatus;
  averagePercent: number | null;
  gradedAssessments: number;
  cells: GradebookCell[];
}

export interface Gradebook {
  course: CourseRef;
  generatedAt: string;
  totalLiveItems: number;
  columns: GradebookColumn[];
  rows: GradebookRow[];
}

export interface StudentReport {
  course: CourseRef;
  generatedAt: string;
  student: { id: string; fullName: string; email: string; avatarUrl: string | null };
  enrollment: { id: string; status: EnrollmentStatus; appliedAt: string; decidedAt: string | null };
  progressPercent: number;
  completedItems: number;
  totalLiveItems: number;
  lastActivityAt: string | null;
  modules: {
    moduleId: string;
    title: string;
    completedItems: number;
    totalItems: number;
    progressPercent: number;
    items: { itemId: string; title: string; type: ItemType; completedAt: string | null }[];
  }[];
  attempts: {
    id: string;
    itemId: string;
    itemTitle: string | null;
    itemType: ItemType | null;
    status: AttemptStatus;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    maxScore: number;
    percent: number | null;
    passed: boolean | null;
    late: boolean;
    autoSubmitted: boolean;
    pendingManualGrading: boolean;
  }[];
  totals: {
    attempts: number;
    assessmentsAttempted: number;
    assessmentsPassed: number;
    assessments: number;
    averageBestPercent: number | null;
    pendingGrading: number;
  };
  feedbackCount: number;
}

export interface QuestionStats {
  questionId: string;
  position: number;
  prompt: string;
  type: QuestionType;
  points: number;
  answered: number;
  unanswered: number;
  percentCorrect: number | null;
  averagePoints: number | null;
  commonWrongAnswers: { text: string; count: number }[];
}

export interface AssessmentAnalytics {
  itemId: string;
  title: string;
  type: ItemType;
  course: CourseRef;
  generatedAt: string;
  maxScore: number;
  passingScore: number;
  attempts: number;
  uniqueLearners: number;
  gradedAttempts: number;
  pendingGrading: number;
  inProgress: number;
  averagePercent: number | null;
  medianPercent: number | null;
  averageScore: number | null;
  passRate: number | null;
  averageDurationSeconds: number | null;
  scoreDistribution: ReportBucket[];
  questions: QuestionStats[];
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
const base = "/api/instructor";

export const reportsApi = {
  overview: (courseId: string) => api.get<OverviewReport>(`${base}/courses/${courseId}/reports/overview`),
  gradebook: (courseId: string) => api.get<Gradebook>(`${base}/courses/${courseId}/reports/gradebook`),
  student: (courseId: string, studentId: string) =>
    api.get<StudentReport>(`${base}/courses/${courseId}/reports/students/${studentId}`),
  assessment: (itemId: string) => api.get<AssessmentAnalytics>(`${base}/items/${itemId}/reports/assessment`),
};

export const reportCsv = {
  gradebook: (courseId: string) => `${base}/courses/${courseId}/reports/gradebook.csv`,
  progress: (courseId: string) => `${base}/courses/${courseId}/reports/progress.csv`,
  student: (courseId: string, studentId: string) => `${base}/courses/${courseId}/reports/students/${studentId}.csv`,
  attempts: (itemId: string) => `${base}/items/${itemId}/reports/attempts.csv`,
};

// ---------------------------------------------------------------------------
// Authenticated file download (a plain <a href> cannot send the bearer token)
// ---------------------------------------------------------------------------
function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

async function fetchFile(path: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: "text/csv, application/problem+json", "Accept-Language": getApiLocale() };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}${path}`, { headers, credentials: "include" });
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR" }, "Server unreachable");
  }
}

/** Fetches a file with the access token and saves it via a temporary object URL. Returns the file name. */
export async function downloadFile(path: string, fallbackName = "export.csv"): Promise<string> {
  let res = await fetchFile(path);
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await fetchFile(path);
  }
  if (!res.ok) {
    let problem: ProblemDetail = {};
    try {
      if ((res.headers.get("content-type") ?? "").includes("json")) problem = (await res.json()) as ProblemDetail;
    } catch {
      problem = {};
    }
    throw new ApiError(res.status, problem);
  }
  const blob = await res.blob();
  const name = fileNameFrom(res.headers.get("content-disposition"), fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
