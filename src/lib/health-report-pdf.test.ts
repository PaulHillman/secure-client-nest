import { describe, expect, test } from "bun:test";
import { pdfCheckRating, type PdfConcern } from "./health-report-pdf";

const concern = (level: "red" | "yellow", check = "Weekly Meetings"): PdfConcern => ({
  level, check, person: null, role: null, reason: "Meeting check finding",
});

describe("PDF check ratings match screen severity", () => {
  test("passed checks are Good", () => {
    expect(pdfCheckRating({ label: "Weekly Meetings", status: "pass" }, [])).toBe("Good");
  });
  test("yellow-only findings are Fair, not Bad", () => {
    expect(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow")])).toBe("Fair");
  });
  test("red findings make the check Bad even alongside yellow", () => {
    expect(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow"), concern("red")])).toBe("Bad");
  });
  test("another check's red finding does not turn a Fair check Bad", () => {
    expect(pdfCheckRating({ label: "Weekly Meetings", status: "flagged" }, [concern("yellow"), concern("red", "File Vault requirements")])).toBe("Fair");
  });
  test("skipped checks are not rated Good", () => {
    expect(pdfCheckRating({ label: "Weekly Meetings", status: "skipped" }, [])).toBe("Not checked");
  });
});