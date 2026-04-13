# AGENTS.md

> ⚠️ REQUIRED READING ORDER
>
> Before making **any product, API, auth, UX, or design decisions**, agents MUST read:
>
> 1. **PRODUCT.md** — product intent, features, data flow, UI layout
> 2. **DESIGN.md** — visual design system, brand identity, component specs, UX patterns
> 3. **AGENTS.md** — engineering standards and implementation rules
>
> ### Precedence rules
> - **PRODUCT.md defines _what_ the system is and _why_**
> - **DESIGN.md defines _how_ it looks and feels** — colors, typography, spacing, component behavior, voice & tone, animations, responsive breakpoints
> - **AGENTS.md defines _how_ it is implemented** — code standards, architecture, testing, deployment
>
> If there is any conflict:
> ➜ **PRODUCT.md wins** on feature scope and behavior
> ➜ **DESIGN.md wins** on visual/UX decisions (colors, layout, copy, motion, brand)
> ➜ **AGENTS.md wins** on code architecture and engineering standards

Project build standards for **Next.js (App Router) + OpenNext + Cloudflare Workers + Cloudflare AI Workers**.

This file is the contract: how we format, test, write APIs, handle auth, manage state, and deploy.

---

## Stack

- **Next.js 14+** (App Router, TypeScript)
- **OpenNext** (deploy Next.js to Cloudflare Workers)
- **Cloudflare Workers** (runtime)
- **Cloudflare AI Workers** (LLM inference — proxying to Anthropic Claude API)
- **Google OAuth 2.0** (authentication + Calendar API access)
- **Google Calendar API v3** (read + write calendar data)
- **Tailwind CSS** (styling)
- **No database** — all state is session-scoped (encrypted cookies + client-side)

---

## Non-negotiables

1. **No database.** All state lives in encrypted HTTP-only cookies (auth tokens) and client-side React state (chat messages, UI state). Do not introduce a DB without updating PRODUCT.md first.
2. **Cloudflare Workers compatibility.** No Node.js-only APIs (`fs`, `crypto` from Node, `Buffer` for core logic). Use Web Crypto API, Web Streams, and Fetch API.
3. **Unit tests are required** for business logic, token handling, and any bugfix (regression tests).
4. **Biome formats everything**; CI must pass.
5. **Types are explicit at boundaries**; no `any`.
6. **Abstraction is earned**: reduce duplication without creating a framework.
7. **Calendar writes require confirmation.** The Scheduler Agent can create, update, and delete events — but ONLY after explicit user confirmation via a confirmation card. No silent mutations. See PRODUCT.md §Agent System.
8. **No agent frameworks.** No LangChain, LangGraph, CrewAI, or similar. Agents are plain functions. The router is a single Claude classification call. Keep it simple.

---

## Project structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (sign-in)
│   ├── dashboard/
│   │   └── page.tsx              # Main app (calendar + chat)
│   └── api/
│       ├── auth/
│       │   ├── google/route.ts   # Initiates OAuth redirect
│       │   ├── callback/route.ts # Exchanges code for tokens
│       │   └── logout/route.ts   # Clears session cookie
│       ├── calendar/
│       │   ├── events/route.ts   # GET: fetch events from Google Calendar API
│       │   └── events/[id]/route.ts  # PATCH/DELETE: modify a specific event
│       └── chat/
│           └── route.ts          # Chat endpoint — router → agent → stream
├── components/                   # React components
│   ├── calendar/                 # Week grid, event blocks, navigation
│   ├── chat/                     # Message list, input, markdown rendering
│   │   └── confirmation-card.tsx # Scheduler Agent write confirmation UI
│   └── layout/                   # Header, auth status, responsive shell
├── lib/                          # Shared utilities (client-safe)
│   ├── env.ts                    # Env var validation (fail-fast)
│   ├── types.ts                  # Shared domain types
│   └── utils.ts                  # Date helpers, formatters
├── server/                       # Server-only code
│   ├── auth/
│   │   ├── session.ts            # Cookie encryption/decryption (Web Crypto API)
│   │   ├── google-oauth.ts       # OAuth URL builder, token exchange, token refresh
│   │   └── middleware.ts         # Auth guard for protected routes
│   ├── calendar/
│   │   └── google-calendar.ts    # Google Calendar API client (read + write)
│   ├── agents/
│   │   ├── router.ts             # Router Agent — classifies intent, returns target + confidence
│   │   ├── calendar-agent.ts     # Calendar Agent — read-only queries and analysis
│   │   ├── scheduler-agent.ts    # Scheduler Agent — create/update/delete with confirmation
│   │   ├── idea-agent.ts         # Idea Agent — creative suggestions and planning
│   │   ├── prompts/
│   │   │   ├── router-prompt.ts  # Router classification prompt (pure function)
│   │   │   ├── calendar-prompt.ts
│   │   │   ├── scheduler-prompt.ts
│   │   │   └── idea-prompt.ts
│   │   └── types.ts              # Agent-internal types (RouterResult, HandoffSignal, etc.)
│   ├── ai/
│   │   └── claude.ts             # Claude API call wrapper + SSE streaming
│   └── observability/
│       └── tracer.ts             # Structured trace logging (Tracer class)
└── tests/
    ├── unit/
    │   ├── session.test.ts
    │   ├── google-calendar.test.ts
    │   ├── router.test.ts        # Router classification tests
    │   ├── calendar-agent.test.ts
    │   ├── scheduler-agent.test.ts
    │   ├── idea-agent.test.ts
    │   ├── tracer.test.ts
    │   └── ...
    └── integration/
        └── ...
```

Rules:
- **No server imports in client components.** `src/server/**` is server-only.
- **No direct Google API calls from client components.** Always go through API routes.
- **`src/lib/`** is the only shared boundary — keep it small, typed, and free of server dependencies.

---

## Formatting & linting (Biome)

- Biome is the only formatter/linter. No Prettier, no ESLint.
- Never hand-format; run Biome.
- Expected scripts:
  - `pnpm biome check .`
  - `pnpm biome check . --write`
- Prefer clarity over cleverness. Keep functions small and named after the domain intent.

---

## TypeScript & types

### Boundary typing (required)

Everything that crosses a boundary must be typed:
- API route inputs and responses
- Google OAuth token payloads
- Google Calendar API responses (mapped to our own `CalendarEvent` type)
- Chat message shapes (`ChatMessage { role, content, timestamp }`)
- Session cookie payload
- AI request/response shapes
- Router Agent output (`RouterResult { agent, confidence, reasoning }`)
- Agent handoff signals
- Confirmation card payloads (proposed event mutations)

Rules:
- No `any`. Use `unknown` + refinement.
- Prefer discriminated unions for state (`type AuthState = { status: "authenticated"; tokens: Tokens } | { status: "unauthenticated" }`).
- Keep domain types in `src/lib/types.ts`; internal types stay close to their module.

### Core domain types

```ts
// These are canonical — all code should use these, not raw Google API shapes

type CalendarEvent = {
  id: string;
  title: string;
  start: string;       // ISO 8601
  end: string;         // ISO 8601
  attendees: string[]; // email addresses
  recurring: boolean;
  status: "confirmed" | "tentative" | "cancelled";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  confirmationCard?: ConfirmationCard; // present when Scheduler proposes a write
};

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // Unix ms
  email: string;
  name: string;
  avatarUrl: string | null;
};

// --- Agent system types (server-only, in src/server/agents/types.ts) ---

type AgentName = "calendar" | "scheduler" | "idea";

type RouterResult = {
  agent: AgentName;
  confidence: number;  // 0.0–1.0
  reasoning: string;
  clarification: string | null; // non-null when confidence < 0.5
};

type HandoffSignal = {
  type: "handoff";
  from: AgentName;
  to: AgentName;
  reason: string;
  context: Record<string, unknown>; // gathered info to pass along
};

type AgentResponse =
  | { type: "stream"; stream: ReadableStream }
  | { type: "handoff"; signal: HandoffSignal }
  | { type: "confirmation"; card: ConfirmationCard };

type ConfirmationCard = {
  action: "create" | "update" | "delete";
  event: {
    title: string;
    start: string;
    end: string;
    attendees: string[];
    description?: string;
  };
  existingEventId?: string; // for update/delete
};
```

---

## Authentication (Google OAuth 2.0)

### Flow

1. `/api/auth/google` → redirect to Google OAuth consent screen
2. Google redirects back to `/api/auth/callback` with `code`
3. Server exchanges `code` for `access_token` + `refresh_token`
4. Tokens + user info stored in an **encrypted HTTP-only cookie** (not localStorage, not a DB)
5. All subsequent API routes read the cookie to get tokens

### Implementation rules

- **Cookie encryption uses Web Crypto API** (AES-GCM). No Node.js `crypto` module.
- **`SESSION_SECRET`** env var (32+ bytes) is the encryption key.
- **Token refresh**: if `access_token` is expired, use `refresh_token` to get a new one before making Google API calls. Update the cookie with the new token.
- **Scopes**: `openid email profile https://www.googleapis.com/auth/calendar` — full read+write access (required for Scheduler Agent). See PRODUCT.md §Google Calendar API — Scopes.
- **Never trust client-provided tokens or user IDs.** Always read from the server-side cookie.
- **Logout** clears the cookie. That's it — no token revocation needed for this scope.

### Auth guard

Every protected API route must call `getSession(request)` first. If it returns null, return 401. No exceptions.

```ts
// Pattern for every protected route
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return new Response("Unauthorized", { status: 401 });
  // ... proceed
}
```

---

## Google Calendar API

### Client rules

- Use native `fetch` — no Google SDK (too heavy, Node.js dependencies).
- Base endpoint: `https://www.googleapis.com/calendar/v3/calendars/primary/events`
- Always pass `Authorization: Bearer ${accessToken}` header.

**Read operations** (`events.list`):
- Required query params: `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`, `maxResults=250`.
- **Map raw Google API responses to our `CalendarEvent` type** in `src/server/calendar/google-calendar.ts`. Never leak raw Google shapes to the client or AI prompt.

**Write operations** (Scheduler Agent only):
- `POST /events` — create event. Body: `{ summary, start, end, attendees, description }`
- `PATCH /events/{eventId}` — update event. Body: only changed fields.
- `DELETE /events/{eventId}` — cancel event.
- **Every write must be preceded by a confirmation card** shown to the user. The API route that handles writes (`/api/calendar/events/[id]`) must receive a valid action payload — never accept raw user input as event data.
- After any successful write, the client re-fetches events to refresh the calendar grid.

### Token refresh handling

If Google returns 401, attempt a token refresh using the `refresh_token`. If refresh fails, return 401 to the client (user must re-authenticate).

### Caching

No caching for now. Events are fetched fresh on every chat message and calendar view load. This is intentional — see PRODUCT.md non-goals.

---

## Agent Orchestration

### Architecture

The chat endpoint (`/api/chat`) is the orchestrator. It does NOT contain agent logic — it coordinates.

```
/api/chat (POST)
  │
  ├─ 1. Validate input + read session
  ├─ 2. Start trace: trace = new Tracer(userId)
  ├─ 3. Call Router Agent (classification only — no calendar data)
  │     trace.step("router", { target, confidence, reasoning })
  ├─ 4. If confidence < 0.5 → return clarification question
  ├─ 5. Fetch calendar events (for Calendar/Scheduler/Idea agents)
  ├─ 6. Call target agent with context
  │     trace.step("agent", { agent, tokens, duration })
  ├─ 7. If agent returns handoff → dispatch to new agent (max 1 handoff)
  │     trace.step("handoff", { from, to, reason })
  ├─ 8. Stream response OR return confirmation card
  ├─ 9. trace.finish() → log structured JSON
  └─ 10. Return response
```

### Agent implementation rules

Each agent is a single async function in `src/server/agents/`:

```ts
// Pattern for every agent
async function calendarAgent(ctx: AgentContext): Promise<AgentResponse> {
  // 1. Build system prompt (pure function from prompts/)
  // 2. Call Claude with streaming
  // 3. Return { type: "stream", stream } or { type: "handoff", signal }
}
```

**AgentContext** is the shared input shape:

```ts
type AgentContext = {
  messages: ChatMessage[];         // conversation history
  events: CalendarEvent[];         // calendar data (pre-fetched)
  user: { name: string; email: string; timezone: string };
  now: string;                     // ISO timestamp
  routerReasoning: string;         // why this agent was chosen
  routerConfidence: number;        // how confident the router was
};
```

Rules:
- **Agents are pure-ish functions.** They take context, call Claude, return a response. No global state.
- **Agents do not fetch calendar data themselves.** The orchestrator fetches once and passes it in.
- **Agents do not call other agents.** They return a `HandoffSignal` and the orchestrator handles redispatch.
- **Each agent has its own prompt file** in `src/server/agents/prompts/`. Prompts are pure functions that take `AgentContext` and return a string. This makes them testable.
- **The Router Agent is special**: it does NOT receive calendar data (keeps it fast), and it returns structured JSON instead of streaming text.

### Router Agent implementation

```ts
// src/server/agents/router.ts — simplified structure
async function routerAgent(
  message: string,
  recentHistory: ChatMessage[]
): Promise<RouterResult> {
  const prompt = buildRouterPrompt(message, recentHistory);
  const response = await callClaude({
    system: prompt,
    messages: [{ role: "user", content: message }],
    max_tokens: 200,      // classification is short
    temperature: 0.2,     // low temp for deterministic routing
    stream: false,        // no streaming — we need the full JSON
  });
  return parseRouterResponse(response); // with fallback parsing
}
```

- **Temperature 0.2** for the router (deterministic classification)
- **Temperature 0.7** for Calendar and Idea agents (balanced)
- **Temperature 0.5** for Scheduler agent (precise about times/details, some flexibility in drafting)
- **max_tokens**: 200 for router, 2048 for all other agents
- All agents use streaming except the router

### Prompt construction rules

- Every prompt file is a **pure function** — takes data in, returns a string. No side effects.
- **Always include** in agent prompts: user name, current time (ISO), timezone, serialized events array.
- **Never include raw Google API responses** in prompts. Use our `CalendarEvent` shape.
- **The router prompt includes agent descriptions** so the model knows what each agent can do.
- If events exceed ~500, truncate to the most relevant window and note the truncation.
- **CalRoo voice**: all agent prompts include the personality instructions from DESIGN.md (butler tone, no emoji, etc.)

### Confirmation card flow (Scheduler Agent)

When the Scheduler Agent decides a write is needed, it does NOT call the Google API. Instead:

1. Agent returns `{ type: "confirmation", card: ConfirmationCard }`
2. The orchestrator sends this to the client as a structured JSON event (not streamed text)
3. Client renders the confirmation card UI (see DESIGN.md)
4. User clicks Confirm → client sends `POST /api/calendar/events` (create) or `PATCH/DELETE /api/calendar/events/[id]`
5. The calendar API route validates the payload, executes the write, returns success/failure
6. Client refreshes calendar events and shows result in chat

**The Scheduler Agent NEVER has direct write access to Google Calendar.** Writes only happen through the explicit API routes, triggered by user confirmation on the client.

### Streaming rules

- Use `ReadableStream` / `TransformStream` (Web Streams API — CF Workers compatible).
- Response content type: `text/event-stream` for SSE.
- SSE event types:
  - `event: token` — streamed text token
  - `event: confirmation` — confirmation card JSON (Scheduler Agent)
  - `event: error` — error message
  - `event: done` — stream complete
- Client should use a fetch-based SSE reader (not `EventSource` — we need POST support).
- Handle upstream errors gracefully — if Claude returns an error mid-stream, send an error event and close.

---

## Observability

### Implementation

- `src/server/observability/tracer.ts` — the `Tracer` class
- Instantiated per request in `/api/chat`: `const trace = new Tracer(userId)`
- Call `trace.step(name, metadata)` at each stage (router, agent, handoff, calendar API call)
- Call `trace.finish()` at end of request — serializes to a single JSON log line via `console.log`
- In local dev, `trace.pretty()` prints human-readable output (see PRODUCT.md for format)

### Tracer class shape

```ts
class Tracer {
  constructor(userId: string);
  step(name: string, metadata: Record<string, unknown>): void;  // auto-timestamps
  finish(): TraceLog;   // logs + returns the full trace
  pretty(): string;     // human-readable for local dev
}
```

### Rules

- **Every agent call gets a trace step.** No untracked calls to Claude.
- **Never log PII**: no message content, no event titles, no attendee emails, no tokens.
- **Do log**: agent name, confidence, latency, token counts, success/failure, handoff info.
- **One trace = one JSON line.** Don't scatter logs across multiple `console.log` calls per request.
- **Tracer is tested.** `tracer.test.ts` verifies trace structure, timing, and that PII is excluded.

---

## State management (no DB)

This project has **no database**. State lives in two places:

1. **Encrypted HTTP-only cookie** — auth tokens + user profile (server-managed)
2. **Client-side React state** — chat messages, current week offset, UI state

### Rules

- Chat history is `useState` / `useReducer` in the dashboard component. Page refresh = clean slate.
- Calendar events are fetched fresh via API routes. No client-side caching layer needed for now.
- Do not introduce localStorage for state persistence unless PRODUCT.md is updated.
- If a future iteration needs persistence, update PRODUCT.md first, then add a DB.

---

## API route standards

### Request/response patterns

- All API routes use the Web Request/Response API (not Next.js-specific helpers that break on CF Workers).
- Validate inputs with Zod at the boundary. Return 400 with a safe error message on validation failure.
- Return JSON with explicit `Content-Type: application/json` (except streaming endpoints).

### Error handling

- Use a small error taxonomy:
  - `401 Unauthorized` — missing or invalid session
  - `400 Bad Request` — invalid input
  - `502 Bad Gateway` — upstream failure (Google API or AI Worker)
  - `500 Internal Server Error` — unexpected errors (log, don't leak details)
- Never expose internal error messages, stack traces, or tokens to the client.

### Performance

- Calendar event fetches should complete in <500ms for typical calendars (<250 events).
- Router classification should complete in <500ms (short prompt, no streaming, low max_tokens).
- Total time to first streamed token: <2s (router + calendar fetch + agent start). Track this via tracer.
- No N+1 patterns — one Google API call per request, not one per event.
- Calendar events fetched ONCE per chat request and passed to the agent. Never fetch inside the agent.

---

## Environment variables

### Source of truth

- `.env.example` committed (no secrets, just keys and descriptions)
- `.env.local` ignored (local development secrets)
- Cloudflare Pages dashboard for preview (staging) and production vars

### Required variables

```
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Session encryption
SESSION_SECRET=               # 32+ byte random string

# AI
ANTHROPIC_API_KEY=            # Or CF AI Worker binding
CLOUDFLARE_AI_WORKER_URL=     # If using a separate AI Worker

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Env validation (required)

`src/lib/env.ts` must validate all required variables at startup. Fail fast with a clear error message if anything is missing. Never fall back to defaults for secrets.

### Updating env vars

When adding/changing env vars:
1. Update `.env.example`
2. Update Cloudflare Pages Preview + Production variables
3. Document in PR: what changed + which envs updated
4. Update `env.ts` validation

---

## Testing

### Minimum bar

Unit tests required for:
- **Session encryption/decryption** (`src/server/auth/session.ts`)
- **Token refresh logic** (`src/server/auth/google-oauth.ts`)
- **Calendar event mapping** (raw Google → `CalendarEvent`)
- **Router Agent classification** — test with various user messages, verify correct agent + reasonable confidence
- **Each agent's prompt construction** — verify prompts include correct context and personality
- **Scheduler Agent confirmation card generation** — verify card shape for create/update/delete
- **Tracer** — verify trace structure, timing, PII exclusion
- **Bug fixes** (regression test for every fix)

### Unit tests

- Location: `src/tests/unit/**`
- Deterministic: no real network calls, no real Google API hits, no real Claude calls.
- Mock `fetch` for Google API and Claude API responses.
- For router tests: provide mock Claude responses with known agent/confidence values.
- For agent tests: mock Claude streaming responses, verify the agent returns the right `AgentResponse` type.
- Fake time when testing token expiry logic and trace timing.
- Prefer small focused test files over monolith test suites.

### Integration tests (recommended)

- Test the full chat flow: user message → router classification → agent dispatch → streamed response.
- Test handoff flow: router → agent A → handoff signal → agent B → response.
- Test confirmation flow: scheduler agent → confirmation card → user confirms → write API → calendar refresh.
- Test OAuth callback: mock Google token exchange → verify cookie is set correctly.
- Mock all external APIs (Google, Claude) — never hit real services in CI.

---

## Deployment (OpenNext + Cloudflare)

### Build & deploy

- `pnpm build` → OpenNext builds for Cloudflare Workers
- `wrangler pages deploy` (or CI/CD via Cloudflare Pages Git integration)
- `wrangler.toml` configures the Worker (compatibility flags, bindings)

### Cloudflare-specific rules

- **No Node.js built-in imports.** If a dependency uses `node:crypto`, `node:fs`, etc., it won't work. Check before adding.
- **Request size limits**: CF Workers have a 100MB request limit. Not an issue for this project but be aware.
- **CPU time limits**: 30s for Workers (50ms on free plan). AI streaming is I/O-bound so this is fine, but don't do heavy computation in the Worker.
- **Test locally with `wrangler dev`** in addition to `next dev` to catch CF compatibility issues early.

---

## Code review checklist

- [ ] Biome passes
- [ ] No `any`; boundaries are typed and validated
- [ ] Unit tests added/updated (regressions for bugfixes)
- [ ] No Node.js-only APIs used (Web Crypto, Web Streams, Fetch only)
- [ ] Auth enforced server-side on all protected routes
- [ ] Google API tokens never leaked to client
- [ ] AI prompts use mapped `CalendarEvent` types, not raw Google shapes
- [ ] Streaming response handles errors gracefully
- [ ] Router classification tested for new intent types
- [ ] Scheduler Agent writes always gated by confirmation card — no silent mutations
- [ ] Tracer covers all agent steps — no untracked Claude calls
- [ ] Trace logs contain no PII (no message content, event titles, or tokens)
- [ ] UI uses CSS variables from DESIGN.md — no hardcoded colors or spacing
- [ ] User-facing copy matches butler voice & tone (DESIGN.md)
- [ ] Components render correctly in both light and dark mode
- [ ] Responsive behavior matches DESIGN.md breakpoints (desktop/tablet/mobile)
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Env changes documented and applied to staging/prod
- [ ] No secrets committed

---

## Design compliance (DESIGN.md)

All UI work must follow DESIGN.md. It is the single source of truth for visual decisions.

### Rules

- **Use CSS custom properties** defined in DESIGN.md for all colors, spacing, radii, and shadows. Never hardcode hex values or pixel sizes in components.
- **Typography**: Playfair Display for headings/wordmark, DM Sans for body/UI, JetBrains Mono for email drafts and timestamps. No other fonts. No system font fallbacks as primary choice.
- **Color palette**: Use the token names (`--color-mahogany`, `--color-brass`, etc.). If you need a new color, add it to DESIGN.md first — don't inline it.
- **Voice & tone**: All user-facing copy (empty states, errors, loading text, placeholders) must match the butler voice defined in DESIGN.md. No generic "Loading..." or "Something went wrong" messages.
- **Roo mascot**: Use the SVG assets from `public/roo/`. Roo appears in empty states, errors, and as the chat avatar. Never omit Roo from states where DESIGN.md specifies an illustration.
- **Motion**: Follow the animation table in DESIGN.md exactly — durations, easings, and what does NOT animate. Respect `prefers-reduced-motion`.
- **Responsive**: Three breakpoints (desktop ≥1024, tablet 768–1023, mobile <768). Follow the layout rules for each. Chat panel is collapsible on desktop, tab-based on mobile.
- **Dark mode**: Swap CSS variables as specified. Verify contrast ratios. Test every component in both themes.
- **Accessibility**: WCAG 2.1 AA contrast, 44px mobile touch targets, focus indicators with `--color-brass`, `aria-live` on chat, `prefers-reduced-motion` support.

### When to update DESIGN.md

If a component needs a visual treatment not covered in DESIGN.md:
1. Propose the addition in the PR description
2. Add it to DESIGN.md in the same PR
3. Use existing tokens and patterns — don't invent a new visual language

---

## Definition of done

A change is done when it:
- passes Biome + tests
- works on Cloudflare Workers (not just `next dev`)
- enforces auth on every protected route
- handles Google API errors and token refresh
- routes to the correct agent with traced decisions
- streams AI responses without dropping connections
- gates all calendar writes behind confirmation cards
- logs structured traces for every chat request
- matches DESIGN.md visually (tokens, typography, layout, voice)
- works in both light and dark mode
- is responsive across all three breakpoints
- is readable and maintainable

---

## External API Documentation (Reference Only)

External API reference material lives in:

```
docs/external/
├── google-oauth/
├── google-calendar-api/
└── anthropic-api/
```

### Authority rules
- External API docs explain **syntax, parameters, and edge cases only**.
- **PRODUCT.md defines allowed behavior and feature scope.**
- **AGENTS.md defines how that behavior is implemented.**
- Do not infer product behavior from API examples.
- When in doubt, stop and update documentation instead of guessing.