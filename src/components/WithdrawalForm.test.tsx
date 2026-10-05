import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import WithdrawalForm from "@/components/WithdrawalForm";
import { LEGAL } from "@/lib/legal";
import { renderIntl, messages } from "../../test/intl";

const fr = messages("fr").withdrawal;
const en = messages("en").withdrawal;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fill(container: HTMLElement, values: Partial<Record<"nom" | "email" | "commande" | "details", string>>) {
  for (const [name, value] of Object.entries(values)) {
    const field = container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    fireEvent.change(field, { target: { value } });
  }
}

const submitFirstStep = (container: HTMLElement) => fireEvent.submit(container.querySelector("form")!);

describe("WithdrawalForm — « Renoncer au contrat ici », puis « Confirmer la rétractation »", () => {
  it("première étape : le bouton porte EXACTEMENT le libellé légal, sans case à cocher ni consentement groupé", () => {
    const { container } = renderIntl(<WithdrawalForm />);
    expect(screen.getByRole("button", { name: "Renoncer au contrat ici" })).toBeTruthy();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    // Nom, e-mail obligatoires ; numéro de commande et précisions facultatifs.
    expect(container.querySelector<HTMLInputElement>('[name="nom"]')!.required).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[name="email"]')!.required).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[name="commande"]')!.required).toBe(false);
    expect(container.querySelector<HTMLTextAreaElement>('[name="details"]')!.required).toBe(false);
  });

  it("le premier bouton n'envoie RIEN : il mène à la relecture", () => {
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Jeanne Martin", email: "jeanne@exemple.fr", commande: "xbz-1a2b3c4d", details: "Le maillot M" });
    submitFirstStep(container);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(fr.reviewTitle)).toBeTruthy();
    expect(screen.getByText("Jeanne Martin")).toBeTruthy();
    expect(screen.getByText("jeanne@exemple.fr")).toBeTruthy();
    expect(screen.getByText("xbz-1a2b3c4d")).toBeTruthy();
    expect(screen.getByText("Le maillot M")).toBeTruthy();
    // Second bouton, libellé nu.
    expect(screen.getByRole("button", { name: "Confirmer la rétractation" })).toBeTruthy();
  });

  it("« Modifier » revient au formulaire avec les valeurs saisies", () => {
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Jeanne Martin", email: "jeanne@exemple.fr" });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: fr.edit }));

    expect(container.querySelector<HTMLInputElement>('[name="nom"]')!.value).toBe("Jeanne Martin");
    expect(container.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe("jeanne@exemple.fr");
  });

  it("la confirmation envoie la déclaration (nom, e-mail, commande, précisions, langue, temps de remplissage) et affiche l'accusé", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" }), { status: 200 }),
    );
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "  Jeanne Martin ", email: "jeanne@exemple.fr", commande: "XBZ-1A2B3C4D", details: "" });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la rétractation" }));

    await waitFor(() => expect(screen.getByText(fr.doneTitle, { exact: false })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/boutique/retractation");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      nom: "Jeanne Martin",
      email: "jeanne@exemple.fr",
      commande: "XBZ-1A2B3C4D",
      details: "",
      website: "",
      locale: "fr",
    });
    expect(typeof body.elapsed).toBe("string");

    // Date ET heure (heure de Paris, côté serveur) + adresse e-mail de l'accusé + adresse de retour.
    expect(screen.getByText(/5 octobre 2026.*01:11:23/)).toBeTruthy();
    expect(screen.getByText(/jeanne@exemple\.fr/)).toBeTruthy();
    expect(screen.getByText(new RegExp(LEGAL.returnAddress.slice(0, 20)))).toBeTruthy();
  });

  it("erreur du serveur : message TRADUIT, on reste sur la relecture et on peut réessayer", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, code: "rateLimited", error: "Trop de tentatives." }), { status: 429 }),
    );
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Jeanne Martin", email: "jeanne@exemple.fr" });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la rétractation" }));

    await waitFor(() => expect(screen.getByText(new RegExp(messages("fr").formErrors.rateLimited.slice(0, 20)))).toBeTruthy());
    expect(screen.queryByText(fr.doneTitle, { exact: false })).toBeNull();
    expect(screen.getByRole("button", { name: "Confirmer la rétractation" })).toBeTruthy();
  });

  it("réseau coupé : message générique TRADUIT, jamais le texte brut du navigateur (« Failed to fetch »)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Jeanne Martin", email: "jeanne@exemple.fr" });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la rétractation" }));
    await waitFor(() => expect(screen.getByText(new RegExp(messages("fr").formErrors.generic.slice(0, 15)))).toBeTruthy());
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });

  it("révision : champs facultatifs vides → libellés accordés (« Non précisée », « Aucune précision »)", () => {
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Jeanne Martin", email: "jeanne@exemple.fr" });
    submitFirstStep(container);
    expect(screen.getByText("Non précisée")).toBeTruthy();
    expect(screen.getByText("Aucune précision")).toBeTruthy();
  });

  it("le piège anti-bot rempli voyage avec la déclaration (le serveur l'ignorera)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" })));
    const { container } = renderIntl(<WithdrawalForm />);
    fill(container, { nom: "Bot", email: "bot@spam.test" });
    fireEvent.change(container.querySelector<HTMLInputElement>('[name="website"]')!, { target: { value: "http://spam.test" } });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la rétractation" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).website).toBe("http://spam.test");
  });

  it("en anglais : « Withdraw from contract here » puis « Confirm withdrawal », langue envoyée au serveur", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, receivedAt: "2026-10-04T23:11:23.000Z" })));
    const { container } = renderIntl(<WithdrawalForm />, { locale: "en" });
    expect(screen.getByRole("button", { name: "Withdraw from contract here" })).toBeTruthy();
    fill(container, { nom: "Jane Martin", email: "jane@example.com" });
    submitFirstStep(container);
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    await waitFor(() => expect(screen.getByText(en.doneTitle, { exact: false })).toBeTruthy());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).locale).toBe("en");
    expect(screen.getByText(/5 October 2026.*01:11:23/)).toBeTruthy();
  });
});
