/**
 * HYTOPIA SDK Boilerplate
 *
 * This is a simple boilerplate to get started on your project.
 * It implements the bare minimum to be able to run and connect
 * to your game server and run around as the basic player entity.
 *
 * From here you can begin to implement your own game logic
 * or do whatever you want!
 *
 * You can find documentation here: https://github.com/hytopiagg/sdk/blob/main/docs/server.md
 *
 * For more in-depth examples, check out the examples folder in the SDK, or you
 * can find it directly on GitHub: https://github.com/hytopiagg/sdk/tree/main/examples/payload-game
 *
 * You can officially report bugs or request features here: https://github.com/hytopiagg/sdk/issues
 *
 * To get help, have found a bug, or want to chat with
 * other HYTOPIA devs, join our Discord server:
 * https://discord.gg/DXCXJbHSJX
 *
 * Official SDK Github repo: https://github.com/hytopiagg/sdk
 * Official SDK NPM Package: https://www.npmjs.com/package/hytopia
 */

import {
  startServer,
  Audio,
  DefaultPlayerEntity,
  PlayerEvent,
  PlayerUIEvent,
  SceneUI,
  CollisionGroup,
  ParticleEmitter,
  PersistenceManager,
  WorldManager,
  PlayerManager,
  World,
  Player,
} from "hytopia";

import island1Map from "./assets/map_island_1.json";
import island2Map from "./assets/map_island_2.json";
import island3Map from "./assets/map_island_3.json";
import { getLeaderboard } from "./islands/shared/coin";
import { IslandManager } from "./islands/islandManager";
import { IslandWorldManager } from "./islands/worldManager";
// Import des fonctions de mise à jour du leaderboard pour chaque île
import { updateAllSkeletonSoldiersLeaderboard as updateIsland1Leaderboard } from "./islands/island1/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland2Leaderboard } from "./islands/island2/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland3Leaderboard } from "./islands/island3/welcomeNPCS";
import { ParticleManager } from "./particles/particleManager";
import type { ParticleType } from "./particles/particleManager";
import {
  purchaseParticle,
  ownsParticle,
  DEFAULT_PARTICLES,
} from "./islands/shared/particlePurchase";

/**
 * Interface pour les données persistées du joueur concernant les coins
 */
interface PlayerCoinData {
  gold?: number;
  collectedCoins?: string[];
  selectedIsland?: string; // Île sélectionnée par le joueur
  selectedParticle?: string; // Particule sélectionnée par le joueur
  ownedParticles?: string[]; // Particules possédées par le joueur
}

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 */
const islandMapMapping: Record<string, any> = {
  island1: island1Map,
  island2: island2Map,
  island3: island3Map,
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * Mapping entre les IDs d'îles et leurs fonctions de mise à jour du leaderboard
 * Utilise un mapping statique pour éviter les problèmes d'import dynamique
 */
const islandLeaderboardUpdaters: Record<
  string,
  (leaderboard: Array<{ playerName: string; timestamp: number }>) => void
> = {
  island1: updateIsland1Leaderboard,
  island2: updateIsland2Leaderboard,
  island3: updateIsland3Leaderboard,
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * startServer is always the entry point for our game.
 * It accepts a single function where we should do any
 * setup necessary for our game. The init function is
 * passed a World instance which is the default
 * world created by the game server on startup.
 *
 * Documentation: https://github.com/hytopiagg/sdk/blob/main/docs/server.startserver.md
 */

startServer((defaultWorld) => {
  /**
   * Note: Le paramètre defaultWorld n'est plus utilisé dans cette architecture.
   * Tous les joueurs sont maintenant redirigés vers les mondes d'îles créés
   * par IslandWorldManager via le worldSelectionHandler.
   */

  /**
   * Enable debug rendering of the physics simulation.
   * This will overlay lines in-game representing colliders,
   * rigid bodies, and raycasts. This is useful for debugging
   * physics-related issues in a development environment.
   * Enabling this can cause performance issues, which will
   * be noticed as dropped frame rates and higher RTT times.
   * It is intended for development environments only and
   * debugging physics.
   */

  // Crée le gestionnaire de mondes d'îles et initialise tous les mondes
  // Tous les mondes d'îles sont créés ici, y compris island1
  const islandWorldManager = new IslandWorldManager(islandMapMapping);
  islandWorldManager.initializeWorlds();

  // Pour activer le debug rendering sur un monde d'île spécifique:
  // const island3World = islandWorldManager.getWorldForIsland("island3");
  // island3World?.simulation.enableDebugRendering(true);

  // Configure le handler pour rediriger automatiquement les nouveaux joueurs vers island1
  // Les joueurs ne rejoindront plus le defaultWorld mais directement le monde de island1
  PlayerManager.instance.worldSelectionHandler = async (player: Player) => {
    const island1World = islandWorldManager.getWorldForIsland("island1");
    return island1World || undefined;
  };

  // Map pour tracker les entités de joueurs par monde et par ID de joueur
  // Structure: Map<World, Map<playerId, DefaultPlayerEntity>>
  const playerEntitiesByWorld = new Map<
    World,
    Map<string, DefaultPlayerEntity>
  >();

  // Map pour tracker les émetteurs de particules par joueur
  // Structure: Map<playerId, ParticleEmitter>
  const playerParticleEmitters = new Map<string, ParticleEmitter>();

  /**
   * Fonction helper pour initialiser un joueur dans un monde donné
   * Cette fonction est utilisée pour tous les mondes d'îles gérés par islandWorldManager
   */
  const initializePlayerInWorld = (
    player: Player,
    world: World,
    islandManager: IslandManager
  ): void => {
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
    // Tous les mondes sont maintenant gérés par islandWorldManager
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
    if (!playerEntitiesByWorld.has(world)) {
      playerEntitiesByWorld.set(world, new Map());
    }
    const worldPlayerMap = playerEntitiesByWorld.get(world)!;
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
    playerParticleEmitters.set(player.id, playerParticleEmitter);

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

    // Fonction helper pour vérifier si le joueur est au sol
    const isPlayerOnGround = (): boolean => {
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
    };

    // Écoute les messages de l'UI concernant la sélection de map
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      if (data.type === "select-island") {
        // Sauvegarde l'île sélectionnée dans les données persistées du joueur
        const islandId = data.islandId as string;
        if (islandId && islandMapMapping[islandId]) {
          const currentData = player.getPersistedData() as PlayerCoinData;
          player.setPersistedData({
            ...currentData,
            selectedIsland: islandId,
          } as Record<string, unknown>);

          // Récupère le monde correspondant à l'île sélectionnée
          const targetWorld = islandWorldManager.getWorldForIsland(islandId);
          if (targetWorld) {
            // Fait rejoindre le joueur au monde de l'île sélectionnée
            // Cela déclenchera LEFT_WORLD sur le monde actuel et JOINED_WORLD sur le nouveau monde
            player.joinWorld(targetWorld);

            // Envoie un message au joueur
            // Le message sera envoyé dans le nouveau monde après le changement
            // On utilise un setTimeout pour s'assurer que le joueur est dans le nouveau monde
            setTimeout(() => {
              const newWorld = islandWorldManager.getWorldForIsland(islandId);
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
        return;
      }

      if (data.type === "select-particle") {
        // Gère la sélection/achat de particule
        const particleId = data.particleId as string;
        if (particleId && ParticleManager.isValidParticleType(particleId)) {
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
          const worldPlayerMap = playerEntitiesByWorld.get(world);
          const playerEntity = worldPlayerMap?.get(player.id);

          // Ne procède que si l'entité du joueur existe
          if (playerEntity) {
            // Récupère l'émetteur de particules actuel du joueur
            const currentEmitter = playerParticleEmitters.get(player.id);
            if (currentEmitter) {
              // Détruit l'ancien émetteur de particules
              currentEmitter.despawn();
              playerParticleEmitters.delete(player.id);
            }

            // Crée un nouvel émetteur de particules avec le type sélectionné
            const newEmitter = ParticleManager.createParticleEmitter(
              particleId as ParticleType,
              playerEntity,
              world
            );
            playerParticleEmitters.set(player.id, newEmitter);

            // Envoie un message de confirmation au joueur
            world.chatManager.sendPlayerMessage(
              player,
              `Particule "${particleId}" appliquée !`,
              "00FF00"
            );
          }
        }
        return;
      }

      if (data.type === "jump-held") {
        // Vérifie si le joueur est au sol avant de permettre le saut
        if (!isPlayerOnGround()) {
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
    });

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
  };

  /**
   * Configure les handlers JOINED_WORLD et LEFT_WORLD pour chaque monde d'île
   * Les joueurs rejoignent maintenant directement les mondes d'îles via worldSelectionHandler
   */
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    // Trouve l'ID de l'île correspondant à ce monde
    let islandId = "";
    islandWorldManager.getAvailableIslandIds().forEach((id) => {
      if (islandWorldManager.getWorldForIsland(id) === islandWorld) {
        islandId = id;
      }
    });

    const islandManager =
      islandWorldManager.getIslandManagerForIsland(islandId);
    if (!islandManager) return;

    // Handler JOINED_WORLD pour ce monde d'île
    islandWorld.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      initializePlayerInWorld(player, islandWorld, islandManager);
    });

    // Handler LEFT_WORLD pour ce monde d'île
    islandWorld.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      islandWorld.entityManager
        .getPlayerEntitiesByPlayer(player)
        .forEach((entity) => entity.despawn());

      const worldPlayerMap = playerEntitiesByWorld.get(islandWorld);
      if (worldPlayerMap) {
        worldPlayerMap.delete(player.id);
      }

      // Nettoie l'émetteur de particules du joueur
      const particleEmitter = playerParticleEmitters.get(player.id);
      if (particleEmitter) {
        particleEmitter.despawn();
        playerParticleEmitters.delete(player.id);
      }
    });
  });

  /**
   * Handle player leaving the game. The PlayerEvent.LEFT_WORLD
   * event is emitted to the world when a player leaves the game.
   * Because HYTOPIA is not opinionated on join and
   * leave game logic, we are responsible for cleaning
   * up the player and any entities associated with them
   * after they leave. We can easily do this by
   * getting all the known PlayerEntity instances for
   * the player who left by using our world's EntityManager
   * instance.
   *
   * The HYTOPIA SDK is heavily driven by events, you
   * can find documentation on how the event system works,
   * here: https://dev.hytopia.com/sdk-guides/events
   */
  // Note: Les handlers LEFT_WORLD sont déjà configurés ci-dessus pour chaque monde

  /**
   * Fonction helper pour obtenir le monde où se trouve un joueur
   * Tous les joueurs sont maintenant dans les mondes d'îles gérés par islandWorldManager
   */
  const getPlayerWorld = (player: Player): World | null => {
    // Vérifie chaque monde d'île
    for (const islandWorld of islandWorldManager.getAllWorlds()) {
      const islandPlayers =
        islandWorld.entityManager.getPlayerEntitiesByPlayer(player);
      if (islandPlayers.length > 0) {
        return islandWorld;
      }
    }

    return null;
  };

  /**
   * Fonction helper pour obtenir le gestionnaire d'îles pour un monde donné
   * Tous les mondes sont maintenant gérés par islandWorldManager
   */
  const getIslandManagerForWorld = (world: World): IslandManager | null => {
    // Trouve l'ID de l'île correspondant à ce monde
    for (const islandId of islandWorldManager.getAvailableIslandIds()) {
      if (islandWorldManager.getWorldForIsland(islandId) === world) {
        return islandWorldManager.getIslandManagerForIsland(islandId);
      }
    }

    return null;
  };

  /**
   * Fonction helper pour enregistrer une commande sur tous les mondes
   * Cela permet d'utiliser la commande peu importe dans quel monde se trouve le joueur
   * Tous les mondes sont maintenant gérés par islandWorldManager
   */
  const registerCommandOnAllWorlds = (
    command: string,
    handler: (player: Player, args?: string[]) => void | Promise<void>
  ): void => {
    // Enregistre la commande sur tous les mondes d'îles
    islandWorldManager.getAllWorlds().forEach((islandWorld) => {
      islandWorld.chatManager.registerCommand(command, handler);
    });
  };

  /**
   * A silly little easter egg command. When a player types
   * "/rocket" in the game, they'll get launched into the air!
   */
  registerCommandOnAllWorlds("/rocket", (player) => {
    const playerWorld = getPlayerWorld(player);
    if (playerWorld) {
      playerWorld.entityManager
        .getPlayerEntitiesByPlayer(player)
        .forEach((entity) => {
          entity.applyImpulse({ x: 0, y: 20, z: 0 });
        });
    }
  });

  /**
   * Commande pour téléporter le joueur à une plateforme spécifique
   * Usage: /teleport <platform-id>
   * Exemple: /teleport start-platform
   */
  registerCommandOnAllWorlds("/teleport", (player, args) => {
    const playerWorld = getPlayerWorld(player);
    if (!playerWorld) return;

    // Vérifie qu'un ID de plateforme a été fourni
    // args est un tableau de mots séparés par des espaces après /teleport
    if (!args || args.length === 0) {
      playerWorld.chatManager.sendPlayerMessage(
        player,
        "Usage: /teleport <platform-id>",
        "FF0000"
      );
      playerWorld.chatManager.sendPlayerMessage(
        player,
        "Exemple: /teleport start-platform",
        "FF0000"
      );
      return;
    }

    const platformId = args[0];
    const islandManager = getIslandManagerForWorld(playerWorld);
    if (!islandManager) {
      playerWorld.chatManager.sendPlayerMessage(
        player,
        "Aucune île n'est actuellement chargée.",
        "FF0000"
      );
      return;
    }

    const currentIsland = islandManager.getCurrentIsland();
    if (!currentIsland) {
      playerWorld.chatManager.sendPlayerMessage(
        player,
        "Aucune île n'est actuellement chargée.",
        "FF0000"
      );
      return;
    }

    const platformPosition = currentIsland.getPlatformPositionById(platformId);

    // Vérifie si la plateforme existe
    if (!platformPosition) {
      playerWorld.chatManager.sendPlayerMessage(
        player,
        `Plateforme avec l'ID "${platformId}" introuvable.`,
        "FF0000"
      );
      return;
    }

    // Téléporte toutes les entités du joueur à la position de la plateforme
    // On ajoute un petit offset en Y pour être au-dessus de la plateforme
    const teleportPosition = {
      x: platformPosition.x,
      y: platformPosition.y + 2, // 2 blocs au-dessus de la plateforme
      z: platformPosition.z,
    };

    playerWorld.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach((entity) => {
        entity.setPosition(teleportPosition);
      });

    playerWorld.chatManager.sendPlayerMessage(
      player,
      `Téléporté vers la plateforme "${platformId}"`,
      "00FF00"
    );
  });

  /**
   * Commande pour réinitialiser les données persistées des coins du joueur
   * Usage: /resetcoins
   */
  registerCommandOnAllWorlds("/resetcoins", async (player) => {
    const playerWorld = getPlayerWorld(player);
    if (!playerWorld) return;
    // Réinitialise les données des coins du joueur
    player.setPersistedData({
      gold: 0,
      collectedCoins: [],
    });

    // Supprime l'entrée du joueur de tous les leaderboards (toutes les îles)
    try {
      const globalData = (await PersistenceManager.instance.getGlobalData(
        "game-leaderboard"
      )) as Record<string, any> | undefined;

      if (globalData) {
        // Liste des IDs d'îles disponibles
        const islandIds = ["island1", "island2"];

        // Met à jour chaque leaderboard d'île
        for (const islandId of islandIds) {
          const leaderboardKey = `leaderboard-${islandId}`;
          const leaderboard = globalData[leaderboardKey] as
            | Array<{ playerName: string; timestamp: number }>
            | undefined;

          if (leaderboard && leaderboard.length > 0) {
            // Filtre pour retirer toutes les entrées de ce joueur
            const updatedLeaderboard = leaderboard.filter(
              (entry) => entry.playerName !== player.username
            );

            // Sauvegarde le leaderboard mis à jour
            globalData[leaderboardKey] = updatedLeaderboard;

            // Met à jour le leaderboard des skeleton soldiers de cette île
            const updateLeaderboard = islandLeaderboardUpdaters[islandId];
            if (updateLeaderboard) {
              try {
                updateLeaderboard(updatedLeaderboard);
                console.log(
                  `[ResetCoins] Leaderboard mis à jour pour ${islandId}`
                );
              } catch (error) {
                console.error(
                  `[ResetCoins] Erreur lors de la mise à jour du leaderboard pour ${islandId}:`,
                  error
                );
              }
            } else {
              console.warn(
                `[ResetCoins] Aucune fonction de mise à jour trouvée pour l'île ${islandId}`
              );
            }
          }
        }

        // Sauvegarde tous les leaderboards mis à jour
        await PersistenceManager.instance.setGlobalData(
          "game-leaderboard",
          globalData
        );
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du leaderboard:", error);
    }

    playerWorld.chatManager.sendPlayerMessage(
      player,
      "Vos données de coins et votre entrée au leaderboard ont été réinitialisées !",
      "FFD700"
    );
  });

  /**
   * Commande pour afficher le leaderboard des joueurs qui ont collecté le dernier coin
   * Usage: /leaderboard [islandId]
   * Si islandId n'est pas spécifié, utilise l'île actuelle du joueur
   */
  registerCommandOnAllWorlds("/leaderboard", async (player, args) => {
    const playerWorld = getPlayerWorld(player);
    if (!playerWorld) return;

    // Détermine quelle île utiliser
    let islandId = "island1"; // Par défaut
    if (args && args.length > 0) {
      // Si un argument est fourni, utilise-le
      islandId = args[0];
    } else {
      // Sinon, détermine l'île depuis le monde du joueur
      islandWorldManager.getAvailableIslandIds().forEach((id) => {
        if (islandWorldManager.getWorldForIsland(id) === playerWorld) {
          islandId = id;
        }
      });
    }

    const leaderboard = await getLeaderboard(islandId);

    if (leaderboard.length === 0) {
      playerWorld.chatManager.sendPlayerMessage(
        player,
        "Aucun joueur n'a encore collecté le dernier coin.",
        "FFD700"
      );
      return;
    }

    // Envoie le titre du leaderboard
    playerWorld.chatManager.sendPlayerMessage(
      player,
      "═══════════════════════════════════",
      "FFD700"
    );
    playerWorld.chatManager.sendPlayerMessage(
      player,
      `🏆 LEADERBOARD - ${islandId.toUpperCase()} - Dernier Coin Collecté`,
      "FFD700"
    );
    playerWorld.chatManager.sendPlayerMessage(
      player,
      "═══════════════════════════════════",
      "FFD700"
    );

    // Affiche chaque joueur du leaderboard avec son rang et la date
    leaderboard.forEach((entry, index) => {
      const rank = index + 1;
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let rankEmoji = "";
      if (rank === 1) rankEmoji = "🥇";
      else if (rank === 2) rankEmoji = "🥈";
      else if (rank === 3) rankEmoji = "🥉";
      else rankEmoji = `${rank}.`;

      playerWorld.chatManager.sendPlayerMessage(
        player,
        `${rankEmoji} ${entry.playerName} - ${dateStr}`,
        rank <= 3 ? "FFD700" : "FFFFFF"
      );
    });

    playerWorld.chatManager.sendPlayerMessage(
      player,
      "═══════════════════════════════════",
      "FFD700"
    );
  });

  /**
   * Play some peaceful ambient music to
   * set the mood!
   * On joue la musique dans tous les mondes d'îles
   */
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    new Audio({
      uri: "audio/music/jungle-theme-looping.mp3",
      loop: true,
      volume: 0.1,
    }).play(islandWorld);
  });
});
