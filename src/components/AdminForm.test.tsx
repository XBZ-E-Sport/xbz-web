// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, act, fireEvent, cleanup } from "@testing-library/react";

const { toastError, toastPromise } = vi.hoisted(() => ({ toastError: vi.fn(), toastPromise: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, promise: toastPromise }),
}));

import AdminForm from "@/components/AdminForm";
import { ADMIN_GENERIC_ERROR, type AdminAction } from "@/lib/admin-result";
import { UPLOAD_MAX_BYTES } from "@/lib/limits";

/** Formulaire (dans une carte <details> ouverte) avec un champ texte et un champ fichier. */
function setup(action: AdminAction = vi.fn(async () => undefined), bytes = 0, closeOnSuccess = true, edit = false) {
  const { container } = render(
    <details open>
      <summary>Modifier</summary>
      <AdminForm action={action} closeOnSuccess={closeOnSuccess}>
        {edit && <input type="hidden" name="id" value="abc" />}
        <input name="nom" defaultValue="Maillot" />
        <input name="photo_file" type="file" />
        <button name="statut" value="accepte">Accepter</button>
        <button name="statut" value="refuse">Refuser</button>
      </AdminForm>
    </details>,
  );
  const nom = container.querySelector<HTMLInputElement>('input[name="nom"]')!;
  fireEvent.change(nom, { target: { value: "Maillot RENOMMÉ" } });
  if (bytes) {
    const file = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const photo = new File([new Uint8Array(bytes)], "IMG_2034.JPG", { type: "image/jpeg" });
    Object.defineProperty(file, "files", { value: [photo] });
  }
  return {
    action,
    nom,
    /** Le champ « nom » ACTUEL (un formulaire d'ajout remonte ses champs après un succès). */
    currentNom: () => container.querySelector<HTMLInputElement>('input[name="nom"]')!,
    form: container.querySelector("form")!,
    details: container.querySelector("details")!,
    button: (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!,
  };
}

async function submit(form: HTMLFormElement, submitter?: HTMLElement) {
  await act(async () => {
    form.requestSubmit(submitter);
    await new Promise((r) => setTimeout(r, 20));
  });
}

/** Message que le toast d'erreur afficherait pour le dernier envoi. */
async function toastErrorText(): Promise<string | null> {
  const [promise, options] = toastPromise.mock.calls.at(-1)!;
  try {
    await promise;
    return null;
  } catch (e) {
    return options.error(e);
  }
}

afterEach(() => cleanup());

beforeEach(() => {
  toastError.mockClear();
  toastPromise.mockClear();
});

describe("AdminForm — image trop lourde", () => {
  it("bloque l'envoi, l'annonce, et garde ce qui a été saisi", async () => {
    const { action, nom, form } = setup(undefined, UPLOAD_MAX_BYTES + 1);
    await submit(form);
    expect(action).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("IMG_2034.JPG"));
    expect(nom.value).toBe("Maillot RENOMMÉ");
  });

  it("laisse partir une image sous la limite", async () => {
    const { action, form } = setup(undefined, 1024);
    await submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("AdminForm — résultat de l'action", () => {
  it("erreur renvoyée par l'action : SON message, saisie et carte conservées", async () => {
    const { nom, form, details } = setup(vi.fn(async () => ({ error: "Taille « M » en double." })));
    await submit(form);
    expect(await toastErrorText()).toBe("Taille « M » en double.");
    expect(nom.value).toBe("Maillot RENOMMÉ");
    expect(details.open).toBe(true);
  });

  it("erreur imprévue (réseau, panne) : message générique, saisie conservée", async () => {
    const { nom, form } = setup(vi.fn(async () => Promise.reject(new Error("Failed to fetch"))));
    await submit(form);
    expect(await toastErrorText()).toBe(ADMIN_GENERIC_ERROR);
    expect(nom.value).toBe("Maillot RENOMMÉ");
  });

  it("succès d'un AJOUT (pas de champ id) : formulaire remis à zéro et carte refermée", async () => {
    const { currentNom, form, details } = setup();
    await submit(form);
    expect(await toastErrorText()).toBeNull();
    expect(currentNom().value).toBe("Maillot");
    expect(details.open).toBe(false);
  });

  it("succès d'une MODIFICATION (champ id) : garde ce qui vient d'être enregistré", async () => {
    // Revenir aux valeurs d'avant l'enregistrement ramenait un menu déroulant
    // à son ancienne valeur — réécrite en base à l'enregistrement suivant.
    const { currentNom, form, details } = setup(undefined, 0, true, true);
    await submit(form);
    expect(await toastErrorText()).toBeNull();
    expect(currentNom().value).toBe("Maillot RENOMMÉ");
    expect(details.open).toBe(false);
  });

  it("succès d'une suppression (closeOnSuccess=false) : la carte reste ouverte", async () => {
    const { form, details } = setup(undefined, 0, false);
    await submit(form);
    expect(details.open).toBe(true);
  });

  it("envoie les champs ET la valeur du bouton cliqué (statut d'une candidature)", async () => {
    const action = vi.fn<AdminAction>(async () => undefined);
    const { form, button } = setup(action);
    await submit(form, button("Refuser"));
    const fd = action.mock.calls[0][0];
    expect(fd.get("nom")).toBe("Maillot RENOMMÉ");
    expect(fd.get("statut")).toBe("refuse");
  });

  it("double clic : un seul envoi tant que le premier n'est pas fini", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<undefined>((r) => (finish = () => r(undefined))));
    const { form } = setup(action);
    await submit(form);
    await submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await submit(form);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe("AdminForm — menus déroulants et éditeurs à état", () => {
  /** Menu non contrôlé dont la valeur par défaut vient du serveur (comme `defaultValue={product.category}`). */
  function Edit({ saved, action }: { saved: string; action: AdminAction }) {
    return (
      <AdminForm action={action}>
        <input type="hidden" name="id" value="abc" />
        <select name="category" defaultValue={saved}>
          <option value="Textile">Textile</option>
          <option value="Accessoire">Accessoire</option>
        </select>
      </AdminForm>
    );
  }

  it("modification : le menu garde la valeur enregistrée, même quand les données serveur arrivent ensuite", async () => {
    const action = vi.fn<AdminAction>(async () => undefined);
    const { container, rerender } = render(<Edit saved="Textile" action={action} />);
    const select = () => container.querySelector<HTMLSelectElement>("select")!;
    fireEvent.change(select(), { target: { value: "Accessoire" } });
    await submit(container.querySelector("form")!);
    expect(action.mock.calls[0][0].get("category")).toBe("Accessoire");

    // La page revalidée repasse la nouvelle valeur par défaut…
    rerender(<Edit saved="Accessoire" action={action} />);
    expect(select().value).toBe("Accessoire");

    // …et l'enregistrement suivant, sans recharger, n'écrit PAS l'ancienne.
    await submit(container.querySelector("form")!);
    expect(action.mock.calls[1][0].get("category")).toBe("Accessoire");
  });

  it("ajout : un éditeur à état (tailles…) repart à neuf après un succès", async () => {
    function Counter() {
      const [n, setN] = useState(0);
      return (
        <>
          <input type="hidden" name="n" value={n} />
          <button type="button" onClick={() => setN((x) => x + 1)}>
            +1
          </button>
          <output>{n}</output>
        </>
      );
    }
    const action = vi.fn<AdminAction>(async () => undefined);
    const { container, getByText } = render(
      <AdminForm action={action}>
        <Counter />
      </AdminForm>,
    );
    fireEvent.click(getByText("+1"));
    fireEvent.click(getByText("+1"));
    expect(container.querySelector("output")!.textContent).toBe("2");
    await submit(container.querySelector("form")!);
    expect(action.mock.calls[0][0].get("n")).toBe("2");
    expect(container.querySelector("output")!.textContent).toBe("0");
  });

  it("ajout en échec : l'éditeur à état garde sa saisie", async () => {
    function Counter() {
      const [n, setN] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setN((x) => x + 1)}>
            +1
          </button>
          <output>{n}</output>
        </>
      );
    }
    const { container, getByText } = render(
      <AdminForm action={vi.fn(async () => ({ error: "Refusé." }))}>
        <Counter />
      </AdminForm>,
    );
    fireEvent.click(getByText("+1"));
    await submit(container.querySelector("form")!);
    expect(container.querySelector("output")!.textContent).toBe("1");
  });

  it("modification : les fichiers choisis sont vidés après l'envoi (pas de renvoi au prochain enregistrement)", async () => {
    const { container } = render(
      <AdminForm action={vi.fn(async () => undefined)}>
        <input type="hidden" name="id" value="abc" />
        <input name="photo_file" type="file" />
      </AdminForm>,
    );
    const file = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const spy = vi.spyOn(file, "value", "set");
    await submit(container.querySelector("form")!);
    expect(spy).toHaveBeenCalledWith("");
  });
});
