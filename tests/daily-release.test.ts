import test from "node:test";
import assert from "node:assert/strict";
import {
  daysUntil,
  updateWeddingDetails,
  validateWeddingDetails,
} from "../src/core/wedding";
import {
  normalizedEmail,
  validateNewPassword,
  validateRecoveryCode,
} from "../src/core/account";
import {
  base64ToBytes,
  bytesToBase64,
  validateDocument,
  DOCUMENT_LIMIT,
} from "../src/core/documents";
const wedding = {
  id: "w",
  partner_one: "",
  partner_two: "",
  wedding_date: null,
  budget: 100,
  budget_version: 2,
  details_version: 1,
};
test("wedding details stay generic and reject invalid dates/names", () => {
  assert.deepEqual(
    validateWeddingDetails({
      partner_one: " ",
      partner_two: "",
      wedding_date: null,
    }),
    { partner_one: "", partner_two: "", wedding_date: null },
  );
  assert.throws(() =>
    validateWeddingDetails({ ...wedding, wedding_date: "2027-02-29" }),
  );
  assert.throws(() =>
    validateWeddingDetails({ ...wedding, partner_one: "a".repeat(61) }),
  );
});
test("details version conflicts preserve unrelated budget and prevent overwrites", () => {
  const next = updateWeddingDetails(
    { ...wedding, budget: 500, budget_version: 3 },
    wedding,
    { partner_one: " שם ", partner_two: "", wedding_date: "2028-02-29" },
  );
  assert.equal(next.budget, 500);
  assert.equal(next.budget_version, 3);
  assert.equal(next.details_version, 2);
  assert.equal(next.partner_one, "שם");
  assert.throws(() => updateWeddingDetails(next, wedding, wedding), /השתנו/);
});
test("countdown follows local calendar days including DST, today and past dates", () => {
  assert.equal(daysUntil(null), null);
  const now = new Date(2026, 2, 27, 23, 59);
  assert.equal(daysUntil("2026-03-28", now), 1);
  assert.equal(daysUntil("2026-03-27", now), 0);
  assert.equal(daysUntil("2026-03-26", now), -1);
});
test("recovery validates email, OTP and matching strong-enough password", () => {
  assert.equal(normalizedEmail(" A@EXAMPLE.COM "), "a@example.com");
  assert.throws(() => normalizedEmail("nope"));
  assert.equal(validateRecoveryCode(" 12345678 "), "12345678");
  assert.throws(() => validateRecoveryCode("bad"));
  assert.equal(validateNewPassword("abcdefghij", "abcdefghij"), "abcdefghij");
  assert.throws(() => validateNewPassword("short", "short"));
  assert.throws(() => validateNewPassword("abcdefghij", "other"));
});
test("documents check actual file headers, size and lossless binary encoding", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nhello");
  assert.equal(
    validateDocument(" חוזה.pdf ", "application/pdf", pdf).name,
    "חוזה.pdf",
  );
  assert.deepEqual(base64ToBytes(bytesToBase64(pdf)), pdf);
  assert.throws(() =>
    validateDocument(
      "fake.pdf",
      "application/pdf",
      new TextEncoder().encode("<script>"),
    ),
  );
  assert.throws(() =>
    validateDocument("empty.pdf", "application/pdf", new Uint8Array()),
  );
  assert.throws(() =>
    validateDocument(
      "huge.pdf",
      "application/pdf",
      new Uint8Array(DOCUMENT_LIMIT + 1),
    ),
  );
  assert.throws(() => validateDocument("x.html", "text/html", pdf));
  assert.throws(() =>
    validateDocument("x".repeat(161), "application/pdf", pdf),
  );
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(validateDocument("x.png", "image/png", png).size_bytes, 8);
  assert.equal(
    validateDocument("x.jpg", "image/jpeg", Uint8Array.from([255, 216, 255, 0]))
      .size_bytes,
    4,
  );
});

test("document encoding works without browser globals and matches standard base64 across chunk boundaries", () => {
  for (const length of [0, 1, 2, 3, 255, 8191, 8192, 8193]) {
    const input = Uint8Array.from({ length }, (_, i) => i % 256);
    const encoded = bytesToBase64(input);
    assert.equal(encoded, Buffer.from(input).toString("base64"));
    assert.deepEqual(base64ToBytes(encoded), input);
  }
  assert.throws(() => base64ToBytes("not base64!"));
});
