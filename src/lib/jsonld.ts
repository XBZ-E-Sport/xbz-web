// Sérialisation sûre d'un objet JSON-LD injecté via `dangerouslySetInnerHTML`
// dans un <script type="application/ld+json">.
//
// Le contenu d'un <script> est du "raw text" : le navigateur n'y cherche qu'une
// séquence de fermeture `</script`. Une donnée dynamique (titre d'article,
// question de FAQ… pilotés par le back-office) contenant `</script>` sortirait
// donc du script et permettrait une injection de balise (XSS).
//
// On échappe `<`, `>` et `&` en séquences unicode : le JSON reste valide et
// parse à l'identique, mais plus aucune sous-chaîne HTML sensible n'apparaît
// littéralement dans le document.
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
