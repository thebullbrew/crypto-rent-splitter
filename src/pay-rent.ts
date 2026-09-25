import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

/**
 * Pay rent to the splitter. The contract's receive() splits it immediately
 * across the configured payees — this script just sends the ETH.
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... AMOUNT_ETH=2.5 npm run pay
 */
async function main(): Promise<void> {
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set — deploy first (`npm run deploy`).");
  }
  const amountRaw = process.env.AMOUNT_ETH;
  if (!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw) || Number(amountRaw) <= 0) {
    throw new Error('Set AMOUNT_ETH to a positive ETH amount, e.g. AMOUNT_ETH=2.5.');
  }
  const amount = parseEther(amountRaw);

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Network:   ${chain.name} (chain id ${chain.id})`);
  console.log(`Payer:     ${account.address}`);
  console.log(`Splitter:  ${config.contractAddress}`);
  console.log(`Amount:    ${amountRaw} ETH`);

  const hash = await walletClient.sendTransaction({
    to: config.contractAddress,
    value: amount,
  });
  console.log(`Pay tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber} — rent split across payees.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
