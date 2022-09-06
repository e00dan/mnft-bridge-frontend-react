# Nervos mNFT to Godwoken bridge (PortalWallet)

## Run

```
yarn && yarn ui
```

## Build

```
yarn build
```

## Bridge Architecture

Frontends:
1. Unipass v2: [Website](https://mnft.nervosdao.community/) | [Code](https://github.com/Kuzirashi/mnft-bridge-frontend)
2. Portal Wallet + Unipass v3: [Website](https://mnft-pw.nervosdao.community) | [Code](https://github.com/Kuzirashi/mnft-bridge-frontend-react)

Operator: https://github.com/Kuzirashi/mnft-godwoken

EVM smart contracts: https://github.com/Kuzirashi/mnft-godwoken-contracts

---

This bridge is a centralized (!) way to send mNFT (one of available NFT standards on Nervos) on Nervos Layer 1 to a specific "bridge" account and then receive it to a user-defined receiving Ethereum address.

The mNFT standard is going to be processed and stored as metadata for Layer 2 EVM NFT using ERC721 standard.

## License

MIT