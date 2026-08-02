import AdminForm from "@/components/AdminForm";

import { articleCategories } from "@/lib/actualite";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string[] | null;
  category: string;
  author: string | null;
  date: string; // YYYY-MM-DD
  published: boolean;
};

export default function ArticleForm({
  action,
  article,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  article?: ArticleRow;
  submitLabel: string;
}) {
  // Préfixe d'id unique par instance (une même page affiche plusieurs formulaires).
  const uid = article ? `article-${article.id}` : "article-new";

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-title`} className={labelCls}>
          Titre
        </label>
        <input
          id={`${uid}-title`}
          name="title"
          defaultValue={article?.title}
          required
          placeholder="Le recrutement Rocket League est ouvert"
          className={inputCls}
        />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-slug`} className={labelCls}>
          Slug (auto si vide)
        </label>
        <input id={`${uid}-slug`} name="slug" defaultValue={article?.slug} placeholder="recrutement-ouvert" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-category`} className={labelCls}>
          Catégorie
        </label>
        <select id={`${uid}-category`} name="category" defaultValue={article?.category ?? "Annonce"} className={inputCls}>
          {articleCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-author`} className={labelCls}>
          Auteur
        </label>
        <input id={`${uid}-author`} name="author" defaultValue={article?.author ?? "Staff XBZ"} placeholder="Staff XBZ" className={inputCls} />
      </div>

      <div className="block">
        <label htmlFor={`${uid}-date`} className={labelCls}>
          Date
        </label>
        <input id={`${uid}-date`} name="date" type="date" defaultValue={article?.date ?? ""} className={inputCls} />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-excerpt`} className={labelCls}>
          Résumé (aperçu dans les listes)
        </label>
        <textarea
          id={`${uid}-excerpt`}
          name="excerpt"
          defaultValue={article?.excerpt ?? ""}
          rows={2}
          placeholder="Une phrase d'accroche affichée sur les cartes et en meta description."
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-content`} className={labelCls}>
          Contenu (un paragraphe par bloc, séparés par une ligne vide)
        </label>
        <textarea
          id={`${uid}-content`}
          name="content"
          defaultValue={(article?.content ?? []).join("\n\n")}
          rows={10}
          placeholder={"Premier paragraphe…\n\nDeuxième paragraphe…"}
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <input id={`${uid}-published`} type="checkbox" name="published" defaultChecked={article?.published ?? true} className="h-4 w-4" />
        <label htmlFor={`${uid}-published`}>Publié (visible sur le site)</label>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
