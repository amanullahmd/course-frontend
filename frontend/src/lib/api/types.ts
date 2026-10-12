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
/** Review state of instructor accounts (null for students and admins). */
export type InstructorStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RegisterRole = Exclude<Role, "ADMIN">;
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type EnrollmentMode = "APPROVAL" | "OPEN";
export type PublishStatus = "DRAFT" | "PUBLISHED";
export type Visibility = "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED";
export type ItemType = "TEXT" | "DOCUMENT" | "VIDEO" | "AUDIO" | "IMAGE" | "EMBED" | "QUIZ" | "EXAM" | "FLASHCARDS" | "ASSIGNMENT";
export type MediaKind = "DOCUMENT" | "VIDEO" | "AUDIO" | "IMAGE" | "ARCHIVE" | "OTHER";
export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "FILL_BLANK"
  | "ESSAY"
  | "CLOZE"
  | "WORD_BANK"
  | "MATCHING"
  | "ORDERING"
  | "DICTATION"
  | "SPEAKING";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";
export type EnrollmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "REVOKED";
export type ScheduleEntityType = "COURSE" | "MODULE" | "ITEM" | "SESSION";
/** OPENS/CLOSES: start and end of a quiz/exam availability window (entityType ITEM). */
export type ScheduleAction = "PUBLISH" | "UNPUBLISH" | "OPENS" | "CLOSES" | "DUE" | "SESSION";
/** APPROVE also restores REJECTED, REVOKED and WITHDRAWN enrollments; REVOKE removes approved learners. */
export type BulkAction = "APPROVE" | "REJECT" | "REVOKE";

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
  /** 429 RATE_LIMITED: seconds until the next attempt is allowed (also in the Retry-After header). */
  retryAfterSeconds?: number;
  /** 413 QUOTA_EXCEEDED: storage usage of the uploader. */
  usedBytes?: number;
  quotaBytes?: number;
  /** 403 ITEM_LOCKED: why the item is not open yet (DATE, PREREQUISITE or SEQUENCE). */
  lockReason?: LockReason;
  unlockAt?: Instant | null;
  prerequisites?: LockPrerequisite[];
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
  /** Instructors only: accounts must be approved by an admin before they can create courses. */
  instructorStatus?: InstructorStatus | null;
}

export interface AdminUserDto extends UserDto {
  enabled: boolean;
  /** The account was deleted by its owner (anonymised). */
  deleted?: boolean;
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
  /** "I accept the terms and have read the privacy policy" (required). */
  acceptTerms?: boolean;
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
  /** Omitted = keep the current setting (FREE for new courses). */
  progression?: CourseProgression;
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
  /** Optional items do not count towards progress and certificates. */
  required: boolean;
  releaseOffsetDays: number | null;
  prerequisites: PrerequisiteDto[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ModuleDto extends Publishable {
  id: Uuid;
  courseId: Uuid;
  title: string;
  description: string | null;
  position: number;
  releaseOffsetDays: number | null;
  prerequisites: PrerequisiteDto[];
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
  progression: CourseProgression;
  clonedFromId: Uuid | null;
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
  /** MATCHING: the right-hand text that belongs to {@link text}. */
  matchText?: string | null;
  /** WORD_BANK: the blank this chip is the answer for, null/absent for a distractor. */
  blankIndex?: number | null;
}

/** Language exercises: partial credit etc. */
export type Scoring = "ALL_OR_NOTHING" | "PARTIAL";

/** Accepted answers of one numbered blank of a CLOZE question. */
export interface QuestionBlankDto {
  index: number;
  acceptedAnswers: string[];
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
  scoring?: Scoring;
  shuffleOptions?: boolean;
  lenientSpelling?: boolean;
  /** SPEAKING: 10 to 600 seconds. */
  maxRecordingSeconds?: number | null;
  /** CLOZE: accepted answers per numbered blank. */
  blanks?: QuestionBlankDto[];
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
  scoring?: Scoring;
  /** CLOZE: typed text, WORD_BANK: chip option id, keyed by blank index. */
  blanks?: Record<string, string> | null;
  /** MATCHING: left option id to right option id. */
  pairs?: Record<string, string> | null;
  /** ORDERING: option ids in the learner's order. */
  order?: Uuid[] | null;
  blankResults?: BlankResult[] | null;
  pairResults?: PairResult[] | null;
  /** ORDERING: the right order, only when the solution may be shown. */
  correctOrder?: Uuid[] | null;
  /** SPEAKING: the learner's recording. */
  responseMedia?: MediaDto | null;
  maxRecordingSeconds?: number | null;
}

export interface BlankResult {
  index: number;
  given: string | null;
  correct: boolean;
  /** Accepted answers, only when the solution may be shown. */
  expected?: string[] | null;
}

export interface PairResult {
  leftId: Uuid;
  left: string;
  rightId: Uuid | null;
  right: string | null;
  correct: boolean;
  expectedRight?: string | null;
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

/** All or nothing. With `courseId`, every id must belong to that course. */
export interface BulkEnrollmentRequest {
  ids: Uuid[];
  action: BulkAction;
  reason?: string | null;
  courseId?: Uuid;
}

export interface AddStudentsRequest {
  /** 1–200 addresses; trimmed and de-duplicated (case-insensitive) by the server. */
  emails: string[];
  message?: string | null;
  invite?: boolean;
}

export type AddStudentsSkipCode =
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_DISABLED"
  | "OWN_COURSE"
  | "CAPACITY_REACHED"
  | "ALREADY_INVITED";

/** Addresses are lower-cased. `invited` ⊆ `notFound`. */
export interface AddStudentsResult {
  added: EnrollmentDto[];
  alreadyEnrolled: string[];
  invited: string[];
  notFound: string[];
  skipped: { email: string; code: AddStudentsSkipCode | string }[];
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
  required: boolean;
  /** Set while the item is not open for this learner yet. */
  lock: LearnLock | null;
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
  progression: CourseProgression;
  requiredCount: number;
  completedRequiredCount: number;
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
  required: boolean;
}

export interface SessionQuestion {
  id: Uuid;
  type: QuestionType;
  prompt: string;
  points: number;
  media?: MediaDto | null;
  options: { id: Uuid; text: string }[];
  /** CLOZE, WORD_BANK: number of blanks. */
  blankCount?: number | null;
  /** MATCHING: the shuffled right-hand texts. */
  matchTargets?: { id: Uuid; text: string }[] | null;
  /** SPEAKING: longest recording in seconds. */
  maxRecordingSeconds?: number | null;
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
  savedAnswers?: SavedAnswer[];
}

export interface SubmitAnswer {
  questionId: Uuid;
  selectedOptionIds: Uuid[];
  textAnswer: string | null;
  blanks?: Record<string, string> | null;
  pairs?: Record<string, string> | null;
  order?: Uuid[] | null;
  /** SPEAKING: id of the learner's own audio upload. */
  responseMediaId?: Uuid | null;
}

/** An autosaved draft as returned when resuming an attempt. */
export interface SavedAnswer extends SubmitAnswer {
  responseMedia?: MediaDto | null;
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
  /** Instructor accounts waiting for approval. */
  pendingInstructors?: number;
}

export interface AdminUserUpdate {
  role: Role;
  enabled: boolean;
}

export interface AdminUsersQuery {
  q?: string;
  role?: Role;
  instructorStatus?: InstructorStatus;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------------------
// Release rules and cloning (Workstream A)
// ---------------------------------------------------------------------------
export type CourseProgression = "FREE" | "SEQUENTIAL_MODULES" | "SEQUENTIAL_ITEMS";
export type LockReason = "DATE" | "PREREQUISITE" | "SEQUENCE";

export interface PrerequisiteDto {
  itemId: Uuid;
  title: string;
  type: ItemType;
  minPercent: number | null;
}

export interface PrerequisiteRef {
  itemId: Uuid;
  minPercent?: number | null;
}

export interface ReleaseRulesRequest {
  /** Items only; modules ignore it. */
  required?: boolean;
  releaseOffsetDays: number | null;
  prerequisites: PrerequisiteRef[];
}

export interface CloneRequest {
  title: string;
  /** Moves all kept dates by this many days (may be negative). */
  shiftDays?: number | null;
  /** false removes all publication and assessment dates from the copy. */
  keepSchedule: boolean;
}

export interface DuplicateItemRequest {
  targetModuleId?: Uuid | null;
}

export interface LockPrerequisite {
  itemId: Uuid;
  title: string;
  minPercent: number | null;
}

export interface LearnLock {
  reason: LockReason;
  unlockAt: Instant | null;
  prerequisites: LockPrerequisite[];
}

// ===========================================================================
// Workstream C: flashcards, assignments, live sessions
// ===========================================================================

export type FlashcardArticle = "der" | "die" | "das";
export type FlashcardGrade = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface FlashcardDto {
  id: Uuid;
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string | null;
  example: string | null;
  audio: MediaDto | null;
  image: MediaDto | null;
  position: number;
}

export interface DeckDto {
  itemId: Uuid;
  cards: FlashcardDto[];
}

export interface FlashcardUpsert {
  id?: Uuid | null;
  front: string;
  back: string;
  article?: string | null;
  plural?: string | null;
  example?: string | null;
  audioMediaId?: Uuid | null;
  imageMediaId?: Uuid | null;
}

export interface CsvCardDto {
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string | null;
  example: string | null;
}

export interface CsvErrorDto {
  line: number;
  field: string;
  code: "REQUIRED" | "TOO_LONG" | "ARTICLE_INVALID" | string;
}

export interface FlashcardImportResult {
  rows: number;
  cards: CsvCardDto[];
  errors: CsvErrorDto[];
  committed: boolean;
  imported: number;
  totalCards: number;
}

export interface LearnerCardDto {
  id: Uuid;
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string | null;
  example: string | null;
  audio: MediaDto | null;
  image: MediaDto | null;
  reviewed: boolean;
  dueAt: Instant | null;
}

export interface LearnerDeckDto {
  itemId: Uuid;
  cards: LearnerCardDto[];
  dueCount: number;
  newCount: number;
}

export interface ReviewCardDto {
  id: Uuid;
  deckItemId: Uuid;
  deckTitle: string;
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string | null;
  example: string | null;
  audio: MediaDto | null;
  image: MediaDto | null;
  newCard: boolean;
  intervalDays: number;
}

export interface ReviewSessionDto {
  courseId: Uuid;
  cards: ReviewCardDto[];
  dueCount: number;
  newCount: number;
  newPerDay: number;
}

export interface ReviewResultDto {
  cardId: Uuid;
  dueAt: Instant;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
}

export interface CourseDueDto {
  courseId: Uuid;
  courseTitle: string;
  due: number;
  newCards: number;
}

export interface ReviewSummaryDto {
  dueToday: number;
  byCourse: CourseDueDto[];
}

// ---- assignments

export type SubmissionStatus = "SUBMITTED" | "RETURNED" | "GRADED";
export type SubmitBlockedReason = "UNDER_REVIEW" | "GRADED" | "MAX_SUBMISSIONS" | "CLOSED";

export interface AssignmentDto {
  itemId: Uuid;
  dueAt: Instant | null;
  allowLate: boolean;
  maxPoints: number;
  maxFiles: number;
  maxSubmissions: number;
  allowText: boolean;
}

export interface AssignmentUpsert {
  dueAt: Instant | null;
  allowLate: boolean;
  maxPoints: number;
  maxFiles: number;
  maxSubmissions: number;
  allowText: boolean;
}

export interface LearnerAssignmentDto extends AssignmentDto {
  submissionsUsed: number;
  overdue: boolean;
  canSubmit: boolean;
  submitBlocked: SubmitBlockedReason | null;
}

export interface SubmissionFileDto {
  media: MediaDto;
  feedbackFile: boolean;
}

export interface SubmissionDto {
  id: Uuid;
  itemId: Uuid;
  versionNo: number;
  status: SubmissionStatus;
  textAnswer: string | null;
  files: SubmissionFileDto[];
  submittedAt: Instant;
  late: boolean;
  points: number | null;
  maxPoints: number;
  feedback: string | null;
  gradedAt: Instant | null;
}

export interface SubmitRequest {
  textAnswer: string | null;
  mediaIds: Uuid[];
}

export interface SubmissionSummaryDto {
  id: Uuid;
  itemId: Uuid;
  itemTitle: string;
  courseId: Uuid;
  student: { id: Uuid; fullName: string; email: string; avatarUrl: string | null };
  versionNo: number;
  status: SubmissionStatus;
  late: boolean;
  submittedAt: Instant;
  points: number | null;
  maxPoints: number;
  fileCount: number;
  hasText: boolean;
}

export interface SubmissionDetailDto {
  summary: SubmissionSummaryDto;
  assignment: AssignmentDto;
  current: SubmissionDto;
  history: SubmissionDto[];
  latest: boolean;
}

export interface SubmissionReviewRequest {
  action: "RETURN" | "GRADE";
  points: number | null;
  feedback: string | null;
  feedbackMediaIds: Uuid[];
}

// ---- live sessions

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export interface LiveSessionUpsert {
  title: string;
  description: string | null;
  startsAt: Instant;
  durationMinutes: number;
  joinUrl: string | null;
  recordingUrl: string | null;
  cancelled: boolean;
}

export interface LiveSeriesRequest {
  title: string;
  description: string | null;
  firstStartsAt: Instant;
  weeks: number;
  durationMinutes: number;
  joinUrl: string | null;
}

export interface LiveSessionDto {
  id: Uuid;
  courseId: Uuid;
  seriesId: Uuid | null;
  title: string;
  description: string | null;
  startsAt: Instant;
  endsAt: Instant;
  durationMinutes: number;
  joinUrl: string | null;
  recordingUrl: string | null;
  cancelled: boolean;
  attendanceRecorded: number;
  presentCount: number;
  createdAt: Instant;
}

export interface AttendanceRow {
  student: { id: Uuid; fullName: string; email: string; avatarUrl: string | null };
  status: AttendanceStatus | null;
}

export interface AttendanceSheetDto {
  sessionId: Uuid;
  rows: AttendanceRow[];
}

export interface LearnerLiveSessionDto {
  id: Uuid;
  courseId: Uuid;
  courseTitle: string;
  title: string;
  description: string | null;
  startsAt: Instant;
  endsAt: Instant;
  durationMinutes: number;
  cancelled: boolean;
  joinUrl: string | null;
  joinOpensAt: Instant;
  recordingUrl: string | null;
  myAttendance: AttendanceStatus | null;
}

export interface CalendarTokenDto {
  token: string;
  url: string;
}
