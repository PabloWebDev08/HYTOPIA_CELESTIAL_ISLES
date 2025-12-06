// coin.ts
import {
  World,
  Entity,
  RigidBodyType,
  Quaternion,
  EntityEvent,
  DefaultPlayerEntity,
  CollisionGroup,
  ColliderShape,
  Audio,
  PersistenceManager,
} from "hytopia";
// Import par défaut pour compatibilité avec le code existant
import coinDataDefault from "../../assets/islands/island1/coin.json";
// Import des fonctions de mise à jour du leaderboard pour chaque île
import { updateAllSkeletonSoldiersLeaderboard as updateIsland1Leaderboard } from "../island1/welcomeNPCS";
import { updateAllSkeletonSoldiersLeaderboard as updateIsland2Leaderboard } from "../island2/welcomeNPCS";

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
  // Ajoutez d'autres îles ici au fur et à mesure
};

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Coin {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  modelScale?: number;
}

export interface CoinConfig {
  metadata: {
    name: string;
    description: string;
  };
  coins: Coin[];
}

/**
 * Interface pour les données persistées du joueur concernant les coins
 */
interface PlayerCoinData {
  gold?: number;
  collectedCoins?: string[];
}

/**
 * Interface pour une entrée du leaderboard
 */
interface LeaderboardEntry {
  playerName: string;
  timestamp: number;
}

/**
 * Interface pour les données persistées globales du leaderboard
 */
interface GlobalLeaderboardData {
  lastCoinLeaderboard?: LeaderboardEntry[];
  // Leaderboards séparés par île
  [key: string]: LeaderboardEntry[] | undefined;
}

/**
 * Gère la collecte d'un coin par un joueur
 * @param world - Le monde où se trouve le coin
 * @param coinEntity - L'entité du coin
 * @param coinId - L'ID du coin
 * @param playerEntity - L'entité du joueur qui collecte le coin
 * @param islandId - L'ID de l'île où se trouve le coin
 * @param lastCoinId - L'ID du dernier coin de cette île
 */
async function handleCoinCollection(
  world: World,
  coinEntity: Entity,
  coinId: string,
  playerEntity: DefaultPlayerEntity,
  islandId: string,
  lastCoinId: string | null
): Promise<void> {
  const player = playerEntity.player;

  // Récupère les données persistées du joueur
  let playerData = player.getPersistedData() as PlayerCoinData | undefined;

  // Initialise les données si elles n'existent pas (nouveau joueur ou données corrompues)
  if (playerData === undefined || playerData.gold === undefined) {
    playerData = {
      gold: 0,
      collectedCoins: [],
    };
    // Sauvegarde les données initialisées
    player.setPersistedData(playerData as Record<string, unknown>);
  }

  // Initialise les propriétés manquantes si nécessaire
  if (!playerData.gold) {
    playerData.gold = 0;
  }
  if (!playerData.collectedCoins) {
    playerData.collectedCoins = [];
  }

  // Vérifie si le coin est spawné (si désactivé, on ne peut pas le collecter)
  if (!coinEntity.isSpawned) {
    return; // Le coin n'est pas spawné, il ne peut pas être collecté
  }

  // Vérifie si c'est le dernier coin de l'île et si c'est la première fois que le joueur le collecte
  const isLastCoin = lastCoinId !== null && coinId === lastCoinId;
  const isFirstTimeLastCoin =
    isLastCoin && !playerData.collectedCoins.includes(coinId);

  // Joue le son de collecte de coin
  new Audio({
    uri: "audio/sfx/coin-collect.mp3",
    loop: false,
    volume: 0.5,
    attachedToEntity: playerEntity,
  }).play(world);

  // Ajoute +1 or au joueur
  playerData.gold = (playerData.gold || 0) + 1;
  playerData.collectedCoins.push(coinId);

  // Sauvegarde les données persistées
  player.setPersistedData({
    gold: playerData.gold,
    collectedCoins: playerData.collectedCoins,
  });

  // Met à jour l'or dans l'UI du joueur
  player.ui.sendData({
    type: "gold-update",
    gold: playerData.gold,
  });

  // // Envoie un message de confirmation au joueur
  // world.chatManager.sendPlayerMessage(
  //   player,
  //   `+1 or collecté ! Total: ${playerData.gold} or`,
  //   "FFD700"
  // );

  // Vérifie si c'est le dernier coin de l'île et si c'est la première fois
  // On ajoute au leaderboard seulement la première fois
  if (isFirstTimeLastCoin) {
    // Le joueur a collecté le dernier coin pour la première fois, on l'ajoute au leaderboard
    await addToLeaderboard(world, player, islandId);
  }

  // Désactive le coin temporairement (même si on ne l'ajoute pas au leaderboard)
  // Récupère la position et rotation stockées pour le respawn
  const coinPosition = (coinEntity as any)._coinPosition;
  const coinRotation = (coinEntity as any)._coinRotation;
  const coinWorld = (coinEntity as any)._coinWorld || world;
  const storedCoinId = (coinEntity as any)._coinId;
  const storedLastCoinId = (coinEntity as any)._lastCoinId;
  const storedIslandId = (coinEntity as any)._islandId;

  coinEntity.despawn();

  // Respawn le coin après 30 secondes
  setTimeout(() => {
    if (coinPosition && coinWorld) {
      coinEntity.spawn(coinWorld, coinPosition, coinRotation);

      // Recrée le collider sensor car il est perdu lors du despawn/respawn
      coinEntity.createAndAddChildCollider({
        shape: ColliderShape.BALL,
        radius: 0.8,
        isSensor: true,
        collisionGroups: {
          belongsTo: [CollisionGroup.ENTITY_SENSOR],
          collidesWith: [CollisionGroup.PLAYER],
        },
        tag: "coin-collector-sensor",
        onCollision: async (other: Entity | any, started: boolean) => {
          if (!started) return;
          if (!(other instanceof DefaultPlayerEntity)) {
            console.log(
              `[Coin ${storedCoinId}] L'entité n'est pas un DefaultPlayerEntity`
            );
            return;
          }
          const playerEntity = other as DefaultPlayerEntity;
          await handleCoinCollection(
            coinWorld,
            coinEntity,
            storedCoinId,
            playerEntity,
            storedIslandId,
            storedLastCoinId
          );
        },
      });
    }
  }, 30000);
}

/**
 * Ajoute un joueur au leaderboard de l'île quand il collecte le dernier coin
 * @param world - Le monde du jeu
 * @param player - Le joueur à ajouter au leaderboard
 * @param islandId - L'ID de l'île (ex: "island1", "island2")
 */
async function addToLeaderboard(
  world: World,
  player: any,
  islandId: string
): Promise<void> {
  try {
    // Clé spécifique pour le leaderboard de cette île
    const leaderboardKey = `leaderboard-${islandId}`;

    // Récupère les données persistées globales
    const globalData = (await PersistenceManager.instance.getGlobalData(
      "game-leaderboard"
    )) as GlobalLeaderboardData | undefined;

    // Initialise le leaderboard s'il n'existe pas
    const leaderboard: LeaderboardEntry[] =
      (globalData?.[leaderboardKey] as LeaderboardEntry[]) || [];

    // Ajoute le joueur au leaderboard avec le timestamp actuel
    const newEntry: LeaderboardEntry = {
      playerName: player.username,
      timestamp: Date.now(),
    };

    leaderboard.push(newEntry);

    // Sauvegarde le leaderboard mis à jour pour cette île
    await PersistenceManager.instance.setGlobalData("game-leaderboard", {
      ...globalData,
      [leaderboardKey]: leaderboard,
    });

    // Envoie un message de félicitations au joueur
    world.chatManager.sendPlayerMessage(
      player,
      `🎉 Félicitations ${player.username} ! Vous avez collecté le dernier coin et êtes ajouté au leaderboard de l'${islandId} !`,
      "FFD700"
    );

    // Met à jour le leaderboard des skeleton soldiers de cette île
    console.log(
      `[Coin] Mise à jour du leaderboard pour l'île ${islandId} avec ${leaderboard.length} entrées`
    );
    const updateLeaderboard = islandLeaderboardUpdaters[islandId];
    if (updateLeaderboard) {
      try {
        updateLeaderboard(leaderboard);
        console.log(
          `[Coin] Leaderboard mis à jour avec succès pour l'île ${islandId}`
        );
      } catch (error) {
        console.error(
          `[Coin] Erreur lors de la mise à jour du leaderboard pour ${islandId}:`,
          error
        );
      }
    } else {
      console.warn(
        `[Coin] Aucune fonction de mise à jour trouvée pour l'île ${islandId}`
      );
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout au leaderboard:", error);
  }
}

/**
 * Trouve l'ID du dernier coin dans une configuration de coins
 * Le dernier coin est celui qui apparaît en dernier dans le tableau
 * @param coinData - Les données JSON des coins
 * @returns L'ID du dernier coin ou null si aucun coin
 */
function getLastCoinId(coinData: CoinConfig): string | null {
  if (!coinData.coins || coinData.coins.length === 0) {
    return null;
  }
  // Le dernier coin est le dernier élément du tableau
  return coinData.coins[coinData.coins.length - 1].id;
}

/**
 * Crée et place toutes les entités de coins dans le monde
 * @param world - Le monde où spawner les coins
 * @param coinData - Les données JSON des coins (optionnel, utilise les données par défaut si non fourni)
 * @param islandId - L'ID de l'île (ex: "island1", "island2")
 * @returns Un tableau contenant toutes les entités de coins créées
 */
export function createCoinEntities(
  world: World,
  coinData?: CoinConfig,
  islandId: string = "island1"
): Entity[] {
  const config = (coinData || coinDataDefault) as CoinConfig;
  const entities: Entity[] = [];

  // Trouve l'ID du dernier coin pour cette île
  const lastCoinId = getLastCoinId(config);

  // Crée chaque coin
  for (const coin of config.coins) {
    // Prépare les options de l'entité
    const entityOptions: any = {
      name: coin.name,
      modelUri: "models/environment/Gameplay/coin-stack.gltf",
      modelLoopedAnimations: ["idle"], // Animation "idle" en boucle
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Coin fixe qui ne bouge pas
        collisionGroups: {
          belongsTo: [CollisionGroup.ENTITY],
          collidesWith: [CollisionGroup.PLAYER, CollisionGroup.BLOCK],
        },
      },
    };

    // Configure l'échelle du modèle si spécifiée
    if (coin.modelScale !== undefined) {
      entityOptions.modelScale = coin.modelScale;
    }

    // Crée l'entité
    const entity = new Entity(entityOptions);

    // Convertit la rotation en Quaternion si fournie
    const rotation = coin.rotation
      ? new Quaternion(
          coin.rotation.x,
          coin.rotation.y,
          coin.rotation.z,
          coin.rotation.w
        )
      : undefined;

    // Spawn l'entité dans le monde avec sa position et rotation
    entity.spawn(world, coin.position, rotation);

    // Stocke l'ID du coin, la position et la rotation pour référence future (nécessaire pour respawn)
    (entity as any)._coinId = coin.id;
    (entity as any)._coinPosition = coin.position;
    (entity as any)._coinRotation = rotation;
    (entity as any)._coinWorld = world;
    (entity as any)._lastCoinId = lastCoinId;
    (entity as any)._islandId = islandId;

    // Ajoute un collider sensor pour détecter les collisions avec les joueurs
    // Le sensor permet de détecter les collisions sans bloquer le mouvement du joueur
    entity.createAndAddChildCollider({
      shape: ColliderShape.BALL,
      radius: 0.8, // Rayon légèrement plus grand que le modèle pour faciliter la collecte
      isSensor: true, // Sensor = détecte les collisions sans bloquer
      collisionGroups: {
        belongsTo: [CollisionGroup.ENTITY_SENSOR],
        collidesWith: [CollisionGroup.PLAYER],
      },
      tag: "coin-collector-sensor",
      // Callback appelé quand une collision est détectée
      onCollision: async (other: Entity | any, started: boolean) => {
        // Ignore si la collision se termine (started === false)
        if (!started) return;

        // Vérifie si l'autre entité est un joueur
        if (!(other instanceof DefaultPlayerEntity)) {
          console.log(
            `[Coin ${coin.id}] L'entité n'est pas un DefaultPlayerEntity`
          );
          return;
        }

        const playerEntity = other as DefaultPlayerEntity;

        // Gère la collecte du coin avec l'ID de l'île et le dernier coin
        await handleCoinCollection(
          world,
          entity,
          coin.id,
          playerEntity,
          islandId,
          lastCoinId
        );
      },
    });

    entities.push(entity);
  }

  return entities;
}

/**
 * Retourne la position d'un coin par son ID
 * Retourne null si le coin n'existe pas
 * @param id - L'ID du coin
 * @param coinData - Les données JSON des coins (optionnel, utilise les données par défaut si non fourni)
 */
export function getCoinPositionById(
  id: string,
  coinData?: CoinConfig
): Position | null {
  const config = (coinData || coinDataDefault) as CoinConfig;
  const coin = config.coins.find((c) => c.id === id);
  return coin ? coin.position : null;
}

/**
 * Récupère le leaderboard des joueurs qui ont collecté le dernier coin pour une île spécifique
 * @param islandId - L'ID de l'île (ex: "island1", "island2")
 * @returns Le leaderboard ou un tableau vide si aucun joueur n'a encore collecté le dernier coin
 */
export async function getLeaderboard(
  islandId: string = "island1"
): Promise<LeaderboardEntry[]> {
  try {
    const leaderboardKey = `leaderboard-${islandId}`;
    const globalData = (await PersistenceManager.instance.getGlobalData(
      "game-leaderboard"
    )) as GlobalLeaderboardData | undefined;
    return (globalData?.[leaderboardKey] as LeaderboardEntry[]) || [];
  } catch (error) {
    console.error("Erreur lors de la récupération du leaderboard:", error);
    return [];
  }
}
