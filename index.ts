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
  ParticleEmitter,
  PlayerManager,
  World,
  Player,
  WorldLoopEvent,
} from "hytopia";

import island1Map from "./assets/map_island_1.json";
import island2Map from "./assets/map_island_2.json";
import island3Map from "./assets/map_island_3.json";
import { IslandManager } from "./islands/islandManager";
import { IslandWorldManager } from "./islands/worldManager";
import { initializePlayerInWorld as initializePlayerInWorldHelper } from "./islands/shared/playerInitialization";
import { setupPlayerUIHandlers } from "./islands/shared/playerUIHandlers";
import { registerAllCommands } from "./islands/shared/commands";
import type { PlayerCoinData } from "./islands/shared/types";

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
    // Utilise la fonction helper pour initialiser le joueur
    const { playerEntity, jumpChargeSceneUI } = initializePlayerInWorldHelper(
      player,
      world,
      islandManager,
      {
        islandWorldManager,
        playerEntitiesByWorld,
        playerParticleEmitters,
        islandMapMapping,
      }
    );

    // Configure les handlers d'événements UI
    setupPlayerUIHandlers(player, world, playerEntity, jumpChargeSceneUI, {
      islandWorldManager,
      playerEntitiesByWorld,
      playerParticleEmitters,
      islandMapMapping,
    });
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
   * Vérifie périodiquement la position Y des joueurs
   * Si un joueur tombe en dessous de y = -50, on le repositionne au point de départ de son île
   * Utilise les événements WorldLoopEvent.TICK_START au lieu de setInterval pour une meilleure intégration avec le SDK
   */
  // Map pour tracker le temps accumulé par monde (en millisecondes)
  const worldTickAccumulators = new Map<World, number>();

  // Configure les listeners d'événements de tick pour chaque monde d'île
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    // Initialise l'accumulateur de temps pour ce monde
    worldTickAccumulators.set(islandWorld, 0);

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

    // Écoute les événements de tick du WorldLoop de ce monde
    islandWorld.loop.on(WorldLoopEvent.TICK_START, ({ tickDeltaMs }) => {
      // Accumule le temps depuis la dernière vérification
      const currentAccumulator = worldTickAccumulators.get(islandWorld) || 0;
      const newAccumulator = currentAccumulator + tickDeltaMs;

      // Vérifie toutes les secondes (1000ms)
      if (newAccumulator >= 1000) {
        // Réinitialise l'accumulateur
        worldTickAccumulators.set(islandWorld, newAccumulator - 1000);

        const currentIsland = islandManager.getCurrentIsland();
        if (!currentIsland) return;

        // Récupère la position de départ de l'île
        const startPosition = currentIsland.getStartPosition();

        // Parcourt tous les joueurs dans ce monde
        const worldPlayerMap = playerEntitiesByWorld.get(islandWorld);
        if (!worldPlayerMap) return;

        worldPlayerMap.forEach((playerEntity, playerId) => {
          // Vérifie si le joueur est en dessous de y = -50
          if (playerEntity.position.y < -50) {
            // Repositionne le joueur au point de départ de l'île
            playerEntity.setPosition(startPosition);
          }
        });
      } else {
        // Met à jour l'accumulateur
        worldTickAccumulators.set(islandWorld, newAccumulator);
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
   * Enregistre toutes les commandes du jeu
   */
  registerAllCommands({
    islandWorldManager,
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
