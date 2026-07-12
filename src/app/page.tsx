import Image from "next/image";

const DISCORD_URL = "https://discord.gg/w7s3rBPsZ6";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Image
          src="/logo-xbz.png"
          alt="Logo XBZ Esport"
          width={220}
          height={220}
          priority
          className="mb-6 drop-shadow-[0_0_8px_rgba(0,102,255,0.35)]"
        />
        <h1 className="font-display text-5xl font-black uppercase tracking-widest text-xbz-blue drop-shadow-[0_0_40px_rgba(0,102,255,0.3)] sm:text-7xl">
          XBZ Esport
        </h1>
        <p className="mt-4 tracking-widest text-neutral-400">
          Rejoindre XBZ • Discord ouvert aux joueurs motivés
        </p>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-xbz mt-8">
          Rejoindre Discord
        </a>
      </section>

      {/* ACCUEIL */}
      <section className="relative z-10 px-[10%] py-20">
        <div className="card-xbz mx-auto max-w-3xl p-10 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold sm:text-4xl">Bienvenue sur XBZ</h2>
          <p className="text-neutral-300">Une structure esport en pleine évolution 🚀</p>
        </div>
      </section>
    </>
  );
}