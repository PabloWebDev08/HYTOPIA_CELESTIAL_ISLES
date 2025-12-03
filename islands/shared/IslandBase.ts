// Classe de base abstraite pour les îles
import { World, Entity } from "hytopia";
import type { Island, Position, IslandEntities } from "./types";

/**
 * Classe de base abstraite pour toutes les îles
 * Fournit des fonctionnalités communes et une structure standardisée
 */
export abstract class IslandBase implements Island {
  protected world: World | null = null;
  protected entities: IslandEntities = {};

  /**
   * Initialise l'île et crée toutes ses entités
   * @param world - Le monde où initialiser l'île
   */
  initialize(world: World): void {
    this.world = world;
    this.createEntities(world);
  }

  /**
   * Méthode abstraite à implémenter par chaque île
   * Crée toutes les entités spécifiques à l'île
   * @param world - Le monde où créer les entités
   */
  protected abstract createEntities(world: World): void;

  /**
   * Retourne la position de départ pour les joueurs
   * @returns La position de départ
   */
  abstract getStartPosition(): Position;

  /**
   * Retourne la position d'une plateforme par son ID
   * @param id - L'ID de la plateforme
   * @returns La position de la plateforme ou null si introuvable
   */
  abstract getPlatformPositionById(id: string): Position | null;

  /**
   * Nettoie les ressources de l'île
   * Désactive toutes les entités créées
   */
  cleanup(): void {
    // Parcourt toutes les entités et les désactive
    Object.values(this.entities).forEach((entityArray) => {
      if (entityArray) {
        entityArray.forEach((entity) => {
          entity.despawn();
        });
      }
    });
    this.entities = {};
  }

  /**
   * Retourne toutes les entités créées par l'île
   * @returns Les entités de l'île
   */
  getEntities(): IslandEntities {
    return this.entities;
  }
}
