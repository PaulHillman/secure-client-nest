SELECT cron.schedule(
  'weekly-vault-digest',
  '0 13 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://project--4d5f6371-69a5-440b-9522-336527351ce5.lovable.app/api/public/hooks/weekly-digest',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_9W2IccpiL6dsmFReXar2kg_LG1Zeb04"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);