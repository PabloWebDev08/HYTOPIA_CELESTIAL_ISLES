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
  World,
  Player,
} from "hytopia";

import hubMap from "./assets/map_hub.json";
import island2Map from "./assets/map_island_2.json";
import { getLeaderboard } from "./coin";
import { IslandManager } from "./islands/islandManager";
import { IslandWorldManager } from "./islands/worldManager";

/**
 * Interface pour les données persistées du joueur concernant les coins
 */
interface PlayerCoinData {
  gold?: number;
  collectedCoins?: string[];
  selectedIsland?: string; // Île sélectionnée par le joueur
}

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 */
const islandMapMapping: Record<string, any> = {
  island1: hubMap,
  island2: island2Map,
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
   * Enable debug rendering of the physics simulation.
   * This will overlay lines in-game representing colliders,
   * rigid bodies, and raycasts. This is useful for debugging
   * physics-related issues in a development environment.
   * Enabling this can cause performance issues, which will
   * be noticed as dropped frame rates and higher RTT times.
   * It is intended for development environments only and
   * debugging physics.
   */

  // defaultWorld.simulation.enableDebugRendering(true);

  /**
   * Le monde par défaut sert de monde de lobby ou d'île par défaut
   * On charge la map de l'île 1 par défaut au démarrage
   */
  defaultWorld.loadMap(hubMap);

  // Initialise le gestionnaire d'îles pour le monde par défaut
  const defaultIslandManager = new IslandManager(defaultWorld);
  defaultIslandManager.loadIsland("island1");

  // Crée le gestionnaire de mondes d'îles et initialise tous les mondes
  const islandWorldManager = new IslandWorldManager(islandMapMapping);
  islandWorldManager.initializeWorlds();

  // Map pour tracker les entités de joueurs par monde et par ID de joueur
  // Structure: Map<World, Map<playerId, DefaultPlayerEntity>>
  const playerEntitiesByWorld = new Map<
    World,
    Map<string, DefaultPlayerEntity>
  >();

  /**
   * Fonction helper pour initialiser un joueur dans un monde donné
   * Cette fonction est réutilisable pour tous les mondes (défaut et îles)
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
    const playerData: PlayerCoinData = {
      gold: existingData?.gold ?? 0,
      collectedCoins: existingData?.collectedCoins ?? [],
      selectedIsland: existingData?.selectedIsland ?? "island1",
    };
    player.setPersistedData(playerData as Record<string, unknown>);

    // Détermine quelle île utiliser pour ce monde
    // Pour le monde par défaut, utilise island1
    // Pour les mondes d'îles, détermine l'île depuis le monde
    let islandId = "island1";
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

    // Crée un émetteur de particules attaché au joueur
    const playerParticleEmitter = new ParticleEmitter({
      attachedToEntity: playerEntity,
      offset: { x: 0, y: -0.5, z: 0 },
      textureUri: "particles/magic.png",
      colorStart: { r: 255, g: 255, b: 255 },
      sizeStart: 0.1,
      sizeStartVariance: 0.03,
      sizeEnd: 0.12,
      sizeEndVariance: 0.02,
      lifetime: 2,
      lifetimeVariance: 0.5,
      rate: 15,
      maxParticles: 30,
      velocity: { x: 0, y: 0.5, z: 0 },
      velocityVariance: { x: 0.3, y: 0.2, z: 0.3 },
      opacityStart: 0.8,
      opacityEnd: 0,
    });

    // Spawn l'émetteur de particules dans le monde
    playerParticleEmitter.spawn(world);

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

    // Envoie l'or initial du joueur à l'UI
    setTimeout(async () => {
      const playerData = player.getPersistedData() as
        | PlayerCoinData
        | undefined;
      const gold = playerData?.gold ?? 0;
      player.ui.sendData({
        type: "gold-update",
        gold: gold,
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
   * Handle player joining the default world (lobby)
   * Les nouveaux joueurs rejoignent ce monde par défaut
   */
  defaultWorld.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    initializePlayerInWorld(player, defaultWorld, defaultIslandManager);
  });

  /**
   * Handle player leaving the default world
   */
  defaultWorld.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    defaultWorld.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach((entity) => entity.despawn());

    const worldPlayerMap = playerEntitiesByWorld.get(defaultWorld);
    if (worldPlayerMap) {
      worldPlayerMap.delete(player.id);
    }
  });

  /**
   * Configure les handlers JOINED_WORLD et LEFT_WORLD pour chaque monde d'île
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
   */
  const getPlayerWorld = (player: Player): World | null => {
    // Vérifie d'abord le monde par défaut
    const defaultWorldPlayers =
      defaultWorld.entityManager.getPlayerEntitiesByPlayer(player);
    if (defaultWorldPlayers.length > 0) {
      return defaultWorld;
    }

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
   */
  const getIslandManagerForWorld = (world: World): IslandManager | null => {
    if (world === defaultWorld) {
      return defaultIslandManager;
    }

    // Trouve l'ID de l'île correspondant à ce monde
    for (const islandId of islandWorldManager.getAvailableIslandIds()) {
      if (islandWorldManager.getWorldForIsland(islandId) === world) {
        return islandWorldManager.getIslandManagerForIsland(islandId);
      }
    }

    return null;
  };

  /**
   * A silly little easter egg command. When a player types
   * "/rocket" in the game, they'll get launched into the air!
   */
  defaultWorld.chatManager.registerCommand("/rocket", (player) => {
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
  defaultWorld.chatManager.registerCommand("/teleport", (player, args) => {
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
  defaultWorld.chatManager.registerCommand("/resetcoins", async (player) => {
    const playerWorld = getPlayerWorld(player);
    if (!playerWorld) return;
    // Réinitialise les données des coins du joueur
    player.setPersistedData({
      gold: 0,
      collectedCoins: [],
    });

    // Supprime l'entrée du joueur du leaderboard global
    try {
      const globalData = (await PersistenceManager.instance.getGlobalData(
        "game-leaderboard"
      )) as
        | {
            lastCoinLeaderboard?: Array<{
              playerName: string;
              timestamp: number;
            }>;
          }
        | undefined;

      if (globalData?.lastCoinLeaderboard) {
        // Filtre pour retirer toutes les entrées de ce joueur
        const updatedLeaderboard = globalData.lastCoinLeaderboard.filter(
          (entry) => entry.playerName !== player.username
        );

        // Sauvegarde le leaderboard mis à jour
        await PersistenceManager.instance.setGlobalData("game-leaderboard", {
          lastCoinLeaderboard: updatedLeaderboard,
        });

        // Met à jour le leaderboard des skeleton soldiers
        const { updateAllSkeletonSoldiersLeaderboard } = await import(
          "./welcomeNPCS"
        );
        updateAllSkeletonSoldiersLeaderboard(updatedLeaderboard);
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
   * Usage: /leaderboard
   */
  defaultWorld.chatManager.registerCommand("/leaderboard", async (player) => {
    const playerWorld = getPlayerWorld(player);
    if (!playerWorld) return;
    const leaderboard = await getLeaderboard();

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
      "🏆 LEADERBOARD - Dernier Coin Collecté",
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
   * On joue la musique dans tous les mondes (défaut et îles)
   */

  // Musique pour le monde par défaut
  new Audio({
    uri: "audio/music/jungle-theme-looping.mp3",
    loop: true,
    volume: 0.1,
  }).play(defaultWorld);

  // Musique pour chaque monde d'île
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    new Audio({
      uri: "audio/music/jungle-theme-looping.mp3",
      loop: true,
      volume: 0.1,
    }).play(islandWorld);
  });
});
