import AdminForm from "@/components/AdminForm";

import { mediaTypes, mediaCategories } from "@/lib/medias";

const inputCls =
  "w-full rounded-lg border-0 bg-[#0d0d13] px-3 py-2 text-sm text-white placeholder:text-neutral-400 outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400";

// Libellés FR (le back-office est en français).
const typeLabels: Record<(typeof mediaTypes)[number], string> = {
  photo: "Photo",
  video: "Vidéo",
};
const categoryLabels: Record<(typeof mediaCategories)[number], string> = {
  events: "Événements",
  matches: "Matchs",
  creation: "Création",
  backstage: "Coulisses",
};

export type MediaRow = {
  id: string;
  type: string;
  title: string | null;
  category: string;
  image: string | null;
  video_url: string | null;
  position: number;
  active: boolean;
};

export default function MediaForm({
  action,
  media,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  media?: MediaRow;
  submitLabel: string;
}) {
  const uid = media ? `media-${media.id}` : "media-new";

  return (
    <AdminForm action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {media && <input type="hidden" name="id" value={media.id} />}

      <div className="block">
        <label htmlFor={`${uid}-type`} className={labelCls}>
          Type
        </label>
        <select id={`${uid}-type`} name="type" defaultValue={media?.type ?? "photo"} className={inputCls}>
          {mediaTypes.map((tp) => (
            <option key={tp} value={tp}>
              {typeLabels[tp]}
            </option>
          ))}
        </select>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-category`} className={labelCls}>
          Catégorie
        </label>
        <select
          id={`${uid}-category`}
          name="category"
          defaultValue={media?.category ?? "events"}
          className={inputCls}
        >
          {mediaCategories.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-title`} className={labelCls}>
          Titre / légende (facultatif)
        </label>
        <input
          id={`${uid}-title`}
          name="title"
          defaultValue={media?.title ?? ""}
          placeholder="Finale du tournoi régional"
          className={inputCls}
        />
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-image-file`} className={labelCls}>
          Image (photo, ou vignette d’une vidéo)
        </label>
        <div className="flex items-center gap-3">
          {media?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          )}
          <input
            id={`${uid}-image-file`}
            name="image_file"
            type="file"
            accept="image/*"
            className="w-full text-sm text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-xbz-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>
        <label htmlFor={`${uid}-image-url`} className="sr-only">
          URL de l’image
        </label>
        <input
          id={`${uid}-image-url`}
          name="image_url"
          type="url"
          defaultValue={media?.image ?? ""}
          placeholder="…ou colle une URL d'image"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Upload une image (JPG / PNG / WebP, 5&nbsp;Mo max) ou colle une URL. Pour une vidéo, c’est
          la vignette affichée dans la galerie.
        </p>
      </div>

      <div className="block sm:col-span-2">
        <label htmlFor={`${uid}-video`} className={labelCls}>
          Lien vidéo (YouTube / Twitch — requis pour une vidéo)
        </label>
        <input
          id={`${uid}-video`}
          name="video_url"
          type="url"
          defaultValue={media?.video_url ?? ""}
          placeholder="https://youtube.com/watch?v=… ou https://twitch.tv/videos/…"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-neutral-400">
          La vignette ouvre ce lien dans un nouvel onglet (aucune vidéo intégrée sur le site).
        </p>
      </div>

      <div className="block">
        <label htmlFor={`${uid}-position`} className={labelCls}>
          Position (ordre)
        </label>
        <input
          id={`${uid}-position`}
          name="position"
          type="number"
          defaultValue={media?.position ?? 0}
          className={inputCls}
        />
      </div>

      <div className="flex items-end gap-2 text-sm text-neutral-300">
        <input
          id={`${uid}-active`}
          type="checkbox"
          name="active"
          defaultChecked={media?.active ?? true}
          className="h-4 w-4"
        />
        <label htmlFor={`${uid}-active`} className="pb-2">
          Visible sur le site
        </label>
      </div>

      <div className="sm:col-span-2">
        <button className="rounded-lg bg-xbz-blue px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:cursor-pointer">
          {submitLabel}
        </button>
      </div>
    </AdminForm>
  );
}
