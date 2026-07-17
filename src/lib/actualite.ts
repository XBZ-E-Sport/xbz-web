// Couche d'accès aux actualités.
//
// ⚠️ POINT DE BRANCHEMENT BACK-OFFICE / SUPABASE :
// Aujourd'hui, les articles proviennent d'un mock statique (MOCK_ARTICLES).
// Quand la table `articles` existera côté Supabase, il suffira de remplacer
// le corps de getArticles() / getArticleBySlug() par une requête (voir les
// exemples en commentaire) — les pages n'ont pas à changer.

export type ArticleCategory =
  | "Compétition"
  | "Recrutement"
  | "Annonce"
  | "Communauté"
  | "Création";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  content: string[]; // paragraphes
  category: ArticleCategory;
  author: string;
  date: string; // ISO (YYYY-MM-DD)
};

const MOCK_ARTICLES: Article[] = [
  {
    slug: "recrutement-rocket-league-ouvert",
    title: "Le recrutement Rocket League est ouvert",
    excerpt:
      "XBZ ouvre plusieurs places dans ses rosters compétitifs et son staff. Postule dès maintenant.",
    category: "Recrutement",
    author: "Staff XBZ",
    date: "2026-07-14",
    content: [
      "La structure XBZ recherche de nouveaux talents pour renforcer ses équipes Rocket League. Plusieurs postes sont ouverts, du Champion au Supersonic Legend.",
      "Le recrutement concerne aussi le staff et la création de contenu : managers, coachs, monteurs et graphistes sont les bienvenus.",
      "Pour postuler, rends-toi sur la page recrutement et remplis le formulaire. Le staff étudie chaque candidature avec attention.",
    ],
  },
  {
    slug: "rosters-preparation-nouvelle-saison",
    title: "Nos rosters se préparent pour la nouvelle saison",
    excerpt:
      "Entraînements intensifs et nouveaux objectifs : les équipes XBZ montent en régime avant la reprise.",
    category: "Compétition",
    author: "Staff XBZ",
    date: "2026-07-05",
    content: [
      "À l'approche de la nouvelle saison, les rosters XBZ intensifient les entraînements et peaufinent leurs stratégies.",
      "L'objectif est clair : gagner en régularité et viser le haut du classement dans chaque division.",
      "Suis les résultats et les temps forts directement sur notre Discord.",
    ],
  },
  {
    slug: "pole-creation-sagrandit",
    title: "Le pôle création s'agrandit",
    excerpt:
      "Graphistes, monteurs et casters : le pôle contenu de XBZ recrute pour faire rayonner le club.",
    category: "Création",
    author: "Staff XBZ",
    date: "2026-06-24",
    content: [
      "Le contenu est au cœur de l'identité de XBZ. Pour aller plus loin, le pôle création s'ouvre à de nouveaux profils.",
      "Montage de clips, visuels, casting de matchs : chaque compétence a sa place pour mettre en valeur les équipes.",
    ],
  },
  {
    slug: "xbz-lance-nouveau-site",
    title: "XBZ lance son nouveau site",
    excerpt:
      "Nouvelle identité, nouvelles pages : découvre le site XBZ v2, pensé pour la communauté.",
    category: "Annonce",
    author: "Staff XBZ",
    date: "2026-06-12",
    content: [
      "XBZ franchit une étape avec un tout nouveau site : plus clair, plus rapide et pensé pour la communauté.",
      "Au programme : présentation du club, équipes, recrutement, et bientôt une boutique et un espace actualité alimenté en direct.",
      "Ce n'est que le début : le site continuera d'évoluer au fil des saisons.",
    ],
  },
];

/** Liste des actualités, les plus récentes d'abord. */
export async function getArticles(): Promise<Article[]> {
  // TODO back-office : remplacer par une requête Supabase, par ex.
  //   const supabase = await createClient();
  //   const { data } = await supabase
  //     .from("articles")
  //     .select("*")
  //     .eq("published", true)
  //     .order("date", { ascending: false });
  //   return (data ?? []) as Article[];
  return [...MOCK_ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
}

/** Un article par son slug, ou null s'il n'existe pas. */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  // TODO back-office : .from("articles").select("*").eq("slug", slug).maybeSingle()
  const articles = await getArticles();
  return articles.find((a) => a.slug === slug) ?? null;
}
