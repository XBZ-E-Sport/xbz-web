export type RoleVariant = "founder" | "staff" | "member" | "creative";

export type RoleTag = { label: string; variant: RoleVariant };

export type StaffEntry = {
  title: string;
  description: string;
  slots: string;
  fixed?: boolean;
  tags: RoleTag[];
  /** Rôle candidat alimenté par cette ligne (piloté par le recrutement). */
  recrute?: string;
  /** Non utilisé côté staff (présent pour compat. avec la carte partagée). */
  slug?: string;
};

export const staffRoster: StaffEntry[] = [
  {
    title: "👑 Fondateurs",
    description: "Direction de la structure",
    slots: "3/3",
    fixed: true,
    tags: [{ label: "FONDATEUR", variant: "founder" }],
  },
  {
    title: "🛠️ Admins",
    description: "Gestion Server & Staff",
    slots: "3/3",
    fixed: true,
    tags: [{ label: "STAFF", variant: "staff" }],
  },
  {
    title: "🛡️ Modos",
    description: "Gestion Discord & Communauté",
    slots: "1/4",
    tags: [{ label: "STAFF", variant: "staff" }],
    recrute: "Modérateur",
  },
  {
    title: "☕ Développeur",
    description: "Développement web & bot Discord",
    slots: "1/1",
    fixed: true,
    tags: [{ label: "CRÉATIF", variant: "creative" }],
  },
  {
    title: "📢 Comm Manager",
    description: "Réseaux sociaux & animation",
    slots: "2/3",
    tags: [{ label: "STAFF", variant: "staff" }],
    recrute: "Community Manager",
  },
  {
    title: "🎙️ Casters",
    description: "Commentaire & animation de matchs",
    slots: "1/2",
    tags: [{ label: "CRÉATIF", variant: "creative" }],
    recrute: "Caster",
  },
  {
    title: "🎬 Monteurs",
    description: "Montage clips & contenu",
    slots: "0/2",
    tags: [{ label: "CRÉATIF", variant: "creative" }],
    recrute: "Monteur",
  },
  {
    title: "🎨 Graphistes",
    description: "Création visuelle & branding",
    slots: "1/2",
    tags: [{ label: "CRÉATIF", variant: "creative" }],
    recrute: "Graphiste",
  },
];
