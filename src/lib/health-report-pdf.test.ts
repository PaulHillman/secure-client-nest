import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { pdfCheckRating, type PdfConcern } from "./health-report-pdf";

const concern = (level: "red" | "yellow", check = "Weekly Meetings"): PdfConcern => ({
  level, check, person: null, role: null, reason: "Meeting check finding",
});

describe("PDF check ratings match screen severity", () => {
  test("passed checks are Good", () => {
    assert.equal(pdfCheckRating({ label: "Weekly Meetings", status: "pass" }, []), "Good");
  });
  test("yellow-only findings are Fair, not Bad", () => {
    assert.equal(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow")]), "Fair");
  });
  test("red findings make the check Bad even alongside yellow", () => {
    assert.equal(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow"), concern("red")]), "Bad");
  });
  test("another check's red finding does not turn a Fair check Bad", () => {
    assert.equal(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow"), concern("red", "File Vault requirements")]), "Fair");
  });
  test("skipped checks are not rated Good", () => {
    assert.equal(pdfCheckRating({ label: "Weekly Meetings", status: "skipped" }, []), "Not checked");
  });
});