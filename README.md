# CalRoo

An AI-powered calendar concierge. Connect your Google Calendar and chat with a multi-agent system that can read, analyse, and schedule events on your behalf.

## How it works

Every chat message is classified by a router agent that dispatches it to the right specialist:

- **Calendar Agent** — answers questions about your schedule, finds free time, analyses patterns. Fetches additional Google Calendar data on-demand via function calling when you ask about dates outside the preloaded window.
- **Scheduler Agent** — creates, updates, and deletes events. All writes require explicit confirmation before touching your calendar.
- **Idea Agent** — generates scheduling suggestions and planning ideas.

Responses stream back in real time. No conversation history is stored server-side — refreshing starts fresh.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **OpenNext + Cloudflare Workers** (runtime)
- **OpenRouter** (LLM inference — Claude Haiku 4.5 by default)
- **Google OAuth 2.0 + Calendar API v3**
- **Biome** (formatting + linting)
- No database — state lives in encrypted HTTP-only cookies and client-side React state

---

## Running locally

### Prerequisites

- Node.js 18+
- pnpm
- A Google Cloud project with the Calendar API enabled
- An OpenRouter API key

### 1. Clone and install

```bash
git clone https://github.com/your-org/calroo.git
cd calroo
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` for local dev |
| `SESSION_SECRET` | 32+ character random string for cookie encryption |
| `OPENROUTER_API_KEY` | API key from [openrouter.ai](https://openrouter.ai/keys) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

**Generate a session secret:**

```bash
openssl rand -base64 32
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Add `http://localhost:3000/api/auth/callback` as an authorised redirect URI
4. Enable the **Google Calendar API** for your project
5. Add your Google account as a test user under OAuth consent screen

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

### Cloudflare Workers local dev

To test against the actual Workers runtime:

```bash
pnpm build
npx wrangler pages dev
```

---

## Deployment

CalRoo deploys to Cloudflare Pages via OpenNext.

```bash
pnpm build
npx wrangler pages deploy
```

Set the following secrets in the **Cloudflare Pages dashboard** (Settings → Environment variables). Do not commit them to `wrangler.toml`.

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI      # https://your-domain.com/api/auth/callback
SESSION_SECRET
OPENROUTER_API_KEY
NEXT_PUBLIC_APP_URL      # https://your-domain.com
```

---

## Development

**Lint and format:**

```bash
pnpm biome check .
pnpm biome check . --write   # auto-fix
```

**Type check:**

```bash
pnpm tsc --noEmit
```

**Tests:**

```bash
pnpm test
```

### Project structure

```
src/
├── app/
│   ├── page.tsx                  # Landing / sign-in
│   ├── dashboard/                # Main app
│   └── api/
│       ├── auth/                 # Google OAuth flow + logout
│       ├── calendar/events/      # GET / POST / PATCH / DELETE
│       └── chat/                 # Orchestrator endpoint
├── components/
│   ├── calendar/                 # Week + month grid
│   ├── chat/                     # Message list, input, confirmation card
│   └── layout/                   # Header
├── lib/                          # Shared types and utilities
└── server/
    ├── agents/                   # Router, Calendar, Scheduler, Idea agents
    ├── ai/                       # OpenRouter client + SSE streaming
    ├── auth/                     # Session encryption, OAuth helpers, middleware
    ├── calendar/                 # Google Calendar API client
    └── observability/            # Structured trace logging
```
