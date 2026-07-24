import { ListPageSkeleton } from "@/components/Skeletons";

// Skeleton affiché pendant le rendu serveur de /actualite (liste d'articles).
export default function Loading() {
  return <ListPageSkeleton count={6} chips />;
}
