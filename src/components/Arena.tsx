/**
 * Couche d'ambiance « Arène » : un balayage lumineux rouge lent + quelques
 * éclats anguleux qui dérivent, peints DERRIÈRE tout le contenu du site.
 *
 * 100 % CSS : rendu et animations vivent dans globals.css (section « COUCHE
 * ARÈNE »). Ce composant ne pose que le markup — composant serveur, sans état
 * ni hook, donc aucun JS envoyé au navigateur. Purement décoratif → masqué aux
 * lecteurs d'écran. Le CSS la coupe en mouvement réduit, à l'impression, en
 * contraste forcé ou renforcé et dans le back-office, et la fige quand une
 * surcouche (menu mobile, lightbox) est ouverte.
 */
export default function Arena() {
  return (
    <div className="xbz-arena" aria-hidden="true">
      <span className="xbz-arena__sweep" />
      <span className="xbz-arena__shard xbz-arena__shard--1" />
      <span className="xbz-arena__shard xbz-arena__shard--drift xbz-arena__shard--2" />
      <span className="xbz-arena__shard xbz-arena__shard--3" />
      <span className="xbz-arena__shard xbz-arena__shard--drift xbz-arena__shard--4" />
      <span className="xbz-arena__shard xbz-arena__shard--drift xbz-arena__shard--5" />
      <span className="xbz-arena__shard xbz-arena__shard--6" />
    </div>
  );
}
