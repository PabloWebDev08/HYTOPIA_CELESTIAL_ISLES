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
  PlayerEvent,
  PersistenceManager,
  PlayerManager,
  Player,
} from "hytopia";

import { getLeaderboard } from "./islands/shared/coin";
import { IslandWorldManager } from "./islands/worldManager";
import {
  islandMapMapping,
  islandLeaderboardUpdaters,
} from "./config/islandConfig";
import { PlayerService } from "./player/playerService";
import { PlayerUIHandler } from "./player/playerUIHandler";
import {
  getPlayerWorld,
  getIslandManagerForWorld,
  registerCommandOnAllWorlds,
} from "./utils/worldHelpers";

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

  // Crée le service de gestion des joueurs
  const playerService = new PlayerService();

  // Crée le gestionnaire d'événements UI pour les joueurs
  const playerUIHandler = new PlayerUIHandler(
    playerService,
    islandWorldManager,
    islandMapMapping
  );

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
      // Initialise le joueur dans le monde
      playerService.initializePlayerInWorld(
        player,
        islandWorld,
        islandManager,
        islandWorldManager
      );

      // Configure les handlers UI pour ce joueur
      playerUIHandler.setupUIHandlers(player, islandWorld);
    });

    // Handler LEFT_WORLD pour ce monde d'île
    islandWorld.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      // Nettoie les ressources du joueur
      playerService.cleanupPlayer(player, islandWorld);
    });
  });

  /**
   * Vérifie périodiquement la position Y des joueurs
   * Si un joueur tombe en dessous du seuil, on le repositionne au point de départ de son île
   */
  setInterval(() => {
    playerService.checkAndRepositionFallenPlayers(islandWorldManager);
  }, 1000); // Vérifie toutes les secondes

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
   * A silly little easter egg command. When a player types
   * "/rocket" in the game, they'll get launched into the air!
   */
  registerCommandOnAllWorlds(
    "/rocket",
    (player) => {
      const playerWorld = getPlayerWorld(player, islandWorldManager);
      if (playerWorld) {
        playerWorld.entityManager
          .getPlayerEntitiesByPlayer(player)
          .forEach((entity) => {
            entity.applyImpulse({ x: 0, y: 20, z: 0 });
          });
      }
    },
    islandWorldManager
  );

  /**
   * Commande pour téléporter le joueur à une plateforme spécifique
   * Usage: /teleport <platform-id>
   * Exemple: /teleport start-platform
   */
  registerCommandOnAllWorlds(
    "/teleport",
    (player, args) => {
      const playerWorld = getPlayerWorld(player, islandWorldManager);
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
      const islandManager = getIslandManagerForWorld(
        playerWorld,
        islandWorldManager
      );
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

      const platformPosition =
        currentIsland.getPlatformPositionById(platformId);

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
    },
    islandWorldManager
  );

  /**
   * Commande pour réinitialiser les données persistées des coins du joueur
   * Usage: /resetcoins
   */
  registerCommandOnAllWorlds(
    "/resetcoins",
    async (player) => {
      const playerWorld = getPlayerWorld(player, islandWorldManager);
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
    },
    islandWorldManager
  );

  /**
   * Commande pour afficher le leaderboard des joueurs qui ont collecté le dernier coin
   * Usage: /leaderboard [islandId]
   * Si islandId n'est pas spécifié, utilise l'île actuelle du joueur
   */
  registerCommandOnAllWorlds(
    "/leaderboard",
    async (player, args) => {
      const playerWorld = getPlayerWorld(player, islandWorldManager);
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
    },
    islandWorldManager
  );

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
