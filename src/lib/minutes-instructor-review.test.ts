import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rejectedMinutes, REJECTED_MINUTES_PREFIX } from './minutes-instructor-review';

const fileName = '10_21 meeting minutes (peer review meetings).pdf';
const verification = { team_id: 'section05-team4', file_name: fileName, note: REJECTED_MINUTES_PREFIX + JSON.stringify({ versionId: 'reviewed-version', message: 'Paul verified this file does not use the template; note already sent; update required.' }) };

describe('Instructor-confirmed minutes violations', () => {
  it('retains the confirmed violation for the reviewed file even if automation excludes it as a supplement', () => {
    assert.deepEqual(rejectedMinutes('section05-team4', [{ file_name: fileName, current_version_id: 'reviewed-version' }], [verification]), [{ fileName, message: 'Paul verified this file does not use the template; note already sent; update required.' }]);
  });
  it('does not apply an old decision to a replacement version', () => {
    assert.deepEqual(rejectedMinutes('section05-team4', [{ file_name: fileName, current_version_id: 'replacement-version' }], [verification]), []);
  });
  it('does not apply another section/team decision', () => {
    assert.deepEqual(rejectedMinutes('section04-team4', [{ file_name: fileName, current_version_id: 'reviewed-version' }], [verification]), []);
  });
});