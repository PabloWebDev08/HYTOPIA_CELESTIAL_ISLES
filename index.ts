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
import type { WorldMap } from "hytopia";

import island1Map from "./assets/map_island_1.json";
import island2Map from "./assets/map_island_2.json";
import island3Map from "./assets/map_island_3.json";
import { IslandManager } from "./islands/islandManager";
import { IslandWorldManager } from "./islands/worldManager";
import { initializePlayerInWorld as initializePlayerInWorldHelper } from "./islands/shared/playerInitialization";
import {
  setupPlayerUIHandlers,
  cleanupJumpAudio,
} from "./islands/shared/playerUIHandlers";
import { registerAllCommands } from "./islands/shared/commands";

/**
 * Constantes de configuration du jeu
 */
const GAME_CONFIG = {
  /** Seuil de chute en dessous duquel le joueur est repositionné */
  FALL_THRESHOLD_Y: -50,
  /** Intervalle de vérification de la position des joueurs (en millisecondes) */
  PLAYER_POSITION_CHECK_INTERVAL_MS: 1000,
  /** Volume par défaut de la musique d'ambiance */
  DEFAULT_MUSIC_VOLUME: 0.1,
} as const;

/**
 * Mapping entre les IDs d'îles et leurs maps correspondantes
 */
const islandMapMapping: Record<string, WorldMap> = {
  island1: island1Map,
  island2: island2Map,
  island3: island3Map,
  // Ajoutez d'autres îles ici au fur et à mesure
};

/**
 * Mapping optionnel entre les IDs d'îles et leurs skyboxes
 * Si une île n'est pas présente dans ce mapping, le skybox par défaut sera utilisé
 * Exemples de skyboxes disponibles : "skyboxes/partly-cloudy", "skyboxes/sunset", etc.
 */
const islandSkyboxMapping: Record<string, string> = {
  island1: "skyboxes/partly-cloudy", // Exemple : skybox personnalisée pour island1
  island2: "skyboxes/sunset", // Exemple : skybox personnalisée pour island2
  island3: "skyboxes/sunset", // Exemple : skybox personnalisée pour island3
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

  // Crée le gestionnaire de mondes d'îles et initialise tous les mondes
  // Tous les mondes d'îles sont créés ici, y compris island1
  // Le deuxième paramètre (islandSkyboxMapping) est optionnel
  // Si vous ne le spécifiez pas, toutes les îles utiliseront le skybox par défaut
  const islandWorldManager = new IslandWorldManager(
    islandMapMapping,
    islandSkyboxMapping
  );
  islandWorldManager.initializeWorlds();

  // Pour activer le debug rendering sur un monde d'île spécifique:
  // const island3World = islandWorldManager.getWorldForIsland("island3");
  // island3World?.simulation.enableDebugRendering(true);

  // Configure le handler pour rediriger automatiquement les nouveaux joueurs vers island1
  // Utilise defaultWorld comme fallback si island1 n'est pas disponible
  PlayerManager.instance.worldSelectionHandler = async (player: Player) => {
    const island1World = islandWorldManager.getWorldForIsland("island1");
    return island1World || defaultWorld;
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
    // Récupère l'ID de l'île correspondant à ce monde
    const islandId = islandWorldManager.getIslandIdForWorld(islandWorld);
    if (!islandId) return;

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

      // Nettoie le cache audio de saut du joueur
      cleanupJumpAudio(player.id);
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

    // Récupère l'ID de l'île correspondant à ce monde
    const islandId = islandWorldManager.getIslandIdForWorld(islandWorld);
    if (!islandId) return;

    const islandManager =
      islandWorldManager.getIslandManagerForIsland(islandId);
    if (!islandManager) return;

    // Écoute les événements de tick du WorldLoop de ce monde
    islandWorld.loop.on(WorldLoopEvent.TICK_START, ({ tickDeltaMs }) => {
      // Accumule le temps depuis la dernière vérification
      const currentAccumulator = worldTickAccumulators.get(islandWorld) || 0;
      const newAccumulator = currentAccumulator + tickDeltaMs;

      // Vérifie périodiquement selon l'intervalle configuré
      if (newAccumulator >= GAME_CONFIG.PLAYER_POSITION_CHECK_INTERVAL_MS) {
        // Réinitialise l'accumulateur en conservant le reste
        worldTickAccumulators.set(
          islandWorld,
          newAccumulator - GAME_CONFIG.PLAYER_POSITION_CHECK_INTERVAL_MS
        );

        const currentIsland = islandManager.getCurrentIsland();
        if (!currentIsland) return;

        // Récupère la position de départ de l'île
        const startPosition = currentIsland.getStartPosition();

        // Parcourt tous les joueurs dans ce monde
        const worldPlayerMap = playerEntitiesByWorld.get(islandWorld);
        if (!worldPlayerMap) return;

        worldPlayerMap.forEach((playerEntity) => {
          // Vérifie si le joueur est en dessous du seuil de chute
          if (playerEntity.position.y < GAME_CONFIG.FALL_THRESHOLD_Y) {
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
   * Enregistre toutes les commandes du jeu
   */
  registerAllCommands({
    islandWorldManager,
  });

  /**
   * Play some peaceful ambient music to
   * set the mood!
   * On joue une musique différente pour chaque île
   * Vous pouvez modifier les chemins de fichiers audio pour chaque île
   */
  const islandMusicMapping: Record<string, string> = {
    island1: "audio/music/hytopia-main-theme.mp3",
    island2: "audio/music/snow-theme-looping.mp3", // Changez ce chemin pour une musique différente
    island3: "audio/music/night-theme-looping.mp3", // Changez ce chemin pour une musique différente
    // Ajoutez d'autres îles ici au fur et à mesure
  };

  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    // Récupère l'ID de l'île correspondant à ce monde
    const islandId = islandWorldManager.getIslandIdForWorld(islandWorld);
    if (!islandId) return;

    // Récupère la musique associée à cette île, ou utilise une musique par défaut
    const musicUri =
      islandMusicMapping[islandId] || "audio/music/jungle-theme-looping.mp3";

    // Joue la musique spécifique à cette île
    new Audio({
      uri: musicUri,
      loop: true,
      volume: GAME_CONFIG.DEFAULT_MUSIC_VOLUME,
    }).play(islandWorld);
  });
});
