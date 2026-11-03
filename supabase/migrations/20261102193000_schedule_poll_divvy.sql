-- Migration 4: schedule the worker.
-- Every 30 seconds is about 86,000 calls a month, under the free plan's 500,000.
-- Do not make this faster without checking the quota (docs: AGENTS.md).

select cron.schedule(
  'poll-divvy',
  '30 seconds',
  $$
  select net.http_post(
    url := 'https://bprhbrerrutlmgddwewb.supabase.co/functions/v1/poll-divvy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Keep worker_runs small: the page only needs recent runs.
select cron.schedule(
  'prune-worker-runs',
  '17 3 * * *',
  $$ delete from public.worker_runs where started_at < now() - interval '3 days'; $$
);
