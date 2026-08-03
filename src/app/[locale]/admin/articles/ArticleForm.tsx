import AdminForm from "@/components/AdminForm";
import EnglishBlock from "@/app/[locale]/admin/EnglishBlock";

import { articleCategories } from "@/lib/actualite";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  excerpt_en: string | null;
  content: string[] | null;
  content_en: string[] | null;
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
  const hasEnglish = Boolean(
    article?.title_en || article?.excerpt_en || article?.content_en?.length,
  );

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

      <EnglishBlock filled={hasEnglish}>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-title-en`} className={labelCls}>
            Title
          </label>
          <input
            id={`${uid}-title-en`}
            name="title_en"
            defaultValue={article?.title_en ?? ""}
            placeholder="Rocket League recruitment is open"
            className={inputCls}
          />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-excerpt-en`} className={labelCls}>
            Summary
          </label>
          <textarea
            id={`${uid}-excerpt-en`}
            name="excerpt_en"
            defaultValue={article?.excerpt_en ?? ""}
            rows={2}
            className={inputCls}
          />
        </div>
        <div className="block sm:col-span-2">
          <label htmlFor={`${uid}-content-en`} className={labelCls}>
            Content (one paragraph per block)
          </label>
          <textarea
            id={`${uid}-content-en`}
            name="content_en"
            defaultValue={(article?.content_en ?? []).join("\n\n")}
            rows={10}
            className={inputCls}
          />
        </div>
      </EnglishBlock>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
