import { ListPageSkeleton } from "@/components/Skeletons";

// Skeleton affiché pendant le rendu serveur de /equipes (rosters + pôles).
// Pas de filtres sur cette page → chips désactivés.
export default function Loading() {
  return <ListPageSkeleton count={6} chips={false} />;
}
