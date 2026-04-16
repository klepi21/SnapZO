# SnapZO Backend

**TypeScript** Express + MongoDB + ethers.js v6 backend for the **SnapZO**
Pay-to-Interact social network on **Mezo testnet** (chainId `31611`). Every
interaction — unlock, tip, reply — is verified on-chain against MUSD ERC-20
transfers.

> Frontend lives in `../web`. This folder contains **only the backend**.

---

## Features

| Capability | How it works |
|------------|--------------|
| **Pay-to-Unlock Posts**   | Client transfers MUSD `userWallet → creatorWallet`, posts the `txHash` to `POST /api/unlock`; backend verifies the on-chain Transfer event, persists `Unlock`, and reveals the post's `ipfsHash`. |
| **Pay-to-Like (tipping)** | Same flow as unlock but for any amount; persists a `Tip` and increments `Post.totalTips`. |
| **Pay-to-Reply (escrow)** | Client transfers MUSD `requesterWallet → escrowWallet`, posts the `txHash` to `POST /api/reply/request`; backend verifies and creates a `pending` `Reply` with deadline `now + 24h`. The creator responds via `POST /api/reply/respond`; if 24h elapses, a **node-cron** job (default `*/5 * * * *`) refunds the requester from the escrow wallet. |
| **IPFS uploads**          | Posts and replies upload media to IPFS via **nft.storage**. |
| **Realtime**              | **socket.io** notifies creators of new pending replies and requesters of `responded` / `refunded` events. |
| **Swagger UI**            | All endpoints documented via JSDoc, served at **`/api-docs`**. |

---

## Project structure

```
backend/
├── src/
│   ├── config/
│   │   ├── index.ts          # env + typed AppConfig
│   │   └── db.ts             # mongoose connect
│   ├── models/
│   │   ├── User.ts
│   │   ├── Post.ts
│   │   ├── Unlock.ts
│   │   ├── Tip.ts
│   │   └── Reply.ts
│   ├── controllers/
│   │   ├── healthController.ts
│   │   ├── postController.ts
│   │   ├── unlockController.ts
│   │   ├── tipController.ts
│   │   ├── replyController.ts
│   │   └── userController.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── posts.ts
│   │   ├── feed.ts
│   │   ├── unlock.ts
│   │   ├── tip.ts
│   │   ├── reply.ts
│   │   └── user.ts
│   ├── services/
│   │   ├── web3Service.ts    # ethers v6 + on-chain verification + listeners
│   │   ├── ipfsService.ts    # nft.storage uploads
│   │   └── cronService.ts    # 24h refund job
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── asyncHandler.ts
│   │   ├── errors.ts
│   │   └── validation.ts
│   └── swagger.ts
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
└── server.ts
```

---

## Installation

Requires **Node 18+** and a running **MongoDB** (local or remote).

```bash
cd backend
cp .env.example .env
# Edit .env (see below)
npm install
npm run dev      # tsx watch (no build step)
# or
npm run build    # compile to dist/
npm start        # node dist/server.js
```

Server boots on `http://localhost:4000` (override with `PORT`).

### Available scripts

| Script           | Purpose                                        |
|------------------|------------------------------------------------|
| `npm run dev`    | Watch + run with `tsx` (no compile step)       |
| `npm run build`  | TypeScript → JavaScript into `dist/`           |
| `npm start`      | Run the compiled `dist/server.js`              |
| `npm run typecheck` | `tsc --noEmit` — type-check only            |
| `npm run clean`  | Remove `dist/`                                 |

---

## Environment variables

All vars are documented in [`.env.example`](./.env.example). Highlights:

| Var | Purpose |
|-----|---------|
| `PORT` | HTTP port (default `4000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins or `*` |
| `MONGO_URI` | MongoDB connection string |
| `RPC_URL` | Mezo RPC (default `https://rpc.test.mezo.org`) |
| `CHAIN_ID` | `31611` for Mezo testnet |
| `MUSD_TOKEN_ADDRESS` | MUSD ERC-20 address on the target network |
| `ESCROW_WALLET_ADDRESS` | Backend wallet that receives pay-to-reply escrow |
| `ESCROW_PRIVATE_KEY` | Private key for the escrow wallet (used to sign refund transfers) |
| `HUB_CONTRACT_ADDRESS` | Optional hub contract; if set, listened to for events |
| `NFT_STORAGE_TOKEN` | nft.storage API token for IPFS uploads |
| `REPLY_WINDOW_HOURS` | Reply deadline (default `24`) |
| `REFUND_CRON_SCHEDULE` | Cron for refund job (default `*/5 * * * *`) |
| `TX_MIN_CONFIRMATIONS` | Confirmations required to accept a tx (default `1`) |
| `MUSD_DECIMALS` | Token decimals (MUSD = `18`) |

> **Security:** keep `ESCROW_PRIVATE_KEY` out of source control. For
> production, load it from a secret manager / KMS, not a plain `.env`.

---

## Run

```bash
npm run dev    # auto-reload via tsx watch
npm run build && npm start   # compiled production-style start
```

Then visit:

- **Swagger UI:** http://localhost:4000/api-docs
- **OpenAPI JSON:** http://localhost:4000/api-docs.json
- **Health:** http://localhost:4000/api/health

---

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/posts` | Create post (uploads media to IPFS, persists in DB) |
| `GET`  | `/api/feed` | Public feed (locked posts hide `ipfsHash` unless `?viewer=` has unlocked) |
| `GET`  | `/api/posts/:postId` | Single post (same conditional reveal) |
| `POST` | `/api/unlock` | Pay-to-Unlock — verifies tx, persists `Unlock`, returns `ipfsHash` |
| `POST` | `/api/tip` | Pay-to-Like — verifies tx, persists `Tip` |
| `POST` | `/api/reply/request` | Pay-to-Reply — verifies tx (to escrow), creates `pending` reply with 24h deadline |
| `GET`  | `/api/reply/pending` | Creator's pending replies (`?creatorWallet=0x...`) |
| `POST` | `/api/reply/respond` | Creator replies (uploads optional media to IPFS) |
| `POST` | `/api/reply/refund` | Manual refund (allowed only after deadline) |
| `POST` | `/api/reply/refund/run` | Admin trigger for one cron pass |
| `GET`  | `/api/user/:wallet` | User profile + their posts |
| `GET`  | `/api/health` | Health check |

Every endpoint has Swagger JSDoc and is browseable at `/api-docs`.

---

## On-chain verification (how `txHash` is checked)

For each pay-to-* call, the backend:

1. Fetches the tx receipt from `RPC_URL`.
2. Confirms `receipt.status === 1` and confirmations ≥ `TX_MIN_CONFIRMATIONS`.
3. Iterates `receipt.logs` and finds an MUSD `Transfer(from, to, value)` event
   where `from`, `to`, and `value` (in 18-decimal base units) match the
   request body.
4. Rejects duplicate `txHash` values via the unique DB indexes on
   `Unlock`, `Tip`, `Reply`.

This works against any standard ERC-20 deployment of MUSD; no hub contract
is required for the MVP. If `HUB_CONTRACT_ADDRESS` is set, the backend
**also** subscribes to its events and rebroadcasts them via socket.io
(`chain:event`).

---

## Refund cron

`node-cron` runs every 5 minutes (configurable via `REFUND_CRON_SCHEDULE`):

- Find `Reply` rows with `status: 'pending'` and `deadline <= now`.
- For each, call MUSD `transfer(requesterWallet, amount)` from the escrow
  wallet via ethers.js.
- Update the reply: `status: 'refunded'`, `refundTxHash`.
- Emit `reply:refunded` on the requester's socket room.

You can also trigger one pass synchronously with:

```bash
curl -X POST http://localhost:4000/api/reply/refund/run
```

---

## Realtime (socket.io)

Connect a socket client and subscribe to rooms:

```js
const socket = io('http://localhost:4000');
socket.emit('subscribe:creator',   '0xCreator...');   // pending replies
socket.emit('subscribe:requester', '0xRequester...'); // responded / refunded
socket.emit('subscribe:post',      'post-uuid-or-tx');// per-post tips
```

Events emitted:

- `reply:pending`     `{ replyId, postId, requester, amount, deadline }`
- `reply:responded`   `{ replyId, postId, replyContent, replyIpfsHash, respondedAt }`
- `reply:refunded`    `{ replyId, postId, amount, refundTxHash }`
- `post:tipped`       `{ postId, amount, from, message }`
- `tip:received`      `{ postId, amount, from }` (creator room)
- `chain:transfer`    raw escrow MUSD transfers
- `chain:event`       hub-contract events (only if `HUB_CONTRACT_ADDRESS` set)

---

## Mezo testnet quick reference

| Item | Value |
|------|-------|
| Chain ID | `31611` |
| RPC | `https://rpc.test.mezo.org` |
| Explorer | `https://explorer.test.mezo.org` |
| Native gas | BTC ([faucet](https://faucet.test.mezo.org/)) |

Docs: <https://mezo.org/docs/developers/getting-started/>

---

## License

MIT
