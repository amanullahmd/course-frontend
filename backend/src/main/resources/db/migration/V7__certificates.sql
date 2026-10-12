-- Course completion certificates. Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

-- One row per course (created on the first save of the instructor's settings; missing row = defaults, disabled).
create table certificate_settings (
    course_id                    uuid primary key references courses (id) on delete cascade,
    enabled                      boolean      not null default false,
    min_progress_percent         integer      not null default 100,
    require_assessments_passed   boolean      not null default true,
    min_average_score            integer,
    show_score                   boolean      not null default true,
    title                        varchar(80),
    cefr_level                   varchar(2),
    signer_name                  varchar(120),
    signer_title                 varchar(80),
    signature_image_id           uuid references media_assets (id) on delete set null,
    organization                 varchar(120),
    custom_text                  varchar(400),
    cert_language                varchar(10)  not null default 'LEARNER',
    updated_at                   timestamp with time zone not null,
    constraint ck_certificate_settings_language check (cert_language in ('LEARNER', 'EN', 'DE')),
    constraint ck_certificate_settings_progress check (min_progress_percent between 0 and 100),
    constraint ck_certificate_settings_score check (min_average_score is null or min_average_score between 0 and 100)
);

-- Issued certificates with snapshots of the names at issue time.
-- active_student_id equals student_id while the certificate is valid and is cleared on revocation, so the unique
-- constraint (course_id, active_student_id) allows exactly one active certificate per learner and course while
-- keeping revoked ones as history (NULLs never collide, in PostgreSQL and H2 alike).
create table certificates (
    id                 uuid primary key,
    code               varchar(32)  not null,
    course_id          uuid         not null references courses (id) on delete cascade,
    student_id         uuid         not null references users (id) on delete cascade,
    active_student_id  uuid,
    learner_name       varchar(120) not null,
    course_title       varchar(200) not null,
    cefr_level         varchar(2)   not null,
    instructor_name    varchar(120) not null,
    signer_title       varchar(80),
    organization       varchar(120),
    title              varchar(80),
    completed_at       timestamp with time zone not null,
    final_score        double precision,
    issue_type         varchar(20)  not null,
    issued_by          uuid references users (id) on delete set null,
    issued_at          timestamp with time zone not null,
    revoked_at         timestamp with time zone,
    revoked_reason     varchar(500),
    revoked_by         uuid references users (id) on delete set null,
    constraint uk_certificates_code unique (code),
    constraint uk_certificates_active unique (course_id, active_student_id),
    constraint ck_certificates_issue_type check (issue_type in ('AUTOMATIC', 'MANUAL'))
);
create index ix_certificates_course on certificates (course_id, issued_at);
create index ix_certificates_student on certificates (student_id, issued_at);
