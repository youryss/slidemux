import { describe, expect, it } from "vitest";
import { alignStepMarks } from "./extract-clips.js";

const marks = [{ slug: "open", startMs: 100, endMs: 900 }];

describe("alignStepMarks", () => {
  it("shifts marks by the pre-origin footage length", () => {
    const aligned = alignStepMarks(marks, 1500, 3500);
    expect(aligned).toEqual([{ slug: "open", startMs: 2100, endMs: 2900 }]);
  });

  it("never shifts marks backwards", () => {
    expect(alignStepMarks(marks, 4000, 3500)).toEqual(marks);
  });

  it("passes marks through when either anchor is missing", () => {
    expect(alignStepMarks(marks, null, 3500)).toEqual(marks);
    expect(alignStepMarks(marks, 1500, null)).toEqual(marks);
  });
});
