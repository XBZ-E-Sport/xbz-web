/**
 * Neutralise les mentions Discord d'un texte saisi par un visiteur, avant de le
 * transmettre au bot : `@everyone`, `@here`, `<@123>`, `<@!123>`, `<@&rôle>`.
 *
 * Une espace sans chasse (U+200B) juste après le « @ » casse la mention sans
 * rien changer à l'affichage. Sans ça, « @everyone » glissé dans une
 * motivation pouvait notifier tout le serveur, si le bot en a la permission.
 * Défense côté site : le bot devrait lui aussi poster avec
 * `allowedMentions: { parse: [] }`.
 *
 * À NE PAS appliquer à une adresse email (`x@here.com` deviendrait impossible
 * à copier-coller depuis Discord).
 */
export function defuseMentions(text: string): string {
  return text.replace(/@(everyone|here)\b/gi, "@​$1").replace(/<@(?=[!&]?\d)/g, "<@​");
}
