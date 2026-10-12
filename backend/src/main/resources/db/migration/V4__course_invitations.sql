-- Invitations e-mailed by instructors to people without an account ("Add learners" → invite).
-- Used to send at most one invitation per course and e-mail address within 24 hours.
create table course_invitations (
    id          uuid primary key,
    course_id   uuid         not null references courses (id) on delete cascade,
    email       varchar(255) not null,
    invited_by  uuid         references users (id) on delete set null,
    created_at  timestamp with time zone not null
);
create index ix_course_invitations_course_email on course_invitations (course_id, email, created_at);
