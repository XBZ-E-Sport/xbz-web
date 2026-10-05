import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";

const refresh = vi.fn();
const replace = vi.fn();
const router = { refresh, replace };
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => router }));

import CartView, { type CartProduct } from "@/components/CartView";
import type { CartLine } from "@/lib/cart";
import { CART_STORAGE_KEY, clearCart } from "@/lib/cart-store";
import { renderIntl, messages } from "../../test/intl";

const fr = messages("fr");
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const products: CartProduct[] = [
  { slug: "maillot", name: "Maillot officiel XBZ", price: 49.99, image: null, icon: "👕", available: true, personalizable: true, personalizationPrice: 5, variants: [{ id: id(1), size: "M", stock: 2 }, { id: id(2), size: "L", stock: 0 }] },
  { slug: "mug", name: "Mug XBZ", price: 14.99, image: null, icon: "☕", available: true, personalizable: false, personalizationPrice: 0, variants: [{ id: id(3), size: "", stock: 5 }] },
];
const setCart = (lines: CartLine[]) => localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
const render = (open = true) => renderIntl(<CartView products={products} shipping={4.9} open={open} />);
const fetchMock = vi.fn();

beforeEach(() => {
  clearCart();
  localStorage.clear();
  fetchMock.mockReset();
  refresh.mockReset();
  replace.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/fr/boutique/panier");
  document.cookie = "xbz_checkout_open=; max-age=0; path=/";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CartView", () => {
  it("panier vide : invitation à visiter la boutique", () => {
    render();
    expect(screen.getByText(fr.cart.empty)).toBeTruthy();
  });

  it("affiche les lignes, le port et le total TTC", () => {
    setCart([{ variantId: id(1), quantity: 2 }, { variantId: id(3), quantity: 1 }]);
    render();
    expect(screen.getByText("Maillot officiel XBZ")).toBeTruthy();
    expect(screen.getByText(/Taille M/)).toBeTruthy();
    // 2 × 49,99 + 14,99 = 114,97 ; + 4,90 de port = 119,87
    expect(screen.getByText("114,97 €")).toBeTruthy();
    expect(screen.getByRole("button", { name: /obligation de paiement · 119,87/ })).toBeTruthy();
  });

  it("taille épuisée ou supprimée : signalée, exclue du total et du paiement", () => {
    setCart([{ variantId: id(2), quantity: 1 }, { variantId: id(9), quantity: 1 }, { variantId: id(3), quantity: 1 }]);
    render();
    expect(screen.getAllByText(fr.cart.unavailable)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /obligation de paiement · 19,89/ })).toBeTruthy();
  });

  it("quantité au-delà du stock : ramenée au disponible", async () => {
    setCart([{ variantId: id(1), quantity: 5 }]);
    render();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: id(1), quantity: 2 }]));
  });

  it("CGV obligatoires avant de payer", async () => {
    setCart([{ variantId: id(3), quantity: 1 }]);
    render();
    fireEvent.click(screen.getByRole("button", { name: /obligation de paiement/ }));
    expect(await screen.findByText(fr.cart.errTerms)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paiement : envoie tailles et quantités (jamais de prix) puis part chez Stripe", async () => {
    setCart([{ variantId: id(3), quantity: 2 }]);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, search: "", pathname: "/fr/boutique/panier" });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_1" }) });
    render();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /obligation de paiement/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/boutique/checkout");
    expect(JSON.parse(init.body)).toEqual({ lines: [{ variantId: id(3), quantity: 2 }], locale: "fr", terms: true });
  });

  it("stock épuisé au moment de payer : la ligne est signalée, le catalogue relu", async () => {
    setCart([{ variantId: id(1), quantity: 1 }, { variantId: id(3), quantity: 1 }]);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: "stock", unavailable: [id(1)] }) });
    render();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /obligation de paiement/ }));
    expect(await screen.findByText(fr.cart.errStock)).toBeTruthy();
    expect(screen.getAllByText(fr.cart.unavailable)).toHaveLength(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("boutique fermée : pas de bouton de paiement", () => {
    setCart([{ variantId: id(3), quantity: 1 }]);
    render(false);
    expect(screen.queryByRole("button", { name: /obligation de paiement/ })).toBeNull();
    expect(screen.getByText(fr.cart.errClosed)).toBeTruthy();
  });

  it("retour « Annuler » de Stripe : stock rendu PUIS catalogue relu, message, adresse nettoyée par le routeur", async () => {
    setCart([{ variantId: id(3), quantity: 1 }]);
    let release!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (release = r)));
    window.history.replaceState(null, "", "/fr/boutique/panier?annule=1");
    await act(async () => {
      render();
    });
    // Tant que la réservation n'est pas rendue, le panier attend (pas de « plus disponible » fantôme).
    expect(screen.getByText(fr.cart.loading)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /obligation de paiement/ })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/boutique/cancel", { method: "POST" });
    await act(async () => release({ ok: true, json: async () => ({ ok: true, released: true }) }));
    expect(screen.getByText(fr.cart.cancelled)).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/fr/boutique/panier", { scroll: false });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /obligation de paiement/ })).toBeTruthy();
  });

  it("retour arrière depuis Stripe (cookie) : réservation rendue sans bandeau, quantités jamais rognées entre-temps", async () => {
    // Stock affiché = 1 car 2 pièces sont réservées par CE navigateur.
    const reserved: CartProduct[] = [{ ...products[0], variants: [{ id: id(1), size: "M", stock: 1 }] }];
    setCart([{ variantId: id(1), quantity: 2 }]);
    document.cookie = "xbz_checkout_open=1; path=/";
    let release!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (release = r)));
    let view!: ReturnType<typeof renderIntl>;
    await act(async () => {
      view = renderIntl(<CartView products={reserved} shipping={4.9} open />);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/boutique/cancel", { method: "POST" });
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: id(1), quantity: 2 }]);
    // Catalogue relu (stock rendu : 2 pièces) avant la fin de l'attente.
    view.rerender(<CartView products={products} shipping={4.9} open />);
    await act(async () => release({ ok: true, json: async () => ({ ok: true, released: true }) }));
    expect(refresh).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: id(1), quantity: 2 }]);
    expect(screen.queryByText(fr.cart.cancelled)).toBeNull();
    expect(screen.getByRole("button", { name: /obligation de paiement · 104,88/ })).toBeTruthy();
  });

  it("route d'annulation injoignable : le panier s'affiche quand même", async () => {
    setCart([{ variantId: id(3), quantity: 1 }]);
    document.cookie = "xbz_checkout_open=1; path=/";
    fetchMock.mockRejectedValue(new Error("hors ligne"));
    await act(async () => {
      render();
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /obligation de paiement/ })).toBeTruthy());
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("CartView : articles personnalisés", () => {
  const martin = { name: "MARTIN", number: "10" };
  // Maillot M : stock 2, supplément 5 €.

  it("affiche le texte imprimé, le prix unitaire AVEC supplément et l'avertissement de rétractation", () => {
    setCart([{ variantId: id(1), quantity: 1, print: martin }]);
    render();
    expect(screen.getByText(/MARTIN · n° 10/)).toBeTruthy();
    // 49,99 + 5 = 54,99 ; + 4,90 de port = 59,89
    expect(screen.getAllByText("54,99 €").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /obligation de paiement · 59,89/ })).toBeTruthy();
    expect(screen.getByText(fr.cart.personalizedNotice)).toBeTruthy();
  });

  it("sans article personnalisé : pas d'avertissement", () => {
    setCart([{ variantId: id(1), quantity: 1 }]);
    render();
    expect(screen.queryByText(fr.cart.personalizedNotice)).toBeNull();
  });

  it("même taille, texte différent : deux lignes distinctes, chacune avec son prix", () => {
    setCart([{ variantId: id(1), quantity: 1 }, { variantId: id(1), quantity: 1, print: martin }]);
    render();
    expect(screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("Maillot officiel XBZ"))).toHaveLength(2);
    // 49,99 + 54,99 = 104,98 ; + 4,90 de port = 109,88
    expect(screen.getByRole("button", { name: /obligation de paiement · 109,88/ })).toBeTruthy();
  });

  it("le stock de la taille est PARTAGÉ entre les lignes : « + » bloqué quand la taille est au maximum", () => {
    setCart([{ variantId: id(1), quantity: 1 }, { variantId: id(1), quantity: 1, print: martin }]);
    render();
    for (const plus of screen.getAllByRole("button", { name: /Ajouter une pièce/ })) {
      expect((plus as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("stock réduit depuis l'ajout : les DERNIÈRES lignes de la taille sont ramenées au disponible", async () => {
    setCart([{ variantId: id(1), quantity: 2 }, { variantId: id(1), quantity: 2, print: martin }]);
    render();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: id(1), quantity: 2 }]));
  });

  it("modifier une ligne personnalisée ne touche pas la ligne ordinaire de la même taille", () => {
    setCart([{ variantId: id(3), quantity: 1 }, { variantId: id(1), quantity: 1, print: martin }]);
    render();
    // Deux lignes : le mug, puis le maillot personnalisé. On retire le maillot.
    const [, retirerMaillot] = screen.getAllByRole("button", { name: /du panier/ });
    fireEvent.click(retirerMaillot);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: id(3), quantity: 1 }]);
  });

  it("le paiement envoie le texte à imprimer, jamais un prix ni un supplément", async () => {
    setCart([{ variantId: id(1), quantity: 1, print: martin }]);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, search: "", pathname: "/fr/boutique/panier" });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_1" }) });
    render();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /obligation de paiement/ }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      lines: [{ variantId: id(1), quantity: 1, print: martin }],
      locale: "fr",
      terms: true,
    });
  });

  it("personnalisation retirée de la boutique depuis l'ajout : ligne signalée, exclue du total et du paiement", () => {
    const off = products.map((p) => (p.slug === "maillot" ? { ...p, personalizable: false } : p));
    setCart([{ variantId: id(1), quantity: 1, print: martin }, { variantId: id(3), quantity: 1 }]);
    renderIntl(<CartView products={off} shipping={4.9} open />);
    expect(screen.getByText(fr.cart.personalizationOff)).toBeTruthy();
    expect(screen.getByRole("button", { name: /obligation de paiement · 19,89/ })).toBeTruthy();
    expect(screen.queryByText(fr.cart.personalizedNotice)).toBeNull();
  });

  it("refus de la base (personnalisation) : message dédié", async () => {
    setCart([{ variantId: id(1), quantity: 1, print: martin }]);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: "personalization" }) });
    render();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /obligation de paiement/ }));
    expect(await screen.findByText(fr.cart.errPersonalization)).toBeTruthy();
  });
});

