/**
 * Configuration des îles
 * Contient les mappings et configurations pour toutes les îles
 */

import island1Map from "../assets/map_island_1.json";
import island2Map from "../assets/map_island_2.json";
import island3Map from "../assets/map_island_3.json";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland1Leaderboard } from "../islands/island1/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland2Leaderboard } from "../islands/island2/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland3Leaderboard } from "../islands/island3/welcomeNPCS";

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 */
export const islandMapMapping: Record<string, any> = {
  island1: island1Map,
  island2: island2Map,
  island3: island3Map,
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * Mapping entre les IDs d'îles et leurs fonctions de mise à jour du leaderboard
 * Utilise un mapping statique pour éviter les problèmes d'import dynamique
 */
export const islandLeaderboardUpdaters: Record<
  string,
  (leaderboard: Array<{ playerName: string; timestamp: number }>) => void
> = {
  island1: updateIsland1Leaderboard,
  island2: updateIsland2Leaderboard,
  island3: updateIsland3Leaderboard,
  // Ajoutez d'autres îles ici au fur et à mesure
};

