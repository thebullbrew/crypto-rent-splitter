import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Produced by `npx hardhat compile` — this script assumes the artifact exists.
const ARTIFACT_PATH = join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "RentSplitter.sol",
  "RentSplitter.json"
);

interface ContractArtifact {
  abi: Abi;
  bytecode: `0x${string}`;
}

function parseList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing required environment variable: ${name}`);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseAddresses(): `0x${string}`[] {
  return parseList("PAYEES").map((a) => {
    const normalized = a.startsWith("0x") ? a : `0x${a}`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
      throw new Error(`PAYEES contains an invalid address: "${a}".`);
    }
    return normalized as `0x${string}`;
  });
}

function parseShares(count: number): bigint[] {
  const parts = parseList("SHARES_BPS");
  if (parts.length !== count) {
    throw new Error(`SHARES_BPS has ${parts.length} entries but PAYEES has ${count}.`);
  }
  const shares = parts.map((p) => {
    if (!/^\d+$/.test(p)) throw new Error(`SHARES_BPS must be integers, got "${p}".`);
    return BigInt(p);
  });
  const total = shares.reduce((a, b) => a + b, 0n);
  if (total !== 10000n) {
    throw new Error(`SHARES_BPS must sum to 10000, got ${total}.`);
  }
  return shares;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;

  const payees = parseAddresses();
  const shares = parseShares(payees.length);

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Network:  ${chain.name} (chain id ${chain.id})`);
  console.log(`Deployer: ${account.address}`);
  payees.forEach((p, i) => console.log(`Payee ${i}:  ${p} — ${shares[i]} bps`));

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [payees, shares],
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`RentSplitter deployed at: ${receipt.contractAddress}`);
  console.log(`\nSet CONTRACT_ADDRESS=${receipt.contractAddress} in your .env`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
