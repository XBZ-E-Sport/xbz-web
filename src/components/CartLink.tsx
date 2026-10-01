"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cartCount } from "@/lib/cart";
import { useCart } from "@/lib/cart-store";

/**
 * Accès au panier dans l'en-tête, avec le nombre d'articles. N'apparaît que
 * si le panier contient quelque chose : pas d'icône inutile pour qui ne fait
 * que visiter. Rendu vide côté serveur (le panier vit dans le navigateur).
 */
export default function CartLink() {
  const t = useTranslations("nav");
  const count = cartCount(useCart());
  if (count === 0) return null;

  return (
    <Link
      href="/boutique/panier"
      aria-label={t("cartAria", { count })}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-[2px] text-white transition hover:bg-white/10"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 7h12l-1.2 11.1a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-xbz-cyan px-1 text-center text-[11px] font-black leading-5 text-[#231a17]"
      >
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}
