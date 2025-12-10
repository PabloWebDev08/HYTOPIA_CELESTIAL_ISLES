// Commandes du jeu
import { Player, World, PersistenceManager } from "hytopia";
import { IslandWorldManager } from "../worldManager";
import { IslandManager } from "../islandManager";
import { getLeaderboard } from "./coin";
import { updateIslandLeaderboard } from "./leaderboard";

/**
 * Interface pour les dépendances nécessaires aux commandes
 */
export interface CommandsDependencies {
  islandWorldManager: IslandWorldManager;
}

/**
 * Fonction helper pour enregistrer une commande sur tous les mondes
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 * @param command - Le nom de la commande
 * @param handler - Le handler de la commande
 */
function registerCommandOnAllWorlds(
  islandWorldManager: IslandWorldManager,
  command: string,
  handler: (player: Player, args?: string[]) => void | Promise<void>
): void {
  // Enregistre la commande sur tous les mondes d'îles
  islandWorldManager.getAllWorlds().forEach((islandWorld) => {
    islandWorld.chatManager.registerCommand(command, handler);
  });
}

/**
 * Commande /rocket - Lance le joueur dans les airs
 * @param player - Le joueur
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 */
function handleRocketCommand(
  player: Player,
  islandWorldManager: IslandWorldManager
): void {
  const playerWorld = islandWorldManager.getPlayerWorld(player);
  if (playerWorld) {
    playerWorld.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach((entity) => {
        entity.applyImpulse({ x: 0, y: 20, z: 0 });
      });
  }
}

/**
 * Commande /teleport - Téléporte le joueur à une plateforme spécifique
 * @param player - Le joueur
 * @param args - Les arguments de la commande
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 */
function handleTeleportCommand(
  player: Player,
  args: string[] | undefined,
  islandWorldManager: IslandWorldManager
): void {
  const playerWorld = islandWorldManager.getPlayerWorld(player);
  if (!playerWorld) return;

  // Vérifie qu'un ID de plateforme a été fourni
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
  const islandManager =
    islandWorldManager.getIslandManagerForWorld(playerWorld);
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
}

/**
 * Commande /resetcoins - Réinitialise les données persistées des coins du joueur
 * @param player - Le joueur
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 */
async function handleResetCoinsCommand(
  player: Player,
  islandWorldManager: IslandWorldManager
): Promise<void> {
  const playerWorld = islandWorldManager.getPlayerWorld(player);
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
      const islandIds = ["island1", "island2", "island3"];

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
          updateIslandLeaderboard(islandId, updatedLeaderboard);
          console.log(`[ResetCoins] Leaderboard mis à jour pour ${islandId}`);
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
}

/**
 * Commande /leaderboard - Affiche le leaderboard des joueurs qui ont collecté le dernier coin
 * @param player - Le joueur
 * @param args - Les arguments de la commande
 * @param islandWorldManager - Le gestionnaire de mondes d'îles
 */
async function handleLeaderboardCommand(
  player: Player,
  args: string[] | undefined,
  islandWorldManager: IslandWorldManager
): Promise<void> {
  const playerWorld = islandWorldManager.getPlayerWorld(player);
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
}

/**
 * Enregistre toutes les commandes du jeu
 * @param deps - Les dépendances nécessaires
 */
export function registerAllCommands(deps: CommandsDependencies): void {
  const { islandWorldManager } = deps;

  // Commande /rocket
  registerCommandOnAllWorlds(islandWorldManager, "/rocket", (player) => {
    handleRocketCommand(player, islandWorldManager);
  });

  // Commande /teleport
  registerCommandOnAllWorlds(
    islandWorldManager,
    "/teleport",
    (player, args) => {
      handleTeleportCommand(player, args, islandWorldManager);
    }
  );

  // Commande /resetcoins
  registerCommandOnAllWorlds(
    islandWorldManager,
    "/resetcoins",
    async (player) => {
      await handleResetCoinsCommand(player, islandWorldManager);
    }
  );

  // Commande /leaderboard
  registerCommandOnAllWorlds(
    islandWorldManager,
    "/leaderboard",
    async (player, args) => {
      await handleLeaderboardCommand(player, args, islandWorldManager);
    }
  );
}
