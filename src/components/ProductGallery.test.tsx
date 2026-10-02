import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";

import ProductGallery from "@/components/ProductGallery";
import { renderIntl } from "../../test/intl";

afterEach(() => cleanup());

const photos = ["https://x.supabase.co/a.webp", "https://x.supabase.co/b.webp", "https://x.supabase.co/c.webp"];

describe("ProductGallery", () => {
  it("affiche la 1re photo, avec un texte alternatif qui situe la photo", () => {
    renderIntl(<ProductGallery images={photos} name="Maillot" icon="👕" />);
    expect(screen.getByAltText("Maillot — photo 1 sur 3")).toBeTruthy();
  });

  it("une vignette change la grande photo et se signale comme active", () => {
    renderIntl(<ProductGallery images={photos} name="Maillot" icon="👕" />);
    const third = screen.getByRole("button", { name: "Afficher la photo 3 sur 3" });
    fireEvent.click(third);
    expect(screen.getByAltText("Maillot — photo 3 sur 3")).toBeTruthy();
    expect(third.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Afficher la photo 1 sur 3" }).getAttribute("aria-current")).toBeNull();
  });

  it("une seule photo : pas de vignettes", () => {
    renderIntl(<ProductGallery images={photos.slice(0, 1)} name="Mug" icon="☕" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("photo qui ne charge pas : retirée ; plus aucune → emoji de repli", () => {
    renderIntl(<ProductGallery images={photos.slice(0, 1)} name="Mug" icon="☕" />);
    fireEvent.error(screen.getByAltText("Mug — photo 1 sur 1"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("☕")).toBeTruthy();
  });

  it("en anglais", () => {
    renderIntl(<ProductGallery images={photos} name="Jersey" icon="👕" />, { locale: "en" });
    expect(screen.getByAltText("Jersey — photo 1 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show photo 2 of 3" })).toBeTruthy();
  });
});
