export type RoleVariant = "founder" | "staff" | "member" | "creative" | "open" | "full" | "closed";

export type RoleTag = { label: string; variant: RoleVariant };

export type EsportEntry = {
  title: string;
  description: string;
  slots: string;
  tags: RoleTag[];
};

export const esportRoster: EsportEntry[] = [
  {
    title: "⚙️ Responsable RL",
    description: "Direction de la section Rocket League",
    slots: "1/1",
    tags: [
      { label: "STAFF", variant: "staff" },
      { label: "RECRUTEMENT FERMÉ", variant: "closed" },
    ],
  },
  {
    title: "💼 Recruteurs",
    description: "Détection & recrutement de talents",
    slots: "1/2",
    tags: [
      { label: "STAFF", variant: "staff" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "👨🏻‍💼 Managers",
    description: "Gestion des équipes compétitives",
    slots: "0/5",
    tags: [
      { label: "STAFF", variant: "staff" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "💪 Coachs",
    description: "Encadrement & stratégie de jeu",
    slots: "0/3",
    tags: [
      { label: "STAFF", variant: "staff" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "⚪ Roster SSL",
    description: "Équipe Supersonic Legend",
    slots: "0/3",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "🔴 Roster GC3",
    description: "Équipe Grand Champion III",
    slots: "2/3",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "🔴 Roster GC2",
    description: "Équipe Grand Champion II",
    slots: "3/3",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT FERMÉ", variant: "closed" },
    ],
  },
  {
    title: "🔴 Roster GC1",
    description: "Équipe Grand Champion I",
    slots: "1/3",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
  {
    title: "🎮 Roster C3",
    description: "Équipe Champion III",
    slots: "1/3",
    tags: [
      { label: "JOUEUR", variant: "member" },
      { label: "RECRUTEMENT OUVERT", variant: "open" },
    ],
  },
];
