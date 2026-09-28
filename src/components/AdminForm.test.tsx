// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, promise: vi.fn() }),
}));

import AdminForm from "@/components/AdminForm";
import { UPLOAD_MAX_BYTES } from "@/lib/limits";

/** Formulaire avec un champ texte et un champ fichier portant `bytes` octets. */
function setup(bytes: number) {
  const action = vi.fn();
  const { container } = render(
    <AdminForm action={action}>
      <input name="nom" defaultValue="" />
      <input name="photo_file" type="file" />
    </AdminForm>,
  );
  const nom = container.querySelector<HTMLInputElement>('input[name="nom"]')!;
  const file = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(nom, { target: { value: "Jean" } });
  const photo = new File([new Uint8Array(bytes)], "IMG_2034.JPG", { type: "image/jpeg" });
  Object.defineProperty(file, "files", { value: [photo] });
  return { action, nom, form: container.querySelector("form")! };
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.requestSubmit();
    await new Promise((r) => setTimeout(r, 20));
  });
}

beforeEach(() => toastError.mockClear());

describe("AdminForm — image trop lourde", () => {
  it("bloque l'envoi, l'annonce, et garde ce qui a été saisi", async () => {
    const { action, nom, form } = setup(UPLOAD_MAX_BYTES + 1);
    await submit(form);
    expect(action).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("IMG_2034.JPG"));
    expect(nom.value).toBe("Jean"); // React n'a pas réinitialisé le formulaire
  });

  it("laisse partir une image sous la limite", async () => {
    const { action, form } = setup(1024);
    await submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});
