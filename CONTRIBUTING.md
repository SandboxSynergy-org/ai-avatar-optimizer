# Contributing to `ai-avatar-optimizer`

Thanks for contributing! This library is maintained by [Sandbox Synergy](https://sandboxsynergy.org) as a lightweight, zero-dependency toolkit for testing, tracking, and auto-optimizing floating AI assistant launchers.

## Development Workflow

1. Clone the repository:
   ```bash
   git clone https://github.com/SandboxSynergy-org/ai-avatar-optimizer.git
   cd ai-avatar-optimizer
   ```
2. Run the built-in Node test suite (requires Node.js 18+):
   ```bash
   npm test
   ```

## Guidelines

- **Zero Runtime Dependencies**: Keep `src/index.js` dependency-free so it runs in Node.js, Edge runtimes, and modern bundlers without bloat.
- **Privacy First**: Never store raw IP addresses, emails, or persistent third-party tracking cookies. All visitor deduplication must use daily-rotating salted hashes (`dailyVisitorHash`).
- **Accessibility (`a11y`)**: Any CSS or UI additions in `styles/glass-coin.css` must include `@media (prefers-reduced-motion: reduce)` fallbacks and visible `:focus-visible` outlines.
