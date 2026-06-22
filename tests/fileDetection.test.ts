import { describe, expect, it } from "vitest";
import { detectSupportedFileType, findShareTs } from "../src/preview/fileDetection";

const baseFile = { id: "F123" };

describe("detectSupportedFileType", () => {
  it("detects markdown by extension", () => {
    expect(detectSupportedFileType({ ...baseFile, name: "spec.md" })).toBe("markdown");
  });

  it("detects html by extension", () => {
    expect(detectSupportedFileType({ ...baseFile, name: "report.html" })).toBe("html");
  });

  it("ignores unsupported files", () => {
    expect(detectSupportedFileType({ ...baseFile, name: "image.png" })).toBeNull();
  });
});

describe("findShareTs", () => {
  it("finds public share ts", () => {
    expect(
      findShareTs(
        {
          ...baseFile,
          shares: { public: { C123: [{ ts: "123.456" }] } }
        },
        "C123"
      )
    ).toBe("123.456");
  });

  it("prefers thread_ts", () => {
    expect(
      findShareTs(
        {
          ...baseFile,
          shares: { private: { G123: [{ ts: "111.222", thread_ts: "999.888" }] } }
        },
        "G123"
      )
    ).toBe("999.888");
  });
});
