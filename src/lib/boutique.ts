// Couche d'accès à la boutique.
//
// ⚠️ POINT DE BRANCHEMENT BACK-OFFICE / SUPABASE :
// Aujourd'hui les produits proviennent d'un mock statique (MOCK_PRODUCTS).
// Quand la table `products` existera, on remplace le corps de getProducts()
// par une requête Supabase (voir l'exemple en commentaire) — la page ne
// change pas.

export type ProductCategory = "Textile" | "Accessoire" | "Gaming";

export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number; // en euros
  category: ProductCategory;
  icon: string; // emoji en attendant les vraies images produits
  image?: string; // URL (Supabase Storage) plus tard
  available: boolean;
  url?: string; // lien d'achat externe, utilisé si available === true
};

const MOCK_PRODUCTS: Product[] = [
  {
    slug: "maillot-officiel",
    name: "Maillot officiel XBZ",
    description: "Le maillot compétitif aux couleurs de la structure.",
    price: 49.99,
    category: "Textile",
    icon: "👕",
    available: false,
  },
  {
    slug: "hoodie",
    name: "Hoodie XBZ",
    description: "Sweat à capuche premium, logo brodé sur la poitrine.",
    price: 59.99,
    category: "Textile",
    icon: "🧥",
    available: false,
  },
  {
    slug: "casquette",
    name: "Casquette XBZ",
    description: "Casquette ajustable brodée, finition mate.",
    price: 19.99,
    category: "Accessoire",
    icon: "🧢",
    available: false,
  },
  {
    slug: "tapis-souris-xl",
    name: "Tapis de souris XL",
    description: "Grand tapis gaming, surface optimisée pour la précision.",
    price: 29.99,
    category: "Gaming",
    icon: "🖱️",
    available: false,
  },
  {
    slug: "mug",
    name: "Mug XBZ",
    description: "Mug céramique aux couleurs du club pour les sessions du matin.",
    price: 14.99,
    category: "Accessoire",
    icon: "☕",
    available: false,
  },
  {
    slug: "sticker-pack",
    name: "Pack de stickers",
    description: "Lot de stickers XBZ pour customiser ton setup.",
    price: 6.99,
    category: "Accessoire",
    icon: "🔖",
    available: false,
  },
];

/** Liste des produits de la boutique. */
export async function getProducts(): Promise<Product[]> {
  // TODO back-office : remplacer par une requête Supabase, par ex.
  //   const supabase = await createClient();
  //   const { data } = await supabase
  //     .from("products")
  //     .select("*")
  //     .order("created_at", { ascending: false });
  //   return (data ?? []) as Product[];
  return MOCK_PRODUCTS;
}
