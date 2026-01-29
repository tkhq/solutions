/**
 * Verifies the TKDemo proxy deployed by deploy.ts: checks on-chain state and lists
 * read/write functions. Reads proxy address from deploy-output.json (written by deploy)
 * or from env PROXY_ADDRESS.
 */

import * as path from "path";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OUT_DIR = path.join(__dirname, "..", "foundry", "out");
const TKDEMO_ARTIFACT = path.join(OUT_DIR, "TKDemo.sol", "TKDemo.json");
const TKDEMO_V2_ARTIFACT = path.join(OUT_DIR, "TKDemoV2.sol", "TKDemoV2.json");
const DEPLOY_OUTPUT = path.join(__dirname, "..", "deploy-output.json");

// ERC-1967 implementation slot (see ERC1967Utils.IMPLEMENTATION_SLOT)
const ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as `0x${string}`;

type AbiItem = {
  type: string;
  name?: string;
  stateMutability?: string;
  inputs?: { name: string; type: string }[];
};

function getProxyAddress(): string {
  if (process.env.PROXY_ADDRESS?.trim()) {
    return process.env.PROXY_ADDRESS.trim();
  }
  try {
    const data = JSON.parse(fs.readFileSync(DEPLOY_OUTPUT, "utf8"));
    if (data.proxyAddress) return data.proxyAddress;
  } catch {
    // ignore
  }
  console.error("Proxy address not found. Run deploy first (writes deploy-output.json) or set PROXY_ADDRESS in .env");
  process.exit(1);
}

function getDeployOutput(): { proxyAddress?: string; implementationAddress?: string } {
  try {
    return JSON.parse(fs.readFileSync(DEPLOY_OUTPUT, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const proxyAddress = getProxyAddress() as `0x${string}`;
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://1rpc.io/sepolia";
  const deployOutput = getDeployOutput();

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  // Read ERC-1967 implementation slot (value is 32 bytes, address is right 20 bytes)
  const slotHex = await publicClient.getStorageAt({
    address: proxyAddress,
    slot: ERC1967_IMPLEMENTATION_SLOT,
  });
  const onChainImpl =
    slotHex && slotHex.length >= 66
      ? ("0x" + slotHex.slice(-40).toLowerCase()) as `0x${string}`
      : null;
  const expectedImpl = deployOutput.implementationAddress
    ? (deployOutput.implementationAddress.toLowerCase() as `0x${string}`)
    : null;

  const artifactPath =
    expectedImpl && onChainImpl && onChainImpl === expectedImpl && fs.existsSync(TKDEMO_V2_ARTIFACT)
      ? TKDEMO_V2_ARTIFACT
      : TKDEMO_ARTIFACT;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
    abi: AbiItem[];
  };
  const abi = artifact.abi;

  const readFns: string[] = [];
  const writeFns: string[] = [];
  for (const item of abi) {
    if (item.type !== "function" || !item.name) continue;
    const mutability = item.stateMutability ?? "";
    if (mutability === "view" || mutability === "pure") {
      readFns.push(item.name);
    } else if (mutability === "nonpayable" || mutability === "payable") {
      writeFns.push(item.name);
    }
  }
  readFns.sort();
  writeFns.sort();

  const code = await publicClient.getBytecode({ address: proxyAddress });
  if (!code || code === "0x") {
    console.error("No contract at", proxyAddress, "- deploy may have failed or address is wrong.");
    process.exit(1);
  }

  type ReadOpts = Parameters<typeof publicClient.readContract>[0];
  const read = (functionName: "name" | "symbol" | "decimals" | "totalSupply" | "owner") =>
    publicClient.readContract({ address: proxyAddress, abi, functionName } as unknown as ReadOpts);

  const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
    read("name"),
    read("symbol"),
    read("decimals"),
    read("totalSupply"),
    read("owner"),
  ]);

  const implMatchBool =
    onChainImpl && expectedImpl && onChainImpl === expectedImpl;

  console.log("--- TKDemo deploy verification ---\n");
  console.log("Proxy address:", proxyAddress);
  console.log("Chain: Sepolia");
  console.log("Implementation (on-chain):", onChainImpl ?? "(none)");
  if (expectedImpl) {
    console.log("Implementation (deploy-output):", expectedImpl);
    console.log("Match:", implMatchBool ? "yes" : "NO — proxy still points to old implementation");
    if (!implMatchBool) {
      console.log("  → Run upgrade again; if it already succeeded, the upgrade may have targeted the wrong ProxyAdmin.");
    }
  }
  console.log("\n--- Deploy info ---");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", Number(decimals));
  console.log("Total supply:", totalSupply.toString());
  console.log("Owner:", owner);
  console.log("\n--- Read functions ---");
  readFns.forEach((fn) => console.log("  ", fn));
  console.log("\n--- Write functions ---");
  writeFns.forEach((fn) => console.log("  ", fn));
  console.log("\nVerification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
