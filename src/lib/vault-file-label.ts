export function finalCompiledName(name: string): string {
  const clean = name.trim();
  return /compiled|final/i.test(clean) ? clean : `Final Compiled - ${clean}`;
}

export function isFinalCompiled(file: { file_name: string; assigned_to: string | null }): boolean {
  return !file.assigned_to && /compiled|final/i.test(file.file_name);
}