import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import JSZip from 'jszip';
import { extractOdtText } from './odt-text';

test('ODT retains reviewer identity and ordered table answers', async () => {
  const zip = new JSZip();
  zip.file('content.xml', '<office:document-content xmlns:office="urn:office" xmlns:text="urn:text" xmlns:table="urn:table"><office:body><text:p>Your name <text:span>Phil Hernandez</text:span></text:p><table:table><table:table-cell><text:p>49</text:p></table:table-cell><table:table-cell><text:p>48</text:p></table:table-cell></table:table><text:p>Oak &amp; Iron</text:p></office:body></office:document-content>');
  assert.equal(await extractOdtText(await zip.generateAsync({ type: 'arraybuffer' })), 'Your name Phil Hernandez\n49\n48\nOak & Iron');
});

test('ODT without content is unreadable, not an invented score', async () => {
  assert.equal(await extractOdtText(await new JSZip().generateAsync({ type: 'arraybuffer' })), null);
});