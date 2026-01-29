import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".opsagent"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", OPSAGENT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".opsagent-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", OPSAGENT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".opsagent"));
  });

  it("uses OPSAGENT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", OPSAGENT_STATE_DIR: "/var/lib/opsagent" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/opsagent"));
  });

  it("expands ~ in OPSAGENT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", OPSAGENT_STATE_DIR: "~/opsagent-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/opsagent-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { OPSAGENT_STATE_DIR: "C:\\State\\opsagent" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\opsagent");
  });
});
