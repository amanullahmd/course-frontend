-- Sprachweg initial schema. Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

create table users (
    id              uuid primary key,
    full_name       varchar(120)  not null,
    email           varchar(255)  not null,
    password_hash   varchar(100)  not null,
    role            varchar(20)   not null,
    email_verified  boolean       not null default false,
    enabled         boolean       not null default true,
    bio             varchar(2000),
    avatar_id       uuid,
    created_at      timestamp with time zone not null,
    updated_at      timestamp with time zone not null,
    constraint uk_users_email unique (email),
    constraint ck_users_role check (role in ('STUDENT', 'INSTRUCTOR', 'ADMIN'))
);

create table media_assets (
    id             uuid primary key,
    owner_id       uuid          not null references users (id) on delete cascade,
    original_name  varchar(255)  not null,
    content_type   varchar(150)  not null,
    size_bytes     bigint        not null,
    kind           varchar(20)   not null,
    storage_key    varchar(255)  not null,
    created_at     timestamp with time zone not null,
    constraint uk_media_storage_key unique (storage_key)
);
create index ix_media_owner on media_assets (owner_id);

alter table users add constraint fk_users_avatar foreign key (avatar_id) references media_assets (id) on delete set null;

create table verification_tokens (
    id          uuid primary key,
    token       varchar(100) not null,
    user_id     uuid         not null references users (id) on delete cascade,
    type        varchar(20)  not null,
    expires_at  timestamp with time zone not null,
    used_at     timestamp with time zone,
    created_at  timestamp with time zone not null,
    constraint uk_verification_token unique (token)
);
create index ix_verification_tokens_user on verification_tokens (user_id, type);

create table refresh_tokens (
    id          uuid primary key,
    token_hash  varchar(64) not null,
    user_id     uuid        not null references users (id) on delete cascade,
    expires_at  timestamp with time zone not null,
    revoked_at  timestamp with time zone,
    created_at  timestamp with time zone not null,
    constraint uk_refresh_token_hash unique (token_hash)
);
create index ix_refresh_tokens_user on refresh_tokens (user_id);

create table courses (
    id               uuid primary key,
    slug             varchar(160)  not null,
    title            varchar(200)  not null,
    subtitle         varchar(300),
    description      varchar(1000000),
    cefr_level       varchar(2)    not null,
    cover_image_id   uuid references media_assets (id) on delete set null,
    instructor_id    uuid          not null references users (id) on delete cascade,
    enrollment_mode  varchar(20)   not null,
    capacity         integer,
    publish_status   varchar(20)   not null,
    publish_at       timestamp with time zone,
    unpublish_at     timestamp with time zone,
    published_at     timestamp with time zone,
    created_at       timestamp with time zone not null,
    updated_at       timestamp with time zone not null,
    constraint uk_courses_slug unique (slug)
);
create index ix_courses_instructor on courses (instructor_id);
create index ix_courses_publication on courses (publish_status, publish_at, unpublish_at);

create table course_tags (
    course_id   uuid        not null references courses (id) on delete cascade,
    sort_order  integer     not null,
    tag         varchar(50) not null,
    primary key (course_id, sort_order)
);

create table course_modules (
    id              uuid primary key,
    course_id       uuid          not null references courses (id) on delete cascade,
    title           varchar(200)  not null,
    description     varchar(5000),
    sort_order      integer       not null,
    publish_status  varchar(20)   not null,
    publish_at      timestamp with time zone,
    unpublish_at    timestamp with time zone,
    created_at      timestamp with time zone not null,
    updated_at      timestamp with time zone not null
);
create index ix_course_modules_course on course_modules (course_id, sort_order);

create table content_items (
    id                uuid primary key,
    module_id         uuid           not null references course_modules (id) on delete cascade,
    item_type         varchar(20)    not null,
    title             varchar(200)   not null,
    summary           varchar(1000),
    body              varchar(1000000),
    external_url      varchar(2000),
    duration_minutes  integer,
    sort_order        integer        not null,
    publish_status    varchar(20)    not null,
    publish_at        timestamp with time zone,
    unpublish_at      timestamp with time zone,
    created_at        timestamp with time zone not null,
    updated_at        timestamp with time zone not null
);
create index ix_content_items_module on content_items (module_id, sort_order);

create table content_item_attachments (
    item_id     uuid    not null references content_items (id) on delete cascade,
    sort_order  integer not null,
    media_id    uuid    not null references media_assets (id) on delete cascade,
    primary key (item_id, sort_order)
);
create index ix_item_attachments_media on content_item_attachments (media_id);

create table assessments (
    id                    uuid primary key,
    item_id               uuid    not null references content_items (id) on delete cascade,
    instructions          varchar(20000),
    time_limit_minutes    integer,
    max_attempts          integer not null default 0,
    passing_score         integer not null default 60,
    shuffle_questions     boolean not null default false,
    show_correct_answers  boolean not null default true,
    available_from        timestamp with time zone,
    available_until       timestamp with time zone,
    constraint uk_assessments_item unique (item_id)
);

create table questions (
    id              uuid primary key,
    assessment_id   uuid           not null references assessments (id) on delete cascade,
    question_type   varchar(20)    not null,
    prompt          varchar(20000) not null,
    explanation     varchar(20000),
    points          integer        not null,
    sort_order      integer        not null,
    case_sensitive  boolean        not null default false,
    media_id        uuid references media_assets (id) on delete set null
);
create index ix_questions_assessment on questions (assessment_id, sort_order);

create table question_accepted_answers (
    question_id  uuid         not null references questions (id) on delete cascade,
    sort_order   integer      not null,
    answer       varchar(500) not null,
    primary key (question_id, sort_order)
);

create table question_options (
    id           uuid primary key,
    question_id  uuid          not null references questions (id) on delete cascade,
    option_text  varchar(2000) not null,
    correct      boolean       not null default false,
    sort_order   integer       not null
);
create index ix_question_options_question on question_options (question_id, sort_order);

create table attempts (
    id             uuid primary key,
    assessment_id  uuid        not null references assessments (id) on delete cascade,
    student_id     uuid        not null references users (id) on delete cascade,
    status         varchar(20) not null,
    started_at     timestamp with time zone not null,
    deadline       timestamp with time zone,
    submitted_at   timestamp with time zone,
    score          double precision,
    max_score      double precision not null default 0,
    late           boolean     not null default false,
    version        bigint      not null default 0
);
create index ix_attempts_assessment_student on attempts (assessment_id, student_id);
create index ix_attempts_student on attempts (student_id);

create table attempt_answers (
    id              uuid primary key,
    attempt_id      uuid           not null references attempts (id) on delete cascade,
    question_id     uuid           not null,
    question_type   varchar(20)    not null,
    prompt          varchar(20000) not null,
    explanation     varchar(20000),
    points          integer        not null,
    sort_order      integer        not null,
    case_sensitive  boolean        not null default false,
    media_id        uuid references media_assets (id) on delete set null,
    text_answer     varchar(20000),
    correct         boolean,
    points_awarded  double precision,
    feedback        varchar(5000)
);
create index ix_attempt_answers_attempt on attempt_answers (attempt_id);

create table attempt_answer_options (
    answer_id    uuid          not null references attempt_answers (id) on delete cascade,
    sort_order   integer       not null,
    option_id    uuid          not null,
    option_text  varchar(2000) not null,
    correct      boolean       not null,
    primary key (answer_id, sort_order)
);

create table attempt_answer_accepted (
    answer_id   uuid         not null references attempt_answers (id) on delete cascade,
    sort_order  integer      not null,
    answer      varchar(500) not null,
    primary key (answer_id, sort_order)
);

create table attempt_answer_selections (
    answer_id  uuid not null references attempt_answers (id) on delete cascade,
    option_id  uuid not null,
    primary key (answer_id, option_id)
);

create table enrollments (
    id               uuid primary key,
    course_id        uuid        not null references courses (id) on delete cascade,
    student_id       uuid        not null references users (id) on delete cascade,
    status           varchar(20) not null,
    message          varchar(2000),
    decision_reason  varchar(2000),
    applied_at       timestamp with time zone not null,
    decided_at       timestamp with time zone,
    version          bigint      not null default 0,
    constraint uk_enrollments_course_student unique (course_id, student_id)
);
create index ix_enrollments_course_status on enrollments (course_id, status, applied_at);
create index ix_enrollments_student on enrollments (student_id);

create table item_progress (
    id            uuid primary key,
    student_id    uuid not null references users (id) on delete cascade,
    item_id       uuid not null references content_items (id) on delete cascade,
    completed_at  timestamp with time zone not null,
    constraint uk_item_progress unique (student_id, item_id)
);
create index ix_item_progress_item on item_progress (item_id);

create table notifications (
    id          uuid primary key,
    user_id     uuid          not null references users (id) on delete cascade,
    type        varchar(50)   not null,
    title       varchar(200)  not null,
    body        varchar(2000),
    link        varchar(500),
    read_at     timestamp with time zone,
    created_at  timestamp with time zone not null
);
create index ix_notifications_user_created on notifications (user_id, created_at);
