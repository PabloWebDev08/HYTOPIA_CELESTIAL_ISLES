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
 * Utilise le defaultWorld pour la première île (island1) pour éviter la duplication
 */
export class IslandWorldManager {
  private worlds: Map<string, World> = new Map();
  private islandManagers: Map<string, IslandManager> = new Map();
  private islandMapMapping: IslandMapMapping;
  private defaultIslandId: string;

  /**
   * Initialise le gestionnaire de mondes d'îles
   * @param islandMapMapping - Mapping entre les IDs d'îles et leurs maps
   * @param defaultWorld - Le monde par défaut à utiliser pour la première île (optionnel)
   * @param defaultIslandId - L'ID de l'île à utiliser avec le defaultWorld (par défaut: "island1")
   */
  constructor(
    islandMapMapping: IslandMapMapping,
    defaultWorld?: World,
    defaultIslandId: string = "island1"
  ) {
    this.islandMapMapping = islandMapMapping;
    this.defaultIslandId = defaultIslandId;

    // Si un defaultWorld est fourni et que l'île par défaut existe dans le mapping
    if (defaultWorld && this.islandMapMapping[defaultIslandId]) {
      const mapData = this.islandMapMapping[defaultIslandId];

      // Charge la map dans le monde par défaut
      defaultWorld.loadMap(mapData);

      // Crée un gestionnaire d'îles pour le monde par défaut
      const islandManager = new IslandManager(defaultWorld);
      islandManager.loadIsland(defaultIslandId);

      // Stocke le monde par défaut et son gestionnaire d'îles
      this.worlds.set(defaultIslandId, defaultWorld);
      this.islandManagers.set(defaultIslandId, islandManager);
    }
  }

  /**
   * Crée tous les mondes d'îles au démarrage
   * Chaque île aura son propre monde isolé (sauf l'île par défaut qui utilise defaultWorld)
   */
  initializeWorlds(): void {
    // Parcourt toutes les îles définies dans le mapping
    Object.keys(this.islandMapMapping).forEach((islandId) => {
      // Ignore l'île par défaut car elle utilise déjà le defaultWorld
      if (islandId === this.defaultIslandId && this.worlds.has(islandId)) {
        return;
      }

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
