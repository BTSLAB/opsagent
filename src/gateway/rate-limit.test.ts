import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 5 });
    try {
      for (let i = 0; i < 5; i++) {
        expect(limiter.allow("1.2.3.4")).toBe(true);
      }
    } finally {
      limiter.cleanup();
    }
  });

  it("denies requests over the limit", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 3 });
    try {
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(false);
      expect(limiter.allow("1.2.3.4")).toBe(false);
    } finally {
      limiter.cleanup();
    }
  });

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 2 });
    try {
      expect(limiter.allow("1.1.1.1")).toBe(true);
      expect(limiter.allow("1.1.1.1")).toBe(true);
      expect(limiter.allow("1.1.1.1")).toBe(false);

      // Different IP should still be allowed
      expect(limiter.allow("2.2.2.2")).toBe(true);
      expect(limiter.allow("2.2.2.2")).toBe(true);
      expect(limiter.allow("2.2.2.2")).toBe(false);
    } finally {
      limiter.cleanup();
    }
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 2 });
    try {
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(1_001);

      // Should be allowed again
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(true);
      expect(limiter.allow("1.2.3.4")).toBe(false);
    } finally {
      limiter.cleanup();
      vi.useRealTimers();
    }
  });

  it("cleanup clears all entries", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 5 });
    limiter.allow("1.1.1.1");
    limiter.allow("2.2.2.2");
    expect(limiter.size()).toBe(2);

    limiter.cleanup();
    expect(limiter.size()).toBe(0);
  });

  it("periodic cleanup removes expired entries", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({
      windowMs: 1_000,
      maxRequests: 10,
      cleanupIntervalMs: 500,
    });
    try {
      limiter.allow("1.1.1.1");
      expect(limiter.size()).toBe(1);

      // Advance past the window + cleanup interval
      vi.advanceTimersByTime(1_500);

      expect(limiter.size()).toBe(0);
    } finally {
      limiter.cleanup();
      vi.useRealTimers();
    }
  });
});
