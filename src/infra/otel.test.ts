import { describe, it, expect } from "vitest";
import { initOtel } from "./otel.js";

describe("initOtel", () => {
  it("returns no-op handle when config is undefined", async () => {
    const handle = await initOtel(undefined);
    expect(handle).toBeDefined();
    expect(handle.shutdown).toBeTypeOf("function");
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("returns no-op handle when enabled is false", async () => {
    const handle = await initOtel({ enabled: false });
    expect(handle).toBeDefined();
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("returns no-op handle when enabled but no endpoint", async () => {
    const handle = await initOtel({ enabled: true });
    expect(handle).toBeDefined();
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("returns a handle with shutdown when properly configured", async () => {
    // This test validates the SDK initializes without throwing.
    // In a test environment without a real OTLP collector, the SDK
    // starts but exports will fail silently — which is expected.
    const handle = await initOtel({
      enabled: true,
      endpoint: "http://localhost:4318",
      serviceName: "test-service",
      traces: true,
      metrics: false,
      sampleRate: 0.5,
    });
    expect(handle).toBeDefined();
    expect(handle.shutdown).toBeTypeOf("function");
    // Shutdown should not throw even without a collector
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("handles metrics-only configuration", async () => {
    const handle = await initOtel({
      enabled: true,
      endpoint: "http://localhost:4318",
      traces: false,
      metrics: true,
      flushIntervalMs: 5000,
    });
    expect(handle).toBeDefined();
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });
});
