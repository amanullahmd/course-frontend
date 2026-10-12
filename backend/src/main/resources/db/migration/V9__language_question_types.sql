-- Language exercises: CLOZE, WORD_BANK, MATCHING, ORDERING, DICTATION and SPEAKING questions, partial credit,
-- option shuffling and spoken answers (recordings are ordinary media assets owned by the learner).
-- question_type stays varchar(20) without a check constraint, so the new type names need no change there.

alter table questions add column scoring varchar(20) default 'ALL_OR_NOTHING' not null;
alter table questions add column shuffle_options boolean default false not null;
alter table questions add column lenient_spelling boolean default false not null;
alter table questions add column max_recording_seconds integer;

alter table question_options add column match_text varchar(2000);
alter table question_options add column blank_index integer;

-- accepted answers per blank (CLOZE); 0 = the single answer list of SHORT_ANSWER, FILL_BLANK and DICTATION
alter table question_accepted_answers add column blank_index integer default 0 not null;

-- snapshots on the attempt, so edits of the question never change attempts that already started
alter table attempt_answers add column scoring varchar(20) default 'ALL_OR_NOTHING' not null;
alter table attempt_answers add column shuffle_options boolean default false not null;
alter table attempt_answers add column lenient_spelling boolean default false not null;
alter table attempt_answers add column max_recording_seconds integer;
alter table attempt_answers add column response_json varchar(20000);
alter table attempt_answers add column response_media_id uuid references media_assets (id) on delete set null;
create index ix_attempt_answers_response_media on attempt_answers (response_media_id);

alter table attempt_answer_options add column match_text varchar(2000);
alter table attempt_answer_options add column blank_index integer;
alter table attempt_answer_accepted add column blank_index integer default 0 not null;
