-- Shifokor top: runs the Telegram bot every minute (long polling, no webhook).
-- The key below is the project's public anon key (the same one the site uses), not a secret.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'telegram-bot-poll';
select cron.schedule('telegram-bot-poll', '* * * * *', $job$
  select net.http_post(
    url := 'https://mkfdcvmbglmbzrcrmtdk.supabase.co/functions/v1/telegram-bot?poll=1',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZmRjdm1iZ2xtYnpyY3JtdGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMzU1ODksImV4cCI6MjEwODkxMTU4OX0.Edi18KpSfCGORa_VsspXk5-OXTL6Kan0pXML603mqQI'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);

-- check:  select jobid, jobname, schedule, active from cron.job;
-- recent calls:  select status_code, left(content::text, 80), created from net._http_response order by id desc limit 5;
