import fs from "node:fs";
import type { OpsAgentConfig } from "../config/types.js";
import { resolveStateDir } from "../config/paths.js";

export type PreflightResult = {
  ok: boolean;
  warnings: string[];
};

/**
 * Well-known environment variable names for AI provider credentials.
 * At least one must be set (or auth.profiles must be configured) for the
 * gateway to be able to serve agent requests.
 */
const PROVIDER_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ZAI_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_GATEWAY_API_KEY",
  "CLAUDE_AI_SESSION_KEY",
  "CLAUDE_WEB_SESSION_KEY",
] as const;

function hasAnyProviderCredential(env: NodeJS.ProcessEnv): boolean {
  return PROVIDER_ENV_KEYS.some((key) => {
    const value = env[key]?.trim();
    return value !== undefined && value !== "";
  });
}

function hasAuthProfiles(cfg: OpsAgentConfig): boolean {
  const profiles = cfg.auth?.profiles;
  if (!profiles || typeof profiles !== "object") return false;
  return Object.keys(profiles).length > 0;
}

function isStateDirWritable(env: NodeJS.ProcessEnv): boolean {
  const stateDir = resolveStateDir(env);
  try {
    fs.accessSync(stateDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run startup preflight checks before the gateway begins serving requests.
 * Returns warnings (never throws) — the gateway should still start even if
 * checks fail, but warnings are logged so operators can fix issues early.
 */
export function runStartupPreflight(
  cfg: OpsAgentConfig,
  env: NodeJS.ProcessEnv = process.env,
): PreflightResult {
  const warnings: string[] = [];

  if (!hasAnyProviderCredential(env) && !hasAuthProfiles(cfg)) {
    warnings.push(
      "No AI provider credentials found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or configure auth.profiles in your config.",
    );
  }

  if (!isStateDirWritable(env)) {
    const stateDir = resolveStateDir(env);
    warnings.push(
      `State directory is not writable: ${stateDir}. The gateway may fail to persist sessions, cron state, or logs.`,
    );
  }

  return { ok: warnings.length === 0, warnings };
}
