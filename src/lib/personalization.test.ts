import { describe, expect, it } from "vitest";

import { isPersonalizable, PERSONALIZABLE_SLUGS } from "@/lib/personalization";

describe("isPersonalizable", () => {
  it("reconnaît le maillot, pas les autres articles", () => {
    expect(isPersonalizable("maillot-officiel")).toBe(true);
    expect(isPersonalizable("hoodie")).toBe(false);
    expect(isPersonalizable("")).toBe(false);
  });

  it("ne liste que des slugs sans espace ni majuscule", () => {
    for (const slug of PERSONALIZABLE_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
