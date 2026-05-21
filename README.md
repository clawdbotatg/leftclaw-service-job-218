# 🍕 Buy a Slice — Pizza Day Burn Generator

**Live URL:** https://bafybeigrpxokd5pjqbvelsqf3mmqyklbaqukqwxzhxa4lxdxhr3yme3uty.ipfs.community.bgipfs.com/

Burn 50,000 CLAWD on Base, generate a unique AI pizza slice from your prompt, and mint it as an NFT.

## What it does

- **Mint**: Describe your dream slice. The app calls an AI image generator, pins the metadata to IPFS, then mints a `PizzaSliceMinter` NFT on Base after you approve & burn 50,000 CLAWD.
- **Leaderboard**: Live aggregate of every wallet that burned CLAWD, ranked by total burned.
- **My Slices**: Gallery of every Pizza Slice NFT minted by your connected wallet.

## Contracts (Base mainnet · chainId 8453)

| Name | Address | Explorer |
| --- | --- | --- |
| `PizzaSliceMinter` | `0x0c758792fd5e6c634c54C44a7B6Dd5C5269D845F` | [Basescan](https://basescan.org/address/0x0c758792fd5e6c634c54c44a7b6dd5c5269d845f) |
| `CLAWD` (ERC-20) | `0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07` | [Basescan](https://basescan.org/address/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07) |

Every mint burns `50_000 * 1e18` CLAWD to `0xdead` (hardcoded, non-configurable).

## Client action required

Ownership was transferred to your wallet via `Ownable2Step`. Call `acceptOwnership()` on `PizzaSliceMinter` to complete the transfer. Until you do, the deployer retains admin rights (to adjust `eventStart`/`eventEnd`).

## Environment variables

```bash
# Vercel endpoint that returns { imageUrl: "https://..." } for a given prompt
NEXT_PUBLIC_GENERATE_URL=https://your-vercel-app.vercel.app/api/generate

# JWT for api.pinata.cloud — used to pin NFT metadata JSON to IPFS
NEXT_PUBLIC_PINATA_JWT=...

# Optional: overrides for Alchemy, WalletConnect, OG host
NEXT_PUBLIC_ALCHEMY_API_KEY=...
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_PRODUCTION_URL=https://your-domain.example
```

## Local development

```bash
yarn install
yarn start          # http://localhost:3000
yarn next:build     # static export to packages/nextjs/out
```

Targets Base mainnet by default (`packages/nextjs/scaffold.config.ts`).

## Stack

Next.js App Router · Wagmi · Viem · RainbowKit · Tailwind + DaisyUI · Scaffold-ETH 2 hooks.
