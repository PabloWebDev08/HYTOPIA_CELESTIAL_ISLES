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
import coinData from "./assets/coin.json";

interface Position {
  x: number;
  y: number;
  z: number;
}

interface Rotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Coin {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  modelScale?: number;
}

interface CoinConfig {
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
}

/**
 * Gère la collecte d'un coin par un joueur
 * @param world - Le monde où se trouve le coin
 * @param coinEntity - L'entité du coin
 * @param coinId - L'ID du coin
 * @param playerEntity - L'entité du joueur qui collecte le coin
 */
async function handleCoinCollection(
  world: World,
  coinEntity: Entity,
  coinId: string,
  playerEntity: DefaultPlayerEntity
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

  // Vérifie si le coin est visible (opacité > 0)
  // Si le coin est invisible, on ne peut pas le collecter
  const currentOpacity = (coinEntity as any).opacity ?? 1;
  if (currentOpacity === 0) {
    return; // Le coin est invisible, il ne peut pas être collecté
  }

  // Vérifie si c'est la première fois que le joueur collecte coin-31
  // (avant de l'ajouter à la liste des coins collectés)
  const isFirstTimeCoin31 =
    coinId === "coin-31" && !playerData.collectedCoins.includes("coin-31");

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

  // Envoie un message de confirmation au joueur
  world.chatManager.sendPlayerMessage(
    player,
    `+1 or collecté ! Total: ${playerData.gold} or`,
    "FFD700"
  );

  // Vérifie si c'est le dernier coin (coin-31) et si c'est la première fois
  // On ajoute au leaderboard seulement la première fois
  if (isFirstTimeCoin31) {
    // Le joueur a collecté le dernier coin pour la première fois, on l'ajoute au leaderboard
    await addToLeaderboard(world, player);
  }

  // Rend le coin invisible temporairement (même si on ne l'ajoute pas au leaderboard)
  coinEntity.setOpacity(0);

  // Réapparaît le coin après 30 secondes (30000 millisecondes)
  setTimeout(() => {
    coinEntity.setOpacity(1);
  }, 30000);
}

/**
 * Ajoute un joueur au leaderboard global quand il collecte le dernier coin
 * @param world - Le monde du jeu
 * @param player - Le joueur à ajouter au leaderboard
 */
async function addToLeaderboard(world: World, player: any): Promise<void> {
  try {
    // Récupère les données persistées globales
    const globalData = (await PersistenceManager.instance.getGlobalData(
      "game-leaderboard"
    )) as GlobalLeaderboardData | undefined;

    // Initialise le leaderboard s'il n'existe pas
    const leaderboard: LeaderboardEntry[] =
      globalData?.lastCoinLeaderboard || [];

    // Ajoute le joueur au leaderboard avec le timestamp actuel
    const newEntry: LeaderboardEntry = {
      playerName: player.username,
      timestamp: Date.now(),
    };

    leaderboard.push(newEntry);

    // Sauvegarde le leaderboard mis à jour
    await PersistenceManager.instance.setGlobalData("game-leaderboard", {
      lastCoinLeaderboard: leaderboard,
    });

    // Envoie un message de félicitations au joueur
    world.chatManager.sendPlayerMessage(
      player,
      `🎉 Félicitations ${player.username} ! Vous avez collecté le dernier coin et êtes ajouté au leaderboard !`,
      "FFD700"
    );

    // Met à jour le leaderboard des bateaux
    const { updateAllSkeletonSoldiersLeaderboard } = await import(
      "./welcomeNPCS"
    );
    updateAllSkeletonSoldiersLeaderboard(leaderboard);
  } catch (error) {
    console.error("Erreur lors de l'ajout au leaderboard:", error);
  }
}

/**
 * Crée et place toutes les entités de coins dans le monde
 * @param world - Le monde où spawner les coins
 * @returns Un tableau contenant toutes les entités de coins créées
 */
export function createCoinEntities(world: World): Entity[] {
  const config = coinData as CoinConfig;
  const entities: Entity[] = [];

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

    // Stocke l'ID du coin pour référence future
    (entity as any)._coinId = coin.id;

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

        // Gère la collecte du coin
        await handleCoinCollection(world, entity, coin.id, playerEntity);
      },
    });

    entities.push(entity);
  }

  return entities;
}

/**
 * Retourne la position d'un coin par son ID
 * Retourne null si le coin n'existe pas
 */
export function getCoinPositionById(id: string): Position | null {
  const config = coinData as CoinConfig;
  const coin = config.coins.find((c) => c.id === id);
  return coin ? coin.position : null;
}

/**
 * Récupère le leaderboard global des joueurs qui ont collecté le dernier coin
 * @returns Le leaderboard ou un tableau vide si aucun joueur n'a encore collecté le dernier coin
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const globalData = (await PersistenceManager.instance.getGlobalData(
      "game-leaderboard"
    )) as GlobalLeaderboardData | undefined;
    return globalData?.lastCoinLeaderboard || [];
  } catch (error) {
    console.error("Erreur lors de la récupération du leaderboard:", error);
    return [];
  }
}
