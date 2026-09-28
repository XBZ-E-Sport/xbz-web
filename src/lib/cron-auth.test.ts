// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { isCronAuthorized } from "@/lib/cron-auth";

const call = (authorization?: string) =>
  isCronAuthorized(
    new Request("https://x.test/api/cron/purge", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCronAuthorized", () => {
  it("accepte exactement « Bearer <CRON_SECRET> »", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t-cron");
    expect(call("Bearer s3cr3t-cron")).toBe(true);
  });

  it.each([
    ["sans en-tête", undefined],
    ["mauvais secret", "Bearer s3cr3t-crom"],
    ["préfixe du secret", "Bearer s3cr3t"],
    ["secret + suffixe", "Bearer s3cr3t-cron2"],
    ["sans « Bearer »", "s3cr3t-cron"],
    ["vide", ""],
  ])("refuse : %s", (_label, header) => {
    vi.stubEnv("CRON_SECRET", "s3cr3t-cron");
    expect(call(header)).toBe(false);
  });

  it("fail-safe : sans CRON_SECRET configuré, tout est refusé — même « Bearer  »", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(call("Bearer ")).toBe(false);
    expect(call(undefined)).toBe(false);
  });
});
