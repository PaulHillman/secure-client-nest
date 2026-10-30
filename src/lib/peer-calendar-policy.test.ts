import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { nextDetroitCalendarCheck } from './peer-calendar-policy';
test('daily calendar validation is 1 am Detroit during daylight time', () => {
  assert.equal(nextDetroitCalendarCheck(new Date('2026-10-30T12:00:00Z')).toISOString(), '2026-10-31T05:00:00.000Z');
});
test('daily calendar validation runs once on fall-back day', () => {
  assert.equal(nextDetroitCalendarCheck(new Date('2026-10-31T05:00:00Z')).toISOString(), '2026-11-01T05:00:00.000Z');
});
test('daily calendar validation follows standard time after fall-back', () => {
  assert.equal(nextDetroitCalendarCheck(new Date('2026-11-01T05:00:00Z')).toISOString(), '2026-11-02T06:00:00.000Z');
});