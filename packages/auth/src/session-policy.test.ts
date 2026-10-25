import { describeDeviceKind, describeUserAgent, UNKNOWN_DEVICE_LABEL } from "./device-label";
import { evaluateSessionTimeouts, refreshCookieMaxAgeSeconds, resolveSessionPolicy, sessionExpiresAt } from "./session-policy";

const SETTINGS = {
  accessTokenTtlMinutes: 15,
  sessionIdleMinutes: 60,
  sessionAbsoluteHours: 12,
  rememberMeDays: 30,
  adminIdleMinutes: 10,
  adminAbsoluteHours: 8,
  sessionWarningMinutes: 2,
};

describe("ADR-053 session policy", () => {
  it("resolves cookie persistence, idle and absolute limits per role and remember-me, ignoring remember-me for SYSTEM_ADMIN", () => {
    const now = new Date("2026-10-24T00:00:00Z");

    const plain = resolveSessionPolicy("USER", false, SETTINGS);
    expect(plain).toEqual({ rememberMe: false, idleMs: 60 * 60_000, absoluteMs: 12 * 3_600_000, warningMs: 2 * 60_000, accessTtlSeconds: 900 });
    expect(refreshCookieMaxAgeSeconds(plain, sessionExpiresAt(now, plain), now)).toBeNull();

    const remembered = resolveSessionPolicy("USER", true, SETTINGS);
    expect(remembered).toMatchObject({ rememberMe: true, idleMs: null, warningMs: null, absoluteMs: 30 * 86_400_000, accessTtlSeconds: 900 });
    expect(sessionExpiresAt(now, remembered).toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(refreshCookieMaxAgeSeconds(remembered, sessionExpiresAt(now, remembered), now)).toBe(30 * 86_400);

    const admin = resolveSessionPolicy("SYSTEM_ADMIN", true, SETTINGS);
    expect(admin).toMatchObject({ rememberMe: false, idleMs: 10 * 60_000, absoluteMs: 8 * 3_600_000 });
    // Access token never outlives the idle window (15-minute TTL capped to the 10-minute admin idle).
    expect(admin.accessTtlSeconds).toBe(600);
    expect(refreshCookieMaxAgeSeconds(admin, sessionExpiresAt(now, admin), now)).toBeNull();
    // Warning is capped to half of the idle window.
    expect(resolveSessionPolicy("USER", false, { ...SETTINGS, sessionIdleMinutes: 10, sessionWarningMinutes: 9 }).warningMs).toBe(5 * 60_000);
  });

  it("expires a session on idle (except remember-me) and on the non-sliding absolute limit", () => {
    const startedAt = new Date("2026-10-24T00:00:00Z");
    const plain = resolveSessionPolicy("USER", false, SETTINGS);
    const remembered = resolveSessionPolicy("USER", true, SETTINGS);
    const at = (iso: string) => new Date(iso);

    expect(evaluateSessionTimeouts({ sessionStartedAt: startedAt, lastActiveAt: at("2026-10-24T05:00:00Z") }, plain, at("2026-10-24T05:59:00Z"))).toBe("active");
    expect(evaluateSessionTimeouts({ sessionStartedAt: startedAt, lastActiveAt: at("2026-10-24T05:00:00Z") }, plain, at("2026-10-24T06:01:00Z"))).toBe("idle");
    // Still active (just refreshed) but past 12 hours since login → absolute wins.
    expect(evaluateSessionTimeouts({ sessionStartedAt: startedAt, lastActiveAt: at("2026-10-24T11:59:00Z") }, plain, at("2026-10-24T12:01:00Z"))).toBe("absolute");
    // Remember-me: no idle limit, only the 30-day absolute.
    expect(evaluateSessionTimeouts({ sessionStartedAt: startedAt, lastActiveAt: startedAt }, remembered, at("2026-11-10T00:00:00Z"))).toBe("active");
    expect(evaluateSessionTimeouts({ sessionStartedAt: startedAt, lastActiveAt: startedAt }, remembered, at("2026-11-24T00:00:00Z"))).toBe("absolute");
  });

  it("labels devices and their kind (desktop/mobile/tablet) from the user agent", () => {
    expect(
      describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    ).toBe("Chrome · Windows");
    expect(
      describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"),
    ).toBe("Edge · Windows");
    expect(
      describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/130.0.0 Chrome/124.0.0.0 Safari/537.36"),
    ).toBe("Cốc Cốc · Windows");
    expect(
      describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"),
    ).toBe("Safari · iPhone");
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36")).toBe(
      "Samsung Internet · Android",
    );
    expect(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox · macOS");
    expect(describeUserAgent(null)).toBe(UNKNOWN_DEVICE_LABEL);
    expect(describeUserAgent("curl/8.4.0")).toBe(UNKNOWN_DEVICE_LABEL);
    // Device kind (icon only): Android tablets omit "Mobile"; iPad and Firefox "Tablet" are tablets; unknown → desktop.
    expect(describeDeviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")).toBe("desktop");
    expect(describeDeviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("mobile");
    expect(describeDeviceKind("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36")).toBe("mobile");
    expect(describeDeviceKind("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")).toBe("tablet");
    expect(describeDeviceKind("Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe("tablet");
    expect(describeDeviceKind("Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe("mobile");
    expect(describeDeviceKind("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe("tablet");
    expect(describeDeviceKind(null)).toBe("desktop");
  });
});
