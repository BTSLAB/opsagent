import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStartupPreflight } from "./startup-preflight.js";
import type { OpsAgentConfig } from "../config/types.js";

vi.mock("node:fs", () => ({
  default: {
    accessSync: vi.fn(),
    constants: { W_OK: 2 },
  },
}));

import fs from "node:fs";

describe("runStartupPreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when provider env var is set and state dir is writable", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const env = { ANTHROPIC_API_KEY: "sk-test-key" } as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight({}, env);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns ok when auth.profiles is configured", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const cfg: OpsAgentConfig = {
      auth: {
        profiles: {
          default: { provider: "anthropic", mode: "api_key" },
        },
      },
    };
    const env = {} as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight(cfg, env);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when no provider credentials are found", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const env = {} as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight({}, env);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("No AI provider credentials found");
  });

  it("warns when state directory is not writable", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("EACCES");
    });
    const env = { ANTHROPIC_API_KEY: "sk-test" } as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight({}, env);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("State directory is not writable");
  });

  it("returns multiple warnings when both checks fail", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("EACCES");
    });
    const env = {} as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight({}, env);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it("treats empty/whitespace-only env vars as missing", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const env = { ANTHROPIC_API_KEY: "   " } as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight({}, env);
    expect(result.ok).toBe(false);
    expect(result.warnings[0]).toContain("No AI provider credentials found");
  });

  it("accepts any supported provider key", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    for (const key of ["OPENAI_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"]) {
      const env = { [key]: "test-key" } as unknown as NodeJS.ProcessEnv;
      const result = runStartupPreflight({}, env);
      expect(result.ok).toBe(true);
    }
  });

  it("treats empty auth.profiles as missing", () => {
    (fs.accessSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const cfg: OpsAgentConfig = { auth: { profiles: {} } };
    const env = {} as unknown as NodeJS.ProcessEnv;
    const result = runStartupPreflight(cfg, env);
    expect(result.ok).toBe(false);
    expect(result.warnings[0]).toContain("No AI provider credentials found");
  });
});
