// Shared wording for files that cannot be read automatically.
// Explains the problem in student-facing language, with format-specific guidance.

/** True when the file name ends in a known-unreadable Apple iWork extension. */
export function isApplePagesFile(fileName: string): boolean {
  return /\.pages$/i.test(fileName);
}

/**
 * Student-facing explanation for a file whose text could not be extracted.
 * .pages files get a specific explanation (Apple-only format); everything else
 * gets the generic re-upload guidance.
 */
export function unreadableFileExplanation(fileName: string): string {
  if (isApplePagesFile(fileName)) {
    return `${fileName} is an Apple Pages file (.pages), which only Apple devices can open and this system cannot read. In Pages, choose File → Export To → PDF (or Word), then upload the exported PDF or DOCX instead.`;
  }
  return `${fileName} appears blank or is in a format that cannot be read. Please re-upload it as a visible DOCX or PDF file so its contents can be verified.`;
}
