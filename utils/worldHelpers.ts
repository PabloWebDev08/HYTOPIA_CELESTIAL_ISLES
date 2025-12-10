/**
 * Helpers pour la gestion des mondes
 */

import { Player, World } from "hytopia";
import { IslandManager } from "../islands/islandManager";
import { IslandWorldManager } from "../islands/worldManager";

/**
 * Obtient le monde où se trouve un joueur
 * @param player - Le joueur
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 * @returns Le monde où se trouve le joueur ou null si introuvable
 */
export function getPlayerWorld(
  player: Player,
  islandWorldManager: IslandWorldManager
): World | null {
  // Vérifie chaque monde d'île
  for (const islandWorld of islandWorldManager.getAllWorlds()) {
    const islandPlayers =
      islandWorld.entityManager.getPlayerEntitiesByPlayer(player);
    if (islandPlayers.length > 0) {
      return islandWorld;
    }
  }

  return null;
}

/**
 * Obtient le gestionnaire d'îles pour un monde donné
 * @param world - Le monde
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 * @returns Le gestionnaire d'îles ou null si introuvable
 */
export function getIslandManagerForWorld(
  world: World,
  islandWorldManager: IslandWorldManager
): IslandManager | null {
  // Trouve l'ID de l'île correspondant à ce monde
  for (const islandId of islandWorldManager.getAvailableIslandIds()) {
    if (islandWorldManager.getWorldForIsland(islandId) === world) {
      return islandWorldManager.getIslandManagerForIsland(islandId);
    }
  }

  return null;
}

/**
 * Enregistre une commande sur tous les mondes d'îles
 * @param command - Le nom de la commande
 * @param handler - Le handler de la commande
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 */
export function registerCommandOnAllWorlds(
  command: string,
  handler: (player: Player, args?: string[]) => void | Promise<void>,
  islandWorldManager: IslandWorldManager
): void {
  // Enregistre la commande sur tous les mondes d'îles
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    islandWorld.chatManager.registerCommand(command, handler);
  });
}

