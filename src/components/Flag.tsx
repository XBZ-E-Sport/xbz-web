// Drapeau pays en SVG auto-hébergé (package country-flag-icons) :
// aucune requête externe, rendu identique sur toutes les plateformes (Windows inclus).
// Rendu dans des Server Components → les SVG ne pèsent pas sur le bundle client.

import * as Flags from "country-flag-icons/react/3x2";

export default function Flag({
  code,
  label,
  className = "h-4 w-auto rounded-xs",
}: {
  code?: string | null;
  label?: string | null;
  className?: string;
}) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const FlagIcon = Flags[code.toUpperCase() as keyof typeof Flags];
  if (!FlagIcon) return null;
  return <FlagIcon aria-hidden="true" title={label ?? undefined} className={className} />;
}
