import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  http,
  type Account,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { toLowercaseAddress } from "./address";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const FOUNDRY_DIR = path.join(__dirname, "..", "foundry");
const OUT_DIR = path.join(FOUNDRY_DIR, "out");
const TKDEMO_ARTIFACT = path.join(OUT_DIR, "TKDemo.sol", "TKDemo.json");
const PROXY_ARTIFACT = path.join(
  OUT_DIR,
  "TransparentUpgradeableProxy.sol",
  "TransparentUpgradeableProxy.json"
);

function runForge(args: string[], cwd: string = FOUNDRY_DIR): void {
  const cmd = `forge ${args.join(" ")}`;
  console.log("[forge]", cmd);
  execSync(cmd, { cwd, stdio: "inherit" });
}

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: toLowercaseAddress(process.env.DEPLOYER_ADDRESS!),
  });

  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ?? "https://1rpc.io/sepolia";
  // Token owner = who can mint (TKDemo.initialize(owner)). Proxy admin = who can upgrade (separate).
  const tokenOwner = toLowercaseAddress(process.env.TOKEN_OWNER!);
  const upgradeAddress = toLowercaseAddress(process.env.UPGRADE_ADDRESS!);

  console.log("Running Foundry clean & build...");
  runForge(["clean"]);
  runForge(["build"]);

  const tkDemoRaw = JSON.parse(
    fs.readFileSync(TKDEMO_ARTIFACT, "utf8")
  ) as { bytecode: { object: string }; abi: readonly unknown[] };
  const proxyRaw = JSON.parse(
    fs.readFileSync(PROXY_ARTIFACT, "utf8")
  ) as { bytecode: { object: string }; abi: readonly unknown[] };

  const implementationBytecode = tkDemoRaw.bytecode.object as Hex;
  const proxyBytecode = proxyRaw.bytecode.object as Hex;

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log("Deploying TKDemo implementation...");
  // Cast: viem Sepolia types require kzg for sendTransaction; we're doing a plain contract deploy.
  const implTxHash = await client.sendTransaction({
    data: implementationBytecode,
  } as unknown as Parameters<typeof client.sendTransaction>[0]);
  const implReceipt = await publicClient.waitForTransactionReceipt({
    hash: implTxHash,
  });
  const implementationAddress = implReceipt.contractAddress;
  if (!implementationAddress) {
    throw new Error("Implementation deployment did not create a contract");
  }
  const implementationAddressLower = toLowercaseAddress(implementationAddress);
  console.log("Implementation at:", implementationAddressLower);

  const initData = encodeFunctionData({
    abi: tkDemoRaw.abi as readonly unknown[],
    functionName: "initialize",
    args: [tokenOwner],
  });

  console.log("Deploying TransparentUpgradeableProxy...");
  const proxyDeployData = encodeDeployData({
    abi: proxyRaw.abi as readonly unknown[],
    bytecode: proxyBytecode,
    args: [implementationAddressLower, upgradeAddress, initData],
  });
  // Cast: same as above (viem Sepolia + sendTransaction typing).
  const proxyTxHash = await client.sendTransaction({
    data: proxyDeployData,
  } as unknown as Parameters<typeof client.sendTransaction>[0]);
  const proxyReceipt = await publicClient.waitForTransactionReceipt({
    hash: proxyTxHash,
  });
  const proxyAddress = proxyReceipt.contractAddress;
  if (!proxyAddress) {
    throw new Error("Proxy deployment did not create a contract");
  }
  const proxyAddressLower = toLowercaseAddress(proxyAddress);

  console.log("Proxy (TKDemo) at:", proxyAddressLower);
  const deployOutputPath = path.join(__dirname, "..", "deploy-output.json");
  fs.writeFileSync(
    deployOutputPath,
    JSON.stringify({ proxyAddress: proxyAddressLower, implementationAddress: implementationAddressLower }, null, 2)
  );
  console.log("Wrote", deployOutputPath, "(for verifyDeploy)");
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
