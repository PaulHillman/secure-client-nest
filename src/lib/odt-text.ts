import JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

/** Read paragraph text in document order without dropping table cells. */
export async function extractOdtText(bytes: ArrayBuffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(bytes);
  const content = zip.file('content.xml');
  if (!content) return null;
  const xml = await content.async('string');
  if (XMLValidator.validate(xml) !== true) return null;
  const nodes = new XMLParser({ preserveOrder: true, ignoreAttributes: false, processEntities: true, trimValues: false }).parse(xml);
  const paragraphs: string[] = [];
  const textOf = (items: any[]): string => items.map(node => Object.entries(node).map(([key, value]) => {
    if (key === '#text') return String(value);
    if (key === ':@') return '';
    if (key === 'text:tab') return '\t';
    if (key === 'text:line-break') return '\n';
    if (key === 'text:s') return ' '.repeat(Math.min(100, Number(node[':@']?.['@_text:c'] ?? 1)));
    return Array.isArray(value) ? textOf(value) : '';
  }).join('')).join('');
  const walk = (items: any[]) => {
    for (const node of items) for (const [key, value] of Object.entries(node)) {
      if (!Array.isArray(value)) continue;
      if (key === 'text:p' || key === 'text:h') paragraphs.push(textOf(value));
      else walk(value);
    }
  };
  walk(nodes);
  return paragraphs.join('\n').trim() || null;
}