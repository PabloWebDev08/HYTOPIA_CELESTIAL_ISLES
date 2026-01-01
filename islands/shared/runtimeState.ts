// runtimeState.ts
// Helpers centralisés pour stocker de l'état runtime sans écrire de propriétés "privées" sur les objets du SDK.
// Objectif: éviter les `(world as any)._xxx` et `(entity as any)._xxx`, plus fragile lors des updates SDK.
//
// NOTE:
// - On utilise des WeakMap pour ne pas empêcher le GC (garbage collector) de libérer les objets.
// - Ces helpers n'ajoutent aucune dépendance externe et ne changent pas le gameplay.

import { Entity, Quaternion, World } from "hytopia";
import type { Position } from "./types";

/**
 * ----------------------------
 * 1) Workaround: suppression temporaire des updates kinematic
 * ----------------------------
 *
 * Contexte:
 * - Lors d'un `Player.joinWorld()`, le client se reconnecte.
 * - Pendant un court instant, il peut recevoir des updates kinematic AVANT les SPAWN d'entités,
 *   ce qui génère des erreurs côté client ("Entity X not created ...").
 *
 * Avant: on écrivait `(world as any)._suppressKinematicUpdatesUntilMs = ...`
 * Maintenant: on stocke cet état dans une WeakMap.
 */
const suppressKinematicUpdatesUntilMsByWorld = new WeakMap<World, number>();

export function requestKinematicUpdateSuppression(
  world: World,
  durationMs: number
): void {
  const safeDurationMs = Math.max(0, durationMs);
  suppressKinematicUpdatesUntilMsByWorld.set(
    world,
    Date.now() + safeDurationMs
  );
}

export function isKinematicUpdateSuppressed(world: World): boolean {
  const untilMs = suppressKinematicUpdatesUntilMsByWorld.get(world);
  return typeof untilMs === "number" && Date.now() < untilMs;
}

/**
 * ----------------------------
 * 1b) Message "post-joinWorld" (sans setTimeout)
 * ----------------------------
 *
 * Objectif: afficher un message dans le nouveau monde après `player.joinWorld(...)`.
 * Au lieu d'attendre avec un timer, on stocke une intention côté serveur, consommée
 * dans le handler `PlayerEvent.JOINED_WORLD`.
 */
const pendingIslandJoinMessageByPlayerId = new Map<string, string>();

export function setPendingIslandJoinMessage(
  playerId: string,
  islandId: string
): void {
  pendingIslandJoinMessageByPlayerId.set(playerId, islandId);
}

export function consumePendingIslandJoinMessage(
  playerId: string
): string | undefined {
  const pending = pendingIslandJoinMessageByPlayerId.get(playerId);
  if (pending) {
    pendingIslandJoinMessageByPlayerId.delete(playerId);
  }
  return pending;
}

export type CoinRuntimeMeta = {
  coinId: string;
  islandId: string;
  lastCoinId: string | null;
  position: Position;
  rotation?: Quaternion;
  world: World;
};

const coinMetaByEntity = new WeakMap<Entity, CoinRuntimeMeta>();

export function setCoinRuntimeMeta(
  entity: Entity,
  meta: CoinRuntimeMeta
): void {
  coinMetaByEntity.set(entity, meta);
}

export function getCoinRuntimeMeta(
  entity: Entity
): CoinRuntimeMeta | undefined {
  return coinMetaByEntity.get(entity);
}

/**
 * ----------------------------
 * 3) Métadonnées runtime: Spinning saw
 * ----------------------------
 */
export type SpinningSawRuntimeMeta = {
  startPosition: Position;
  world: World;
};

const spinningSawMetaByEntity = new WeakMap<Entity, SpinningSawRuntimeMeta>();

export function setSpinningSawRuntimeMeta(
  entity: Entity,
  meta: SpinningSawRuntimeMeta
): void {
  spinningSawMetaByEntity.set(entity, meta);
}

export function getSpinningSawRuntimeMeta(
  entity: Entity
): SpinningSawRuntimeMeta | undefined {
  return spinningSawMetaByEntity.get(entity);
}
