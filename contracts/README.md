# SnapZo pooled hub (Solidity)

UUPS-upgradeable **`SnapZoHub`** plus immutable **`SnapToken` (`SNAP`)** minted on first `initialize`. Relayers submit **EIP-712** `deposit` / `withdraw`; **owner or relayer** may **harvest** and **restake**. See `../docs/SC_PLAN.md` Part D for product rules.

**`SnapZoSocial`** (UUPS) routes **SNAP** for **tips**, **unlocks**, and **paid-reply escrow** (Part F). Relayer-only; same whitelist pattern as the hub. Deploy **after** the hub exists and point **`SNAP_TOKEN`** at `hub.snapToken()`.

**SNAP (18 decimals):** each deposit mints SNAP **1:1 with the hub’s increase in sMUSD wei** (gauge + vault) after routing MUSD through the vault — so MUSD→SNAP count follows the vault’s **MUSD→sMUSD** exchange (e.g. 100 MUSD can mint ~500 SNAP if the vault mints ~500 sMUSD). Withdrawals still burn SNAP **pro‑rata** against hub sMUSD and redeem through the vault for MUSD.

## Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)

### `forge: command not found`

Foundry installs binaries under **`~/.foundry/bin`**. Your shell does not have that directory on **`PATH`** yet.

**Option A — one session:**

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge --version
```

**Option B — persist for bash** (add to `~/.bash_profile` or `~/.bashrc`, then open a new terminal or `source` the file):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

If `~/.foundry/bin/forge` does not exist, install Foundry: `curl -L https://foundry.paradigm.xyz | bash` then run `foundryup`, then use Option A again.

## Commands

```bash
cd contracts
export PATH="$HOME/.foundry/bin:$PATH"   # if forge is not found
forge build
forge test
```

`forge build` does **not** fail on those messages: they come from Foundry’s **linter** (style / micro-optimizations). This repo sets **`lint_on_build = false`** in `foundry.toml` so builds stay quiet. To run linter explicitly: `forge lint`.

## Deploy (Mezo testnet)

Set env (example addresses from `web/src/lib/constants`):

```bash
# NEVER commit a real key. Export in your shell only, or use `source` on a gitignored file.
# With or without `0x` prefix (64 hex chars); deploy script normalizes either form.
export PRIVATE_KEY=0xYOUR_KEY_HERE
export MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
export MUSD_VAULT=0x6f461c68b2c5492c0f5ccec5a264d692aa7a8e16
export SMUSD_GAUGE=0xa6972f35550717280f2538ea77638b29073e3f07
export SWAP_ROUTER=0xd245bec6836d85e159763a5d2bfce7cbc3488e03
export GAUGE_REWARD_TOKEN=0x7B7c000000000000000000000000000000000001
# optional:
# export FEE_RECEIVER=0x...
# export FEE_BPS=100
# export RELAYER=0x...

forge script script/DeploySnapZoHub.s.sol:DeploySnapZoHub \
  --rpc-url https://rpc.test.mezo.org \
  --broadcast
```

### Deploy `SnapZoSocial` (after hub + SNAP exist)

```bash
export PRIVATE_KEY=0xYOUR_KEY_HERE
export SNAP_TOKEN=0x...   # hub.snapToken()
# optional defaults: 1 ether / 2 ether
# export LIKE_TIP_AMOUNT_WEI=1000000000000000000
# export REPLY_STAKE_AMOUNT_WEI=2000000000000000000
# export RELAYER=0x...

forge script script/DeploySnapZoSocial.s.sol:DeploySnapZoSocial \
  --rpc-url https://rpc.test.mezo.org \
  --broadcast
```

Users must **`approve(SNAP → SnapZoSocial proxy)`** before relayers can execute `tipWithSig` / `unlockWithSig` / `replyDepositWithSig`.

### Deploy `SnapZoSubscriptions` (OnlySnaps)

```bash
export PRIVATE_KEY=0xYOUR_KEY_HERE
export SNAP_TOKEN=0x26410f213EA670B9D24c7F7a8c7b8Ab1Ecdc0B0E
# optional: defaults to deployer wallet if RELAYER is not set
# export RELAYER=0x...

forge script script/DeploySnapZoSubscriptions.s.sol:DeploySnapZoSubscriptions \
  --rpc-url https://rpc.test.mezo.org \
  --broadcast \
  --contracts script
```

### Deployed `SnapZoSubscriptions` (Mezo testnet, chain 31611 — 2026-04-23)

| Role | Address |
|------|---------|
| **Subscriptions (proxy — use this in backend env)** | `0xEF1E367fC508AcEfCF9F099AeCcE01cE6601eA5F` |
| **Implementation** | `0x298a944B045C37E2A3d48B09aF431a6BBF14Fd29` |

- Proxy deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x3a84fbb7611ce4b6f139e06b8fd0fecc9a280351daa5aa86040d6c344ab15654)  
- Impl deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x8ef75db73d0edd2a43659e3b1326fe2da9e6dca0ffb46c981be293b02b3448ea)  
- Block: **12511519**

**Deploy right now (checklist)**

1. **Remove any real key from git** — if you pasted a live `PRIVATE_KEY` into this repo, **rotate that key** (generate a new deployer wallet) and treat the old one as leaked. Never commit keys; use `export` in the terminal or a **gitignored** `contracts/.env` (see `.gitignore`).
2. **Fund the deployer** with **Mezo testnet BTC** for gas (`forge script` sends real txs on `--broadcast`).
3. From the repo: `cd contracts`, set `PATH` to Foundry if needed, `export PRIVATE_KEY=0x…` (hex `uint256` form is fine) plus the `MUSD`, `MUSD_VAULT`, … vars above.
4. Run the **`forge script … --broadcast`** line. On success, the console prints **implementation**, **proxy (hub)**, and **SNAP** addresses — copy the **proxy** as the app’s hub address.

### Deployed instance (Mezo testnet, chain 31611 — 2026-04-17)

| Role | Address |
|------|---------|
| **Hub (proxy — use this in the app)** | `0x9Cd1C98aC5C4F68881dcC63Ded54Ddb239033BfD` |
| **Implementation** | `0x9e2D31B2B9E3f59B26b2b32ca840d0aD6925fbB8` |
| **SNAP token** | `0xCA1A5C01c533dDE957f0eFC79b25906b0187039D` |

- Proxy deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x9016570537f8e8b250a7026b1bfe0e4147a905508da2a9ea8f26fec75199acdf)  
- Impl deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x69a2dc638b2f0ee29fb32edf99b90eb752028fe27bdf96bf3aa4a14ae625638d)  
- `contracts/cache/` may contain **sensitive** script metadata — keep it **gitignored** (already under `cache/`).

### Deployed `SnapZoSocial` (Mezo testnet, chain 31611 — 2026-04-18)

| Role | Address |
|------|---------|
| **Social (proxy — tips / unlocks / reply escrow)** | `0xee3294D7B254066E172F820B0389e8a39E59D56A` |
| **Implementation** | `0xa34e98C13A5CEf9E27a7F2eE353CC053da033645` |

- Proxy deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x25b63e842547688b58e5126e708cde5cf344ab4508a54f59252517eb84919697)  
- Impl deploy tx: [explorer](https://explorer.test.mezo.org/tx/0xb5d3ead51c0cff544b0c182fed82f75bcfffeefcf22903021eac11cc49a57fbf)  
- Block: **12430314**

### Deployed `SnapZoSocial` (Mezo testnet, chain 31611 — 2026-04-22)

| Role | Address |
|------|---------|
| **Social (proxy — tips / unlocks / reply escrow)** | `0x30200f8ee05a34a3062CAbFe42c18f7b894239C4` |
| **Implementation** | `0x443A2fa7dD443ea6f6036e4424bD8722c8372FF6` |
| **SNAP token used by social** | `0x26410f213EA670B9D24c7F7a8c7b8Ab1Ecdc0B0E` |

- Proxy deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x1ccc42d3ee6556f3d591590921292d21f46c7d38e6164d09b1ffc47ffe945c6b)  
- Impl deploy tx: [explorer](https://explorer.test.mezo.org/tx/0x36b59a8f7a54aaad8d502dbe5911dd2285b387c5567bfeb7cf9f8bfecf67adb0)  
- Block: **12538413** / **12538412**

After deploy: **whitelist relayer addresses** on the hub (`setRelayer`), have users **approve MUSD → hub** (and optionally use **MUSD `permit`** in the same tx via `depositWithSigAndPermit`), and **`encode` restake router routes** when liquidity exists (`setRestakeRoutes` while **paused**).

### Web app (`web/`)

1. Copy `web/.env.example` → **`web/.env.local`** (gitignored).
2. **`RELAYER_PRIVATE_KEY`** — EOA that is **`isRelayer` on-chain** with **Mezo testnet BTC** for gas (owner is fine for demos). Required for **Sign & relay** to succeed.
3. Hub + SNAP addresses **default** to the latest testnet deploy in code; override with `NEXT_PUBLIC_SNAPZO_HUB_ADDRESS` / `NEXT_PUBLIC_SNAP_TOKEN_ADDRESS` if you redeploy. Set `NEXT_PUBLIC_SNAPZO_HUB_UI=false` to hide the hub card.
4. Run `pnpm dev` in `web/`, open **`/earn`** — **SnapZo hub (pooled)** is at the **top**; classic vault/gauge stays below. Restart dev server after env changes.

## No on-chain liquidity: manual reward → MUSD → strategy (no SNAP mint)

1. **`harvest()`** (owner or relayer) so reward token accrues on the hub (minus performance fee).  
2. **`recoverRewardToken(yourWallet, amount)`** — **owner only**; moves the configured **reward token** to your wallet so you can swap **off-chain / elsewhere**.  
   - You cannot use **`sweep`** for reward/MUSD/SNAP/vault tokens; those stay denylisted for safety.  
3. After you hold **MUSD**, either:  
   - **`injectMusdWithoutMint(amount)`** — **owner** pulls MUSD from your wallet (approve hub first) and pushes **vault → gauge** with **no new SNAP** (NAV gift to existing holders), or  
   - **`transfer` MUSD to the hub** then **`restake()`** — same outcome: idle MUSD on the hub is deposited and staked **without minting SNAP**.

## Upgrade

Deploy new `SnapZoHub` implementation, then `UUPSUpgradeable.upgradeToAndCall` (or OZ `upgradeTo`) from **owner** — follow OpenZeppelin UUPS checklist (storage layout, `gap`, no `initialize` on impl except `_disableInitializers`).

## Typed data (off-chain)

- **Domain:** `name` = `SnapZoHub`, `version` = `1`, `chainId`, `verifyingContract` = hub **proxy** address.  
- On-chain helper: `domainSeparatorV4()`.  
- **Types:**  
  - `Deposit(address user,uint256 assets,uint256 nonce,uint256 deadline)`  
  - `Withdraw(address user,uint256 snapAmount,uint256 nonce,uint256 deadline)`  

Primary-type name must match the **typehash strings** in `SnapZoHub.sol`.

### `SnapZoSocial` typed data

- **Domain:** `name` = `SnapZoSocial`, `version` = `1`, `chainId`, `verifyingContract` = social **proxy** address.  
- **Types** (see `SnapZoSocial.sol`):  
  - `Tip(address tipper,uint256 postId,address creator,uint256 nonce,uint256 deadline)`  
  - `Unlock(address unlocker,uint256 postId,address creator,uint256 amount,uint256 nonce,uint256 deadline)`  
  - `ReplyDeposit(address payer,uint256 postId,address creator,uint256 nonce,uint256 deadline)`  
  - `FulfillReply(address creator,bytes32 requestId,uint256 commentId,uint256 nonce,uint256 deadline)`  
  - `RefundReply(address requester,bytes32 requestId,uint256 nonce,uint256 deadline)`  

**`requestId`** for reply flows: `keccak256(abi.encode(chainId, social, postId, creator, payer, nonceUsed))` where `nonceUsed` is the **signed** `nonce` at deposit time (matches `nonces[payer]` before increment).
