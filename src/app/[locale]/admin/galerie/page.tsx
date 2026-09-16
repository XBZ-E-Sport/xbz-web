import AdminForm from "@/components/AdminForm";
import { requireStaff } from "@/lib/adminguard";
import ConfirmButton from "@/components/ConfirmButton";
import MediaForm, { type MediaRow } from "./MediaForm";
import { createMedia, updateMedia, deleteMedia } from "./actions";

export const metadata = { title: "Galerie — Back-office XBZ" };
export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = { photo: "Photo", video: "Vidéo" };
const categoryLabels: Record<string, string> = {
  events: "Événements",
  matches: "Matchs",
  creation: "Création",
  backstage: "Coulisses",
};

export default async function AdminGaleriePage() {
  const { admin } = await requireStaff();
  const { data, error } = await admin
    .from("medias")
    .select("id, type, title, category, image, video_url, position, active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const medias = (data ?? []) as MediaRow[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un média */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouveau média</h2>
        <MediaForm action={createMedia} submitLabel="Ajouter le média" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Médias <span className="text-neutral-400">({medias.length})</span>
        </h2>

        {medias.length === 0 ? (
          <p className="text-neutral-400">Aucun média. Ajoute le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {medias.map((m) => (
              <li key={m.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span aria-hidden="true" className="text-2xl">
                        {m.type === "video" ? "🎬" : "🖼️"}
                      </span>
                    )}
                    <div>
                      <h3 className="font-display text-lg text-white">
                        {m.title || (m.type === "video" ? "Vidéo sans titre" : "Photo sans titre")}
                        {!m.active && (
                          <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                            masqué
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-neutral-400">
                        {typeLabels[m.type] ?? m.type} · {categoryLabels[m.category] ?? m.category}
                      </p>
                    </div>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / Supprimer
                  </summary>
                  <div className="mt-4">
                    <MediaForm action={updateMedia} media={m} submitLabel="Enregistrer" />
                    <AdminForm
                      action={deleteMedia}
                      className="mt-3"
                      loadingMessage="Suppression…"
                      successMessage="Média supprimé"
                      closeOnSuccess={false}
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 hover:cursor-pointer"
                        message={`Supprimer ce média${m.title ? ` (« ${m.title} »)` : ""} ? Action irréversible.`}
                      >
                        Supprimer le média
                      </ConfirmButton>
                    </AdminForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
