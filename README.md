# SnapZO

**SnapZO** is a hackathon-style demo: an Instagram-inspired social feed where **every meaningful interaction moves MUSD on Mezo testnet** — pay to unlock hidden media, tip to like, and pay a small amount to post a comment. The UI is mobile-first (centered ~430px frame on desktop), with wallet connect, toasts for transaction state, and local persistence for likes and comments between sessions.

> **Repository:** [github.com/klepi21/SnapZO](https://github.com/klepi21/SnapZO)  
> **Chain:** [Mezo](https://mezo.org/docs/developers/getting-started/) testnet · **MUSD** transfers to creator `tipRecipient` addresses from dummy feed data.

---

## Why this exists

Social feeds optimize for engagement; SnapZO experiments with **attention → economy**: interactions cost a visible amount of stablecoin, which can reduce spam in real products and makes demos easy to explain to judges or users. This repo is a **frontend-first** slice: real `ERC20.transfer` calls via **wagmi** + **viem**, dummy posts, and session/local storage for unlock state and comments.

---

## What is implemented today

| Area | Behavior |
|------|-----------|
| **Splash** (`/`) | SnapZO branding, “Get Started” → feed |
| **Feed** (`/feed`) | Scrollable post cards, sticky header (logo, notifications placeholder, wallet menu) |
| **Profile** (`/profile`) | Cover, avatar, stats, tabs, masonry-style gallery from dummy data |
| **Wallet** | RainbowKit + wagmi; default chain **Mezo testnet (31611)**; connect / switch network from header |
| **Unlock** | First feed post can be **content-locked** (blurred). **Unlock** sends **0.1 MUSD** `transfer` to the post’s `tipRecipient`; media reveals for the session |
| **Like** | **0.01 MUSD** `transfer` to `tipRecipient`; heart turns **red** when liked; optimistic UI while pending |
| **Double-tap / double-click** | On the **post image** (unlocked only), same like flow as the heart |
| **Comments** | Bottom sheet (Instagram-style); **Post** sends **0.01 MUSD** `transfer`, then appends comment to **localStorage**; sheet **stays open** so the new comment appears immediately |
| **Toasts** | Minimal bottom toasts for tx prompts, success, and errors |
| **MUSD in UI** | CoinGecko-style inline icon where amounts are shown (see `web/src/components/icons/musd-inline-icon.tsx`) |

**Not in scope yet (see `docs/ARCHITECTURE.md`):** Solidity hub contract, indexer, pay-to-reply escrow + 24h refund, true gasless relayer / meta-transactions. Today the wallet still needs **test BTC for gas** on Mezo unless you wire a relayer.

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS 4**
- **RainbowKit** + **wagmi** + **viem** + **TanStack Query**
- **lucide-react** icons · **next/image** (remote patterns for avatars / MUSD icon host)

---

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Next.js application (all runnable code) |
| `web/public/fonts/` | Custom font assets (e.g. logo) |
| `contracts/` | Reserved for Solidity / Foundry (empty placeholder for now) |
| `docs/ARCHITECTURE.md` | Deeper product + on-chain design notes |

---

## Mezo testnet (quick reference)

| Item | Value |
|------|--------|
| **Chain ID** | `31611` |
| **RPC** | `https://rpc.test.mezo.org` |
| **Explorer** | `https://explorer.test.mezo.org` |
| **Gas** | BTC (test BTC: [faucet.test.mezo.org](https://faucet.test.mezo.org/)) |
| **MUSD** | App defaults to published testnet address from `@mezo-org/musd-contracts` / env override — see `web/src/lib/constants/musd.ts` and `.env.example` |

Official docs: [Mezo — Developer Getting Started](https://mezo.org/docs/developers/getting-started/).

---

## Run locally

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000): splash → **Get Started** → `/feed` and `/profile`.

### Environment

- **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** — from [Reown Cloud](https://cloud.reown.com/) if you use WalletConnect.
- By default, **WalletConnect is off** (injected wallets only), so **localhost works without** an allowlist.
- To enable WalletConnect: set **`NEXT_PUBLIC_ENABLE_WALLETCONNECT=true`**, add `http://localhost:3000` (and `http://127.0.0.1:3000` if needed) to your Reown project allowlist, then restart dev.

Optional: **`NEXT_PUBLIC_MUSD_TOKEN_ADDRESS`** to override the MUSD contract address.

### Quality checks

```bash
cd web
npm run lint
npm run build
```

---

## Contributing / fork

PRs and issues welcome. For a clean clone: use Node LTS, copy `web/.env.example` to `web/.env.local`, and do not commit real keys.

---

## License

MIT (or replace with your preferred license when you publish formally.)

---

## Acknowledgements

Built for exploration on **Mezo** and **MUSD**. UI patterns inspired by familiar social apps; on-chain behavior is intentionally simple (`transfer`) for hackathon velocity.
