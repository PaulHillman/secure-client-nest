export const CONFIRMATION_PREFIX = 'health_confirmed:';
export function confirmedHealthFiles(teamId: string, rule: string, files: { file_name: string; current_version_id: string | null }[], records: { team_id: string; file_name: string; note: string | null }[]) {
  return records.flatMap(record => {
    if (record.team_id !== teamId || !record.note?.startsWith(CONFIRMATION_PREFIX)) return [];
    try {
      const decision = JSON.parse(record.note.slice(CONFIRMATION_PREFIX.length));
      return decision.rule === rule && typeof decision.versionId === 'string' && files.some(file => file.file_name === record.file_name && file.current_version_id === decision.versionId) ? [record.file_name] : [];
    } catch { return []; }
  });
}