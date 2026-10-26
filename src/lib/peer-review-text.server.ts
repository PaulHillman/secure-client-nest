export async function extractPeerText(blob: Blob, name: string): Promise<string | null> {
  try {
    const bytes = await blob.arrayBuffer();
    let text: string | null = null;
    if (/\.pdf$/i.test(name)) {
      const { extractText } = await import('unpdf');
      text = (await extractText(new Uint8Array(bytes), { mergePages: true })).text;
    } else if (/\.docx$/i.test(name)) {
      const mammoth = await import('mammoth/mammoth.browser');
      text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
    } else if (/\.odt$/i.test(name)) {
      const { extractOdtText } = await import('./odt-text');
      text = await extractOdtText(bytes);
    } else if (/\.(txt|md)$/i.test(name)) text = new TextDecoder().decode(bytes);
    return text && text.replace(/\s/g, '').length >= 200 ? text.trim() : null;
  } catch { return null; }
}