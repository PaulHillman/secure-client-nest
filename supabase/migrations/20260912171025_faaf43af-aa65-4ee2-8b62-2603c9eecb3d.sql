UPDATE public.proof_materials
SET audio_path = 'course/pm_voicemail/Professor_Hillman_Seedman_50_Percent_Faster.mp3',
    ready = true,
    updated_at = now()
WHERE proof_key = 'pm_voicemail';