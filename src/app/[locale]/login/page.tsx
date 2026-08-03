import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { loginWithPassword, loginWithDiscord } from "./actions";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

// Page de connexion staff : pas d'indexation (contenu privé, pas de canonical vers l'accueil).
export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-400 outline-none";

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("login");
  const { error } = await searchParams;

  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="card-xbz p-8">
        <h1 className="mb-6 text-center font-display text-3xl font-bold">{t("title")}</h1>

        {/* Le message vient du serveur d'auth (Supabase / garde Discord) : il est
            déjà rédigé en français et n'est pas re-traduit ici. */}
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <form action={loginWithPassword} className="flex flex-col gap-3">
          <label htmlFor="login-email" className="sr-only">
            {t("email")}
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            required
            autoComplete="email"
            className={inputCls}
          />
          <label htmlFor="login-password" className="sr-only">
            {t("password")}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder={t("password")}
            required
            autoComplete="current-password"
            className={inputCls}
          />
          <button type="submit" className="btn-xbz w-full text-center hover:cursor-pointer">
            {t("submit")}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-white/10" /> {t("or")}{" "}
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form action={loginWithDiscord}>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#5865F2] px-4 py-3 font-bold text-white transition hover:brightness-110 hover:cursor-pointer"
          >
            {t("discordSubmit")}
          </button>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-neutral-400">
            {t.rich("discordNotice", {
              role: (chunks) => <strong className="text-neutral-300">{chunks}</strong>,
            })}
          </p>
        </form>
      </div>
    </section>
  );
}
