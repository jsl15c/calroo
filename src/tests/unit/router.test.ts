import { describe, expect, it } from "vitest";
import { parseRouterResponse } from "@/server/agents/router";

describe("parseRouterResponse", () => {
  it("parses a valid calendar routing response", () => {
    const raw = JSON.stringify({
      agent: "calendar",
      confidence: 0.92,
      reasoning: "User asking about Thursday schedule",
      clarification: null,
    });
    const result = parseRouterResponse(raw);
    expect(result.agent).toBe("calendar");
    expect(result.confidence).toBe(0.92);
    expect(result.clarification).toBeNull();
  });

  it("parses a valid scheduler routing response", () => {
    const raw = JSON.stringify({
      agent: "scheduler",
      confidence: 0.87,
      reasoning: "User wants to create a meeting",
      clarification: null,
    });
    const result = parseRouterResponse(raw);
    expect(result.agent).toBe("scheduler");
    expect(result.confidence).toBe(0.87);
  });

  it("parses a valid idea routing response", () => {
    const raw = JSON.stringify({
      agent: "idea",
      confidence: 0.75,
      reasoning: "User asking for team activity suggestions",
      clarification: null,
    });
    const result = parseRouterResponse(raw);
    expect(result.agent).toBe("idea");
  });

  it("returns clarification when confidence is low", () => {
    const raw = JSON.stringify({
      agent: "calendar",
      confidence: 0.4,
      reasoning: "Ambiguous request",
      clarification: "Are you looking to check your schedule or make a change?",
    });
    const result = parseRouterResponse(raw);
    expect(result.confidence).toBe(0.4);
    expect(result.clarification).not.toBeNull();
    expect(result.clarification).toContain("schedule");
  });

  it("strips markdown code fences", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        agent: "calendar",
        confidence: 0.8,
        reasoning: "test",
        clarification: null,
      }) +
      "\n```";
    const result = parseRouterResponse(raw);
    expect(result.agent).toBe("calendar");
  });

  it("falls back gracefully on invalid JSON", () => {
    const result = parseRouterResponse("this is not json at all");
    expect(result.agent).toBe("calendar"); // fallback
    expect(result.confidence).toBe(0.4); // low fallback confidence
    expect(result.clarification).not.toBeNull(); // asks for clarification
  });

  it("falls back gracefully on empty string", () => {
    const result = parseRouterResponse("");
    expect(result.agent).toBe("calendar");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("clamps confidence to [0, 1]", () => {
    const raw = JSON.stringify({
      agent: "calendar",
      confidence: 1.5, // out of range
      reasoning: "test",
      clarification: null,
    });
    const result = parseRouterResponse(raw);
    expect(result.confidence).toBe(1);
  });

  it("defaults to 'calendar' agent for unknown agent names", () => {
    const raw = JSON.stringify({
      agent: "unknown_agent",
      confidence: 0.8,
      reasoning: "test",
      clarification: null,
    });
    const result = parseRouterResponse(raw);
    expect(result.agent).toBe("calendar");
  });
});
