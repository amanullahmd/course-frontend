/**
 * TypeScript mirror of the Sprachweg REST contract (docs/PLAN.md §6).
 * All instants are ISO-8601 UTC strings, all ids are UUID strings.
 */

export type Uuid = string;
export type Instant = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";
export type RegisterRole = Exclude<Role, "ADMIN">;
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type EnrollmentMode = "APPROVAL" | "OPEN";
export type PublishStatus = "DRAFT" | "PUBLISHED";
export type Visibility = "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED";
export type ItemType = "TEXT" | "DOCUMENT" | "VIDEO" | "AUDIO" | "IMAGE" | "EMBED" | "QUIZ" | "EXAM";
export type MediaKind = "DOCUMENT" | "VIDEO" | "AUDIO" | "IMAGE" | "ARCHIVE" | "OTHER";
export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "FILL_BLANK"
  | "ESSAY";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";
export type EnrollmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "REVOKED";
export type ScheduleEntityType = "COURSE" | "MODULE" | "ITEM";
/** OPENS/CLOSES: start and end of a quiz/exam availability window (entityType ITEM). */
export type ScheduleAction = "PUBLISH" | "UNPUBLISH" | "OPENS" | "CLOSES";
export type BulkAction = "APPROVE" | "REJECT";

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface MessageResponse {
  message: string;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string>;
  /** Correlation id for 5xx errors (backend extension). */
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Auth & users
// ---------------------------------------------------------------------------
export interface UserDto {
  id: Uuid;
  fullName: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  bio: string | null;
  avatarUrl: string | null;
  avatarMediaId?: Uuid | null;
  locale?: "en" | "de";
  createdAt: Instant;
}

export interface AdminUserDto extends UserDto {
  enabled: boolean;
}

export interface AuthResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: UserDto;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: RegisterRole;
  /** UI locale for e-mails (backend extension). */
  locale?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  bio: string | null;
  avatarMediaId: Uuid | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
export interface MediaDto {
  id: Uuid;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: MediaKind;
  /** Absolute, signed, time-limited URL. */
  url: string;
  /** Same as `url` but forces a download (backend extension). */
  downloadUrl?: string;
  createdAt: Instant;
}

// ---------------------------------------------------------------------------
// Public catalog
// ---------------------------------------------------------------------------
export interface InstructorRef {
  id: Uuid;
  fullName: string;
  avatarUrl: string | null;
}

export interface InstructorPublicRef extends InstructorRef {
  bio: string | null;
}

export interface CourseSummaryDto {
  id: Uuid;
  slug: string;
  title: string;
  subtitle: string | null;
  level: CefrLevel;
  tags: string[];
  coverImageUrl: string | null;
  instructor: InstructorRef;
  studentCount: number;
  moduleCount: number;
  itemCount: number;
  enrollmentMode: EnrollmentMode;
  publishedAt: Instant | null;
}

export interface OutlineItem {
  id: Uuid;
  title: string;
  type: ItemType;
  durationMinutes: number | null;
}

export interface OutlineModule {
  id: Uuid;
  title: string;
  description: string | null;
  items: OutlineItem[];
}

export interface CoursePublicDto extends Omit<CourseSummaryDto, "instructor"> {
  description: string | null;
  capacity: number | null;
  instructor: InstructorPublicRef;
  outline: OutlineModule[];
}

export interface CatalogQuery {
  q?: string;
  level?: CefrLevel;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------------------
// Instructor
// ---------------------------------------------------------------------------
export interface PublicationRequest {
  publishStatus: PublishStatus;
  publishAt?: Instant | null;
  unpublishAt?: Instant | null;
}

export interface Publishable {
  publishStatus: PublishStatus;
  publishAt: Instant | null;
  unpublishAt: Instant | null;
  visibility: Visibility;
}

export interface CourseUpsert {
  title: string;
  subtitle: string | null;
  description: string | null;
  level: CefrLevel;
  tags: string[];
  coverImageId?: Uuid | null;
  enrollmentMode: EnrollmentMode;
  capacity?: number | null;
}

export interface AssessmentSummary {
  questionCount: number;
  totalPoints: number;
  timeLimitMinutes: number | null;
}

export interface ContentItemDto extends Publishable {
  id: Uuid;
  moduleId: Uuid;
  courseId: Uuid;
  type: ItemType;
  title: string;
  summary: string | null;
  body: string | null;
  externalUrl: string | null;
  durationMinutes: number | null;
  position: number;
  attachments: MediaDto[];
  assessment?: AssessmentSummary | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ModuleDto extends Publishable {
  id: Uuid;
  courseId: Uuid;
  title: string;
  description: string | null;
  position: number;
  items: ContentItemDto[];
}

export interface CourseDto extends Publishable {
  id: Uuid;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  level: CefrLevel;
  tags: string[];
  coverImage: MediaDto | null;
  enrollmentMode: EnrollmentMode;
  capacity: number | null;
  studentCount: number;
  pendingCount: number;
  modules: ModuleDto[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface InstructorCourseDto extends Publishable {
  id: Uuid;
  slug: string;
  title: string;
  subtitle: string | null;
  level: CefrLevel;
  coverImageUrl: string | null;
  studentCount: number;
  pendingCount: number;
  moduleCount: number;
  itemCount: number;
  updatedAt: Instant;
}

export interface ModuleUpsert {
  title: string;
  description: string | null;
}

export interface ItemUpsert {
  type: ItemType;
  title: string;
  summary: string | null;
  body: string | null;
  externalUrl: string | null;
  durationMinutes: number | null;
  attachmentIds: Uuid[];
}

export interface OrderRequest {
  ids: Uuid[];
}

export interface QuestionOptionDto {
  id?: Uuid;
  text: string;
  correct: boolean;
  position: number;
}

export interface QuestionDto {
  id?: Uuid;
  type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  position: number;
  caseSensitive: boolean;
  acceptedAnswers: string[];
  mediaId?: Uuid | null;
  media?: MediaDto | null;
  options: QuestionOptionDto[];
}

export interface AssessmentDto {
  itemId: Uuid;
  instructions: string | null;
  timeLimitMinutes: number | null;
  /** 0 = unlimited */
  maxAttempts: number;
  /** 0-100 */
  passingScore: number;
  shuffleQuestions: boolean;
  showCorrectAnswers: boolean;
  availableFrom: Instant | null;
  availableUntil: Instant | null;
  questions: QuestionDto[];
}

export interface StudentRef {
  id: Uuid;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface EnrollmentDto {
  id: Uuid;
  courseId: Uuid;
  courseTitle: string;
  student: StudentRef;
  status: EnrollmentStatus;
  message: string | null;
  decisionReason: string | null;
  appliedAt: Instant;
  decidedAt: Instant | null;
  waitlistPosition?: number | null;
  progressPercent: number | null;
}

export interface ScheduleEventDto {
  id: string;
  entityType: ScheduleEntityType;
  entityId: Uuid;
  courseId: Uuid;
  courseTitle: string;
  title: string;
  itemType?: ItemType | null;
  action: ScheduleAction;
  at: Instant;
}

export interface InstructorDashboardDto {
  courseCount: number;
  liveCourseCount: number;
  studentCount: number;
  pendingCount: number;
  upcoming: ScheduleEventDto[];
  recentApplications: EnrollmentDto[];
}

export interface AttemptSummaryDto {
  id: Uuid;
  student: StudentRef;
  status: AttemptStatus;
  startedAt: Instant;
  submittedAt: Instant | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
  pendingManualGrading: boolean;
  /** Submitted after the deadline (backend extension). */
  late?: boolean;
  /** Submitted by the server with the autosaved answers because time ran out or the window closed. */
  autoSubmitted?: boolean;
}

export interface AttemptAnswerOption {
  id: Uuid;
  text: string;
  correct?: boolean | null;
}

export interface AttemptAnswerResult {
  questionId: Uuid;
  type: QuestionType;
  prompt: string;
  points: number;
  selectedOptionIds: Uuid[];
  textAnswer: string | null;
  correct?: boolean | null;
  pointsAwarded?: number | null;
  feedback: string | null;
  options?: AttemptAnswerOption[] | null;
  acceptedAnswers?: string[] | null;
  explanation?: string | null;
  media?: MediaDto | null;
}

export interface AttemptResultDto extends AttemptSummaryDto {
  itemId: Uuid;
  itemTitle: string;
  deadline: Instant | null;
  answers: AttemptAnswerResult[];
}

export interface GradeRequest {
  grades: { questionId: Uuid; pointsAwarded: number; feedback: string | null }[];
}

export interface BulkEnrollmentRequest {
  ids: Uuid[];
  action: BulkAction;
  reason?: string | null;
}

export interface ScheduleQuery {
  from?: Instant;
  to?: Instant;
  courseId?: Uuid;
}

// ---------------------------------------------------------------------------
// Student / learner
// ---------------------------------------------------------------------------
export interface StudentEnrollmentDto {
  id: Uuid;
  status: EnrollmentStatus;
  message: string | null;
  decisionReason: string | null;
  appliedAt: Instant;
  decidedAt: Instant | null;
  waitlistPosition: number | null;
  progressPercent: number | null;
  course: CourseSummaryDto;
}

export interface LearnItemRef {
  id: Uuid;
  title: string;
  type: ItemType;
  durationMinutes: number | null;
  completed: boolean;
}

export interface LearnModule {
  id: Uuid;
  title: string;
  description: string | null;
  items: LearnItemRef[];
}

export interface LearnCourseDto {
  course: CourseSummaryDto & { description: string | null };
  progressPercent: number;
  modules: LearnModule[];
}

export interface LearnAssessmentInfo {
  instructions: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  passingScore: number;
  questionCount: number;
  totalPoints: number;
  availableFrom: Instant | null;
  availableUntil: Instant | null;
  attemptsUsed: number;
  bestPercent: number | null;
  inProgressAttemptId: Uuid | null;
}

export interface LearnItemDto {
  id: Uuid;
  courseId: Uuid;
  moduleId: Uuid;
  type: ItemType;
  title: string;
  summary: string | null;
  body: string | null;
  externalUrl: string | null;
  durationMinutes: number | null;
  attachments: MediaDto[];
  completed: boolean;
  prevItemId: Uuid | null;
  nextItemId: Uuid | null;
  assessment?: LearnAssessmentInfo | null;
}

export interface SessionQuestion {
  id: Uuid;
  type: QuestionType;
  prompt: string;
  points: number;
  media?: MediaDto | null;
  options: { id: Uuid; text: string }[];
}

export interface AttemptSessionDto {
  id: Uuid;
  status: AttemptStatus;
  startedAt: Instant;
  /** Effective deadline: the time limit capped at the window end (or the window end alone); null = never expires. */
  deadline: Instant | null;
  timeLimitMinutes?: number | null;
  availableUntil?: Instant | null;
  /** Server clock when the session was returned (corrects client clock skew). */
  serverTime?: Instant | null;
  questions: SessionQuestion[];
  /** Autosaved draft answers (restored when resuming, also on another device). */
  savedAnswers?: SubmitAnswer[];
}

export interface SubmitAnswer {
  questionId: Uuid;
  selectedOptionIds: Uuid[];
  textAnswer: string | null;
}

export interface SubmitAttemptRequest {
  answers: SubmitAnswer[];
}

// ---------------------------------------------------------------------------
// Notifications & admin
// ---------------------------------------------------------------------------
export interface NotificationDto {
  id: Uuid;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Instant;
}

export interface UnreadCountDto {
  count: number;
}

export interface AdminStatsDto {
  users: number;
  students: number;
  instructors: number;
  courses: number;
  liveCourses: number;
  enrollments: number;
}

export interface AdminUserUpdate {
  role: Role;
  enabled: boolean;
}

export interface AdminUsersQuery {
  q?: string;
  role?: Role;
  page?: number;
  size?: number;
}
