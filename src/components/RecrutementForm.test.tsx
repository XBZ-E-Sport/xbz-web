import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import RecrutementForm from "@/components/RecrutementForm";

const rolesByCategory = {
  "XBZ Staff": [{ name: "Manager", free: 2 }],
  "XBZ Esport": [{ name: "Joueur", free: 1 }],
};

const rosters = [
  { name: "Roster SSL", rank: "Supersonic Legend" },
  { name: "Roster GC3", rank: "Grand Champion III" },
];

afterEach(() => cleanup());

describe("RecrutementForm", () => {
  it("désactive le rôle tant qu'aucune catégorie n'est choisie", () => {
    const { container } = render(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    const role = container.querySelector<HTMLSelectElement>("#rec-role")!;
    expect(role.disabled).toBe(true);
  });

  it("active le rôle et liste les postes ouverts après le choix d'une catégorie", () => {
    const { container } = render(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    const categorie = container.querySelector<HTMLSelectElement>("#rec-categorie")!;
    fireEvent.change(categorie, { target: { value: "XBZ Esport" } });

    const role = container.querySelector<HTMLSelectElement>("#rec-role")!;
    expect(role.disabled).toBe(false);
    const values = [...role.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("Joueur");
  });

  it("informe et reste désactivé quand aucun poste n'est ouvert dans la catégorie", () => {
    const empty = { "XBZ Staff": [], "XBZ Esport": [] };
    const { container } = render(<RecrutementForm rolesByCategory={empty} rosters={rosters} />);
    fireEvent.change(container.querySelector<HTMLSelectElement>("#rec-categorie")!, {
      target: { value: "XBZ Staff" },
    });

    expect(screen.getByText(/Aucun poste n/i)).toBeTruthy();
    expect(container.querySelector<HTMLSelectElement>("#rec-role")!.disabled).toBe(true);
  });

  it("propose les rosters dans un sélecteur pour une candidature Esport", () => {
    const { container } = render(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    // Le bloc Esport (dont le roster) n'apparaît qu'en catégorie « XBZ Esport ».
    fireEvent.change(container.querySelector<HTMLSelectElement>("#rec-categorie")!, {
      target: { value: "XBZ Esport" },
    });

    const rosterSelect = container.querySelector<HTMLSelectElement>("#rec-rang")!;
    expect(rosterSelect.tagName).toBe("SELECT");
    expect(rosterSelect.name).toBe("rang"); // même champ → stocké dans candidatures.rang
    const values = [...rosterSelect.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("Roster SSL");
    expect(values).toContain("Roster GC3");
    expect(values).toContain(""); // option « Sans préférence » (facultatif)
  });
});
