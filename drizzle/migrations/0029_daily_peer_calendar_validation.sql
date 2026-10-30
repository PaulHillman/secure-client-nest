CREATE TABLE public.peer_calendar_dispatch (id boolean PRIMARY KEY DEFAULT true CHECK (id), token uuid, expires_at timestamptz);
GRANT ALL ON public.peer_calendar_dispatch TO service_role;
ALTER TABLE public.peer_calendar_dispatch ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dispatch_peer_calendar_validation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nonce uuid := gen_random_uuid(); next_run timestamptz; utc_hour integer; job bigint;
BEGIN
 next_run := (((now() AT TIME ZONE 'America/Detroit')::date + 1) + time '01:00') AT TIME ZONE 'America/Detroit';
 utc_hour := extract(hour FROM next_run AT TIME ZONE 'UTC');
 SELECT jobid INTO job FROM cron.job WHERE jobname='peer-calendar-daily-validation';
 IF job IS NOT NULL THEN PERFORM cron.alter_job(job, schedule := '0 ' || utc_hour || ' * * *'); END IF;
 INSERT INTO public.peer_calendar_dispatch(id,token,expires_at) VALUES (true,nonce,now()+interval '15 minutes') ON CONFLICT (id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at;
 PERFORM net.http_post(url := 'https://project--4d5f6371-69a5-440b-9522-336527351ce5.lovable.app/api/public/hooks/peer-calendar-validation', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || nonce::text), body := '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_peer_calendar_validation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_peer_calendar_validation() TO service_role;
CREATE OR REPLACE FUNCTION public.audit_peer_calendar_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_data jsonb; after_data jsonb; label text; person_name text;
BEGIN
 IF TG_OP='UPDATE' AND OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at AND OLD.zoom_url IS NOT DISTINCT FROM NEW.zoom_url AND OLD.booking_topic IS NOT DISTINCT FROM NEW.booking_topic THEN RETURN NEW; END IF;
 before_data := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 after_data := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 SELECT name INTO person_name FROM public.profiles WHERE id=coalesce((after_data->>'student_id')::uuid,(before_data->>'student_id')::uuid);
 label := CASE TG_OP WHEN 'INSERT' THEN 'Booking added' WHEN 'DELETE' THEN 'Booking canceled / removed' ELSE 'Booking changed' END;
 INSERT INTO public.admin_audit_log(actor_id,action,archive_name,details) VALUES(auth.uid(),'peer_calendar_change',coalesce(person_name,'Student meeting'),jsonb_build_object('change',label,'before',before_data,'after',after_data));
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_peer_calendar_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER peer_calendar_change_audit AFTER INSERT OR UPDATE OR DELETE ON public.peer_review_meetings FOR EACH ROW EXECUTE FUNCTION public.audit_peer_calendar_change();