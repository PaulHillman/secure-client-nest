import { researchCoverage } from "./health-review-comparison";
import { MINUTES_TEMPLATE_MIN_MARKERS, minutesFollowTemplate } from "./minutes-template";

/** Downloads one vault file version and extracts its text (null when unreadable). */
async function readVaultText(db: any, file: { file_name: string; current_version_id: string | null }): Promise<string | null> {
  let text: string | null = null;
  try {
    if (!file.current_version_id) throw new Error("No current version");
    const { data: version, error } = await db.from("file_versions").select("storage_path, file_size").eq("id", file.current_version_id).single();
    if (error || !version || version.file_size > 10_000_000) throw new Error("Unavailable or too large");
    const { data: blob, error: downloadError } = await db.storage.from("vault").download(version.storage_path);
    if (downloadError || !blob) throw new Error("Unavailable");
    const bytes = await blob.arrayBuffer();
    if (/\.pdf$/i.test(file.file_name)) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(bytes), { mergePages: true }); text = result.text;
    } else if (/\.docx$/i.test(file.file_name)) {
      const mammoth = await import("mammoth/mammoth.browser");
      text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
    } else if (/\.(txt|md|csv)$/i.test(file.file_name)) text = new TextDecoder().decode(bytes);
    if (!text?.trim()) text = null;
  } catch { text = null; }
  return text;
}

export async function inspectResearch(db: any, files: { file_name: string; current_version_id: string | null }[]) {
 const documents: { fileName: string; text: string | null }[] = [];
 for (const file of files) {
  documents.push({ fileName: file.file_name, text: await readVaultText(db, file) });
 }
 return { topics: researchCoverage(documents), unreadable: documents.filter(d => !d.text).map(d => d.fileName), inspected: documents.filter(d => d.text).map(d => d.fileName) };
}

/**
 * Checks whether team minutes follow the shared Meeting Minutes Template.
 * Unreadable files (e.g. .pages) are reported as unverified, never as violations.
 */
export async function inspectMinutesTemplate(
  db: any,
  files: { file_name: string; current_version_id: string | null }[],
  template: { file_name: string; current_version_id: string | null } | null,
  textCache?: Map<string, string | null>,
  minMarkers: number = MINUTES_TEMPLATE_MIN_MARKERS,
) {
  const cache = textCache ?? new Map<string, string | null>();
  const textOf = async (file: { file_name: string; current_version_id: string | null }) => {
    const key = file.current_version_id ?? file.file_name;
    if (!cache.has(key)) cache.set(key, await readVaultText(db, file));
    return cache.get(key)!;
  };
  const templateText = template ? await textOf(template) : null;
  const results: { fileName: string; follows: boolean | null }[] = [];
  for (const file of files) {
    const text = await textOf(file);
    // The template itself, or unreadable files, stay unverified rather than violations.
    if (!text || (templateText && minutesFollowTemplate(templateText, minMarkers) === false)) {
      results.push({ fileName: file.file_name, follows: null });
    } else {
      results.push({ fileName: file.file_name, follows: minutesFollowTemplate(text, minMarkers) });
    }
  }
  return {
    results,
    unverified: results.filter(r => r.follows === null).map(r => r.fileName),
    violations: results.filter(r => r.follows === false).map(r => r.fileName),
    compliant: results.filter(r => r.follows === true).map(r => r.fileName),
  };
}
