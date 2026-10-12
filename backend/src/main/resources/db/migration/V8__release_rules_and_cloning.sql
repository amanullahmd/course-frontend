-- Workstream A: dynamic course structure (release rules, prerequisites, required/optional items, course cloning).
-- Portable between PostgreSQL 17 and H2 (MODE=PostgreSQL).

-- Course progression: FREE | SEQUENTIAL_MODULES | SEQUENTIAL_ITEMS.
alter table courses add column progression varchar(20) default 'FREE' not null;
alter table courses add constraint ck_courses_progression
    check (progression in ('FREE', 'SEQUENTIAL_MODULES', 'SEQUENTIAL_ITEMS'));

-- Provenance of a cloned course; the link is dropped when the original is deleted.
alter table courses add column cloned_from_id uuid references courses (id) on delete set null;

-- Drip: the module/item opens N days after the learner's enrollment was approved (null = no drip).
alter table course_modules add column release_offset_days integer;
alter table content_items add column release_offset_days integer;

-- Optional items do not count towards progress, certificates or sequential gates.
alter table content_items add column required boolean default true not null;

-- Explicit prerequisites. target_id is polymorphic (module or item), so rows are removed by the application when the
-- target (or its course) is deleted. Rows disappear automatically when the required item is deleted.
create table release_prerequisites (
    id               uuid        primary key,
    target_type      varchar(10) not null,
    target_id        uuid        not null,
    requires_item_id uuid        not null references content_items (id) on delete cascade,
    min_percent      integer,
    constraint ck_release_prereq_target check (target_type in ('MODULE', 'ITEM')),
    constraint ck_release_prereq_percent check (min_percent is null or (min_percent >= 0 and min_percent <= 100)),
    constraint uk_release_prereq unique (target_type, target_id, requires_item_id)
);
create index ix_release_prereq_target on release_prerequisites (target_type, target_id);
create index ix_release_prereq_requires on release_prerequisites (requires_item_id);
