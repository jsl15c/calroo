# CalRoo — Product Spec

## Overview

CalRoo is a web-based calendar concierge that connects to a user's Google Calendar and provides an AI-powered chat interface backed by a multi-agent system. A routing agent classifies each user message and dispatches it to the right specialist agent — one for reading/analyzing the calendar, one for scheduling actions (create, update, delete), and one for generating ideas. Users interact with a single chat thread; the agent orchestration is invisible to them.

## Tech Stack

- **Framework**: Next.js (App Router, deployed via OpenNext on Cloudflare Workers)
- **AI**: Anthropic Claude API (called from CF Workers / API routes)
- **Auth**: Google OAuth 2.0 (manual PKCE flow)
- **Calendar Data**: Google Calendar API v3 (REST — read AND write)
- **Database**: None — all state is session-scoped (encrypted cookies + client-side)
- **Styling**: Tailwind CSS
- **Observability**: Lightweight structured logging (no LangChain, no LangSmith)

## Architecture

```
┌─────────────┐     ┌─────────────────────────────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js on Cloudflare Workers       │────▶│ Google APIs   │
│  (React UI)  │◀────│                                     │◀────│ (Calendar,   │
│              │     │  /api/chat                          │     │  OAuth)       │
└─────────────┘     │    │                                │     └──────────────┘
                    │    ▼                                │
                    │  ┌───────────────────┐              │
                    │  │  Router Agent     │              │
                    │  │  (classify +      │              │
                    │  │   confidence)     │              │
                    │  └──┬────┬────┬──────┘              │
                    │     │    │    │                      │
                    │     ▼    ▼    ▼                      │
                    │  ┌────┐┌────┐┌────┐                  │
                    │  │Cal ││Sch ││Idea│                  │
                    │  │Agt ││Agt ││Agt │                  │
                    │  └────┘└────┘└────┘                  │
                    │         │                            │
                    │         ▼                            │
                    │  Google Calendar API (read + write)  │
                    └─────────────────────────────────────┘
```

### Data Flow

1. User authenticates with Google via OAuth 2.0
2. Tokens stored in an encrypted HTTP-only cookie (no DB)
3. User sends a chat message
4. `/api/chat` receives the message + conversation history
5. **Router Agent** classifies the intent, assigns a target agent + confidence score
6. If confidence ≥ threshold → dispatch to the target agent. If below → Router asks the user a clarifying question.
7. The target agent executes (fetching calendar data, calling Google Calendar API, or generating ideas)
8. Response streams back to the client
9. All agent decisions are logged with structured trace data
10. No conversation history is persisted server-side — refreshing starts fresh

---

## Agent System

### Overview

The agent system is simple function orchestration — no framework, no LangChain. Each agent is a function that takes context (conversation history, calendar data, user info) and returns a response. The router decides who gets called.

### Router Agent

The router is the front door. Every user message hits it first.

**Input**: the user's message + last 2–3 conversation turns (for context)

**Output**:
```json
{
  "agent": "calendar" | "scheduler" | "idea",
  "confidence": 0.0–1.0,
  "reasoning": "User is asking about existing events on Thursday",
  "clarification": null
}
```

**Behavior:**
- Confidence ≥ 0.8 → dispatch immediately to the target agent
- Confidence 0.5–0.79 → dispatch but include the routing context so the target agent knows it's a soft match (agent can ask for clarification itself)
- Confidence < 0.5 → Router responds directly with a clarifying question ("I want to make sure I help you correctly — are you looking to check your schedule, make a change, or brainstorm ideas?")

**Implementation**: single Claude call with a short classification prompt. The prompt includes the agent descriptions so the model knows what each can do. Response is structured JSON (enforce with system prompt instruction, parse with fallback).

**The router does NOT:**
- Execute any calendar actions
- Fetch calendar data
- Generate long responses
- Stream tokens (it's a fast classification call, not a conversation)

### Calendar Agent

Handles all read-only calendar queries. This is the "what's on my schedule" agent.

**Capabilities:**
- Summarize a day, week, or custom time range
- Answer questions about specific events (who's attending, what time, how long)
- Analyze time usage (meeting hours, free blocks, busiest days)
- Find available slots for a given duration
- Compare weeks or identify patterns
- Provide recommendations for reducing meeting load

**Context it receives:**
- User's calendar events for the relevant time window (fetched from Google Calendar API)
- User's name, timezone, current time
- Conversation history
- Router's reasoning (so it knows why it was chosen)

**Google Calendar API access**: read-only (`events.list`)

**System prompt personality**: speaks in CalRoo's butler voice (see DESIGN.md)

### Scheduler Agent

Handles all write actions on the calendar. This is the "make it happen" agent.

**Capabilities:**
- Create new events (with title, time, duration, attendees, description)
- Update existing events (reschedule, change attendees, update description)
- Delete/cancel events
- Draft email invites or update notifications for the user to review
- Block recurring time (focus blocks, workout slots, lunch holds)

**Critical behavior — confirmation before writes:**
Every write action requires explicit user confirmation before execution. The flow is:

1. User asks to schedule/change/delete something
2. Scheduler Agent proposes the action with full details:
   ```
   I'd like to schedule the following:
   
   **Team Sync with Joe and Dan**
   Thursday, April 16 · 2:00 – 2:30 PM
   Attendees: joe@co.com, dan@co.com
   
   Shall I go ahead and add this to your calendar?
   ```
3. User confirms → Agent calls Google Calendar API to execute
4. User declines or modifies → Agent adjusts the proposal

**The Scheduler Agent NEVER silently creates, updates, or deletes events.** Every mutation is previewed first.

**Context it receives:**
- Same calendar context as the Calendar Agent (needs to check for conflicts)
- Conversation history (may contain prior proposals the user modified)
- Router's reasoning

**Google Calendar API access**: read + write (`events.insert`, `events.update`, `events.delete`)

### Idea Agent

Handles creative and planning requests. This is the "what should I do" agent.

**Capabilities:**
- Suggest meeting agendas based on attendees and context
- Generate team hangout or offsite ideas
- Propose weekly schedule structures (deep work blocks, meeting days, etc.)
- Draft event descriptions and invite copy
- Brainstorm solutions for scheduling conflicts
- Suggest optimal meeting lengths based on attendee count and purpose

**Context it receives:**
- Calendar data (so suggestions are grounded in real availability)
- Conversation history
- Router's reasoning

**Google Calendar API access**: read-only (needs to know what's already scheduled to make relevant suggestions)

**This agent is the most creative** — it has more latitude in tone and can be playful within the CalRoo voice.

### Agent Handoff

Sometimes an agent realizes mid-response that the request belongs to a different agent. Example: user asks the Calendar Agent "What do I have Thursday?" and follows up with "Cancel the 2pm." The Calendar Agent shouldn't handle that — it should hand off to the Scheduler Agent.

**Handoff rules:**
- An agent can signal a handoff by returning a structured handoff response instead of a user-facing message
- The handoff includes: target agent, the reason, and any context gathered so far
- The router validates the handoff and dispatches to the new agent
- The user sees a seamless response — no "transferring you to another agent" message
- A handoff counts as one additional agent call (max chain: router → agent A → handoff → agent B). No deeper chaining — if agent B also wants to hand off, it responds with what it can and notes the limitation.

---

## Observability

### Philosophy

No LangChain. No LangSmith. No vendor SDK. Just structured JSON logs that tell you what happened, how long it took, and whether it worked.

### Trace Structure

Every chat request generates a **trace** — a single object that captures the full agent flow:

```json
{
  "traceId": "tr_a1b2c3d4",
  "timestamp": "2026-04-13T14:32:01.000Z",
  "userId": "user_abc",
  "duration_ms": 1840,
  "steps": [
    {
      "step": "router",
      "agent": null,
      "duration_ms": 320,
      "input_tokens": 180,
      "output_tokens": 45,
      "result": {
        "target": "calendar",
        "confidence": 0.92,
        "reasoning": "User asking about Thursday schedule"
      }
    },
    {
      "step": "agent",
      "agent": "calendar",
      "duration_ms": 1520,
      "input_tokens": 2400,
      "output_tokens": 380,
      "calendar_events_fetched": 47,
      "result": "success"
    }
  ],
  "handoff": null,
  "error": null
}
```

### What Gets Logged

| Event | Fields |
|---|---|
| Router classification | target agent, confidence, reasoning, latency, token counts |
| Agent execution | agent name, latency, token counts, success/failure |
| Calendar API call | endpoint, event count returned/modified, latency, HTTP status |
| Handoff | source agent, target agent, reason |
| Error | step where it failed, error type, message (sanitized — no tokens or PII) |
| Clarification | that the router asked for clarification instead of dispatching |

### What Does NOT Get Logged

- User message content (privacy)
- Full AI prompts or responses (cost + privacy)
- Google access tokens or refresh tokens (security)
- Calendar event details (PII — titles, attendees, etc.)

### Implementation

- A `Tracer` class in `src/server/observability/tracer.ts`
- Instantiated per request: `const trace = new Tracer(userId)`
- Each step calls `trace.step("router", { ... })` with timing and metadata
- At the end of the request, `trace.finish()` serializes and logs to `console.log` as a single JSON line
- In production, CF Workers logs are captured by Cloudflare's log system (or forward to any log drain later)
- For local dev, a `trace.pretty()` method prints a human-readable summary to the console

### Example Local Dev Output

```
─── CalRoo Trace tr_a1b2c3d4 ──────────────────────────
  user:   user_abc
  total:  1,840ms

  1. ROUTER → calendar (confidence: 0.92)     320ms
     "User asking about Thursday schedule"
  2. CALENDAR AGENT                           1,520ms
     47 events fetched · 2,400 in / 380 out tokens
     ✓ success

  no handoffs · no errors
────────────────────────────────────────────────────────
```

### Metrics to Track (via log aggregation)

Once logs are flowing, these are the key metrics to watch:

- **Router accuracy**: how often does the first-choice agent handle the full request without handoff?
- **Confidence distribution**: histogram of router confidence scores (are we hovering near the threshold?)
- **Agent latency p50/p95**: is any agent consistently slow?
- **Handoff rate**: high handoff rate = router prompt needs tuning
- **Error rate by agent**: which agent fails most?
- **Clarification rate**: how often does the router punt back to the user?
- **Token usage per request**: cost tracking

---

## Google Calendar API — Scopes

Since the Scheduler Agent writes to the calendar, scopes are:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/calendar` (full read + write)

The OAuth consent screen must reflect this: "CalRoo will be able to view and edit your Google Calendar."

---

## Context Window Strategy

This is NOT a RAG pipeline. Calendar data is structured and small enough to fit in context.

**On each agent call:**

1. Determine the relevant time window (default: 2 weeks back + 4 weeks forward)
2. Fetch events from Google Calendar API for that window
3. Serialize events into a compact JSON structure:
   ```json
   {
     "timezone": "America/New_York",
     "now": "2026-04-13T10:30:00-04:00",
     "events": [
       {
         "id": "abc123",
         "title": "Standup",
         "start": "2026-04-13T09:00:00-04:00",
         "end": "2026-04-13T09:30:00-04:00",
         "attendees": ["joe@co.com", "dan@co.com"],
         "recurring": true,
         "status": "confirmed"
       }
     ]
   }
   ```
4. Inject into the agent's system prompt
5. Send conversation history + system prompt to Claude

**The Router Agent does NOT receive calendar data** — it only sees the user's message and recent conversation turns. This keeps the routing call fast and cheap.

---

## Features

### 1. Google Authentication

- "Sign in with Google" button on landing page
- Request scopes: `calendar` (full access), `userinfo.email`, `userinfo.profile`
- On success, redirect to the dashboard
- Display user's name and avatar in the header
- Sign-out button that clears the session

### 2. Calendar Display

- Default view: current week (Mon–Sun)
- Events as positioned blocks on a time grid
- Each event shows: title, time range, color indicator
- Navigation: previous/next week arrows, "Today" button
- Calendar refreshes after any Scheduler Agent write action (optimistic update on the client, verified by re-fetch)

### 3. Chat Interface

A persistent chat panel where the user talks to CalRoo. The multi-agent system is invisible — the user sees one continuous conversation.

**Example interactions by agent:**

| User Says | Routed To | What Happens |
|---|---|---|
| "What does my week look like?" | Calendar | Summarizes events, highlights busy/free blocks |
| "How much time am I in meetings?" | Calendar | Analyzes events, calculates percentages |
| "Schedule a 1:1 with Joe on Thursday" | Scheduler | Finds open slots, proposes a time, confirms before creating |
| "Cancel my 3pm tomorrow" | Scheduler | Shows event details, confirms before deleting |
| "Move my standup to 10am" | Scheduler | Proposes the update, confirms before modifying |
| "What's a good team activity for 8 people?" | Idea | Suggests activities based on group size and available time |
| "Help me plan a better weekly schedule" | Idea | Analyzes current patterns, proposes a restructured week |
| "Draft an email to reschedule my 2pm" | Idea | Generates polished email copy the user can send |

**Chat UX:**
- Messages stream in token-by-token (SSE)
- User's messages on the right, CalRoo on the left
- Markdown rendering for responses
- Confirmation cards for write actions (structured UI, not just text)
- Loading indicator while routing + agent processing

### 4. Confirmation Cards (Scheduler Agent)

When the Scheduler Agent proposes a write action, it renders as a structured card in the chat:

```
┌─────────────────────────────────────┐
│ 📅 New Event                        │
│                                     │
│ Team Sync with Joe and Dan          │
│ Thursday, Apr 16 · 2:00–2:30 PM    │
│ Attendees: joe@co.com, dan@co.com   │
│                                     │
│    [ Confirm ]    [ Edit ]          │
└─────────────────────────────────────┘
```

- **Confirm**: executes the API call, shows success state, refreshes calendar
- **Edit**: puts the details back into the chat as an editable prompt
- Card transitions to a success/failure state after action

---

## Pages / Routes

| Route | Description |
|---|---|
| `/` | Landing page with sign-in button |
| `/dashboard` | Main app — calendar view + chat panel (protected) |
| `/api/auth/google` | Initiates OAuth flow |
| `/api/auth/callback` | Handles OAuth callback, sets session cookie |
| `/api/auth/logout` | Clears session |
| `/api/calendar/events` | Fetches events from Google Calendar API (requires auth) |
| `/api/calendar/events/[id]` | Update or delete a specific event (requires auth) |
| `/api/chat` | Chat endpoint — runs router → agent → response |

---

## UI Layout (Dashboard)

```
┌──────────────────────────────────────────────────────┐
│ [Roo] CalRoo               [Today] [<] [>]   [☽] [↗]│
├────────────────────────────────┬─────────────────────┤
│                                │                     │
│                                │   Chat with Roo     │
│    Weekly Calendar Grid        │                     │
│    (time slots on Y axis,      │   [messages...]     │
│     days on X axis)            │   [confirm card]    │
│                                │                     │
│                                │                     │
│                                │   ┌───────────────┐ │
│                                │   │ Ask Roo...    │ │
│                                │   └───────────────┘ │
└────────────────────────────────┴─────────────────────┘
```

- Calendar takes ~60% width, chat takes ~40%
- On mobile: tab-based switching between calendar and chat views
- Dark mode support
- See DESIGN.md for full visual specification

---

## Non-Goals (for now)

- No database or conversation persistence
- No multi-account support
- No real-time calendar sync (fetched per request)
- No CalDAV / non-Google calendar support
- No LangChain, LangGraph, or agent framework dependencies
- No external observability vendors (Datadog, LangSmith, etc.) — just structured logs

---

## Future Enhancements (if time allows)

- Smart suggestions on page load ("You have 6 hours of meetings tomorrow — want to reschedule any?")
- Calendar heatmap showing meeting density over time
- Drag-and-drop rescheduling that triggers Scheduler Agent confirmation flow
- Observability dashboard (parse trace logs into a simple admin view)
- Multi-calendar support (work + personal)
- Recurring event intelligence ("You've had this weekly meeting for 6 months — still useful?")