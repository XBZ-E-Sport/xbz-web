import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import RecrutementForm from "@/components/RecrutementForm";
import { renderIntl, messages } from "../../test/intl";

const rolesByCategory = {
  "XBZ Staff": [{ name: "Manager", free: 2 }],
  "XBZ Esport": [{ name: "Joueur", free: 1 }],
};

const rosters = [
  { name: "Roster SSL", rank: "Supersonic Legend" },
  { name: "Roster GC3", rank: "Grand Champion III" },
];

const fr = messages("fr");
const en = messages("en");

afterEach(() => cleanup());

describe("RecrutementForm", () => {
  it("désactive le rôle tant qu'aucune catégorie n'est choisie", () => {
    const { container } = renderIntl(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    const role = container.querySelector<HTMLSelectElement>("#rec-role")!;
    expect(role.disabled).toBe(true);
  });

  it("active le rôle et liste les postes ouverts après le choix d'une catégorie", () => {
    const { container } = renderIntl(
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
    const { container } = renderIntl(<RecrutementForm rolesByCategory={empty} rosters={rosters} />);
    fireEvent.change(container.querySelector<HTMLSelectElement>("#rec-categorie")!, {
      target: { value: "XBZ Staff" },
    });

    expect(screen.getByText(fr.recrutementForm.roleNoneOpenHelp)).toBeTruthy();
    expect(container.querySelector<HTMLSelectElement>("#rec-role")!.disabled).toBe(true);
  });

  it("impose 18 ans minimum pour le staff, 16 sinon", () => {
    const { container } = renderIntl(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    const age = container.querySelector<HTMLInputElement>("#rec-age")!;
    const categorie = container.querySelector<HTMLSelectElement>("#rec-categorie")!;

    expect(age.min).toBe("16"); // défaut (aucune catégorie choisie)

    fireEvent.change(categorie, { target: { value: "XBZ Staff" } });
    expect(age.min).toBe("18");

    fireEvent.change(categorie, { target: { value: "XBZ Esport" } });
    expect(age.min).toBe("16");
  });

  it("propose les rosters dans un sélecteur pour une candidature Esport", () => {
    const { container } = renderIntl(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
    );
    // Le bloc Esport (dont le roster) n'apparaît qu'en catégorie « XBZ Esport ».
    fireEvent.change(container.querySelector<HTMLSelectElement>("#rec-categorie")!, {
      target: { value: "XBZ Esport" },
    });

    const rosterSelect = container.querySelector<HTMLSelectElement>("#rec-roster")!;
    expect(rosterSelect.tagName).toBe("SELECT");
    expect(rosterSelect.name).toBe("roster"); // même champ → stocké dans candidatures.roster
    const values = [...rosterSelect.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("Roster SSL");
    expect(values).toContain("Roster GC3");
    expect(values).toContain(""); // option « Sans préférence » (facultatif)
  });

  it("s'affiche en anglais quand la langue est en", () => {
    const { container } = renderIntl(
      <RecrutementForm rolesByCategory={rolesByCategory} rosters={rosters} />,
      { locale: "en" },
    );
    expect(screen.getByLabelText(en.recrutementForm.category)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: en.recrutementForm.submit }),
    ).toBeTruthy();
    // Le placeholder d'âge interpole le minimum : il doit rester correct traduit.
    const age = container.querySelector<HTMLInputElement>("#rec-age")!;
    expect(age.placeholder).toBe("16 and over");
  });
});
