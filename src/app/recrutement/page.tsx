import RecrutementForm from "@/components/RecrutementForm";

export const metadata = { title: "Recrutement — XBZ Esport" };

export default function RecrutementPage() {
  return (
    <section className="relative z-10 mx-auto max-w-2xl px-6 pb-20 pt-32">
      <div className="card-xbz p-6 sm:p-10">
        <h1 className="mb-6 text-center font-display text-3xl font-bold sm:text-4xl">📝 Recrutement</h1>
        <RecrutementForm />
      </div>
    </section>
  );
}