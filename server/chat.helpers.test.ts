import { describe, expect, it } from "vitest";
import { contentToText, titleFromPrompt } from "./routers";

describe("NOVA chat helpers", () => {
  it("creates a useful compact title from the first prompt", () => {
    expect(titleFromPrompt("  Explain binary trees in Java  ")).toBe("Explain binary trees in Java");
    expect(titleFromPrompt(" ")).toBe("New conversation");
  });

  it("limits long titles without losing the conversational shape", () => {
    const title = titleFromPrompt("A very long question that should become a short conversation title for the sidebar");
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
  });

  it("normalizes text and multimodal content for persistence", () => {
    expect(contentToText("hello")).toBe("hello");
    expect(contentToText([{ type: "text", text: "first" }, { type: "text", text: "second" }])).toBe("first\nsecond");
    expect(contentToText(undefined)).toBe("");
  });
});
