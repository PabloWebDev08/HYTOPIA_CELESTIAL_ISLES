// Gestionnaire de mondes pour les îles
import { World, WorldManager, Player, type WorldMap } from "hytopia";
import { IslandManager } from "./islandManager";

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 * Doit correspondre au mapping dans index.ts
 */
export interface IslandMapMapping {
  [islandId: string]: WorldMap;
}

/**
 * Mapping optionnel entre les IDs d'îles et leurs skyboxes
 * Si une île n'a pas de skybox spécifiée, le skybox par défaut sera utilisé
 */
export interface IslandSkyboxMapping {
  [islandId: string]: string;
}

/**
 * Gestionnaire de mondes pour les îles
 * Crée et gère un monde séparé pour chaque île
 */
export class IslandWorldManager {
  private worlds: Map<string, World> = new Map();
  private islandManagers: Map<string, IslandManager> = new Map();
  private islandMapMapping: IslandMapMapping;
  private islandSkyboxMapping: IslandSkyboxMapping;
  private defaultSkybox: string = "skyboxes/partly-cloudy";

  /**
   * Initialise le gestionnaire de mondes d'îles
   * @param islandMapMapping - Mapping entre les IDs d'îles et leurs maps
   * @param islandSkyboxMapping - Mapping optionnel entre les IDs d'îles et leurs skyboxes
   */
  constructor(
    islandMapMapping: IslandMapMapping,
    islandSkyboxMapping?: IslandSkyboxMapping
  ) {
    this.islandMapMapping = islandMapMapping;
    this.islandSkyboxMapping = islandSkyboxMapping || {};
  }

  /**
   * Crée tous les mondes d'îles au démarrage
   * Chaque île aura son propre monde isolé
   */
  initializeWorlds(): void {
    // Parcourt toutes les îles définies dans le mapping
    Object.keys(this.islandMapMapping).forEach((islandId) => {
      const mapData = this.islandMapMapping[islandId];

      // Récupère la skybox spécifique à cette île, ou utilise le défaut
      const skyboxUri =
        this.islandSkyboxMapping[islandId] || this.defaultSkybox;

      // Crée un nouveau monde pour cette île
      const world = WorldManager.instance.createWorld({
        name: `Island ${islandId}`,
        skyboxUri: skyboxUri,
      });

      // Charge la map dans ce monde
      world.loadMap(mapData);

      // Crée un gestionnaire d'îles pour ce monde
      const islandManager = new IslandManager(world);
      islandManager.loadIsland(islandId);

      // Stocke le monde et son gestionnaire d'îles
      this.worlds.set(islandId, world);
      this.islandManagers.set(islandId, islandManager);
    });
  }

  /**
   * Récupère le monde correspondant à une île
   * @param islandId - L'ID de l'île (ex: "island1", "island2")
   * @returns Le monde correspondant ou null si l'île n'existe pas
   */
  getWorldForIsland(islandId: string): World | null {
    return this.worlds.get(islandId) || null;
  }

  /**
   * Récupère le gestionnaire d'îles pour un monde spécifique
   * @param islandId - L'ID de l'île
   * @returns Le gestionnaire d'îles ou null si l'île n'existe pas
   */
  getIslandManagerForIsland(islandId: string): IslandManager | null {
    return this.islandManagers.get(islandId) || null;
  }

  /**
   * Récupère tous les mondes créés
   * @returns Un tableau avec tous les mondes d'îles
   */
  getAllWorlds(): World[] {
    return Array.from(this.worlds.values());
  }

  /**
   * Récupère tous les IDs d'îles disponibles
   * @returns Un tableau avec tous les IDs d'îles
   */
  getAvailableIslandIds(): string[] {
    return Array.from(this.worlds.keys());
  }

  /**
   * Récupère l'ID de l'île correspondant à un monde donné
   * @param world - Le monde pour lequel trouver l'ID de l'île
   * @returns L'ID de l'île ou null si le monde n'est pas géré par ce manager
   */
  getIslandIdForWorld(world: World): string | null {
    for (const [islandId, islandWorld] of this.worlds.entries()) {
      if (islandWorld === world) {
        return islandId;
      }
    }
    return null;
  }

  /**
   * Récupère le monde où se trouve un joueur
   * @param player - Le joueur pour lequel trouver le monde
   * @returns Le monde où se trouve le joueur ou null si le joueur n'est dans aucun monde géré
   */
  getPlayerWorld(player: Player): World | null {
    // Vérifie chaque monde d'île
    for (const islandWorld of this.worlds.values()) {
      const islandPlayers =
        islandWorld.entityManager.getPlayerEntitiesByPlayer(player);
      if (islandPlayers.length > 0) {
        return islandWorld;
      }
    }
    return null;
  }

  /**
   * Récupère le gestionnaire d'îles pour un monde donné
   * @param world - Le monde pour lequel trouver le gestionnaire d'îles
   * @returns Le gestionnaire d'îles ou null si le monde n'est pas géré
   */
  getIslandManagerForWorld(world: World): IslandManager | null {
    // Trouve l'ID de l'île correspondant à ce monde
    const islandId = this.getIslandIdForWorld(world);
    if (!islandId) {
      return null;
    }
    return this.getIslandManagerForIsland(islandId);
  }
}
