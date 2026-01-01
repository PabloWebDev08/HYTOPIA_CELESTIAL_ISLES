// Gestion de la musique d'ambiance par île
import { Audio } from "hytopia";
import { IslandWorldManager } from "../worldManager";

/**
 * Mapping entre les IDs d'îles et leurs musiques correspondantes.
 * Modifie simplement les chemins ici pour changer la musique d'une île.
 */
export const islandMusicMapping: Record<string, string> = {
  island1: "audio/music/rizzlas-morning-vibes.mp3",
  island2: "audio/music/space-ambient.mp3", // Changez ce chemin pour une musique différente
  island3: "audio/music/the-infinite-pulse.mp3", // Changez ce chemin pour une musique différente
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * Options de lecture de la musique d'ambiance par île.
 */
export interface IslandMusicOptions {
  /** Mapping entre l'ID d'une île et l'URI de sa musique */
  mapping?: Record<string, string>;
  /** Musique utilisée si aucune entrée n'existe pour une île */
  fallbackUri?: string;
  /** Volume de lecture */
  volume: number;
  /** Si true, la musique boucle */
  loop?: boolean;
}

/**
 * Joue une musique d'ambiance spécifique à chaque île (par monde).
 * @param islandWorldManager - Gestionnaire de mondes d'îles
 * @param options - Options de lecture (volume requis)
 */
export function playIslandAmbientMusic(
  islandWorldManager: IslandWorldManager,
  options: IslandMusicOptions
): void {
  const {
    mapping = islandMusicMapping,
    fallbackUri = "audio/music/jungle-theme-looping.mp3",
    volume,
    loop = true,
  } = options;

  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    // Récupère l'ID de l'île correspondant à ce monde
    const islandId = islandWorldManager.getIslandIdForWorld(islandWorld);
    if (!islandId) return;

    // Récupère la musique associée à cette île, ou utilise une musique par défaut
    const musicUri = mapping[islandId] || fallbackUri;

    // Joue la musique spécifique à cette île
    new Audio({
      uri: musicUri,
      loop,
      volume,
    }).play(islandWorld);
  });
}
