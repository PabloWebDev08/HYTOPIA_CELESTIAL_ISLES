// Gestionnaire de mondes pour les îles
import { World, WorldManager } from "hytopia";
import { IslandManager } from "./islandManager";

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 * Doit correspondre au mapping dans index.ts
 */
export interface IslandMapMapping {
  [islandId: string]: any; // Type de la map JSON
}

/**
 * Gestionnaire de mondes pour les îles
 * Crée et gère un monde séparé pour chaque île
 */
export class IslandWorldManager {
  private worlds: Map<string, World> = new Map();
  private islandManagers: Map<string, IslandManager> = new Map();
  private islandMapMapping: IslandMapMapping;

  /**
   * Initialise le gestionnaire de mondes d'îles
   * @param islandMapMapping - Mapping entre les IDs d'îles et leurs maps
   */
  constructor(islandMapMapping: IslandMapMapping) {
    this.islandMapMapping = islandMapMapping;
  }

  /**
   * Crée tous les mondes d'îles au démarrage
   * Chaque île aura son propre monde isolé
   */
  initializeWorlds(): void {
    // Parcourt toutes les îles définies dans le mapping
    Object.keys(this.islandMapMapping).forEach((islandId) => {
      const mapData = this.islandMapMapping[islandId];

      // Crée un nouveau monde pour cette île
      const world = WorldManager.instance.createWorld({
        name: `Island ${islandId}`,
        skyboxUri: "skyboxes/partly-cloudy", // Utilise le skybox par défaut
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
}
