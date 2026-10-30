import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { OPERATIONAL_DEFAULTS as defaults, operationalSchema, resolveOperationalRules, detroitDeadline } from './review-rulebook';
import { peerReviewPass, peerBadgeTone } from './peer-review-policy';
import { peerEmailAction } from './peer-review-email';
import { canAssessPeerAttempt } from './peer-review-workspace';
import { healthPeerSummary } from './health-peer-summary';
import { finalRegradeDecision } from './peer-review-discussion';
import { researchCoverage } from './health-review-comparison';
import { minutesFollowTemplate } from './minutes-template';
import { changedEvidenceRules } from './review-rule-comparison';
import { HEALTH_REVIEW_RULE_DEFAULTS } from './health-review-rules';
const a = { user_id: 'student', team_id: 'team', file_id: 'file', attempt: 2, score: 8, status: 'assessed', created_at: '2026-10-30' };
test('new revision target drives passing, badge, email action and weekly decision consistently', () => {
  const p = { ...defaults, revision_pass: 9 };
  assert.equal(peerReviewPass(8, 2, p), false);
  assert.match(peerBadgeTone(8, new Date('2026-10-30'), 2, null, p), /gold/);
  assert.equal(peerEmailAction(8, 2, p).complete, false);
  assert.equal(healthPeerSummary({ ...a, policy_snapshot: p }, [], Date.parse('2026-10-30')).action, 'revise_or_book');
});
test('existing assessment policy stays at revision 8 even if future rules require 9', () => {
  assert.equal(healthPeerSummary({ ...a, policy_snapshot: defaults }, [], Date.parse('2026-10-30'), { ...defaults, revision_pass: 9 }).action, 'complete');
  assert.equal(peerReviewPass(8, 2, null), true);
});
test('maximum four ordinary submissions allows fourth and requires a meeting at four, not three', () => {
  const p = { ...defaults, max_submissions: 4 };
  assert.equal(canAssessPeerAttempt(4, false, p.max_submissions), true);
  assert.equal(canAssessPeerAttempt(5, false, p.max_submissions), false);
  assert.equal(peerEmailAction(7, 3, p).meetingRequired, false);
  assert.equal(peerEmailAction(7, 4, p).meetingRequired, true);
});
test('authorized final accepts saved threshold and records saved deduction separately', () => {
  const p = { ...defaults, final_pass: 7.8, final_deduction: -5 };
  assert.equal(finalRegradeDecision({ attempt: 5, final_submission: true, policy_snapshot: p }, 7.8, 'admin', 'now').final_points_adjustment, 0);
  assert.equal(finalRegradeDecision({ attempt: 5, final_submission: true, policy_snapshot: p }, 7.7, 'admin', 'now').final_points_adjustment, -5);
});
test('deadline uses Sunday 11:59 Detroit through daylight saving', () => {
  assert.equal(detroitDeadline('2026-10-25'), '2026-10-26T03:59:59Z');
  assert.equal(detroitDeadline('2026-11-01'), '2026-11-02T04:59:59Z');
});
test('non-Sunday and reversed deadlines are rejected, not silently applied', () => {
  assert.equal(operationalSchema.safeParse({ ...defaults, revision_due: '2026-11-02' }).success, false);
  assert.equal(operationalSchema.safeParse({ ...defaults, revision_due: '2026-10-18' }).success, false);
});
test('unknown keys including protected delivery settings are rejected', () => {
  assert.equal(operationalSchema.safeParse({ ...defaults, copy_pm: false }).success, false);
});
test('malformed or absent saved policies retain documented 7/8/3 defaults', () => {
  assert.equal(resolveOperationalRules({ max_submissions: 100 }).max_submissions, 3);
  assert.equal(resolveOperationalRules(null).original_pass, 7);
  assert.equal(resolveOperationalRules(null).revision_pass, 8);
});
test('custom research topic requires actual text evidence, not a matching filename', () => {
  const topics = [{ topic: 'Interview preparation', keywords: ['interview preparation'] }];
  assert.equal(researchCoverage([{ fileName: 'interview preparation.docx', text: null }], topics)[0]?.evidence.length, 0);
  assert.equal(researchCoverage([{ fileName: 'notes.docx', text: 'Interview preparation includes reviewing client facts.' }], topics)[0]?.evidence.length, 1);
});
test('custom minutes labels drive section eligibility', () => {
  assert.equal(minutesFollowTemplate('Decisions and next steps', 2, ['decisions', 'next steps']), true);
  assert.equal(minutesFollowTemplate('Attendees only', 2, ['decisions', 'next steps']), false);
});
test('changed research or minutes rules are reporting corrections, not earned fixes', () => {
  const changed = changedEvidenceRules(undefined, { thresholds: HEALTH_REVIEW_RULE_DEFAULTS, operational: { ...defaults, research_topics: [{ topic: 'New topic', keywords: ['new evidence'] }], minutes_markers: ['decisions'] } });
  assert.equal(changed.has('vault:research'), true);
  assert.equal(changed.has('meetings:minutes_template'), true);
  assert.equal(changedEvidenceRules(undefined, { thresholds: HEALTH_REVIEW_RULE_DEFAULTS, operational: defaults }).size, 0);
});