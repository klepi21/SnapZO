# SnapZO

Mobile-first social demo on **Mezo testnet**: feed, wallet, and pay-to-interact flows. Amounts are quoted in **MUSD** where shown; when the **SnapZo hub** is configured, the app settles unlocks and micro-tips in **SNAP** (`ERC20.transfer` to the creator) using hub NAV (`totalAssets` / `totalSupply`). Gas remains **native BTC** on Mezo.

**Repository:** [github.com/klepi21/SnapZO](https://github.com/klepi21/SnapZO)  
**Chain:** [Mezo](https://mezo.org/docs/developers/getting-started/) testnet · chain ID **31611**

---

## Repository layout

| Path | Role |
|------|------|
| `web/` | Next.js 16 app (App Router): UI, wagmi/viem, hub earn panel, swap, admin screens |
| `contracts/` | Foundry: **SnapZoHub** (UUPS), **SnapToken**, **SnapZoSocial** (UUPS); deploy & upgrade scripts |
| `backend/` | Optional Express + MongoDB API: posts, feed, unlock/tip/reply verification vs **MUSD** `Transfer` logs, IPFS, Socket.IO |
| `docs/` | Architecture and design notes (`ARCHITECTURE.md`, `SC_PLAN.md` where present) |

---

## Frontend (`web/`)

| Area | Description |
|------|-------------|
| **Routes** | `/` splash · `/feed` · `/profile` · `/create` · `/leaderboard` · `/earn` · `/swap` · `/admin/snapzo` (owner tooling when addresses are set) |
| **Wallet** | RainbowKit + wagmi + viem; default chain Mezo testnet |
| **Unlock** | Locked media: user sends **SNAP** `transfer(creator, amount)`; amount from MUSD-quoted `unlockPriceMusd` via hub ratio (ceil) |
| **Like / comment** | **0.01 MUSD** quoted → SNAP wei; same `SNAP.transfer` pattern when hub is configured |
| **Earn** | **SnapZoHub** panel: EIP-712 signed deposit/withdraw (relayer submits if `RELAYER_PRIVATE_KEY` is set server-side in `web/.env.local`) |
| **Swap** | BTC ↔ MUSD via Mezo DEX router (`getAmountsOut`, approve, swap) |
| **Chrome** | Sticky header, Instagram-style **bottom tab bar** (shell colors), toasts above nav |

Detailed product/architecture: `docs/ARCHITECTURE.md`. Contract build/deploy: `contracts/README.md`.

---

## Smart contracts (`contracts/`)

| Contract | Purpose |
|----------|---------|
| **SnapZoHub** | Pooled MUSD → vault + gauge; mints/burns **SNAP**; EIP-712 `deposit` / `withdraw` for allowlisted relayers; MEZO rewards indexed to SNAP; UUPS upgradeable |
| **SnapToken** | **SNAP** receipt token (18 decimals); only hub mints/burns; transfer hook keeps hub reward accounting correct |
| **SnapZoSocial** | EIP-712 **tips**, **unlocks**, **paid-reply escrow** in SNAP; relayer whitelist; UUPS (wire in UI/relayer when you adopt it end-to-end) |

**Tooling:** `forge build`, `forge test`. **Deploy:** `script/DeploySnapZoHub.s.sol`, `DeploySnapZoSocial.s.sol`, `UpgradeSnapZoHub.s.sol` — env and RPC steps are documented in **`contracts/README.md`**.

Default testnet addresses for the web app live in `web/src/lib/constants/snapzo-hub.ts` (override with `NEXT_PUBLIC_*`).

---

## Backend (`backend/`)

Optional **Node** service for a **server-truth** feed: create posts (IPFS via nft.storage), verify **MUSD** transfers from receipts for unlock/tip/reply, Mongo persistence, refund cron, Swagger at **`/api-docs`**.

| Concern | Details |
|---------|---------|
| **Verification** | `txHash` + expected `Transfer(from,to,value)` on MUSD; confirmations configurable |
| **API** | `POST /api/posts`, `GET /api/feed`, `POST /api/unlock`, `POST /api/tip`, reply lifecycle routes — full table in **`backend/README.md`** |
| **Realtime** | Socket.IO rooms for creators / requesters / posts |

Set **`NEXT_PUBLIC_SNAPZO_API_URL`** in `web/.env.local` if the Next app should call this API (e.g. create post). If unset, local/demo paths may skip it.

---

## On-chain calls from the web app (today)

These are what developers grep for when wiring product to chain:

| User action | On-chain call (hub configured) | Token |
|-------------|--------------------------------|--------|
| Unlock post | `SNAP.transfer(tipRecipient, snapWei)` | SNAP |
| Like / double-tap | `SNAP.transfer(tipRecipient, snapWei)` | SNAP |
| Comment (composer) | Same pattern for quoted SNAP amount | SNAP |
| Hub deposit / withdraw | Relayer submits hub `depositWithSig` / `withdrawWithSig` (user signs EIP-712) | MUSD in / MUSD+MEZO out (per contract) |
| Swap | Router `approve` + `swapExactTokensForTokens` (BTC↔MUSD path) | BTC ERC-20 + MUSD |

Gas for every transaction is paid in **test BTC** from the user’s wallet unless you run a custom relayer for those paths.

---

## Mezo testnet (reference)

| Item | Value |
|------|--------|
| Chain ID | `31611` |
| RPC | `https://rpc.test.mezo.org` |
| Explorer | `https://explorer.test.mezo.org` |
| Gas | Native BTC ([faucet](https://faucet.test.mezo.org/)) |
| MUSD | Defaults from `@mezo-org/musd-contracts` / env — see `web/src/lib/constants/musd.ts` |

---

## Environment

- **Web:** `web/.env.example` — WalletConnect, optional MUSD override, **hub / SNAP / SnapZoSocial** addresses, `NEXT_PUBLIC_SNAPZO_API_URL`, server-only **`RELAYER_PRIVATE_KEY`** for hub relay.
- **Backend:** `backend/.env.example` — `MONGO_URI`, `RPC_URL`, `MUSD_TOKEN_ADDRESS`, escrow keys, IPFS token, cron, CORS.

Do not commit private keys or production secrets.

---

## Run locally

**Web**

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. WalletConnect is off by default (injected wallets only); see `.env.example` to enable Reown.

**Contracts**

```bash
cd contracts
export PATH="$HOME/.foundry/bin:$PATH"   # if needed
forge build && forge test
```

**Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

---

## Quality checks

```bash
cd web && npm run lint && npm run build
cd contracts && forge test
cd backend && npm run typecheck
```

---

## Contributing

Issues and PRs welcome. Use Node LTS, copy env examples to untracked files, and keep keys out of git.

---

## License

MIT (adjust if you publish under another license.)

---

## Acknowledgements

Built for exploration on **Mezo** and ecosystem stablecoin **MUSD**. UI patterns reference familiar social apps; on-chain scope is intentionally staged (direct **SNAP** transfers in the demo feed vs full **SnapZoSocial** relay in contracts).
