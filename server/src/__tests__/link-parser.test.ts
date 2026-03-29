import { describe, it, expect } from "vitest";
import { parseGoogleLink } from "../services/link-parser.js";

describe("parseGoogleLink", () => {
  it("parses a standard Drive folder URL", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/folders/1abc123xyz"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Drive folder URL with query params", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/folders/1abc123xyz?usp=sharing"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Drive folder URL with /u/0/ prefix", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/u/0/folders/1abc123xyz"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Google Photos shared album URL", () => {
    const result = parseGoogleLink(
      "https://photos.google.com/share/AF1QipN_abc123"
    );
    expect(result).toEqual({ sourceType: "photos", sourceId: "AF1QipN_abc123" });
  });

  it("parses a Google Photos album URL", () => {
    const result = parseGoogleLink(
      "https://photos.google.com/album/AF1QipN_abc123"
    );
    expect(result).toEqual({ sourceType: "photos", sourceId: "AF1QipN_abc123" });
  });

  it("throws InvalidLinkError for unrecognized URLs", () => {
    expect(() => parseGoogleLink("https://example.com/foo")).toThrow(
      "not a valid Google Drive or Photos link"
    );
  });

  it("throws InvalidLinkError for empty string", () => {
    expect(() => parseGoogleLink("")).toThrow();
  });
});
