import { researchCoverage } from "./health-review-comparison";
export async function inspectResearch(db: any, files: { file_name: string; current_version_id: string | null }[]) {
 const documents: { fileName: string; text: string | null }[] = [];
 for (const file of files) {
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
  documents.push({ fileName: file.file_name, text });
 }
 return { topics: researchCoverage(documents), unreadable: documents.filter(d => !d.text).map(d => d.fileName), inspected: documents.filter(d => d.text).map(d => d.fileName) };
}
