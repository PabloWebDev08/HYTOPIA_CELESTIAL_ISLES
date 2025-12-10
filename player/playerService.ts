/**
 * Service centralisé pour la gestion des joueurs
 * Gère les entités de joueurs, les particules, et l'état des joueurs
 */

import {
  DefaultPlayerEntity,
  Player,
  World,
  CollisionGroup,
  ParticleEmitter,
  SceneUI,
} from "hytopia";
import { IslandManager } from "../islands/islandManager";
import { IslandWorldManager } from "../islands/worldManager";
import { ParticleManager } from "../particles/particleManager";
import type { ParticleType } from "../particles/particleManager";
import { DEFAULT_PARTICLES } from "../islands/shared/particlePurchase";
import { hasUnlockedIsland } from "../islands/shared/coin";
import type { PlayerCoinData } from "../types/player";
import { JUMP_CONFIG } from "./jumpHandler";

/**
 * Service pour gérer les joueurs et leurs entités
 */
export class PlayerService {
  // Map pour tracker les entités de joueurs par monde et par ID de joueur
  // Structure: Map<World, Map<playerId, DefaultPlayerEntity>>
  private playerEntitiesByWorld = new Map<
    World,
    Map<string, DefaultPlayerEntity>
  >();

  // Map pour tracker les émetteurs de particules par joueur
  // Structure: Map<playerId, ParticleEmitter>
  private playerParticleEmitters = new Map<string, ParticleEmitter>();

  // Map pour tracker les SceneUI de jump charge par joueur
  // Structure: Map<playerId, SceneUI>
  private jumpChargeSceneUIs = new Map<string, SceneUI>();

  /**
   * Initialise un joueur dans un monde donné
   * @param player - Le joueur à initialiser
   * @param world - Le monde où initialiser le joueur
   * @param islandManager - Le gestionnaire d'îles pour ce monde
   * @param islandWorldManager - Le gestionnaire de mondes d'îles
   */
  initializePlayerInWorld(
    player: Player,
    world: World,
    islandManager: IslandManager,
    islandWorldManager: IslandWorldManager
  ): void {
    // Initialise les données persistées pour les nouveaux joueurs
    const existingData = player.getPersistedData() as
      | PlayerCoinData
      | undefined;

    // S'assure que les particules par défaut sont toujours incluses
    const existingOwnedParticles = existingData?.ownedParticles || [];
    const ownedParticles = [
      ...new Set([...DEFAULT_PARTICLES, ...existingOwnedParticles]),
    ];

    const playerData: PlayerCoinData = {
      gold: existingData?.gold ?? 0,
      collectedCoins: existingData?.collectedCoins ?? [],
      selectedIsland: existingData?.selectedIsland ?? "island1",
      selectedParticle:
        existingData?.selectedParticle ??
        ParticleManager.getDefaultParticleType(),
      ownedParticles: ownedParticles,
    };
    player.setPersistedData(playerData as Record<string, unknown>);

    // Détermine quelle île utiliser pour ce monde
    let islandId = "island1"; // Par défaut
    islandWorldManager.getAvailableIslandIds().forEach((id) => {
      if (islandWorldManager.getWorldForIsland(id) === world) {
        islandId = id;
      }
    });

    // Charge l'île dans le gestionnaire d'îles
    islandManager.loadIsland(islandId);
    const currentIsland = islandManager.getCurrentIsland()!;

    // Crée l'entité du joueur
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: "Player",
    });

    // Utilise la position de départ de l'île
    const startPos = currentIsland.getStartPosition();
    playerEntity.spawn(world, startPos);

    // Initialise la Map pour ce monde si elle n'existe pas
    if (!this.playerEntitiesByWorld.has(world)) {
      this.playerEntitiesByWorld.set(world, new Map());
    }
    const worldPlayerMap = this.playerEntitiesByWorld.get(world)!;
    worldPlayerMap.set(player.id, playerEntity);

    // Crée un émetteur de particules attaché au joueur selon sa sélection
    const selectedParticleType = ParticleManager.isValidParticleType(
      playerData.selectedParticle!
    )
      ? (playerData.selectedParticle! as ParticleType)
      : ParticleManager.getDefaultParticleType();

    const playerParticleEmitter = ParticleManager.createParticleEmitter(
      selectedParticleType,
      playerEntity,
      world
    );

    // Stocke la référence à l'émetteur de particules pour ce joueur
    this.playerParticleEmitters.set(player.id, playerParticleEmitter);

    // Configure les groupes de collision
    playerEntity.setCollisionGroupsForSolidColliders({
      belongsTo: [CollisionGroup.PLAYER],
      collidesWith: [
        CollisionGroup.BLOCK,
        CollisionGroup.ENTITY,
        CollisionGroup.ENTITY_SENSOR,
        CollisionGroup.ENVIRONMENT_ENTITY,
      ],
    });

    playerEntity.setCollisionGroupsForSensorColliders({
      belongsTo: [CollisionGroup.ENTITY_SENSOR],
      collidesWith: [
        CollisionGroup.BLOCK,
        CollisionGroup.ENTITY,
        CollisionGroup.ENVIRONMENT_ENTITY,
      ],
    });

    // Charge l'UI du jeu pour ce joueur
    player.ui.load("ui/index.html");

    // Envoie l'or initial du joueur et les particules possédées à l'UI
    setTimeout(async () => {
      const playerData = player.getPersistedData() as
        | PlayerCoinData
        | undefined;
      const gold = playerData?.gold ?? 0;
      // S'assure que les particules par défaut sont toujours incluses
      const existingOwnedParticles = playerData?.ownedParticles || [];
      const ownedParticles = [
        ...new Set([...DEFAULT_PARTICLES, ...existingOwnedParticles]),
      ];
      player.ui.sendData({
        type: "gold-update",
        gold: gold,
      });
      player.ui.sendData({
        type: "owned-particles-update",
        ownedParticles: ownedParticles,
      });

      // Envoie l'état de déverrouillage des îles à l'UI
      const islandsStatus = {
        island1: { unlocked: true }, // L'île 1 est toujours accessible
        island2: { unlocked: hasUnlockedIsland(player, "island2") },
        island3: { unlocked: hasUnlockedIsland(player, "island3") },
      };
      player.ui.sendData({
        type: "islands-unlock-status",
        islands: islandsStatus,
      });
    }, 100);

    // Crée une Scene UI pour la barre de charge verticale au-dessus du joueur
    const jumpChargeSceneUI = new SceneUI({
      templateId: "jump-charge-bar",
      attachedToEntity: playerEntity,
      state: { progress: 0, visible: false },
      offset: { x: 0, y: 1.8, z: 0 },
      viewDistance: 6,
    });

    jumpChargeSceneUI.load(world);
    this.jumpChargeSceneUIs.set(player.id, jumpChargeSceneUI);

    // Messages de bienvenue
    world.chatManager.sendPlayerMessage(
      player,
      "Welcome to the game!",
      "00FF00"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Use WASD to move around & space to jump."
    );
    world.chatManager.sendPlayerMessage(player, "Hold shift to sprint.");
    world.chatManager.sendPlayerMessage(
      player,
      "Hold jump button longer to jump higher!",
      "FFFF00"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Random cosmetic items are enabled for testing!"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Press \\ to enter or exit debug view."
    );
  }

  /**
   * Nettoie les ressources d'un joueur lorsqu'il quitte un monde
   * @param player - Le joueur qui quitte
   * @param world - Le monde qu'il quitte
   */
  cleanupPlayer(player: Player, world: World): void {
    // Nettoie les entités du joueur
    world.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach((entity) => entity.despawn());

    // Supprime l'entité du joueur de la Map
    const worldPlayerMap = this.playerEntitiesByWorld.get(world);
    if (worldPlayerMap) {
      worldPlayerMap.delete(player.id);
    }

    // Nettoie l'émetteur de particules du joueur
    const particleEmitter = this.playerParticleEmitters.get(player.id);
    if (particleEmitter) {
      particleEmitter.despawn();
      this.playerParticleEmitters.delete(player.id);
    }

    // Nettoie la SceneUI de jump charge
    const jumpChargeSceneUI = this.jumpChargeSceneUIs.get(player.id);
    if (jumpChargeSceneUI) {
      // Note: SceneUI n'a pas de méthode despawn explicite, mais elle sera nettoyée automatiquement
      this.jumpChargeSceneUIs.delete(player.id);
    }
  }

  /**
   * Récupère l'entité d'un joueur dans un monde donné
   * @param player - Le joueur
   * @param world - Le monde
   * @returns L'entité du joueur ou undefined si introuvable
   */
  getPlayerEntity(player: Player, world: World): DefaultPlayerEntity | undefined {
    const worldPlayerMap = this.playerEntitiesByWorld.get(world);
    return worldPlayerMap?.get(player.id);
  }

  /**
   * Récupère l'émetteur de particules d'un joueur
   * @param playerId - L'ID du joueur
   * @returns L'émetteur de particules ou undefined si introuvable
   */
  getParticleEmitter(playerId: string): ParticleEmitter | undefined {
    return this.playerParticleEmitters.get(playerId);
  }

  /**
   * Met à jour l'émetteur de particules d'un joueur
   * @param playerId - L'ID du joueur
   * @param emitter - Le nouvel émetteur de particules
   */
  setParticleEmitter(playerId: string, emitter: ParticleEmitter): void {
    // Nettoie l'ancien émetteur s'il existe
    const oldEmitter = this.playerParticleEmitters.get(playerId);
    if (oldEmitter) {
      oldEmitter.despawn();
    }
    this.playerParticleEmitters.set(playerId, emitter);
  }

  /**
   * Récupère la SceneUI de jump charge d'un joueur
   * @param playerId - L'ID du joueur
   * @returns La SceneUI ou undefined si introuvable
   */
  getJumpChargeSceneUI(playerId: string): SceneUI | undefined {
    return this.jumpChargeSceneUIs.get(playerId);
  }

  /**
   * Récupère toutes les entités de joueurs dans un monde donné
   * @param world - Le monde
   * @returns Map des entités de joueurs (playerId -> DefaultPlayerEntity)
   */
  getPlayerEntitiesInWorld(
    world: World
  ): Map<string, DefaultPlayerEntity> | undefined {
    return this.playerEntitiesByWorld.get(world);
  }

  /**
   * Vérifie périodiquement la position Y des joueurs et les repositionne s'ils tombent
   * @param islandWorldManager - Le gestionnaire de mondes d'îles
   */
  checkAndRepositionFallenPlayers(
    islandWorldManager: IslandWorldManager
  ): void {
    // Parcourt tous les mondes d'îles
    islandWorldManager.getAllWorlds().forEach((islandWorld) => {
      // Trouve l'ID de l'île correspondant à ce monde
      let islandId = "";
      islandWorldManager.getAvailableIslandIds().forEach((id) => {
        if (islandWorldManager.getWorldForIsland(id) === islandWorld) {
          islandId = id;
        }
      });

      // Récupère le gestionnaire d'îles pour ce monde
      const islandManager =
        islandWorldManager.getIslandManagerForIsland(islandId);
      if (!islandManager) return;

      const currentIsland = islandManager.getCurrentIsland();
      if (!currentIsland) return;

      // Récupère la position de départ de l'île
      const startPosition = currentIsland.getStartPosition();

      // Parcourt tous les joueurs dans ce monde
      const worldPlayerMap = this.playerEntitiesByWorld.get(islandWorld);
      if (!worldPlayerMap) return;

      worldPlayerMap.forEach((playerEntity) => {
        // Vérifie si le joueur est en dessous du seuil de chute
        if (playerEntity.position.y < JUMP_CONFIG.fallThreshold) {
          // Repositionne le joueur au point de départ de l'île
          playerEntity.setPosition(startPosition);
        }
      });
    });
  }
}

