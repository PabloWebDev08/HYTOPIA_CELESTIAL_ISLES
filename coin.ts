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

  // Ajoute +1 or au joueur
  playerData.gold = (playerData.gold || 0) + 1;
  playerData.collectedCoins.push(coinId);

  // Sauvegarde les données persistées
  player.setPersistedData({
    gold: playerData.gold,
    collectedCoins: playerData.collectedCoins,
  });

  // Envoie un message de confirmation au joueur
  world.chatManager.sendPlayerMessage(
    player,
    `+1 or collecté ! Total: ${playerData.gold} or`,
    "FFD700"
  );

  // Rend le coin invisible temporairement
  coinEntity.setOpacity(0);

  // Réapparaît le coin après 30 secondes (30000 millisecondes)
  setTimeout(() => {
    coinEntity.setOpacity(1);
  }, 30000);
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
        // Log pour déboguer
        console.log(
          `[Coin ${coin.id}] Collision sensor détectée avec ${other?.constructor?.name}, started: ${started}`
        );

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
 * Configure les collisions entre les coins et les joueurs
 * Note: Les collisions sont maintenant configurées directement dans createCoinEntities
 * via le callback onCollision du collider sensor. Cette fonction est conservée pour
 * compatibilité mais ne fait plus rien car tout est géré dans createCoinEntities.
 * @param world - Le monde où se trouvent les coins
 * @param coinEntities - Tableau des entités de coins
 */
export function setupCoinCollisions(
  world: World,
  coinEntities: Entity[]
): void {
  // Les collisions sont maintenant configurées directement dans createCoinEntities
  // via le callback onCollision du collider sensor
  // Cette fonction est conservée pour compatibilité avec le code existant
  console.log(
    `[setupCoinCollisions] ${coinEntities.length} coins configurés avec collision sensor`
  );
}
