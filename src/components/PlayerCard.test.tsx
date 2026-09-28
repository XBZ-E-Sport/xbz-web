import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import PlayerCard from "@/components/PlayerCard";
import type { Player } from "@/lib/roster";
import { renderIntl } from "../../test/intl";

const player: Player = {
  id: "j1",
  slug: "louan",
  pseudo: "Louan",
  nom: null,
  photo_url: null,
  pays: "France",
  pays_code: "FR",
  role: "Capitaine",
  bio: null,
  rang: null,
  mmr: null,
  twitter: null,
  twitch: null,
  rltracker: null,
  palmares: null,
  position: 1,
};

afterEach(() => cleanup());

describe("PlayerCard", () => {
  it("suit la langue PASSÉE par la page, même dans un contexte français", () => {
    // Reproduit une page /en statique : le contexte de langue par défaut est le
    // français. Avant, la carte affichait « Capitaine » et liait vers /fr/….
    const { container } = renderIntl(
      <ul>
        <PlayerCard player={player} parentSlug="gc3" locale="en" roleLabel="Captain" />
      </ul>,
      { locale: "fr" },
    );
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/en/equipes/gc3/louan");
    expect(container.textContent).toContain("Captain");
    expect(container.textContent).not.toContain("Capitaine");
  });

  it("garde la couleur de badge indexée sur le rôle d'origine (français)", () => {
    const { container } = renderIntl(
      <ul>
        <PlayerCard player={{ ...player, role: "Coach" }} locale="en" roleLabel="Coach" />
      </ul>,
    );
    expect(container.querySelector("span.bg-xbz-blue")?.textContent).toBe("Coach");
  });
});
