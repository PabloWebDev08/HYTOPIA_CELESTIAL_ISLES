// Types et interfaces communs pour toutes les îles
import { World, Entity } from "hytopia";

/**
 * Position dans l'espace 3D
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Rotation en quaternion
 */
export interface Rotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Position avec rotation optionnelle
 */
export interface PositionWithRotation extends Position {
  rotation?: Rotation;
}

/**
 * Interface que toutes les îles doivent implémenter
 */
export interface Island {
  /**
   * Initialise l'île et crée toutes ses entités
   * @param world - Le monde où initialiser l'île
   */
  initialize(world: World): void;

  /**
   * Retourne la position de départ pour les joueurs
   * @returns La position de départ
   */
  getStartPosition(): Position;

  /**
   * Retourne la position d'une plateforme par son ID
   * @param id - L'ID de la plateforme
   * @returns La position de la plateforme ou null si introuvable
   */
  getPlatformPositionById(id: string): Position | null;

  /**
   * Nettoie les ressources de l'île (optionnel)
   * Peut être utilisé pour désactiver temporairement une île
   */
  cleanup?(): void;
}

/**
 * Structure contenant toutes les entités créées par une île
 */
export interface IslandEntities {
  parkourEntities?: Entity[];
  coinEntities?: Entity[];
  spinningSawEntities?: Entity[];
  npcs?: Entity[];
  boats?: Entity[];
  arrows?: Entity[];
  speechBubbles?: Entity[];
  [key: string]: Entity[] | undefined;
}
