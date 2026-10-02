// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";

const { toastError, toastPromise } = vi.hoisted(() => ({ toastError: vi.fn(), toastPromise: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, promise: toastPromise }),
}));

import AdminForm from "@/components/AdminForm";
import { ADMIN_GENERIC_ERROR, type AdminAction } from "@/lib/admin-result";
import { UPLOAD_MAX_BYTES } from "@/lib/limits";

/** Formulaire (dans une carte <details> ouverte) avec un champ texte et un champ fichier. */
function setup(action: AdminAction = vi.fn(async () => undefined), bytes = 0, closeOnSuccess = true) {
  const { container } = render(
    <details open>
      <summary>Modifier</summary>
      <AdminForm action={action} closeOnSuccess={closeOnSuccess}>
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

  it("succès : formulaire remis à zéro et carte refermée", async () => {
    const { nom, form, details } = setup();
    await submit(form);
    expect(await toastErrorText()).toBeNull();
    expect(nom.value).toBe("Maillot");
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
