import { test } from "node:test";
import assert from "node:assert/strict";
import { ageCutoffDate, ageOn, checkAgePlacement, computeTermRefund, isValidEmiratesId, formatEmiratesId, maxFeeIncreasePct, validateRegistrationDeposit, attendanceBand, subjectAppliesToStudent, GRADE_CATALOGUE } from "../src/lib/khda";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("age cut-off is 31 Aug for September schools and 31 Mar for April schools", () => {
  assert.equal(ageCutoffDate("SEPTEMBER", d("2026-08-31")).toISOString().slice(0, 10), "2026-08-31");
  assert.equal(ageCutoffDate("APRIL", d("2026-04-01")).toISOString().slice(0, 10), "2026-03-31");
});

test("ageOn handles birthdays before and after the cut-off", () => {
  assert.equal(ageOn(d("2020-08-31"), d("2026-08-31")), 6);
  assert.equal(ageOn(d("2020-09-01"), d("2026-08-31")), 5);
});

test("age placement flags too young and out-of-range placements", () => {
  const cutoff = d("2026-08-31");
  assert.equal(checkAgePlacement(d("2022-01-01"), 4, cutoff).ok, true); // FS2 at 4
  assert.equal(checkAgePlacement(d("2023-01-01"), 4, cutoff).tooYoung, true);
  assert.equal(checkAgePlacement(d("2018-01-01"), 4, cutoff).needsKhdaApproval, true); // 8 in FS2
});

test("grade catalogue is consistent (ascending order, ascending ages)", () => {
  for (const [curr, grades] of Object.entries(GRADE_CATALOGUE)) {
    for (let i = 1; i < grades.length; i++) {
      assert.ok(grades[i].order > grades[i - 1].order, `${curr} order`);
      assert.ok(grades[i].minAgeYears >= grades[i - 1].minAgeYears, `${curr} age`);
    }
    assert.equal(grades[grades.length - 1].minAgeYears, 17, `${curr} final year age`);
  }
});

test("registration deposit is capped at 10% of tuition", () => {
  assert.equal(validateRegistrationDeposit(40000, 4000).ok, true);
  assert.equal(validateRegistrationDeposit(40000, 4000.01).ok, false);
});

test("fee increase ceiling follows the rating multiplier", () => {
  assert.equal(maxFeeIncreasePct("OUTSTANDING", 2.5), 5);
  assert.equal(maxFeeIncreasePct("GOOD", 2.5), 3.75);
  assert.equal(maxFeeIncreasePct("WEAK", 2.5), 2.5);
  assert.equal(maxFeeIncreasePct(null, 2.5), 2.5);
});

test("refund rule retains 1 month / 2 months / full term", () => {
  const base = { annualTuition: 30000, termFee: 12000, termStart: d("2026-08-31") };
  assert.equal(computeTermRefund({ ...base, withdrawalDate: d("2026-09-10") }).retained, 3000);
  assert.equal(computeTermRefund({ ...base, withdrawalDate: d("2026-09-25") }).retained, 6000);
  assert.equal(computeTermRefund({ ...base, withdrawalDate: d("2026-11-01") }).retained, 12000);
  assert.equal(computeTermRefund({ ...base, withdrawalDate: d("2026-09-25") }).refund, 6000);
});

test("Emirates ID validation uses the 784 prefix and Luhn check digit", () => {
  // Build a valid number from a known body
  const body = "78419901234567";
  let sum = 0;
  for (let i = 0; i < 14; i++) { let x = Number(body[i]); if ((15 - i) % 2 === 0) { x *= 2; if (x > 9) x -= 9; } sum += x; }
  const valid = body + String((10 - (sum % 10)) % 10);
  assert.equal(isValidEmiratesId(valid), true);
  assert.equal(isValidEmiratesId(formatEmiratesId(valid)), true);
  assert.equal(isValidEmiratesId("784-1234-1234567-9"), false);
  assert.equal(isValidEmiratesId("123456789012345"), false);
  assert.match(formatEmiratesId(valid), /^784-\d{4}-\d{7}-\d$/);
});

test("attendance bands", () => {
  assert.equal(attendanceBand(98.5), "OUTSTANDING");
  assert.equal(attendanceBand(95), "GOOD");
  assert.equal(attendanceBand(89), "VERY_WEAK");
});

test("subject applicability", () => {
  assert.equal(subjectAppliesToStudent("MUSLIM_ONLY", { isMuslim: false, arabicFirstLanguage: false }), false);
  assert.equal(subjectAppliesToStudent("ARABIC_NATIVE", { isMuslim: true, arabicFirstLanguage: true }), true);
  assert.equal(subjectAppliesToStudent("ARABIC_NON_NATIVE", { isMuslim: true, arabicFirstLanguage: true }), false);
  assert.equal(subjectAppliesToStudent("ALL", { isMuslim: false, arabicFirstLanguage: false }), true);
});
