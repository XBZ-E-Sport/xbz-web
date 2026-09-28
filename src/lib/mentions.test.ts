import { describe, it, expect } from "vitest";

import { defuseMentions } from "@/lib/mentions";

const ZWSP = "​";

describe("defuseMentions", () => {
  it("casse @everyone / @here, quelle que soit la casse", () => {
    expect(defuseMentions("salut @everyone et @HERE")).toBe(`salut @${ZWSP}everyone et @${ZWSP}HERE`);
  });

  it("casse les mentions de membre et de rôle", () => {
    expect(defuseMentions("<@123> <@!456> <@&789>")).toBe(`<@${ZWSP}123> <@${ZWSP}!456> <@${ZWSP}&789>`);
  });

  it("laisse intact un texte sans mention (affichage identique)", () => {
    const text = "Motivé, 3 ans de RL — contact : pseudo#1234 <3";
    expect(defuseMentions(text)).toBe(text);
    expect(defuseMentions("@jean")).toBe("@jean");
  });
});
