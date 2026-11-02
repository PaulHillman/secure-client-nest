import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { peerCloseoutBody, peerCloseoutComment } from './peer-review-closeout';

const comment = "I re-graded your 3rd submission and while you didn't get to 8/10, you did get a 7.6 and for the assignment, I will accept that.";
test('close-out email includes the saved instructor acceptance comment verbatim', () => {
  const saved = peerCloseoutComment({ accepted_note: comment, discussion_note: 'Earlier meeting note' });
  const body = peerCloseoutBody({ firstName: 'Meta', score: 7.6, meetingLine: 'No meeting needed.', comment: saved });
  assert.equal(saved, comment);
  assert.equal(body.split('\n\n').filter(part => part === comment).length, 1);
  assert.equal(body.includes('Earlier meeting note'), false);
});
test('legacy close-outs include the discussion comment when no acceptance comment exists', () => {
  assert.equal(peerCloseoutComment({ accepted_note: ' ', discussion_note: comment }), comment);
});
test('no saved instructor comment means no invented comment', () => {
  assert.equal(peerCloseoutComment({ accepted_note: null, discussion_note: null }), null);
});