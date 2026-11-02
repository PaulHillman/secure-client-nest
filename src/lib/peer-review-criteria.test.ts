import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { activePeerReviewCriteria, criteriaReminderDue, validReminderMonthDay } from './peer-review-criteria';

describe('comment-only rubric lines', () => {
  it('excludes lines beginning with # from new scoring criteria', () => {
    assert.equal(activePeerReviewCriteria('Require accurate totals.\n# Historical penalty\nKeep rankings unique.'), 'Require accurate totals.\nKeep rankings unique.');
  });
  it('excludes ## lines including the former below-seven rule', () => {
    assert.equal(activePeerReviewCriteria('Three positives per teammate.\n## Missing the required number places it immediately below a 7'), 'Three positives per teammate.');
  });
  it('handles indented comments and Windows line endings, preserving inline hashes', () => {
    assert.equal(activePeerReviewCriteria('  ## Old SMART requirement\r\nUse Competition #2 evidence.\r\n\t# Old rule'), 'Use Competition #2 evidence.');
  });
  it('retains the historical document unchanged', () => {
    const saved = 'Accurate totals.\n## Prior rule';
    assert.equal(activePeerReviewCriteria(saved), 'Accurate totals.');
    assert.equal(saved, 'Accurate totals.\n## Prior rule');
  });
});

describe('annual criteria review reminder', () => {
  it('reminds before submission/evaluation until reviewed this year', () => {
    assert.equal(criteriaReminderDue(new Date('2026-10-22T23:55:00Z'), '10-16', null), true);
    assert.equal(criteriaReminderDue(new Date('2026-10-22T23:55:00Z'), '10-16', 2026), false);
  });
  it('returns next year and stays quiet before the reminder date', () => {
    assert.equal(criteriaReminderDue(new Date('2027-10-22T23:55:00Z'), '10-16', 2026), true);
    assert.equal(criteriaReminderDue(new Date('2027-10-15T12:00:00Z'), '10-16', 2026), false);
  });
  it('rejects impossible annual dates', () => {
    assert.equal(validReminderMonthDay('02-30'), false);
    assert.equal(validReminderMonthDay('10-16'), true);
  });
});