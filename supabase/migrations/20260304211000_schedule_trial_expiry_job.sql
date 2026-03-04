-- Schedule automatic trial expiry once per day.
-- Safe behavior:
-- - Uses pg_cron when available.
-- - Recreates the named job idempotently.

do $$
declare
  v_existing_job_id bigint;
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'pg_cron'
  ) and to_regnamespace('cron') is not null then
    select j.jobid
    into v_existing_job_id
    from cron.job j
    where j.jobname = 'expire-employer-trials-daily'
    limit 1;

    if v_existing_job_id is not null then
      perform cron.unschedule(v_existing_job_id);
    end if;

    perform cron.schedule(
      'expire-employer-trials-daily',
      '15 0 * * *',
      $cron$select public.expire_elapsed_employer_trials();$cron$
    );
  end if;
end;
$$;
