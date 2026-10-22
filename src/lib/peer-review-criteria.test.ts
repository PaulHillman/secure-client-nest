import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { criteriaReminderDue, validReminderMonthDay } from './peer-review-criteria';

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