# RentSplitter

![banner](assets/banner.jpg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-627EEA.svg)](https://etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

An on-chain rent-distribution rail: **one address in, automatic split out**.
Tenants pay a single contract address and the rent is divided instantly across
payees by basis-point shares — lender, property manager, owner — with no
intermediary touching the funds. Built on
[Hardhat](https://hardhat.org), [OpenZeppelin Contracts](https://openzeppelin.com/contracts),
and [viem](https://viem.sh).

## Quickstart

```bash
npm install
npx hardhat compile
npm run build

cp .env.example .env   # fill in RPC_URL, PRIVATE_KEY

# Deploy with payees and shares (basis points, must sum to 10000):
PAYEES=0xLender...,0xManager...,0xOwner... \
SHARES_BPS=7000,1000,2000 \
npm run deploy         # set CONTRACT_ADDRESS in .env afterwards

# Pay rent — the contract splits it on receipt:
CONTRACT_ADDRESS=0x... AMOUNT_ETH=2.5 npm run pay
```

## How the split math works

- Shares are in **basis points** and must sum to exactly **10000** (100%).
- Each payee receives `msg.value * sharesBps[i] / 10000`, sent immediately in
  the same transaction — nothing is held by the contract.
- Integer-division **dust** (at most a few wei) goes to `payees[0]`.
- Zero-value payments are rejected.
- Every distribution emits `RentDistributed(payer, amount)`; payee changes emit
  `PayeesUpdated(payees, sharesBps)`.

Example: `$2,500` rent with shares `7000, 1000, 2000` → `$1,750` lender,
`$250` manager, `$500` owner, atomically.

## Security notes

- **The owner can change payees and shares at any time** via `updatePayees`.
  This is the central trust assumption: deploy with an owner you trust, or
  transfer ownership to a multisig. Tenants should verify the payee set
  (read `payees(i)` / `PayeesUpdated` events) before paying.
- Payee addresses receive ETH via low-level calls — a payee that is a contract
  with a reverting fallback will revert the whole distribution. Prefer EOAs or
  tested receiver contracts.
- This template has not been audited. Do not route real rent through it until
  the contract — and your payee/ownership setup — has been reviewed by
  qualified professionals.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
