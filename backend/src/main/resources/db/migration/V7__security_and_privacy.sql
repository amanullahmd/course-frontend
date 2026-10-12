-- Security & privacy (P0-5 / P0-6). Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

-- Instructor approval: PENDING | APPROVED | REJECTED for INSTRUCTOR accounts, null for students and admins.
-- Instructors that exist before this migration keep working: they are APPROVED.
alter table users add column instructor_status varchar(20);
update users set instructor_status = 'APPROVED' where role = 'INSTRUCTOR';
alter table users add constraint ck_users_instructor_status
    check (instructor_status is null or instructor_status in ('PENDING', 'APPROVED', 'REJECTED'));
create index ix_users_instructor_status on users (instructor_status);

-- When the user accepted the terms of use and acknowledged the privacy policy (registration checkbox).
alter table users add column terms_accepted_at timestamp with time zone;

-- Accounts are never hard-deleted: "delete my account" anonymises the row and sets deleted_at.
alter table users add column deleted_at timestamp with time zone;

-- Safeguard against cascading deletes: V1 created courses.instructor_id with "on delete cascade", so deleting an
-- instructor row would silently delete their courses and every learner's enrollments, attempts and progress.
-- Replace it with "on delete restrict". The V1 constraint is unnamed; PostgreSQL names it courses_instructor_id_fkey
-- (dropped here). H2 generates another name, so on H2 (dev/test only) the drop is a no-op and the original cascade
-- remains alongside the new constraint. The application never deletes users (UserRepository refuses deletes).
alter table courses drop constraint if exists courses_instructor_id_fkey;
alter table courses add constraint fk_courses_instructor_restrict
    foreign key (instructor_id) references users (id) on delete restrict;

-- ShedLock (https://github.com/lukas-krecan/ShedLock): at most one instance runs each @SchedulerLock job at a time.
create table shedlock (
    name        varchar(64)  not null,
    lock_until  timestamp    not null,
    locked_at   timestamp    not null,
    locked_by   varchar(255) not null,
    constraint pk_shedlock primary key (name)
);
