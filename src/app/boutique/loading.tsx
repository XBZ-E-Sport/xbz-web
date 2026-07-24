import { ListPageSkeleton } from "@/components/Skeletons";

// Skeleton affiché pendant le rendu serveur de /boutique (catalogue produits).
export default function Loading() {
  return <ListPageSkeleton count={6} chips />;
}
