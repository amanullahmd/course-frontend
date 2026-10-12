-- Exam timing: attempts that run out of time (or whose assessment window closes) are submitted automatically
-- with the answers saved so far (server-side autosave stores draft answers on attempt_answers).
alter table attempts add column auto_submitted boolean default false not null;

-- The expiry sweeper looks for in-progress attempts by deadline.
create index ix_attempts_status_deadline on attempts (status, deadline);
-- ... and for in-progress attempts of assessments whose window has closed.
create index ix_assessments_available_until on assessments (available_until);
