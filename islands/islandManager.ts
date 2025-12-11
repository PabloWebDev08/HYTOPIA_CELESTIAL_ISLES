// Gestionnaire central des îles
import { World } from "hytopia";
import type { Island } from "./shared/types";
import { Island1 } from "./island1/island";
import { Island2 } from "./island2/island";
import { Island3 } from "./island3/island";

/**
 * Gestionnaire central pour toutes les îles du jeu
 * Permet de charger et gérer les différentes îles
 */
export class IslandManager {
  private islands: Map<string, Island> = new Map();
  private currentIsland: Island | null = null;
  private currentIslandId: string | null = null;
  private world: World | null = null;

  /**
   * Initialise le gestionnaire d'îles
   * @param world - Le monde du jeu
   */
  constructor(world: World) {
    this.world = world;
    this.registerIslands();
  }

  /**
   * Enregistre toutes les îles disponibles
   */
  private registerIslands(): void {
    // Enregistre l'île 1
    this.islands.set("island1", new Island1());
    // Enregistre l'île 2 (vide pour l'instant)
    this.islands.set("island2", new Island2());
    // Enregistre l'île 3
    this.islands.set("island3", new Island3());
    // Ajoutez d'autres îles ici au fur et à mesure de leur création
  }

  /**
   * Charge une île spécifique par son ID
   * @param islandId - L'ID de l'île à charger (ex: "island1", "island2")
   */
  loadIsland(islandId: string): void {
    if (!this.world) {
      throw new Error("IslandManager n'a pas été initialisé avec un monde");
    }

    // IMPORTANT:
    // Ce projet utilise un monde séparé par île (voir IslandWorldManager).
    // On charge donc l'île une seule fois au démarrage du monde.
    // Quand un joueur rejoint le monde, on ne doit PAS recharger l'île,
    // sinon cela despawn/respawn toutes les entités et peut provoquer
    // des messages "removed" reçus avant les "spawn" côté client.
    if (this.currentIslandId === islandId) {
      return;
    }

    const island = this.islands.get(islandId);
    if (!island) {
      throw new Error(`Île avec l'ID "${islandId}" introuvable`);
    }

    // Nettoie l'île actuelle si elle existe
    if (this.currentIsland && this.currentIsland.cleanup) {
      this.currentIsland.cleanup();
    }

    // Initialise la nouvelle île
    island.initialize(this.world);
    this.currentIsland = island;
    this.currentIslandId = islandId;
  }

  /**
   * Retourne l'île actuellement chargée
   * @returns L'île actuelle ou null si aucune île n'est chargée
   */
  getCurrentIsland(): Island | null {
    return this.currentIsland;
  }

  /**
   * Retourne toutes les îles enregistrées
   * @returns Un tableau avec les IDs de toutes les îles disponibles
   */
  getAvailableIslands(): string[] {
    return Array.from(this.islands.keys());
  }
}
