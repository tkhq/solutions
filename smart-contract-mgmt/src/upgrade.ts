/**
 * Deploy TKDemoV2 (6 decimals) and upgrade the proxy to it.
 * Uses UPGRADE_ADDRESS to sign. Proxy from deploy-output.json or PROXY_ADDRESS.
 * The proxy's admin (from ERC-1967 slot) must be a ProxyAdmin contract; we call
 * ProxyAdmin.upgradeAndCall(proxy, newImpl, "0x").
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { toLowercaseAddress } from "./address";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const FOUNDRY_DIR = path.join(__dirname, "..", "foundry");
const OUT_DIR = path.join(FOUNDRY_DIR, "out");
const TKDEMO_V2_ARTIFACT = path.join(OUT_DIR, "TKDemoV2.sol", "TKDemoV2.json");
const PROXY_ADMIN_ARTIFACT = path.join(OUT_DIR, "ProxyAdmin.sol", "ProxyAdmin.json");
const DEPLOY_OUTPUT = path.join(__dirname, "..", "deploy-output.json");

// ERC-1967 standard: same for every compliant proxy. EIP https://eips.ethereum.org/EIPS/eip-1967
const ERC1967_ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" as `0x${string}`;

const NETWORKS: Record<string, { chain: Chain; rpcEnvKey: string; defaultRpc: string }> = {
  sepolia: {
    chain: sepolia,
    rpcEnvKey: "SEPOLIA_RPC_URL",
    defaultRpc: "https://1rpc.io/sepolia",
  },
};

function parseNetwork(): string {
  const idx = process.argv.indexOf("--network");
  if (idx === -1 || !process.argv[idx + 1]) return "sepolia";
  const v = process.argv[idx + 1];
  if (!NETWORKS[v]) throw new Error(`Unknown network "${v}". Supported: ${Object.keys(NETWORKS).join(", ")}`);
  return v;
}

function runForge(args: string[], cwd: string = FOUNDRY_DIR): void {
  execSync(`forge ${args.join(" ")}`, { cwd, stdio: "inherit" });
}

function getProxyAddress(): string {
  const raw =
    process.env.PROXY_ADDRESS?.trim() ||
    (() => {
      try {
        const d = JSON.parse(fs.readFileSync(DEPLOY_OUTPUT, "utf8"));
        return d.proxyAddress ?? "";
      } catch {
        return "";
      }
    })();
  if (!raw) {
    console.error("Proxy address not found. Run deploy first or set PROXY_ADDRESS.");
    process.exit(1);
  }
  return toLowercaseAddress(raw);
}

async function main() {
  const networkName = parseNetwork();
  const { chain, rpcEnvKey, defaultRpc } = NETWORKS[networkName];
  const rpcUrl = process.env[rpcEnvKey] ?? defaultRpc;
  const proxyAddress = getProxyAddress() as Address;

  runForge(["clean"]);
  runForge(["build"]);

  const v2Raw = JSON.parse(fs.readFileSync(TKDEMO_V2_ARTIFACT, "utf8")) as {
    bytecode: { object: string };
    abi: readonly unknown[];
  };
  const proxyAdminRaw = JSON.parse(fs.readFileSync(PROXY_ADMIN_ARTIFACT, "utf8")) as { abi: readonly unknown[] };

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
  const upgradeAccount = (await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: toLowercaseAddress(process.env.UPGRADE_ADDRESS!),
  })) as Account;

  const transport = http(rpcUrl);
  const walletClient = createWalletClient({ account: upgradeAccount, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  // ProxyAdmin address is in the proxy's ERC-1967 admin slot
  const adminSlotHex = await publicClient.getStorageAt({ address: proxyAddress, slot: ERC1967_ADMIN_SLOT });
  const proxyAdminAddress =
    adminSlotHex && adminSlotHex.length >= 66
      ? ("0x" + adminSlotHex.slice(-40).toLowerCase()) as Address
      : null;
  if (!proxyAdminAddress) throw new Error("Could not read proxy admin from slot");

  // 1) Deploy new implementation
  const deployData = v2Raw.bytecode.object as Hex;
  const implTxHash = await walletClient.sendTransaction({
    data: deployData,
  } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implTxHash });
  if (implReceipt.status === "reverted") throw new Error("Implementation deploy reverted");
  const newImplementationAddress = implReceipt.contractAddress;
  if (!newImplementationAddress) throw new Error("Implementation deploy did not create a contract");
  const newImplementationAddressLower = toLowercaseAddress(newImplementationAddress);

  // 2) Upgrade via ProxyAdmin
  const upgradeHash = await walletClient.writeContract({
    address: proxyAdminAddress,
    abi: proxyAdminRaw.abi,
    functionName: "upgradeAndCall",
    args: [proxyAddress, newImplementationAddressLower, "0x" as Hex],
  } as unknown as Parameters<typeof walletClient.writeContract>[0]);

  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
  if (upgradeReceipt.status === "reverted") throw new Error("Upgrade reverted");

  const deployOutput = JSON.parse(fs.readFileSync(DEPLOY_OUTPUT, "utf8")) as {
    proxyAddress: string;
    implementationAddress: string;
  };
  deployOutput.implementationAddress = newImplementationAddressLower;
  fs.writeFileSync(DEPLOY_OUTPUT, JSON.stringify(deployOutput, null, 2));
  console.log("Done. Proxy implementation:", newImplementationAddressLower, "→ run verify-deploy to confirm.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
