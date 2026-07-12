export const metadata = { title: "Support — XBZ Esport" };

const DISCORD_URL = "https://discord.gg/w7s3rBPsZ6";
const MAIL = "xbzesport1@gmail.com";

export default function SupportPage() {
  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-32">
      <div className="card-xbz p-8 text-center sm:p-10">
        <h1 className="mb-8 font-display text-3xl font-bold sm:text-4xl">Support</h1>
        <div className="flex flex-col items-center gap-4">
          <a href={`mailto:${MAIL}`} className="btn-xbz w-56 text-center">Mail</a>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-xbz w-56 text-center">
            Discord
          </a>
          <p className="mt-2 max-w-md text-xs text-neutral-500">
            ⚠️ Les messages abusifs, spam ou trolls pourront entraîner des sanctions sur la plateforme
            ou le serveur Discord.
          </p>
        </div>
      </div>
    </section>
  );
}