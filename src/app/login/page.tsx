import { loginWithPassword, loginWithDiscord } from "./actions";

export const metadata = { title: "Connexion staff — XBZ" };

const inputCls =
  "w-full rounded-lg border-0 bg-[#111] px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="card-xbz p-8">
        <h1 className="mb-6 text-center font-display text-3xl font-bold">Espace staff</h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <form action={loginWithPassword} className="flex flex-col gap-3">
          <input name="email" type="email" placeholder="Email" required className={inputCls} />
          <input name="password" type="password" placeholder="Mot de passe" required className={inputCls} />
          <button type="submit" className="btn-xbz w-full text-center hover:cursor-pointer">Se connecter</button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-neutral-500">
          <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
        </div>

        <form action={loginWithDiscord}>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#5865F2] px-4 py-3 font-bold text-white transition hover:brightness-110 hover:cursor-pointer"
          >
            Se connecter avec Discord
          </button>
        </form>
      </div>
    </section>
  );
}