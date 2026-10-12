-- Practice and teaching loop (workstream C): vocabulary flashcards with spaced repetition, assignments with file
-- submissions, live sessions with attendance and an iCal feed. Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

-- ---------------------------------------------------------------- flashcards (a FLASHCARDS item is a deck)
create table flashcards (
    id              uuid primary key,
    item_id         uuid          not null references content_items (id) on delete cascade,
    front           varchar(500)  not null,
    back            varchar(500)  not null,
    article         varchar(3),
    plural          varchar(200),
    example         varchar(1000),
    audio_media_id  uuid references media_assets (id) on delete set null,
    image_media_id  uuid references media_assets (id) on delete set null,
    sort_order      integer       not null,
    constraint ck_flashcards_article check (article is null or article in ('der', 'die', 'das'))
);
create index ix_flashcards_item on flashcards (item_id, sort_order);

-- SM-2 state per learner and card; a row exists once the learner has reviewed the card for the first time.
create table flashcard_reviews (
    id                 uuid primary key,
    card_id            uuid not null references flashcards (id) on delete cascade,
    student_id         uuid not null references users (id) on delete cascade,
    repetitions        integer          not null default 0,
    interval_days      integer          not null default 0,
    ease               double precision not null default 2.5,
    lapses             integer          not null default 0,
    due_at             timestamp with time zone not null,
    first_reviewed_at  timestamp with time zone not null,
    last_reviewed_at   timestamp with time zone,
    constraint uk_flashcard_review unique (card_id, student_id)
);
create index ix_flashcard_reviews_due on flashcard_reviews (student_id, due_at);

-- ---------------------------------------------------------------- assignments
create table assignments (
    id               uuid primary key,
    item_id          uuid    not null references content_items (id) on delete cascade,
    due_at           timestamp with time zone,
    allow_late       boolean not null default true,
    max_points       integer not null default 10,
    max_files        integer not null default 3,
    max_submissions  integer not null default 3,
    allow_text       boolean not null default true,
    constraint uk_assignments_item unique (item_id)
);

create table assignment_submissions (
    id             uuid primary key,
    assignment_id  uuid        not null references assignments (id) on delete cascade,
    student_id     uuid        not null references users (id) on delete cascade,
    version_no     integer     not null,
    text_answer    varchar(20000),
    status         varchar(20) not null,               -- SUBMITTED | RETURNED | GRADED
    submitted_at   timestamp with time zone not null,
    late           boolean     not null default false,
    points         double precision,
    feedback       varchar(20000),
    graded_by      uuid references users (id) on delete set null,
    graded_at      timestamp with time zone,
    version        bigint      not null default 0,
    constraint uk_submission_version unique (assignment_id, student_id, version_no),
    constraint ck_submission_status check (status in ('SUBMITTED', 'RETURNED', 'GRADED'))
);
create index ix_submissions_assignment_status on assignment_submissions (assignment_id, status);
create index ix_submissions_student on assignment_submissions (student_id);

create table assignment_submission_files (
    submission_id  uuid    not null references assignment_submissions (id) on delete cascade,
    sort_order     integer not null,
    media_id       uuid    not null references media_assets (id) on delete cascade,
    feedback_file  boolean not null default false,
    primary key (submission_id, sort_order)
);
create index ix_submission_files_media on assignment_submission_files (media_id);

-- ---------------------------------------------------------------- live sessions
create table live_sessions (
    id                uuid primary key,
    course_id         uuid          not null references courses (id) on delete cascade,
    series_id         uuid,
    title             varchar(200)  not null,
    description       varchar(5000),
    starts_at         timestamp with time zone not null,
    duration_minutes  integer       not null,
    join_url          varchar(2000),
    recording_url     varchar(2000),
    cancelled         boolean       not null default false,
    reminder_sent_at  timestamp with time zone,
    created_at        timestamp with time zone not null,
    updated_at        timestamp with time zone not null
);
create index ix_live_sessions_course_start on live_sessions (course_id, starts_at);
create index ix_live_sessions_start on live_sessions (starts_at);

create table live_attendance (
    session_id  uuid        not null references live_sessions (id) on delete cascade,
    student_id  uuid        not null references users (id) on delete cascade,
    status      varchar(10) not null,                   -- PRESENT | LATE | ABSENT | EXCUSED
    primary key (session_id, student_id),
    constraint ck_live_attendance_status check (status in ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED'))
);

-- Secret of the per-user iCal feed (GET /api/calendar/{token}.ics); rotatable.
alter table users add column calendar_token varchar(64);
create unique index uk_users_calendar_token on users (calendar_token);
