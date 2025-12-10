// Logique d'initialisation des joueurs dans les mondes d'îles
import {
  Player,
  World,
  DefaultPlayerEntity,
  CollisionGroup,
  ParticleEmitter,
  SceneUI,
  type WorldMap,
} from "hytopia";
import { IslandManager } from "../islandManager";
import { IslandWorldManager } from "../worldManager";
import { ParticleManager } from "../../particles/particleManager";
import type { ParticleType } from "../../particles/particleManager";
import { mergeDefaultParticles } from "./particlePurchase";
import { hasUnlockedIsland } from "./coin";
import type { PlayerCoinData } from "./types";

/**
 * Interface pour les dépendances nécessaires à l'initialisation du joueur
 */
export interface PlayerInitializationDependencies {
  islandWorldManager: IslandWorldManager;
  playerEntitiesByWorld: Map<World, Map<string, DefaultPlayerEntity>>;
  playerParticleEmitters: Map<string, ParticleEmitter>;
  islandMapMapping: Record<string, WorldMap>;
}

/**
 * Initialise les données persistées du joueur
 * @param player - Le joueur à initialiser
 * @returns Les données persistées initialisées
 */
export function initializePlayerData(player: Player): PlayerCoinData {
  const existingData = player.getPersistedData() as PlayerCoinData | undefined;

  // S'assure que les particules par défaut sont toujours incluses
  const ownedParticles = mergeDefaultParticles(existingData?.ownedParticles);

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
  return playerData;
}

/**
 * Détermine l'ID de l'île correspondant à un monde
 * @param world - Le monde pour lequel trouver l'ID de l'île
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 * @returns L'ID de l'île ou "island1" par défaut
 */
export function getIslandIdForWorld(
  world: World,
  islandWorldManager: IslandWorldManager
): string {
  let islandId = "island1"; // Par défaut
  islandWorldManager.getAvailableIslandIds().forEach((id) => {
    if (islandWorldManager.getWorldForIsland(id) === world) {
      islandId = id;
    }
  });
  return islandId;
}

/**
 * Crée l'entité du joueur dans le monde
 * @param player - Le joueur
 * @param world - Le monde où créer l'entité
 * @param islandManager - Le gestionnaire d'îles
 * @param islandId - L'ID de l'île
 * @param playerEntitiesByWorld - Map pour stocker les entités par monde
 * @returns L'entité du joueur créée
 */
export function createPlayerEntity(
  player: Player,
  world: World,
  islandManager: IslandManager,
  islandId: string,
  playerEntitiesByWorld: Map<World, Map<string, DefaultPlayerEntity>>
): DefaultPlayerEntity {
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
  if (!playerEntitiesByWorld.has(world)) {
    playerEntitiesByWorld.set(world, new Map());
  }
  const worldPlayerMap = playerEntitiesByWorld.get(world)!;
  worldPlayerMap.set(player.id, playerEntity);

  return playerEntity;
}

/**
 * Configure les particules du joueur
 * @param player - Le joueur
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde où créer les particules
 * @param playerData - Les données persistées du joueur
 * @param playerParticleEmitters - Map pour stocker les émetteurs de particules
 * @returns L'émetteur de particules créé
 */
export function setupPlayerParticles(
  player: Player,
  playerEntity: DefaultPlayerEntity,
  world: World,
  playerData: PlayerCoinData,
  playerParticleEmitters: Map<string, ParticleEmitter>
): ParticleEmitter {
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
  playerParticleEmitters.set(player.id, playerParticleEmitter);

  return playerParticleEmitter;
}

/**
 * Configure les groupes de collision pour l'entité du joueur
 * @param playerEntity - L'entité du joueur
 */
export function setupPlayerCollisions(playerEntity: DefaultPlayerEntity): void {
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
}

/**
 * Configure l'UI du joueur et envoie les données initiales
 * @param player - Le joueur
 */
export function setupPlayerUI(player: Player): void {
  // Charge l'UI du jeu pour ce joueur
  player.ui.load("ui/index.html");

  // Envoie l'or initial du joueur et les particules possédées à l'UI
  setTimeout(async () => {
    const playerData = player.getPersistedData() as PlayerCoinData | undefined;
    const gold = playerData?.gold ?? 0;
    // S'assure que les particules par défaut sont toujours incluses
    const ownedParticles = mergeDefaultParticles(playerData?.ownedParticles);
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
}

/**
 * Configure la barre de charge de saut au-dessus du joueur
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde où créer la barre
 * @returns La SceneUI de la barre de charge
 */
export function setupJumpChargeBar(
  playerEntity: DefaultPlayerEntity,
  world: World
): SceneUI {
  // Crée une Scene UI pour la barre de charge verticale au-dessus du joueur
  const jumpChargeSceneUI = new SceneUI({
    templateId: "jump-charge-bar",
    attachedToEntity: playerEntity,
    state: { progress: 0, visible: false },
    offset: { x: 0, y: 1.8, z: 0 },
    viewDistance: 6,
  });

  jumpChargeSceneUI.load(world);
  return jumpChargeSceneUI;
}

/**
 * Envoie les messages de bienvenue au joueur
 * @param player - Le joueur
 * @param world - Le monde où envoyer les messages
 */
export function sendWelcomeMessages(player: Player, world: World): void {
  // Messages de bienvenue
  world.chatManager.sendPlayerMessage(player, "Welcome to the game!", "00FF00");
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
 * Initialise un joueur dans un monde donné
 * Cette fonction orchestre toutes les étapes d'initialisation
 * @param player - Le joueur à initialiser
 * @param world - Le monde où initialiser le joueur
 * @param islandManager - Le gestionnaire d'îles
 * @param deps - Les dépendances nécessaires à l'initialisation
 * @returns Un objet contenant l'entité du joueur et la barre de charge de saut
 */
export function initializePlayerInWorld(
  player: Player,
  world: World,
  islandManager: IslandManager,
  deps: PlayerInitializationDependencies
): {
  playerEntity: DefaultPlayerEntity;
  jumpChargeSceneUI: SceneUI;
} {
  // Initialise les données persistées
  const playerData = initializePlayerData(player);

  // Détermine l'ID de l'île pour ce monde
  const islandId = getIslandIdForWorld(world, deps.islandWorldManager);

  // Crée l'entité du joueur
  const playerEntity = createPlayerEntity(
    player,
    world,
    islandManager,
    islandId,
    deps.playerEntitiesByWorld
  );

  // Configure les particules
  setupPlayerParticles(
    player,
    playerEntity,
    world,
    playerData,
    deps.playerParticleEmitters
  );

  // Configure les collisions
  setupPlayerCollisions(playerEntity);

  // Configure l'UI
  setupPlayerUI(player);

  // Configure la barre de charge de saut
  const jumpChargeSceneUI = setupJumpChargeBar(playerEntity, world);

  // Envoie les messages de bienvenue
  sendWelcomeMessages(player, world);

  return {
    playerEntity,
    jumpChargeSceneUI,
  };
}
