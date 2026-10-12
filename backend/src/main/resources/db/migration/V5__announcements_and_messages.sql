-- Course announcements (instructor → learners) and direct messages (instructor ↔ learner).
-- Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

create table announcements (
    id            uuid primary key,
    course_id     uuid           not null references courses (id) on delete cascade,
    author_id     uuid           not null references users (id) on delete cascade,
    title         varchar(200)   not null,
    body          varchar(20000) not null,
    audience      varchar(20)    not null,
    send_email    boolean        not null default false,
    pinned        boolean        not null default false,
    status        varchar(20)    not null,
    scheduled_at  timestamp with time zone,
    sent_at       timestamp with time zone,
    created_at    timestamp with time zone not null,
    updated_at    timestamp with time zone not null,
    version       bigint         not null default 0,
    constraint ck_announcements_audience check (audience in ('ALL_APPROVED', 'SELECTED')),
    constraint ck_announcements_status check (status in ('DRAFT', 'SCHEDULED', 'SENT'))
);
create index ix_announcements_course on announcements (course_id, status);
create index ix_announcements_due on announcements (status, scheduled_at);

-- Learners chosen for audience SELECTED (resolved and validated again when the announcement is sent).
create table announcement_selected_users (
    announcement_id  uuid not null references announcements (id) on delete cascade,
    user_id          uuid not null references users (id) on delete cascade,
    primary key (announcement_id, user_id)
);

-- Who actually received a sent announcement, with read tracking.
create table announcement_recipients (
    id               uuid primary key,
    announcement_id  uuid not null references announcements (id) on delete cascade,
    user_id          uuid not null references users (id) on delete cascade,
    read_at          timestamp with time zone,
    emailed_at       timestamp with time zone,
    created_at       timestamp with time zone not null,
    constraint uk_announcement_recipients unique (announcement_id, user_id)
);
create index ix_announcement_recipients_user on announcement_recipients (user_id, read_at);

-- One conversation per (course or "general") and pair of users. participant_a_id < participant_b_id (canonical
-- order); pair_key = '<courseId|general>:<a>:<b>' keeps the pair unique even when course_id is null (or is set to
-- null because the course was deleted).
create table conversations (
    id                         uuid primary key,
    pair_key                   varchar(120) not null,
    course_id                  uuid references courses (id) on delete set null,
    participant_a_id           uuid         not null references users (id) on delete cascade,
    participant_b_id           uuid         not null references users (id) on delete cascade,
    a_last_read_at             timestamp with time zone,
    b_last_read_at             timestamp with time zone,
    a_mail_pending_since       timestamp with time zone,
    b_mail_pending_since       timestamp with time zone,
    a_last_emailed_at          timestamp with time zone,
    b_last_emailed_at          timestamp with time zone,
    last_message_at            timestamp with time zone,
    last_message_preview       varchar(200),
    last_message_sender_id     uuid,
    created_at                 timestamp with time zone not null,
    version                    bigint       not null default 0,
    constraint uk_conversations_pair unique (pair_key)
);
create index ix_conversations_a on conversations (participant_a_id, last_message_at);
create index ix_conversations_b on conversations (participant_b_id, last_message_at);
create index ix_conversations_mail_a on conversations (a_mail_pending_since);
create index ix_conversations_mail_b on conversations (b_mail_pending_since);

create table messages (
    id               uuid primary key,
    conversation_id  uuid          not null references conversations (id) on delete cascade,
    sender_id        uuid          not null references users (id) on delete cascade,
    body             varchar(5000) not null,
    created_at       timestamp with time zone not null
);
create index ix_messages_conversation_created on messages (conversation_id, created_at, id);
