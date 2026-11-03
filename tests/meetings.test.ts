import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteMeetingState,
  overlappingMeetings,
  saveMeetingState,
  validateMeeting,
  type Meeting,
  type MeetingDraft,
} from "../src/core/meetings";
import { meetingWallTime, wallTimeToInstant } from "../src/core/meetingTime";
const draft: MeetingDraft = {
  title: "פגישה",
  starts_at: "2027-01-04T10:00:00.000Z",
  time_zone: "Asia/Jerusalem",
  duration_minutes: 60,
  location: "חיפה",
  vendor_id: null,
  owner: "both",
  status: "scheduled",
  reminder_minutes: 60,
  notes: "",
};
const meeting = (id: string, changes: Partial<Meeting> = {}): Meeting => ({
  ...draft,
  id,
  wedding_id: "w",
  version: 1,
  ...changes,
});
test("wall times round-trip independently of device time zone", () => {
  assert.equal(
    wallTimeToInstant("2027-01-04", "12:00", "Asia/Jerusalem"),
    draft.starts_at,
  );
  assert.deepEqual(meetingWallTime(draft.starts_at, "Asia/Jerusalem"), {
    date: "2027-01-04",
    time: "12:00",
  });
  assert.equal(
    wallTimeToInstant("2027-01-04", "00:00", "UTC"),
    "2027-01-04T00:00:00.000Z",
  );
});
test("nonexistent, repeated and malformed wall times are rejected explicitly", () => {
  assert.throws(
    () => wallTimeToInstant("2026-03-27", "02:30", "Asia/Jerusalem"),
    /אינה קיימת/,
  );
  assert.throws(
    () => wallTimeToInstant("2026-10-25", "01:30", "Asia/Jerusalem"),
    /פעמיים/,
  );
  for (const [date, time, zone] of [
    ["2027-02-30", "12:00", "UTC"],
    ["2027-01-01", "24:00", "UTC"],
    ["2027-01-01", "12:00", "Bogus/Zone"],
  ])
    assert.throws(() => wallTimeToInstant(date, time, zone));
});
test("meeting validation strips protected fields and checks minutes/status", () => {
  const clean = validateMeeting(meeting("x"));
  assert.ok(!("id" in clean));
  assert.ok(!("version" in clean));
  assert.throws(() => validateMeeting({ ...draft, duration_minutes: 14 }));
  assert.throws(() => validateMeeting({ ...draft, reminder_minutes: 123 }));
  assert.throws(() =>
    validateMeeting({ ...draft, starts_at: "2027-02-30T12:00:00.000Z" }),
  );
});
test("overlap warning considers actual duration and stable participant assignments", () => {
  const rows = [meeting("one", { owner: "one" })];
  assert.equal(overlappingMeetings(rows, { ...draft, owner: "two" }).length, 0);
  assert.equal(
    overlappingMeetings(rows, {
      ...draft,
      owner: "one",
      starts_at: "2027-01-04T10:30:00.000Z",
    }).length,
    1,
  );
  assert.equal(
    overlappingMeetings(rows, {
      ...draft,
      starts_at: "2027-01-04T11:00:00.000Z",
    }).length,
    0,
  );
  assert.equal(overlappingMeetings(rows, draft, "one").length, 0);
  assert.equal(
    overlappingMeetings(rows, { ...draft, status: "cancelled" }).length,
    0,
  );
});
test("meeting create retries and versioned edits/deletes preserve snapshots", () => {
  const rows = saveMeetingState([], "m", "w", null, draft);
  assert.equal(saveMeetingState(rows, "m", "w", null, draft), rows);
  const next = saveMeetingState(rows, "m", "w", 1, {
    ...draft,
    status: "done",
  });
  assert.equal(next[0].version, 2);
  assert.equal(rows[0].status, "scheduled");
  assert.throws(() => saveMeetingState(next, "m", "w", 1, draft));
  assert.throws(() => deleteMeetingState(next, rows[0]));
  assert.deepEqual(deleteMeetingState(next, next[0]), []);
});
