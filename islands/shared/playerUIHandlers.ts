// Gestionnaires d'événements UI pour les joueurs
import {
  Player,
  World,
  PlayerUIEvent,
  DefaultPlayerEntity,
  SceneUI,
  Audio,
  ParticleEmitter,
} from "hytopia";
import { IslandWorldManager } from "../worldManager";
import { ParticleManager } from "../../particles/particleManager";
import type { ParticleType } from "../../particles/particleManager";
import { purchaseParticle, ownsParticle } from "./particlePurchase";
import { hasUnlockedIsland } from "./coin";
import type { PlayerCoinData } from "./types";

/**
 * Interface pour les dépendances nécessaires aux handlers UI
 */
export interface PlayerUIHandlersDependencies {
  islandWorldManager: IslandWorldManager;
  playerEntitiesByWorld: Map<World, Map<string, DefaultPlayerEntity>>;
  playerParticleEmitters: Map<string, ParticleEmitter>;
  islandMapMapping: Record<string, any>;
}

/**
 * Vérifie si le joueur est au sol
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde où vérifier
 * @returns true si le joueur est au sol
 */
function isPlayerOnGround(
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
 * Gère la sélection d'île par le joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param islandId - L'ID de l'île sélectionnée
 * @param deps - Les dépendances nécessaires
 */
function handleSelectIsland(
  player: Player,
  world: World,
  islandId: string,
  deps: PlayerUIHandlersDependencies
): void {
  if (!deps.islandMapMapping[islandId]) {
    return;
  }

  // Vérifie si l'île est déverrouillée
  if (!hasUnlockedIsland(player, islandId)) {
    // L'île est verrouillée, envoie un message d'erreur au joueur
    world.chatManager.sendPlayerMessage(
      player,
      `🔒 Cette île est verrouillée ! Vous devez collecter le dernier coin de l'île précédente pour y accéder.`,
      "FF0000"
    );
    return;
  }

  const currentData = player.getPersistedData() as PlayerCoinData;
  player.setPersistedData({
    ...currentData,
    selectedIsland: islandId,
  } as Record<string, unknown>);

  // Récupère le monde correspondant à l'île sélectionnée
  const targetWorld = deps.islandWorldManager.getWorldForIsland(islandId);
  if (targetWorld) {
    // Fait rejoindre le joueur au monde de l'île sélectionnée
    // Cela déclenchera LEFT_WORLD sur le monde actuel et JOINED_WORLD sur le nouveau monde
    player.joinWorld(targetWorld);

    // Envoie un message au joueur
    // Le message sera envoyé dans le nouveau monde après le changement
    // On utilise un setTimeout pour s'assurer que le joueur est dans le nouveau monde
    setTimeout(() => {
      const newWorld = deps.islandWorldManager.getWorldForIsland(islandId);
      if (newWorld) {
        newWorld.chatManager.sendPlayerMessage(
          player,
          `Vous avez rejoint ${islandId}!`,
          "00FF00"
        );
      }
    }, 100);
  }
}

/**
 * Gère la sélection/achat de particule par le joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param particleId - L'ID de la particule sélectionnée
 * @param deps - Les dépendances nécessaires
 */
function handleSelectParticle(
  player: Player,
  world: World,
  particleId: string,
  deps: PlayerUIHandlersDependencies
): void {
  if (!ParticleManager.isValidParticleType(particleId)) {
    return;
  }

  // Vérifie si le joueur possède déjà la particule
  const alreadyOwned = ownsParticle(player, particleId);

  // Si la particule n'est pas possédée, tente de l'acheter
  if (!alreadyOwned) {
    const purchaseSuccess = purchaseParticle(player, world, particleId);
    if (!purchaseSuccess) {
      // L'achat a échoué (pas assez d'or)
      world.chatManager.sendPlayerMessage(
        player,
        "Il vous manque de l'OR",
        "FF0000"
      );
      return; // Arrête ici, ne sélectionne pas la particule
    }
  }

  // La particule est maintenant possédée (soit elle l'était déjà, soit l'achat a réussi)
  // Sauvegarde la particule sélectionnée dans les données persistées du joueur
  const currentData = player.getPersistedData() as PlayerCoinData;
  player.setPersistedData({
    ...currentData,
    selectedParticle: particleId,
  } as Record<string, unknown>);

  // Récupère d'abord l'entité du joueur dans le monde actuel
  const worldPlayerMap = deps.playerEntitiesByWorld.get(world);
  const playerEntity = worldPlayerMap?.get(player.id);

  // Ne procède que si l'entité du joueur existe
  if (playerEntity) {
    // Récupère l'émetteur de particules actuel du joueur
    const currentEmitter = deps.playerParticleEmitters.get(player.id);
    if (currentEmitter) {
      // Détruit l'ancien émetteur de particules
      currentEmitter.despawn();
      deps.playerParticleEmitters.delete(player.id);
    }

    // Crée un nouvel émetteur de particules avec le type sélectionné
    const newEmitter = ParticleManager.createParticleEmitter(
      particleId as ParticleType,
      playerEntity,
      world
    );
    deps.playerParticleEmitters.set(player.id, newEmitter);

    // Envoie un message de confirmation au joueur
    world.chatManager.sendPlayerMessage(
      player,
      `Particule "${particleId}" appliquée !`,
      "00FF00"
    );
  }
}

/**
 * Gère les événements de saut (jump-held et jump-charge-update)
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde actuel
 * @param jumpChargeSceneUI - La SceneUI de la barre de charge
 * @param data - Les données de l'événement
 */
function handleJumpEvents(
  playerEntity: DefaultPlayerEntity,
  world: World,
  jumpChargeSceneUI: SceneUI,
  data: any
): void {
  if (data.type === "jump-held") {
    // Vérifie si le joueur est au sol avant de permettre le saut
    if (!isPlayerOnGround(playerEntity, world)) {
      jumpChargeSceneUI.setState({ progress: 0, visible: false });
      return;
    }

    const duration = data.duration || 0;

    // Configuration du saut
    const minJumpForce = 10;
    const maxJumpForce = 50;
    const maxHoldDuration = 1000;

    const normalizedDuration = Math.min(duration / maxHoldDuration, 1);
    const jumpForce =
      minJumpForce + normalizedDuration * (maxJumpForce - minJumpForce);

    playerEntity.applyImpulse({ x: 0, y: jumpForce, z: 0 });

    // Joue le son de saut attaché au joueur
    new Audio({
      uri: "audio/sfx/cartoon-jump.mp3",
      loop: false,
      volume: 0.5,
      attachedToEntity: playerEntity,
    }).play(world);

    jumpChargeSceneUI.setState({ progress: 0, visible: false });
  } else if (data.type === "jump-charge-update") {
    jumpChargeSceneUI.setState({
      progress: data.progress || 0,
      visible: data.visible || false,
    });
  }
}

/**
 * Configure tous les handlers d'événements UI pour un joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param playerEntity - L'entité du joueur
 * @param jumpChargeSceneUI - La SceneUI de la barre de charge
 * @param deps - Les dépendances nécessaires
 */
export function setupPlayerUIHandlers(
  player: Player,
  world: World,
  playerEntity: DefaultPlayerEntity,
  jumpChargeSceneUI: SceneUI,
  deps: PlayerUIHandlersDependencies
): void {
  // Écoute les messages de l'UI
  player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
    if (data.type === "select-island") {
      const islandId = data.islandId as string;
      if (islandId) {
        handleSelectIsland(player, world, islandId, deps);
      }
      return;
    }

    if (data.type === "select-particle") {
      const particleId = data.particleId as string;
      if (particleId) {
        handleSelectParticle(player, world, particleId, deps);
      }
      return;
    }

    if (data.type === "jump-held" || data.type === "jump-charge-update") {
      handleJumpEvents(playerEntity, world, jumpChargeSceneUI, data);
    }
  });
}

