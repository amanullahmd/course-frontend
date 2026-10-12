-- Preferred language of a user ("en" or "de"); used for e-mails and in-app notifications.
alter table users add column locale varchar(5) default 'en' not null;
