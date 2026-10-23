type UploadFile = {
  id: string;
  section: string;
  subsection: string;
  assigned_to: string | null;
  uploaded_by: string;
};

type UploadVersion = {
  id: string;
  file_id: string;
  uploaded_at: string;
  version_number: number;
};

/** Keep originals and revisions adjacent under the member's identity. */
export function groupPeerUploads<T extends UploadFile & { created_at: string }>(files: T[]) {
  const groups = new Map<string, T[]>();
  for (const file of files) {
    const owner = file.assigned_to ?? file.uploaded_by;
    const group = groups.get(owner) ?? [];
    group.push(file);
    groups.set(owner, group);
  }
  return Array.from(groups, ([owner, uploads]) => ({
    owner,
    files: uploads.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
  }));
}

/** Count peer-review uploads across separate file rows, never from filenames. */
export function peerUploadSequence(files: UploadFile[], versions: UploadVersion[]) {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const groups = new Map<string, UploadVersion[]>();
  for (const version of versions) {
    const file = fileById.get(version.file_id);
    if (!file || file.subsection !== "Mid-Semester Peer Reviews") continue;
    const owner = file.assigned_to ?? file.uploaded_by;
    const group = groups.get(owner) ?? [];
    group.push(version);
    groups.set(owner, group);
  }
  const result = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at) ||
      a.version_number - b.version_number || a.id.localeCompare(b.id));
    group.forEach((version, index) => result.set(version.id, index + 1));
  }
  return result;
}