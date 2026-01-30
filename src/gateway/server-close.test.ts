import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatewayCloseHandler } from "./server-close.js";

vi.mock("../hooks/gmail-watcher.js", () => ({
  stopGmailWatcher: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: vi.fn().mockReturnValue([{ id: "telegram" }, { id: "discord" }]),
}));

function createMockParams() {
  const mockSocket = { close: vi.fn() };
  const clients = new Set([{ socket: mockSocket }]) as Parameters<
    typeof createGatewayCloseHandler
  >[0]["clients"];

  return {
    bonjourStop: vi.fn().mockResolvedValue(undefined),
    tailscaleCleanup: vi.fn().mockResolvedValue(undefined),
    canvasHost: { close: vi.fn().mockResolvedValue(undefined) },
    canvasHostServer: { close: vi.fn().mockResolvedValue(undefined) },
    stopChannel: vi.fn().mockResolvedValue(undefined),
    pluginServices: { stop: vi.fn().mockResolvedValue(undefined) },
    cron: { stop: vi.fn() },
    heartbeatRunner: { stop: vi.fn() },
    nodePresenceTimers: new Map<string, ReturnType<typeof setInterval>>(),
    broadcast: vi.fn(),
    tickInterval: setInterval(() => {}, 999_999),
    healthInterval: setInterval(() => {}, 999_999),
    dedupeCleanup: setInterval(() => {}, 999_999),
    agentUnsub: vi.fn(),
    heartbeatUnsub: vi.fn(),
    chatRunState: { clear: vi.fn() },
    clients,
    configReloader: { stop: vi.fn().mockResolvedValue(undefined) },
    browserControl: { stop: vi.fn().mockResolvedValue(undefined) },
    wss: { close: vi.fn((cb: () => void) => cb()) } as unknown as Parameters<
      typeof createGatewayCloseHandler
    >[0]["wss"],
    httpServer: {
      closeIdleConnections: vi.fn(),
      close: vi.fn((cb: (err?: Error) => void) => cb()),
    } as unknown as Parameters<typeof createGatewayCloseHandler>[0]["httpServer"],
  };
}

describe("createGatewayCloseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls all subsystem cleanup functions", async () => {
    const params = createMockParams();
    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.bonjourStop).toHaveBeenCalledTimes(1);
    expect(params.tailscaleCleanup).toHaveBeenCalledTimes(1);
    expect(params.canvasHost!.close).toHaveBeenCalledTimes(1);
    expect(params.canvasHostServer!.close).toHaveBeenCalledTimes(1);
    expect(params.stopChannel).toHaveBeenCalledTimes(2); // telegram + discord
    expect(params.pluginServices!.stop).toHaveBeenCalledTimes(1);
    expect(params.cron.stop).toHaveBeenCalledTimes(1);
    expect(params.heartbeatRunner.stop).toHaveBeenCalledTimes(1);
    expect(params.configReloader.stop).toHaveBeenCalledTimes(1);
    expect(params.browserControl!.stop).toHaveBeenCalledTimes(1);
  });

  it("broadcasts shutdown event with reason and restartExpectedMs", async () => {
    const params = createMockParams();
    const close = createGatewayCloseHandler(params);
    await close({ reason: "config change", restartExpectedMs: 5000 });

    expect(params.broadcast).toHaveBeenCalledWith("shutdown", {
      reason: "config change",
      restartExpectedMs: 5000,
    });
  });

  it("uses default reason when none provided", async () => {
    const params = createMockParams();
    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.broadcast).toHaveBeenCalledWith("shutdown", {
      reason: "gateway stopping",
      restartExpectedMs: null,
    });
  });

  it("closes WebSocket clients with code 1012", async () => {
    const mockSocket = { close: vi.fn() };
    const params = createMockParams();
    params.clients.clear();
    (params.clients as Set<{ socket: { close: (code: number, reason: string) => void } }>).add({
      socket: mockSocket,
    });

    const close = createGatewayCloseHandler(params);
    await close();

    expect(mockSocket.close).toHaveBeenCalledWith(1012, "service restart");
  });

  it("clears clients set after closing connections", async () => {
    const params = createMockParams();
    expect(params.clients.size).toBe(1);

    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.clients.size).toBe(0);
  });

  it("clears all intervals", async () => {
    const params = createMockParams();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const close = createGatewayCloseHandler(params);
    await close();

    expect(clearIntervalSpy).toHaveBeenCalledWith(params.tickInterval);
    expect(clearIntervalSpy).toHaveBeenCalledWith(params.healthInterval);
    expect(clearIntervalSpy).toHaveBeenCalledWith(params.dedupeCleanup);

    clearIntervalSpy.mockRestore();
  });

  it("clears node presence timers", async () => {
    const params = createMockParams();
    const timer = setInterval(() => {}, 999_999);
    params.nodePresenceTimers.set("node-1", timer);
    params.nodePresenceTimers.set("node-2", timer);

    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.nodePresenceTimers.size).toBe(0);
  });

  it("calls agentUnsub and heartbeatUnsub", async () => {
    const params = createMockParams();
    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.agentUnsub).toHaveBeenCalledTimes(1);
    expect(params.heartbeatUnsub).toHaveBeenCalledTimes(1);
  });

  it("clears chat run state", async () => {
    const params = createMockParams();
    const close = createGatewayCloseHandler(params);
    await close();

    expect(params.chatRunState.clear).toHaveBeenCalledTimes(1);
  });

  it("survives bonjour stop throwing", async () => {
    const params = createMockParams();
    params.bonjourStop = vi.fn().mockRejectedValue(new Error("bonjour failed"));

    const close = createGatewayCloseHandler(params);
    await expect(close()).resolves.toBeUndefined();
  });

  it("survives canvas host close throwing", async () => {
    const params = createMockParams();
    params.canvasHost = { close: vi.fn().mockRejectedValue(new Error("canvas failed")) };

    const close = createGatewayCloseHandler(params);
    await expect(close()).resolves.toBeUndefined();
  });

  it("survives agent unsub throwing", async () => {
    const params = createMockParams();
    params.agentUnsub = vi.fn().mockImplementation(() => {
      throw new Error("unsub failed");
    });

    const close = createGatewayCloseHandler(params);
    await expect(close()).resolves.toBeUndefined();
  });

  it("handles null optional params", async () => {
    const params = createMockParams();
    params.bonjourStop = null;
    params.tailscaleCleanup = null;
    params.canvasHost = null;
    params.canvasHostServer = null;
    params.pluginServices = null;
    params.agentUnsub = null;
    params.heartbeatUnsub = null;
    params.browserControl = null;

    const close = createGatewayCloseHandler(params);
    await expect(close()).resolves.toBeUndefined();
  });

  it("closes HTTP servers with closeIdleConnections first", async () => {
    const params = createMockParams();
    const callOrder: string[] = [];
    const httpServer = params.httpServer as unknown as {
      closeIdleConnections: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    httpServer.closeIdleConnections.mockImplementation(() => callOrder.push("closeIdle"));
    httpServer.close.mockImplementation((cb: (err?: Error) => void) => {
      callOrder.push("close");
      cb();
    });

    const close = createGatewayCloseHandler(params);
    await close();

    expect(callOrder).toEqual(["closeIdle", "close"]);
  });

  it("closes WSS before HTTP servers", async () => {
    const params = createMockParams();
    const callOrder: string[] = [];
    (params.wss.close as ReturnType<typeof vi.fn>).mockImplementation((cb: () => void) => {
      callOrder.push("wss");
      cb();
    });
    const httpServer = params.httpServer as unknown as {
      closeIdleConnections: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    httpServer.close.mockImplementation((cb: (err?: Error) => void) => {
      callOrder.push("http");
      cb();
    });

    const close = createGatewayCloseHandler(params);
    await close();

    expect(callOrder.indexOf("wss")).toBeLessThan(callOrder.indexOf("http"));
  });
});
