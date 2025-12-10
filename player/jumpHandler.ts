/**
 * Gestionnaire de la logique de saut
 * Gère le calcul de la force de saut et la vérification si le joueur est au sol
 */

import { DefaultPlayerEntity, World } from "hytopia";

/**
 * Configuration du saut
 */
export const JUMP_CONFIG = {
  minJumpForce: 10,
  maxJumpForce: 50,
  maxHoldDuration: 1000,
  fallThreshold: -50, // Seuil Y pour repositionner le joueur
} as const;

/**
 * Vérifie si le joueur est au sol en utilisant un raycast
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde où se trouve le joueur
 * @returns true si le joueur est au sol, false sinon
 */
export function isPlayerOnGround(
  playerEntity: DefaultPlayerEntity,
  world: World
): boolean {
  const playerPosition = playerEntity.position;
  const raycastOrigin = {
    x: playerPosition.x,
    y: playerPosition.y - 0.5,
    z: playerPosition.z,
  };
  const raycastDirection = { x: 0, y: -1, z: 0 };
  const raycastDistance = 1.0;

  const raycastResult = world.simulation.raycast(
    raycastOrigin,
    raycastDirection,
    raycastDistance,
    {
      filterExcludeRigidBody: playerEntity.rawRigidBody,
    }
  );

  return (
    raycastResult?.hitBlock !== undefined ||
    raycastResult?.hitEntity !== undefined
  );
}

/**
 * Calcule la force de saut en fonction de la durée de maintien du bouton
 * @param holdDuration - Durée en millisecondes pendant laquelle le bouton a été maintenu
 * @returns La force de saut calculée
 */
export function calculateJumpForce(holdDuration: number): number {
  const normalizedDuration = Math.min(
    holdDuration / JUMP_CONFIG.maxHoldDuration,
    1
  );
  return (
    JUMP_CONFIG.minJumpForce +
    normalizedDuration * (JUMP_CONFIG.maxJumpForce - JUMP_CONFIG.minJumpForce)
  );
}

