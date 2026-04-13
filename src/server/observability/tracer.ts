// Structured trace logging — one JSON line per chat request.
// Never logs PII: no message content, event titles, attendees, or tokens.

type TraceStep = {
  step: string;
  agent?: string | null;
  duration_ms: number;
  startedAt: number;
  [key: string]: unknown;
};

export type TraceLog = {
  traceId: string;
  timestamp: string;
  userId: string;
  duration_ms: number;
  steps: TraceStep[];
  handoff: { from: string; to: string; reason: string } | null;
  error: { step: string; type: string; message: string } | null;
};

export class Tracer {
  private traceId: string;
  private userId: string;
  private startedAt: number;
  private steps: TraceStep[];
  private handoff: TraceLog["handoff"];
  private error: TraceLog["error"];

  constructor(userId: string) {
    this.traceId = `tr_${Math.random().toString(36).slice(2, 10)}`;
    this.userId = userId;
    this.startedAt = Date.now();
    this.steps = [];
    this.handoff = null;
    this.error = null;
    this.activeStep = null;
  }

  /**
   * Records a completed step.
   * Pass metadata but NEVER include: message content, event titles, attendee
   * emails, or token strings.
   */
  step(
    name: string,
    metadata: Record<string, unknown> & { duration_ms?: number },
  ): void {
    const { duration_ms, ...rest } = metadata;
    this.steps.push({
      step: name,
      agent: (rest.agent as string | undefined) ?? null,
      duration_ms: duration_ms ?? 0,
      startedAt: Date.now(),
      ...rest,
    });
  }

  /** Marks the start of a step and returns a function to end it. */
  startStep(name: string, metadata: Record<string, unknown> = {}): () => void {
    const t0 = Date.now();
    return () => {
      this.step(name, { ...metadata, duration_ms: Date.now() - t0 });
    };
  }

  /** Records a handoff between agents. */
  recordHandoff(from: string, to: string, reason: string): void {
    this.handoff = { from, to, reason };
  }

  /** Records an error at a specific step. */
  recordError(step: string, type: string, message: string): void {
    this.error = { step, type, message };
  }

  /** Finalizes the trace, logs it as a single JSON line, and returns it. */
  finish(): TraceLog {
    const log: TraceLog = {
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      duration_ms: Date.now() - this.startedAt,
      steps: this.steps,
      handoff: this.handoff,
      error: this.error,
    };

    console.log(JSON.stringify(log));
    return log;
  }

  /** Human-readable summary for local development. */
  pretty(): string {
    const total = Date.now() - this.startedAt;
    const lines: string[] = [
      `─── CalRoo Trace ${this.traceId} ${"─".repeat(30)}`,
      `  user:   ${this.userId}`,
      `  total:  ${total.toLocaleString()}ms`,
      "",
    ];

    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i];
      const label = s.agent
        ? `${String(s.step).toUpperCase()} → ${s.agent}`
        : String(s.step).toUpperCase();
      lines.push(`  ${i + 1}. ${label.padEnd(40)} ${String(s.duration_ms)}ms`);
      if (s.reasoning) lines.push(`     "${s.reasoning}"`);
      if (s.result) lines.push(`     ${s.result}`);
    }

    if (this.handoff) {
      lines.push(
        `\n  handoff: ${this.handoff.from} → ${this.handoff.to} (${this.handoff.reason})`,
      );
    } else {
      lines.push("\n  no handoffs");
    }

    if (this.error) {
      lines.push(`  ERROR at ${this.error.step}: ${this.error.message}`);
    } else {
      lines.push("  no errors");
    }

    lines.push("─".repeat(56));
    return lines.join("\n");
  }
}
