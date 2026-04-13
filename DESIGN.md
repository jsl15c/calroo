# DESIGN.md — CalRoo

## Design Philosophy

CalRoo is a personal calendar concierge — not a tool, a *service*. The UX should feel like having a sharply dressed butler who also happens to be a kangaroo. Elevated language, refined interactions, and white-glove attention to detail — but never stuffy. There's a warmth and wit underneath the polish.

**The tension that makes CalRoo distinctive:**
- The *butler* gives us: composure, anticipation, precision, trust, understated luxury
- The *kangaroo* gives us: energy, warmth, surprise, a pocket (the pouch!) for holding things, playfulness

CalRoo doesn't feel like a chatbot. It feels like someone who already knows your schedule better than you do and is gently steering you through your day.

---

## Brand Identity

### Name
**CalRoo** — Calendar + Kangaroo. Short, memorable, slightly absurd in the best way.

### Mascot: Roo
A kangaroo in a tailcoat. Not cartoonish — think Wes Anderson character design. Roo has:
- A subtle knowing expression (one brow slightly raised)
- A tailcoat with a pocket square
- A pouch that occasionally holds calendar items, emails, or a pocket watch
- Clean line art style — works at 16px favicon and 200px hero size

Roo appears:
- On the landing page (welcoming, standing with a slight bow)
- As the chat avatar (head only, small)
- In empty states (holding a sign, checking a pocket watch)
- In error states (looking slightly flustered but composed)
- Never animated to the point of distraction — subtle idle states only

### Voice & Tone
CalRoo speaks like a butler, not a robot:

| Instead of | CalRoo says |
|---|---|
| "Here are your events" | "Your week ahead, if I may" |
| "No events found" | "Your calendar is refreshingly clear" |
| "Error loading" | "I seem to have misplaced that — one moment" |
| "Signed out" | "Until next time" |
| "Loading..." | "Consulting your schedule..." |

Rules:
- First person, slightly formal, never robotic
- Contractions are fine ("I've prepared" not "I have prepared") — butler, not Victorian
- Light humor is encouraged but never at the user's expense
- Never use emoji in the assistant's responses. Punctuation does the work.
- Refer to events as "engagements" or "appointments" occasionally for flavor, but don't overdo it

---

## Color System

The palette draws from gentleman's club interiors — deep, warm, grounded — with one unexpected accent.

### Core Palette

```css
/* Light mode */
--color-ink:           #1C1917;       /* Stone 900 — primary text */
--color-ink-soft:      #78716C;       /* Stone 500 — secondary text */
--color-ink-faint:     #A8A29E;       /* Stone 400 — tertiary/disabled */

--color-parchment:     #FAFAF9;       /* Stone 50 — page background */
--color-linen:         #F5F5F4;       /* Stone 100 — card/panel background */
--color-cream:         #E7E5E4;       /* Stone 200 — borders, dividers */

--color-mahogany:      #4A2C2A;       /* Deep reddish brown — primary brand */
--color-mahogany-soft: #6B4745;       /* Lighter mahogany — hover states */
--color-brass:         #B8860B;       /* Dark goldenrod — accents, CTAs */
--color-brass-glow:    #D4A843;       /* Lighter brass — hover on accents */

--color-roo:           #C8553D;       /* Kangaroo terracotta — mascot, fun moments */
--color-roo-soft:      #E8856F;       /* Light terracotta — subtle highlights */

--color-success:       #3D7A4A;       /* Forest green — confirmed events */
--color-caution:       #B8860B;       /* Brass doubles as warning */
--color-error:         #9B2C2C;       /* Deep red — errors, conflicts */
```

### Dark Mode

```css
--color-ink:           #E7E5E4;       /* Stone 200 */
--color-ink-soft:      #A8A29E;       /* Stone 400 */
--color-ink-faint:     #57534E;       /* Stone 600 */

--color-parchment:     #1C1917;       /* Stone 900 */
--color-linen:         #292524;       /* Stone 800 */
--color-cream:         #44403C;       /* Stone 700 */

--color-mahogany:      #D4A89A;       /* Inverted — warm light brown */
--color-brass:         #D4A843;       /* Brass stays warm */
--color-roo:           #E8856F;       /* Terracotta lightened */
```

### Event Color Coding

Events on the calendar grid use muted, distinguished tones:

```css
--event-meeting:       #4A2C2A20;     /* Mahogany 12% — meetings */
--event-meeting-bar:   #4A2C2A;       /* Mahogany solid — left border */
--event-focus:         #3D7A4A20;     /* Green 12% — focus/deep work */
--event-focus-bar:     #3D7A4A;
--event-personal:      #C8553D20;     /* Terracotta 12% — personal */
--event-personal-bar:  #C8553D;
--event-tentative:     #B8860B20;     /* Brass 12% — tentative */
--event-tentative-bar: #B8860B;
```

Each event block has a 3px solid left border in the full color, with the background at 12% opacity. Clean, scannable, not overwhelming.

---

## Typography

### Font Stack

- **Display / Headings**: `"Playfair Display", Georgia, serif`
  - Used for: page titles, the CalRoo wordmark, section headers
  - Weight: 600 (semibold) for headings, 400 (regular) for the wordmark
  - Gives the butler energy — editorial, refined, confident

- **Body / UI**: `"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif`
  - Used for: all body text, labels, buttons, chat messages, calendar event titles
  - Weights: 400 (regular), 500 (medium for labels/buttons), 600 (semibold for emphasis)
  - Clean and modern without being clinical — the competent staff behind the elegance

- **Monospace** (email drafts, time displays): `"JetBrains Mono", "Fira Code", monospace`
  - Used for: drafted emails in chat, time stamps, code-like content
  - Weight: 400
  - Gives email drafts a "typed letter" feel

### Scale

```css
--text-xs:    0.75rem  / 1rem;        /* 12px — timestamps, tertiary labels */
--text-sm:    0.875rem / 1.25rem;     /* 14px — secondary text, event details */
--text-base:  1rem     / 1.5rem;      /* 16px — body text, chat messages */
--text-lg:    1.125rem / 1.75rem;     /* 18px — card titles, section labels */
--text-xl:    1.5rem   / 2rem;        /* 24px — page section headings */
--text-2xl:   2rem     / 2.5rem;      /* 32px — page title */
--text-hero:  3rem     / 3.5rem;      /* 48px — landing page hero */
```

---

## Spacing & Layout

### Grid

- Dashboard: CSS Grid — `grid-template-columns: 1fr 420px` (calendar | chat)
- Below 1024px: single column with tab navigation (Calendar / Chat tabs)
- Below 640px: full-width mobile layout, chat as primary view

### Spacing Scale (8px base)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Border Radius

```css
--radius-sm:   4px;       /* Buttons, inputs, small elements */
--radius-md:   8px;       /* Cards, panels */
--radius-lg:   12px;      /* Modal dialogs, popovers */
--radius-full: 9999px;    /* Avatars, pills */
```

Rounded but not bubbly. This is a tailored suit, not a bouncy castle.

---

## Components

### Landing Page

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              [Roo illustration]                    │
│                                                    │
│            CalRoo                                  │
│     Your calendar, attended to.                    │
│                                                    │
│        [ Sign in with Google ]                     │
│                                                    │
│   "Good morning. Shall we review your week?"       │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Centered layout, generous whitespace
- Roo illustration: ~180px, subtle entrance animation (a gentle bow or nod)
- "CalRoo" in Playfair Display, 48px
- Tagline in DM Sans, 18px, `--color-ink-soft`
- Sign-in button: `--color-mahogany` background, white text, slight shadow
- Bottom quote: italic DM Sans, `--color-ink-faint`, rotates between 3–4 butler greetings on each visit

**Greeting rotation (time-aware):**
- Before noon: "Good morning. Shall we review your week?"
- Afternoon: "Good afternoon. Your schedule awaits."
- Evening: "Good evening. Let's prepare for tomorrow."
- Weekend: "A fine weekend ahead. Anything to arrange?"

### Header (Dashboard)

```
┌──────────────────────────────────────────────────────┐
│ [Roo icon] CalRoo          [Today] [◀] [▶]   [☽] [↗]│
└──────────────────────────────────────────────────────┘
```

- Height: 56px
- Left: Roo head icon (24px) + "CalRoo" wordmark in Playfair Display
- Center-right: Calendar navigation — "Today" pill button, prev/next arrows
- Far right: Dark mode toggle (sun/moon), user avatar with sign-out dropdown
- Bottom border: 1px `--color-cream`
- Background: `--color-parchment`

### Calendar Grid

The week view is the centerpiece. It should feel like a well-organized desk planner.

**Time column (left):**
- Width: 64px
- Hours displayed: 7:00 AM – 9:00 PM
- Time labels in `--text-xs`, `--color-ink-faint`, right-aligned
- Current time indicator: horizontal line in `--color-roo` with a small dot

**Day columns:**
- Header: day name (Mon, Tue...) + date number
- Today's column header gets `--color-roo` text and a subtle background tint (`--color-roo` at 4%)
- Hour grid lines: 1px dashed `--color-cream`
- Half-hour lines: 1px dotted `--color-cream` at 50% opacity

**Event blocks:**
- Positioned absolutely based on start/end time
- Left border: 3px solid (color by category)
- Background: category color at 12% opacity
- Content: event title (DM Sans 500, truncated with ellipsis) + time range (`--text-xs`, regular)
- Border radius: `--radius-sm`
- On hover: `translateY(-1px)`, shadow increase, full title in tooltip
- Overlapping events: side-by-side with reduced width (minimum 40% of column)

**Empty day state:** Faint text centered in the column — "Clear skies" in `--color-ink-faint` italic

### Chat Panel

The right-side panel. This is where Roo works.

**Panel structure:**

```
┌─────────────────────────┐
│ Chat with Roo        [—]│  ← collapsible header
├─────────────────────────┤
│                         │
│  [Roo avatar]           │
│  "Good afternoon. Your  │
│   Tuesday is rather     │
│   packed — shall we     │
│   see about that?"      │
│                         │
│            [User msg]   │
│            "How much    │
│             time am I   │
│             in meetings │
│             this week?" │
│                         │
│  [Roo avatar]           │
│  "This week you have    │
│   14.5 hours across     │
│   22 engagements..."    │
│                         │
├─────────────────────────┤
│ [message input]    [→]  │  ← input area
└─────────────────────────┘
```

**Chat header:**
- "Chat with Roo" in DM Sans 500
- Collapse/expand chevron on desktop
- On mobile: full-screen view with back arrow to calendar

**Message bubbles:**

- **User messages**: right-aligned, `--color-mahogany` background, white text, `--radius-md` with bottom-right corner squared (`border-bottom-right-radius: 2px`)
- **Roo messages**: left-aligned, `--color-linen` background, `--color-ink` text, `--radius-md` with bottom-left corner squared. Small Roo head avatar (28px) to the left of the first message in a group.
- Max width: 85% of panel
- Spacing between messages from same sender: `--space-2`
- Spacing between sender switches: `--space-5`

**Email drafts in chat:**
- Rendered in a distinct card within the Roo message bubble
- `--color-parchment` background with 1px `--color-cream` border
- Header labels ("To:", "Subject:") in `--text-xs`, DM Sans 600, `--color-ink-soft`
- Body in JetBrains Mono 400, `--text-sm`
- Copy button: top-right corner, icon-only (clipboard icon → checkmark with 1.5s revert)
- Subtle left border: 2px `--color-brass`

**Streaming indicator:**
- Three dots pulsing in sequence (150ms stagger, 600ms cycle)
- Dots are `--color-brass`, 6px circles
- Preceded by Roo's avatar
- Incoming text fades in per token batch (opacity 0→1 over 100ms)

**Input area:**
- Text input with placeholder: *"Ask Roo anything about your schedule..."*
- `--color-linen` background, 1px `--color-cream` border
- On focus: border transitions to `--color-mahogany`
- Send button: 36px circle, `--color-brass` background, white arrow icon
- Enter to send, Shift+Enter for newline
- Max height: 120px, then internal scroll
- Disabled state while streaming (input grayed, send button shows a stop icon to cancel)

### Empty States

Every empty state features Roo doing something contextual:

| State | Roo pose | Text |
|---|---|---|
| No events this week | Checking a pocket watch | "A remarkably clear week. Shall I help you fill it?" |
| Chat — no messages | Standing with a slight bow | "At your service. Ask me anything about your calendar." |
| Auth error | Adjusting his tailcoat | "A brief interruption. Shall we try once more?" |
| API error | Holding a cracked monocle | "I seem to have dropped something. One moment, please." |
| Calendar loading | — (skeleton only) | "Consulting your schedule..." |
| Token expired | Tipping his hat | "Your session has concluded. A fresh start, perhaps?" |

### Buttons

**Primary** (sign in, key actions):
- Background: `--color-mahogany`
- Text: white, DM Sans 500, `--text-sm`
- Hover: `--color-mahogany-soft`
- Active: darken 5%, `scale(0.98)`
- Height: 40px, padding: 0 20px
- Transition: background 150ms ease, transform 100ms ease

**Secondary** (Today, navigation):
- Background: `--color-linen`
- Text: `--color-ink`, DM Sans 500
- Border: 1px `--color-cream`
- Hover: `--color-cream` background
- Height: 36px

**Icon buttons** (prev/next, dark mode, collapse):
- 36px square, `--radius-sm`
- `--color-ink-soft` icon color
- Hover: `--color-linen` background
- Active: `--color-cream` background

**Accent** (copy email, suggested actions):
- Background: `--color-brass`
- Text: white, DM Sans 500
- Hover: `--color-brass-glow`

---

## Motion & Animation

Keep it composed. A butler doesn't fidget.

### Principles
- Entrances are graceful (fade + slight slide), exits are quick (fade only)
- Duration: 150ms for micro-interactions, 300ms for panel transitions, 500ms for page entrances
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` — ease-out feel
- No bouncing, no elastic, no spring physics — this isn't a toy

### Specific Animations

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Page load | Calendar grid fades in, events stagger top-to-bottom | 300ms + 50ms stagger | ease-out |
| New chat message | Slide up from bottom + fade in | 200ms | ease-out |
| Streaming text | Tokens fade in per batch | 100ms | linear |
| Event block hover | `translateY(-1px)` + shadow increase | 150ms | ease-out |
| Button press | `scale(0.98)` | 100ms | ease-out |
| Panel collapse/expand | Height transition + content fade | 300ms | ease-in-out |
| Dark mode toggle | All colors crossfade | 200ms | ease |
| Landing page Roo | Subtle fade-in + slight upward drift | 500ms, 200ms delay | ease-out |

### What Does NOT Animate
- Calendar week navigation (instant — snappy trumps graceful here)
- Error state appearance (immediate — urgency over elegance)
- Text input typing
- Scroll position changes

---

## Responsive Behavior

### Desktop (≥1024px)
- Two-panel layout: calendar (flex-grow) | chat (420px fixed width)
- Chat panel collapsible — when collapsed, calendar takes full width and a small floating action button (Roo's head, 48px circle, `--color-mahogany`) appears in bottom-right to re-open
- Minimum calendar width: 560px

### Tablet (768px–1023px)
- Two-panel layout with chat narrowed to 340px
- If viewport < 860px: switch to tab layout automatically
- Calendar may show 5-day view (Mon–Fri) to conserve space

### Mobile (<768px)
- Tab-based navigation with bottom tab bar
- Two tabs: **Calendar** (grid icon) | **Chat** (message icon)
- Tab bar: 56px height, `--color-parchment` background, 1px top border `--color-cream`
- Active tab: `--color-roo` icon + label, inactive: `--color-ink-faint`
- Calendar tab: scrollable week view or 3-day view, swipe to change days
- Chat tab: full-screen chat, header shows "CalRoo" + back arrow
- Header simplified: no wordmark, just Roo icon + navigation

---

## Shadows & Depth

Subtle and warm — never harsh blue-gray shadows.

```css
--shadow-sm:   0 1px 2px rgba(28, 25, 23, 0.06);
--shadow-md:   0 2px 8px rgba(28, 25, 23, 0.08);
--shadow-lg:   0 4px 16px rgba(28, 25, 23, 0.10);
--shadow-xl:   0 8px 32px rgba(28, 25, 23, 0.12);
```

Usage:
- Event blocks at rest: `--shadow-sm`
- Event blocks on hover: `--shadow-md`
- Chat panel (desktop): `--shadow-md` on left edge only (`-4px 0 16px ...`)
- Dropdowns/tooltips: `--shadow-lg`
- Modals: `--shadow-xl` + backdrop overlay

---

## Iconography

- **Icon set**: Lucide (already available in the React environment)
- **Size**: 16px for inline, 20px for buttons, 24px for navigation
- **Stroke width**: 1.5px (matches the refined aesthetic — default 2px is too heavy)
- **Color**: inherit from parent text color

Key icons:
| Purpose | Icon |
|---|---|
| Previous week | `ChevronLeft` |
| Next week | `ChevronRight` |
| Dark mode (light) | `Sun` |
| Dark mode (dark) | `Moon` |
| Send message | `ArrowUp` |
| Copy email | `Copy` → `Check` |
| Collapse panel | `PanelRightClose` |
| Expand panel | `PanelRightOpen` |
| Sign out | `LogOut` |
| Calendar tab | `CalendarDays` |
| Chat tab | `MessageSquare` |
| Error | `AlertCircle` |
| Stop streaming | `Square` (filled) |

---

## Accessibility

The butler serves everyone.

- **Color contrast**: all text meets WCAG 2.1 AA (4.5:1 for body, 3:1 for large text)
- **Focus indicators**: 2px solid `--color-brass` outline with 2px offset on all interactive elements
- **Keyboard navigation**: full tab order through header → calendar → chat input
- **Screen readers**: calendar events announced with title + time + attendee count; chat messages have role="log" with aria-live="polite"
- **Reduced motion**: respect `prefers-reduced-motion` — disable all animations, transitions set to 0ms
- **Touch targets**: minimum 44px on mobile for all interactive elements

---

## Suggested Chat Prompts

On first load (no messages yet), show 3 tappable suggestion chips below Roo's greeting:

```
┌─────────────────────────────────────┐
│  [Roo avatar]                       │
│  "Good morning. At your service."   │
│                                     │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ What does my │ │ How much time│  │
│  │ week look    │ │ am I in      │  │
│  │ like?        │ │ meetings?    │  │
│  └──────────────┘ └──────────────┘  │
│  ┌──────────────────────────────┐   │
│  │ Help me block mornings for   │   │
│  │ focus time                   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

- Chips: `--color-linen` background, 1px `--color-cream` border, `--radius-md`
- On hover: `--color-cream` background
- On tap: inject text into input and send immediately
- Disappear after first user message (don't show again in the session)

---

## File & Asset Conventions

```
public/
├── fonts/
│   ├── PlayfairDisplay-Regular.woff2
│   ├── PlayfairDisplay-SemiBold.woff2
│   ├── DMSans-Regular.woff2
│   ├── DMSans-Medium.woff2
│   ├── DMSans-SemiBold.woff2
│   └── JetBrainsMono-Regular.woff2
├── roo/
│   ├── roo-hero.svg              # Landing page — full body, bowing
│   ├── roo-avatar.svg            # Chat avatar — head only, 28px
│   ├── roo-favicon.svg           # Favicon — head silhouette
│   ├── roo-empty-calendar.svg    # Empty state — pocket watch
│   ├── roo-empty-chat.svg        # Empty state — slight bow
│   ├── roo-error.svg             # Error state — cracked monocle
│   └── roo-expired.svg           # Session expired — tipping hat
└── og-image.png                  # Social preview card (1200×630)
```

- All Roo illustrations as SVG (scalable, themeable with CSS custom properties)
- Fonts self-hosted as woff2 (no Google Fonts CDN dependency — faster, privacy-friendly)
- Preload display font in `<head>` to avoid FOUT

---

## Implementation Priority

When building, follow this order to match how the design layers:

1. **CSS variables + Tailwind config** — set up the full token system first
2. **Typography + font loading** — get Playfair + DM Sans rendering correctly
3. **Landing page** — simplest page, proves the brand feel immediately
4. **Dashboard layout shell** — two-panel grid, header, responsive breakpoints
5. **Calendar grid** — time axis, day columns, event blocks with color coding
6. **Chat panel** — message bubbles, input, streaming indicator
7. **Empty states + error states** — Roo illustrations + copy
8. **Animations** — add last, layer on without disrupting function
9. **Dark mode** — flip the variables, verify contrast, adjust Roo SVG fills
10. **Accessibility pass** — focus states, aria labels, reduced motion