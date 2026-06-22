import { getActiveSlackInstallation } from "../db/queries";
import type { Env } from "../types";
import { decryptSecret } from "../utils/secretBox";

export async function resolveSlackBotToken(env: Env, teamId: string): Promise<string> {
  const installation = await getActiveSlackInstallation(env.DB, teamId);
  if (installation) {
    return decryptSecret(installation.bot_token_ciphertext, installationTokenEncryptionKey(env));
  }

  if (env.SLACK_BOT_TOKEN) {
    return env.SLACK_BOT_TOKEN;
  }

  throw new Error(`No active Slack installation for team ${teamId}`);
}

export function installationTokenEncryptionKey(env: Env): string {
  return env.INSTALLATION_TOKEN_ENCRYPTION_KEY ?? env.PREVIEW_SIGNING_SECRET;
}
