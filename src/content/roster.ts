export type RoleVariant = "founder" | "staff" | "member" | "creative" | "open";

export type RoleTag = { label: string; variant: RoleVariant };

export type RosterEntry = {
  title: string;
  description: string;
  tags: RoleTag[];
};

export const roster: RosterEntry[] = [
  {
    title: "🎮 Joueurs Rocket League",
    description: "Roster compétitif",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "🎮 Joueurs Warzone",
    description: "Roster compétitif",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "👑 Fondateurs",
    description: "Direction de la structure",
    tags: [{ label: "FONDATEUR", variant: "founder" }],
  },
  {
    title: "🛡 Modérateurs",
    description: "Gestion Discord & communauté",
    tags: [{ label: "STAFF", variant: "staff" }],
  },
  {
    title: "🎨 Graphistes",
    description: "Création visuelle & branding",
    tags: [
      { label: "CRÉATIF", variant: "creative" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "🎬 Monteurs",
    description: "Montage clips & contenu",
    tags: [
      { label: "CRÉATIF", variant: "creative" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "📢 Community Manager",
    description: "Réseaux sociaux & animation",
    tags: [
      { label: "STAFF", variant: "staff" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
];