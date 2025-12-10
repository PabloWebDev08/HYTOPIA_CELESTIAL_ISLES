// Gestion centralisée des leaderboards pour toutes les îles
// Import des fonctions de mise à jour du leaderboard pour chaque île
import { updateAllSkeletonSoldiersLeaderboard as updateIsland1Leaderboard } from "../island1/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland2Leaderboard } from "../island2/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland3Leaderboard } from "../island3/welcomeNPCS";

/**
 * Type pour une fonction de mise à jour du leaderboard
 */
export type LeaderboardUpdater = (
  leaderboard: Array<{ playerName: string; timestamp: number }>
) => void;

/**
 * Mapping entre les IDs d'îles et leurs fonctions de mise à jour du leaderboard
 * Utilise un mapping statique pour éviter les problèmes d'import dynamique
 */
const islandLeaderboardUpdaters: Record<string, LeaderboardUpdater> = {
  island1: updateIsland1Leaderboard,
  island2: updateIsland2Leaderboard,
  island3: updateIsland3Leaderboard,
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * Récupère la fonction de mise à jour du leaderboard pour une île spécifique
 * @param islandId - L'ID de l'île (ex: "island1", "island2")
 * @returns La fonction de mise à jour ou null si l'île n'existe pas
 */
export function getIslandLeaderboardUpdater(
  islandId: string
): LeaderboardUpdater | null {
  return islandLeaderboardUpdaters[islandId] || null;
}

/**
 * Met à jour le leaderboard pour une île spécifique
 * @param islandId - L'ID de l'île
 * @param leaderboard - Le leaderboard à mettre à jour
 */
export function updateIslandLeaderboard(
  islandId: string,
  leaderboard: Array<{ playerName: string; timestamp: number }>
): void {
  const updater = getIslandLeaderboardUpdater(islandId);
  if (updater) {
    try {
      updater(leaderboard);
    } catch (error) {
      console.error(
        `[Leaderboard] Erreur lors de la mise à jour du leaderboard pour ${islandId}:`,
        error
      );
    }
  } else {
    console.warn(
      `[Leaderboard] Aucune fonction de mise à jour trouvée pour l'île ${islandId}`
    );
  }
}

