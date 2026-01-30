/**
 * Mint 100 TKDemo tokens to an address. Uses TOKEN_OWNER key (Turnkey) to sign.
 * Usage: pnpm run mint [recipient-address]
 * If no address is provided, mints to TOKEN_OWNER from .env.
 * Proxy from deploy-output.json or PROXY_ADDRESS.
 */

import * as path from "path";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { createPublicClient, createWalletClient, http, type Account, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { toLowercaseAddress } from "./address";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OUT_DIR = path.join(__dirname, "..", "foundry", "out");
const TKDEMO_ARTIFACT = path.join(OUT_DIR, "TKDemo.sol", "TKDemo.json");
const DEPLOY_OUTPUT = path.join(__dirname, "..", "deploy-output.json");

const MINT_AMOUNT = 100n * 10n ** 18n; // 100 tokens (18 decimals)

function getProxyAddress(): string {
  const raw =
    process.env.PROXY_ADDRESS?.trim() ||
    (() => {
      try {
        const data = JSON.parse(fs.readFileSync(DEPLOY_OUTPUT, "utf8"));
        return data.proxyAddress ?? "";
      } catch {
        return "";
      }
    })();
  if (!raw) {
    console.error("Proxy address not found. Run deploy first or set PROXY_ADDRESS in .env");
    process.exit(1);
  }
  return toLowercaseAddress(raw);
}

async function main() {
  const recipientArg = process.argv[2]?.trim();
  const recipientRaw =
    recipientArg && recipientArg.startsWith("0x")
      ? recipientArg
      : (process.env.TOKEN_OWNER?.trim() ?? "");
  if (!recipientRaw || !recipientRaw.startsWith("0x")) {
    console.error("Usage: pnpm run mint [recipient-address]");
    console.error("If no address is provided, TOKEN_OWNER from .env is used.");
    process.exit(1);
  }
  const recipient = toLowercaseAddress(recipientRaw);

  const proxyAddress = getProxyAddress() as Hex;
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://1rpc.io/sepolia";

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const tokenOwnerAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: toLowercaseAddress(process.env.TOKEN_OWNER!),
  });

  const artifact = JSON.parse(fs.readFileSync(TKDEMO_ARTIFACT, "utf8")) as { abi: readonly unknown[] };
  const transport = http(rpcUrl);

  const walletClient = createWalletClient({
    account: tokenOwnerAccount as Account,
    chain: sepolia,
    transport,
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  console.log("Minting", "100", "tokens to", recipient, "...");
  const hash = await walletClient.writeContract(
    {
      address: proxyAddress,
      abi: artifact.abi,
      functionName: "mint",
      args: [recipient, MINT_AMOUNT],
    } as unknown as Parameters<typeof walletClient.writeContract>[0]
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Minted. Tx:", receipt.transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
