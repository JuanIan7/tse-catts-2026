import { describe, expect, it } from "vitest";
import { codePointOffsetAtUtf16Offset, needsReviewPdfPageBreak, rangesOverlap, selectedTextForRange, utf16OffsetAtCodePointOffset } from "./evaluation-review";

describe("admin evaluation review selection", () => {
  it("keeps only an exact valid transcript slice", () => {
    expect(selectedTextForRange("Eu sou João, do Corpo de Bombeiros.", 7, 11)).toBe("João");
    expect(selectedTextForRange("texto", 3, 2)).toBeNull();
    expect(selectedTextForRange("texto", 0, 800)).toBeNull();
  });

  it("detects overlapping annotation ranges", () => {
    expect(rangesOverlap(3, 7, 6, 9)).toBe(true);
    expect(rangesOverlap(3, 7, 7, 9)).toBe(false);
  });

  it("keeps original transcript offsets after an earlier marked range", () => {
    const content = "João trabalha como motorista e sente saudade da filha.";
    expect(selectedTextForRange(content, 37, 43)).toBe("saudad");
    expect(selectedTextForRange(content, 37, 44)).toBe("saudade");
  });

  it("moves a review annotation to the next PDF page before its marker", () => {
    expect(needsReviewPdfPageBreak(275, 18, 280)).toBe(true);
    expect(needsReviewPdfPageBreak(250, 18, 280)).toBe(false);
  });

  it("uses Unicode character offsets consistently when an emoji precedes the selection", () => {
    const content = "🙂 João";
    expect(codePointOffsetAtUtf16Offset(content, 3)).toBe(2);
    expect(utf16OffsetAtCodePointOffset(content, 2)).toBe(3);
    expect(selectedTextForRange(content, 2, 6)).toBe("João");
  });
});
