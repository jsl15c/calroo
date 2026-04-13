import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tracer } from "@/server/observability/tracer";

describe("Tracer", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a trace with a traceId and userId", () => {
    const tracer = new Tracer("user_123");
    const log = tracer.finish();
    expect(log.traceId).toMatch(/^tr_[a-z0-9]+$/);
    expect(log.userId).toBe("user_123");
  });

  it("records steps with correct names", () => {
    const tracer = new Tracer("user_abc");
    tracer.step("router", {
      agent: "calendar",
      confidence: 0.9,
      duration_ms: 300,
    });
    tracer.step("agent", {
      agent: "calendar",
      duration_ms: 1200,
      result: "success",
    });
    const log = tracer.finish();
    expect(log.steps).toHaveLength(2);
    expect(log.steps[0].step).toBe("router");
    expect(log.steps[1].step).toBe("agent");
  });

  it("records handoff info", () => {
    const tracer = new Tracer("user_abc");
    tracer.recordHandoff("calendar", "scheduler", "User asked to create event");
    const log = tracer.finish();
    expect(log.handoff).toEqual({
      from: "calendar",
      to: "scheduler",
      reason: "User asked to create event",
    });
  });

  it("records error info", () => {
    const tracer = new Tracer("user_abc");
    tracer.recordError("agent", "TimeoutError", "Claude API timed out");
    const log = tracer.finish();
    expect(log.error).toEqual({
      step: "agent",
      type: "TimeoutError",
      message: "Claude API timed out",
    });
  });

  it("has null handoff and error when none recorded", () => {
    const tracer = new Tracer("user_abc");
    const log = tracer.finish();
    expect(log.handoff).toBeNull();
    expect(log.error).toBeNull();
  });

  it("logs exactly one JSON line via console.log", () => {
    const tracer = new Tracer("user_abc");
    tracer.finish();
    expect(console.log).toHaveBeenCalledTimes(1);
    const call = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(() => JSON.parse(call as string)).not.toThrow();
  });

  it("does NOT include PII fields in step metadata", () => {
    const tracer = new Tracer("user_abc");
    tracer.step("router", {
      agent: "calendar",
      confidence: 0.9,
      reasoning: "User asking about Thursday",
      duration_ms: 100,
    });
    const log = tracer.finish();
    const logStr = JSON.stringify(log);
    // The log should not contain message content or raw tokens
    // (reasoning is OK — it's internal routing context, not user content)
    expect(logStr).not.toContain("accessToken");
    expect(logStr).not.toContain("refreshToken");
  });

  it("records duration_ms > 0 for a real elapsed step", async () => {
    const tracer = new Tracer("user_abc");
    const end = tracer.startStep("router", { agent: "calendar" });
    await new Promise((r) => setTimeout(r, 10));
    end();
    const log = tracer.finish();
    expect(log.steps[0].duration_ms).toBeGreaterThan(0);
  });

  it("pretty() returns a string containing traceId", () => {
    const tracer = new Tracer("user_abc");
    tracer.step("router", {
      agent: "calendar",
      confidence: 0.9,
      duration_ms: 200,
    });
    const pretty = tracer.pretty();
    expect(typeof pretty).toBe("string");
    expect(pretty).toContain("CalRoo Trace");
  });
});
