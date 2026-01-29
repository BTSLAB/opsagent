import { describe, expect, it } from "vitest";

import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "opsagent", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "opsagent", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "opsagent", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "opsagent", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "opsagent", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "opsagent", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "opsagent", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "opsagent"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "opsagent", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "opsagent", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "opsagent", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "opsagent", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "opsagent", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "opsagent", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "opsagent", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "opsagent", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "opsagent", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "opsagent", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "opsagent", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "opsagent", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "opsagent", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "opsagent", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "opsagent",
      rawArgs: ["node", "opsagent", "status"],
    });
    expect(nodeArgv).toEqual(["node", "opsagent", "status"]);

    const directArgv = buildParseArgv({
      programName: "opsagent",
      rawArgs: ["opsagent", "status"],
    });
    expect(directArgv).toEqual(["node", "opsagent", "status"]);

    const bunArgv = buildParseArgv({
      programName: "opsagent",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "opsagent",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "opsagent", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "opsagent", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "opsagent", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "opsagent", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "opsagent", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "opsagent", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "opsagent", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "opsagent", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
