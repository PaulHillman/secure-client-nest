export const REJECTED_MINUTES_PREFIX = 'minutes_template_rejected:';

type File = { file_name: string; current_version_id: string | null };
type Verification = { team_id: string; file_name: string; note: string | null };

/** Negative instructor decisions apply only to the exact reviewed version. */
export function rejectedMinutes(teamId: string, files: File[], verifications: Verification[]) {
  return verifications.flatMap(v => {
    if (v.team_id !== teamId || !v.note?.startsWith(REJECTED_MINUTES_PREFIX)) return [];
    try {
      const decision = JSON.parse(v.note.slice(REJECTED_MINUTES_PREFIX.length));
      const file = files.find(f => f.file_name === v.file_name && f.current_version_id === decision.versionId);
      return file && typeof decision.versionId === 'string' && typeof decision.message === 'string'
        ? [{ fileName: file.file_name, message: decision.message }] : [];
    } catch { return []; }
  });
}