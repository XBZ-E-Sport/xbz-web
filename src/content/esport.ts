export type RoleVariant = "founder" | "staff" | "member" | "creative";

export type RoleTag = { label: string; variant: RoleVariant };

export type EsportEntry = {
  title: string;
  description: string;
  slots: string;
  fixed?: boolean;
  tags: RoleTag[];
  /** Rôle candidat alimenté par cette ligne (piloté par le recrutement). */
  recrute?: string;
};

export const esportRoster: EsportEntry[] = [
  {
    title: "⚙️ Gérant RL",
    description: "Direction de la section Rocket League",
    slots: "1/1",
    fixed: true,
    tags: [{ label: "STAFF", variant: "staff" }],
  },
  {
    title: "💼 Recruteurs",
    description: "Détection & recrutement de talents",
    slots: "1/2",
    tags: [{ label: "STAFF", variant: "staff" }],
    recrute: "Recruteur",
  },
  {
    title: "👨🏻‍💼 Managers",
    description: "Gestion des équipes compétitives",
    slots: "0/5",
    tags: [{ label: "STAFF", variant: "staff" }],
    recrute: "Manager",
  },
  {
    title: "💪 Coachs",
    description: "Encadrement & stratégie de jeu",
    slots: "0/3",
    tags: [{ label: "STAFF", variant: "staff" }],
    recrute: "Coach",
  },
  {
    title: "⚪ Roster SSL",
    description: "Équipe Supersonic Legend",
    slots: "0/3",
    tags: [{ label: "JOUEUR", variant: "member" }],
    recrute: "Joueur",
  },
  {
    title: "🔴 Roster GC3",
    description: "Équipe Grand Champion III",
    slots: "2/3",
    tags: [{ label: "JOUEUR", variant: "member" }],
    recrute: "Joueur",
  },
  {
    title: "🔴 Roster GC2",
    description: "Équipe Grand Champion II",
    slots: "2/3",
    tags: [{ label: "JOUEUR", variant: "member" }],
    recrute: "Joueur",
  },
  {
    title: "🔴 Roster GC1",
    description: "Équipe Grand Champion I",
    slots: "1/3",
    tags: [{ label: "JOUEUR", variant: "member" }],
    recrute: "Joueur",
  },
  {
    title: "🎮 Roster C3",
    description: "Équipe Champion III",
    slots: "1/3",
    tags: [{ label: "JOUEUR", variant: "member" }],
    recrute: "Joueur",
  },
];
