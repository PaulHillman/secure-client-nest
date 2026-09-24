export function safeStorageFileName(fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");

  return safe || "file";
}

export function archiveObjectPath(
  archiveId: string,
  kind: "file-versions" | "group-norms",
  id: string,
  sourcePath: string,
): string {
  const sourceName = sourcePath.split("/").pop() ?? "file";
  const extension = sourceName.match(/\.[A-Za-z0-9]{1,12}$/)?.[0] ?? "";
  return `archive/${archiveId}/${kind}/${id}${extension.toLowerCase()}`;
}