import { researchCoverage } from "./health-review-comparison";
import { MINUTES_TEMPLATE_MIN_MARKERS, minutesFollowTemplate } from "./minutes-template";
import { OPERATIONAL_DEFAULTS } from './review-rulebook';

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
    // Vault display names can omit the extension; the retained upload path identifies the format.
    const formatName = version.storage_path.split('/').pop() ?? file.file_name;
    if (/\.pdf$/i.test(formatName)) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(bytes), { mergePages: true }); text = result.text;
    } else if (/\.docx$/i.test(formatName)) {
      const mammoth = await import("mammoth/mammoth.browser");
      text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
    } else if (/\.(txt|md|csv)$/i.test(formatName)) text = new TextDecoder().decode(bytes);
    if (!text?.trim()) text = null;
  } catch { text = null; }
  return text;
}

export async function inspectResearch(db: any, files: { file_name: string; current_version_id: string | null }[], topics = OPERATIONAL_DEFAULTS.research_topics, confirmations: { file_name: string; note: string | null }[] = []) {
 const documents: { fileName: string; text: string | null }[] = [];
 for (const file of files) {
  documents.push({ fileName: file.file_name, text: await readVaultText(db, file) });
 }
 const coverage = researchCoverage(documents, topics);
 for (const record of confirmations) {
  if (!record.note?.startsWith('health_research_evidence:')) continue;
  try {
   const decision = JSON.parse(record.note.slice('health_research_evidence:'.length));
   const file = files.find(f => f.file_name === record.file_name && f.current_version_id === decision.versionId);
   const text = file ? documents.find(d => d.fileName === file.file_name)?.text : null;
   if (!text || !Array.isArray(decision.topics)) continue;
   for (const item of decision.topics) {
    const topic = coverage.find(t => t.topic === item.topic);
    if (topic && typeof item.excerpt === 'string' && item.excerpt.trim().length >= 30 && text.replace(/\s+/g, ' ').includes(item.excerpt) && !topic.evidence.some(e => e.fileName === record.file_name)) {
     topic.evidence.push({ fileName: record.file_name, excerpt: item.excerpt });
    }
   }
  } catch { /* Invalid or outdated evidence never establishes coverage. */ }
 }
 return { topics: coverage, unreadable: documents.filter(d => !d.text).map(d => d.fileName), inspected: documents.filter(d => d.text).map(d => d.fileName) };
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
  markers: readonly string[] = OPERATIONAL_DEFAULTS.minutes_markers,
) {
  const cache = textCache ?? new Map<string, string | null>();
  const textOf = async (file: { file_name: string; current_version_id: string | null }) => {
    const key = file.current_version_id ?? file.file_name;
    if (!cache.has(key)) cache.set(key, await readVaultText(db, file));
    return cache.get(key) ?? null;
  };
  const templateText = template ? await textOf(template) : null;
  const results: { fileName: string; follows: boolean | null }[] = [];
  for (const file of files) {
    const text = await textOf(file);
    // The template itself, or unreadable files, stay unverified rather than violations.
    if (!text || (templateText && minutesFollowTemplate(templateText, minMarkers, markers) === false)) {
      results.push({ fileName: file.file_name, follows: null });
    } else {
      results.push({ fileName: file.file_name, follows: minutesFollowTemplate(text, minMarkers, markers) });
    }
  }
  return {
    results,
    unverified: results.filter(r => r.follows === null).map(r => r.fileName),
    violations: results.filter(r => r.follows === false).map(r => r.fileName),
    compliant: results.filter(r => r.follows === true).map(r => r.fileName),
  };
}
