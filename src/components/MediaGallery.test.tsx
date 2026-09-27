import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import MediaGallery from "@/components/MediaGallery";
import type { Media } from "@/lib/medias";
import { renderIntl, messages } from "../../test/intl";

const medias: Media[] = [
  { id: "1", type: "photo", title: "Finale LAN", category: "events", image: "/corbeau.png", videoUrl: null },
  { id: "2", type: "photo", title: "Backstage", category: "backstage", image: "/corbeau.png", videoUrl: null },
];

const fr = messages("fr");

afterEach(() => cleanup());

function openFirst() {
  const view = renderIntl(<MediaGallery medias={medias} />);
  fireEvent.click(screen.getByRole("button", { name: "Finale LAN" }));
  return { view, dialog: screen.getByRole("dialog") };
}

describe("MediaGallery — lightbox", () => {
  // La page pose la galerie dans un conteneur `relative z-10` (contexte
  // d'empilement) : rendue sur place, la lightbox passerait sous le header
  // (z-50) et le footer. Le portail la sort au niveau de <body>.
  it("est rendue directement dans <body>, hors du conteneur de la page", () => {
    const { view, dialog } = openFirst();
    expect(dialog.parentElement).toBe(document.body);
    expect(view.container.contains(dialog)).toBe(false);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("met le focus sur le bouton de fermeture à l'ouverture", () => {
    openFirst();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: fr.galerie.close }));
  });

  it("se ferme avec Échap, le fond ou le bouton — pas en cliquant sur la photo", () => {
    const { dialog } = openFirst();
    fireEvent.click(dialog.querySelector("figure")!);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Finale LAN" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Finale LAN" }));
    fireEvent.click(screen.getByRole("button", { name: fr.galerie.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
