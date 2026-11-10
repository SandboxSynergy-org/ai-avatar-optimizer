# `ai-avatar-optimizer`

**Multi-Variant AI Widget & Avatar Randomizer, Cookie-Free Press-to-Open Telemetry, and Time-Windowed Auto-Optimizer (+ 3D Gleaming Glass Coin CSS)**

Built and open-sourced by **[Sandbox Synergy](https://sandboxsynergy.org)** for developers building floating AI assistants, voice guides, and support widgets who want empirical data on **which minimized launcher style earns the most presses to open** without annoying auto-popups.

---

## Why We Built This

Auto-opening chat popups frustrate visitors and hurt Core Web Vitals. Starting your AI assistant **minimized/closed** on every page open respects the user—but which minimized launcher design actually invites visitors to press and open it?

- A **3D gleaming glass coin** with your logo shifting reflection in the light (no text clutter)?
- A **compact mini logo badge** with a micro `"AI"` tag?
- A **breathing multi-layer isometric emblem** with `"Ask AI"`?
- A **compact portrait pill** vs. a **full-size portrait pill**?

`ai-avatar-optimizer` gives you a complete, zero-dependency engine to:
1. **Randomize $N$ avatar styles across page opens** using a **non-repeating uniform Markov sampler** (`pickAvatarStyle`) that guarantees an exact $1/N$ ($20\%$ for 5 styles) stationary impression share while never repeating the exact same style on consecutive page navigations.
2. **Track impressions, presses-to-open (`open`), and post-open engagement** (`quick_reply`, `chat_message`, `voice_play`, `voice_talk`, `action_click`) using **cookie-free daily-rotating salted visitor hashes** and built-in **double-tap deduplication**.
3. **Auto-optimize at the end of your experiment window** (e.g., 60 days): `AvatarExperimentController` ranks all variants by total **Presses to Open** (tie-broken by open rate % and post-open actions) and automatically locks in the winning style once the test window completes.
4. **Drop-in 3D Gleaming Glass Coin CSS (`styles/glass-coin.css`)**: Pure GPU-composited CSS (`perspective`, `rotateY/rotateX`, convex lens top-edge highlight, and `mix-blend-mode: screen` specular light-beam sweep) with full `@media (prefers-reduced-motion: reduce)` support.

---

## Quick Start

### 1. Install or Copy

```bash
git clone https://github.com/SandboxSynergy-org/ai-avatar-optimizer.git
cd ai-avatar-optimizer
npm test
```

### 2. Pick a Style on Page Open (Client or SSR)

```js
import { pickAvatarStyle, DEFAULT_AVATAR_STYLES } from "ai-avatar-optimizer";

// Honors ?aig_style= query override for testing, or a locked winner once the 60-day window finishes.
// Otherwise picks uniformly across the 5 styles without repeating `previousStyle` back-to-back.
const nextStyleId = pickAvatarStyle({
  forcedStyle: new URLSearchParams(window.location.search).get("aig_style"),
  lockedStyle: serverInfo.lockedAvatarStyle, // null while experiment is running
  previousStyle: sessionStorage.getItem("aig_last_style"),
});

sessionStorage.setItem("aig_last_style", nextStyleId);
```

### 3. Record Impressions, Presses to Open, and Post-Open Engagement (Server API)

```js
import { AvatarExperimentController, MemoryAvatarStorage } from "ai-avatar-optimizer";

const controller = new AvatarExperimentController({
  storage: new MemoryAvatarStorage({
    startedAt: "2026-11-10T00:00:00.000Z",
    durationDays: 60,
    autoOptimize: true,
  }),
});

// Inside POST /api/ai-guide/avatar-event
await controller.record({
  widgetId: "main-site",
  styleId: body.styleId, // e.g. 'glass-coin'
  action: body.action,   // 'impression' | 'open' | 'quick_reply' | 'chat_message' | 'voice_play' | 'voice_talk' | 'action_click'
  sid: body.sid,
  path: body.path,
  ip: requestIp,
  userAgent: req.headers.get("user-agent") || "",
});
```

### 4. Query the 60-Day Leaderboard & Auto-Lock Winner

```js
const report = await controller.getReport({ widgetId: "main-site" });

console.log(report.experiment.status); // 'running' | 'completed_auto_locked' | 'manually_locked'
console.log(report.experiment.recommendedWinnerId); // e.g. 'glass-coin'
console.table(
  report.styles.map((s) => ({
    style: s.name,
    impressions: s.impressions,
    pressesToOpen: s.opens,
    openRatePct: `${s.openRatePct}%`,
    shareOfOpens: `${s.shareOfOpensPct}%`,
    postOpenActions: s.engagedTotal,
    leader: s.isLeader ? "🏆 #1" : "",
  }))
);
```

---

## Included 5 Default Avatar Styles (`DEFAULT_AVATAR_STYLES`)

| Style ID | Name | Desktop / Mobile Avatar | CTA Label | Visual Design |
| :--- | :--- | :--- | :--- | :--- |
| `glass-coin` | **Gleaming Glass Coin (Logo Only)** | `54px` / `46px` | *None (emblem only)* | 3D bevelled obsidian-and-gold glass medallion with shifting specular light reflection across your logo. |
| `mini-gleam` | **Mini Gleaming Logo Badge (Small)** | `40px` / `34px` | `AI` | Ultra-compact circular glass logo coin with shifting light reflection and a micro `AI` pill. |
| `cube-breath` | **Breathing Isometric Cube & Glass Coin** | `50px` / `42px` | `Ask AI` | Multi-layer breathing emblem inside a gleaming glass medallion with `Ask AI` label. |
| `compact-portrait` | **Compact Portrait Pill (Small)** | `46px` / `40px` | `Ask me` | Low-profile human/founder avatar with audio-reactive ring and compact `Ask me` label. |
| `full-portrait` | **Full Portrait Pill (Large)** | `92px` / `76px` | `Ask me` | Full-size human/founder portrait with audio-reactive conic ring and `Ask me` pill. |

---

## 3D Gleaming Glass Coin CSS (`styles/glass-coin.css`)

Import `styles/glass-coin.css` to render a 3D glass coin that shifts reflection in the light:

```html
<button type="button" class="aig-glass" aria-label="Ask the AI Guide">
  <span class="aig-coin-medallion aig-glass-coin" style="width: 54px; height: 54px;">
    <img src="/your-logo-mark.png" alt="" style="width: 78%; height: 78%; object-fit: contain;" />
  </span>
</button>
```

- **`.aig-coin-medallion`**: Sculpted circular dark-glass casing with inner top/bottom rim bevels and warm ambient glow.
- **`.aig-glass-coin::before`**: Convex glass dome top-edge lens refraction arc.
- **`.aig-glass-coin::after`**: Angled `mix-blend-mode: screen` specular light beam that sweeps across the coin face as the medallion tilts in 3D (`aig-coin-tilt` + `aig-coin-gleam`).
- **Reduced Motion**: Automatically disables continuous tilt/sweep animations when `prefers-reduced-motion: reduce` is active.

---

## PostgreSQL Schema (`sql/schema.sql`)

If you use PostgreSQL in production, apply [`sql/schema.sql`](./sql/schema.sql) and wire a custom storage adapter:

```sql
CREATE TABLE IF NOT EXISTS ai_guide_avatar_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guide_id TEXT NOT NULL DEFAULT 'default',
  style_id TEXT NOT NULL,
  action TEXT NOT NULL,
  visitor TEXT NOT NULL,
  sid TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '/',
  device TEXT NOT NULL DEFAULT 'Desktop'
);

CREATE INDEX IF NOT EXISTS ai_guide_avatar_events_lookup_idx
  ON ai_guide_avatar_events (guide_id, created_at DESC, style_id, action);
```

---

## Mathematical Note: Non-Repeating Uniform Markov Sampler

When testing $N = 5$ avatar styles across page opens, a naive uniform sampler repeats the exact same style on consecutive page navigations $20\%$ of the time, making the randomizer feel "stuck" during multi-page sessions.

`pickAvatarStyle` uses a symmetric Markov transition on the complete graph $K_N$ without self-loops:
- Initial page open ($t = 0$): $P(X_0 = i) = \frac{1}{N}$.
- Subsequent page open ($t \ge 1$): $P(X_t = j \mid X_{t-1} = i) = \frac{1}{N - 1}$ for all $j \ne i$, and $0$ for $j = i$.

Because the transition matrix is doubly stochastic, the marginal distribution at **every single page open** $t \ge 0$ is strictly uniform:

$$\forall t \ge 0, \forall i \in \{1, \dots, N\}: \quad P(X_t = i) = \frac{1}{N} = 20\%$$

while guaranteeing $P(X_t = X_{t-1}) = 0$.

---

## License

MIT © [Sandbox Synergy LLC](https://sandboxsynergy.org)
