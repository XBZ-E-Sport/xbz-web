import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import BuyBox from "@/components/BuyBox";
import ClientMessages from "@/components/ClientMessages";
import ProductGallery from "@/components/ProductGallery";
import { Link } from "@/i18n/navigation";
import { getProductBySlug, getProductSlugs, getProducts, isPurchasable, type Product } from "@/lib/boutique";
import { productCategoryStyles } from "@/lib/format";
import { jsonLdString } from "@/lib/jsonld";
import { LEGAL } from "@/lib/legal";
import { formatEuros } from "@/lib/money";
import { bannerVersion, productBanner } from "@/lib/og-banners";
import { isPersonalizable } from "@/lib/personalization";
import { productJsonLd } from "@/lib/product-seo";
import { breadcrumbJsonLd, pageDescription } from "@/lib/seo";
import { SHIPPING_COUNTRIES, shippingEuros } from "@/lib/shop";
import { absoluteUrl, localizedPath, pageMetadata } from "@/lib/site";
import { isShopOpen } from "@/lib/stripe";

// Page d'un produit : photos, tailles et ajout au panier, description, guide
// des tailles, livraison et retours — et ce que Google lit (prix, stock).
//
// Rendu statique régénéré (ISR), comme la liste : le back-office et chaque
// mouvement de stock invalident ces pages (revalidateLocalizedPath
// « /boutique/[slug] »). `force-static` : voir actualite/[slug].
export const dynamic = "force-static";
export const revalidate = 3600;

/** Prégénère les produits connus au build ; la langue vient du layout. */
export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/** Description de la page : celle du produit si elle est assez riche, sinon une phrase-type. */
async function describe(product: Product, locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: "product" });
  return pageDescription(
    [product.description],
    t("metaFallback", { name: product.name, price: formatEuros(product.price, locale) }),
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "product" });
  const product = await getProductBySlug(slug, locale);
  if (!product) return { title: t("metaNotFound") };
  return pageMetadata({
    title: t("metaTitle", { name: product.name }),
    description: await describe(product, locale),
    path: `/boutique/${product.slug}`,
    locale,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = await getProductBySlug(slug, locale);
  if (!product) notFound();

  const t = await getTranslations({ locale, namespace: "product" });
  const tCat = await getTranslations({ locale, namespace: "productCategories" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const open = isShopOpen();
  const purchasable = open && isPurchasable(product);
  const path = `/boutique/${product.slug}`;
  const shipping = shippingEuros();

  // Même adresse que l'og:image de la page (identifiant versionné compris).
  const banner = await productBanner(locale, product.slug);
  const bannerUrl = absoluteUrl(localizedPath(`${path}/opengraph-image/${bannerVersion(banner)}`, locale));
  const jsonLd = productJsonLd({
    product,
    locale,
    path,
    category: tCat(product.category),
    description: await describe(product, locale),
    purchasable,
    shipping,
    countries: SHIPPING_COUNTRIES,
    fallbackImage: bannerUrl,
  });
  const breadcrumb = breadcrumbJsonLd(
    [
      { name: tNav("home"), path: "/" },
      { name: tNav("boutique"), path: "/boutique" },
      { name: product.name, path },
    ],
    locale,
  );

  // Trois autres produits, de la même catégorie d'abord : la visite continue.
  const others = (await getProducts(locale)).filter((p) => p.slug !== product.slug);
  const related = [
    ...others.filter((p) => p.category === product.category),
    ...others.filter((p) => p.category !== product.category),
  ].slice(0, 3);

  const paragraphs = product.description.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }} />

      <Link
        href="/boutique"
        locale={locale}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span> {t("backToShop")}
      </Link>

      <ClientMessages locale={locale} clients={["ProductGallery", "BuyBox"]}>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <ProductGallery images={product.images} name={product.name} icon={product.icon} />

          <div className="flex flex-col gap-6">
            <div>
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${productCategoryStyles[product.category]}`}
              >
                {tCat(product.category)}
              </span>
              <h1 className="mt-4 font-display text-3xl font-black leading-tight text-white sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-display text-2xl font-bold text-white">{formatEuros(product.price, locale)}</span>
                {purchasable && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
                    {t("inStock")}
                  </span>
                )}
              </p>
            </div>

            <BuyBox product={product} open={open} />

            {paragraphs.length > 0 && (
              <section aria-labelledby="product-description">
                <h2 id="product-description" className="font-display text-lg text-white">
                  {t("description")}
                </h2>
                <div className="mt-2 space-y-3 leading-relaxed text-neutral-300">
                  {paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {product.sizeGuide && (
              <details className="card-xbz group p-4">
                <summary className="cursor-pointer font-display text-white marker:text-xbz-cyan">
                  {t("sizeGuide")}
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-300">{product.sizeGuide}</p>
              </details>
            )}

            <section aria-labelledby="product-delivery" className="card-xbz p-4 text-sm leading-relaxed text-neutral-300">
              <h2 id="product-delivery" className="font-display text-base text-white">
                {t("delivery")}
              </h2>
              <p className="mt-2">{t("deliveryText", { price: formatEuros(shipping, locale), days: LEGAL.deliveryDays })}</p>
              <p className="mt-2">
                {t.rich("returnsText", {
                  withdraw: (chunks) => (
                    <Link
                      href="/boutique/retractation"
                      locale={locale}
                      className="font-semibold text-xbz-cyan underline underline-offset-2"
                    >
                      {chunks}
                    </Link>
                  ),
                  cgv: (chunks) => (
                    <Link href="/cgv" locale={locale} className="font-semibold text-xbz-cyan underline underline-offset-2">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
              {isPersonalizable(product.slug) && <p className="mt-2">{t("returnsPersonalized")}</p>}
              {open && <p className="mt-2 text-neutral-400">{t("securePayment")}</p>}
            </section>
          </div>
        </div>
      </ClientMessages>

      {related.length > 0 && (
        <section aria-labelledby="product-related" className="mt-20">
          <h2 id="product-related" className="font-display text-2xl text-white">
            {t("related")}
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {related.map((p) => (
              <li key={p.slug} className="card-xbz overflow-hidden">
                <Link href={`/boutique/${p.slug}`} locale={locale} className="group flex h-full flex-col">
                  <span className="relative flex h-36 items-center justify-center overflow-hidden bg-linear-to-br from-xbz-blue/20 to-xbz-cyan/10">
                    {p.image ? (
                      <Image src={p.image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                    ) : (
                      <span aria-hidden="true" className="text-5xl">
                        {p.icon || "🛒"}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 items-baseline justify-between gap-3 p-4">
                    <span className="font-display text-xbz-red-light group-hover:underline underline-offset-4">{p.name}</span>
                    <span className="shrink-0 font-bold text-white">{formatEuros(p.price, locale)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
