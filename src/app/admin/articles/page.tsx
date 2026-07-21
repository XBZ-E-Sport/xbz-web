import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmButton from "@/components/ConfirmButton";
import { formatDate } from "@/lib/format";
import ArticleForm, { type ArticleRow } from "./ArticleForm";
import { createArticle, updateArticle, deleteArticle } from "./actions";

export const metadata = { title: "Actualité — Back-office XBZ" };
export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articles")
    .select("id, slug, title, excerpt, content, category, author, date, published")
    .order("date", { ascending: false });

  if (error) {
    return <p className="text-red-400">Erreur de chargement : {error.message}</p>;
  }
  const articles = (data ?? []) as ArticleRow[];

  return (
    <div className="flex flex-col gap-8">
      {/* Ajouter un article */}
      <section className="card-xbz p-6">
        <h2 className="mb-4 font-display text-lg text-white">➕ Nouvel article</h2>
        <ArticleForm action={createArticle} submitLabel="Publier l’article" />
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-display text-lg text-white">
          Articles <span className="text-neutral-500">({articles.length})</span>
        </h2>

        {articles.length === 0 ? (
          <p className="text-neutral-400">Aucun article. Crée le premier ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {articles.map((a) => (
              <li key={a.id} className="card-xbz p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-white">
                      {a.title}
                      {!a.published && (
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                          brouillon
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      /{a.slug} · {a.category} · {formatDate(a.date)} · {a.author ?? "—"}
                    </p>
                  </div>
                </div>

                <details className="group mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-xbz-cyan">
                    Modifier / supprimer
                  </summary>
                  <div className="mt-4">
                    <ArticleForm action={updateArticle} article={a} submitLabel="Enregistrer" />
                    <form action={deleteArticle} className="mt-3">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="slug" value={a.slug} />
                      <ConfirmButton
                        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
                        message={`Supprimer l'article "${a.title}" ? Action irréversible.`}
                      >
                        Supprimer l’article
                      </ConfirmButton>
                    </form>
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
