import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedHealthFiles, CONFIRMATION_PREFIX } from './health-instructor-confirmation';
const file = { file_name: 'Sobie Research.pdf', current_version_id: 'pdf-version' };
const record = { team_id: 'oak', file_name: file.file_name, note: CONFIRMATION_PREFIX + JSON.stringify({ rule: 'research_readable', versionId: 'pdf-version' }) };
test('instructor-readable Sobie PDF is confirmed for its exact version', () => {
  assert.deepEqual(confirmedHealthFiles('oak', 'research_readable', [file], [record]), ['Sobie Research.pdf']);
});
test('a replacement file does not inherit a prior readability decision', () => {
  assert.deepEqual(confirmedHealthFiles('oak', 'research_readable', [{ ...file, current_version_id: 'new' }], [record]), []);
});
test('confirmation does not leak to another team or check', () => {
  assert.deepEqual(confirmedHealthFiles('other', 'research_readable', [file], [record]), []);
  assert.deepEqual(confirmedHealthFiles('oak', 'interview_questions', [file], [record]), []);
});