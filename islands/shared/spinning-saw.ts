// spinning-saw.ts
import {
  World,
  Entity,
  RigidBodyType,
  Quaternion,
  DefaultPlayerEntity,
  CollisionGroup,
  ColliderShape,
} from "hytopia";
// Import par défaut pour compatibilité avec le code existant
import spinningSawDataDefault from "../../assets/islands/island3/spinning-saw.json";

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

export interface SpinningSaw {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  modelScale?: number;
}

export interface SpinningSawConfig {
  metadata: {
    name: string;
    description: string;
  };
  spinningSaws: SpinningSaw[];
}

/**
 * Gère la collision avec une spinning-saw et téléporte le joueur au point de départ
 * @param world - Le monde où se trouve la spinning-saw
 * @param playerEntity - L'entité du joueur qui entre en collision
 * @param startPosition - La position de départ où téléporter le joueur
 */
async function handleSpinningSawCollision(
  world: World,
  playerEntity: DefaultPlayerEntity,
  startPosition: Position
): Promise<void> {
  const player = playerEntity.player;

  // Téléporte toutes les entités du joueur à la position de départ
  // On ajoute un petit offset en Y pour être au-dessus du sol
  const teleportPosition = {
    x: startPosition.x,
    y: startPosition.y + 1, // 1 bloc au-dessus du point de départ
    z: startPosition.z,
  };

  world.entityManager.getPlayerEntitiesByPlayer(player).forEach((entity) => {
    entity.setPosition(teleportPosition);
  });

  // Envoie un message au joueur pour l'informer de la téléportation
  world.chatManager.sendPlayerMessage(
    player,
    "Vous avez été touché par une scie rotative ! Retour au point de départ.",
    "FF6B00"
  );
}

/**
 * Crée et place toutes les entités de spinning-saws dans le monde
 * @param world - Le monde où spawner les spinning-saws
 * @param spinningSawData - Les données JSON des spinning-saws (optionnel, utilise les données par défaut si non fourni)
 * @param startPosition - La position de départ où téléporter les joueurs qui entrent en collision
 * @returns Un tableau contenant toutes les entités de spinning-saws créées
 */
export function createSpinningSawEntities(
  world: World,
  spinningSawData?: SpinningSawConfig,
  startPosition?: Position
): Entity[] {
  const config = (spinningSawData ||
    spinningSawDataDefault) as SpinningSawConfig;
  const entities: Entity[] = [];

  // Utilise la position de départ fournie ou une position par défaut
  const defaultStartPosition: Position = startPosition || { x: 0, y: 0, z: 0 };

  // Crée chaque spinning-saw
  for (const spinningSaw of config.spinningSaws) {
    // Prépare les options de l'entité
    const entityOptions: any = {
      name: spinningSaw.name,
      modelUri: "models/environment/Gameplay/spinning-saw.gltf",
      modelLoopedAnimations: ["idle"], // Animation "idle" en boucle
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Spinning-saw fixe qui ne bouge pas
        collisionGroups: {
          belongsTo: [CollisionGroup.ENTITY],
          collidesWith: [CollisionGroup.PLAYER, CollisionGroup.BLOCK],
        },
      },
    };

    // Configure l'échelle du modèle si spécifiée
    if (spinningSaw.modelScale !== undefined) {
      entityOptions.modelScale = spinningSaw.modelScale;
    }

    // Crée l'entité
    const entity = new Entity(entityOptions);

    // Convertit la rotation en Quaternion si fournie
    const rotation = spinningSaw.rotation
      ? new Quaternion(
          spinningSaw.rotation.x,
          spinningSaw.rotation.y,
          spinningSaw.rotation.z,
          spinningSaw.rotation.w
        )
      : undefined;

    // Spawn l'entité dans le monde avec sa position et rotation
    entity.spawn(world, spinningSaw.position, rotation);

    // Stocke la position de départ pour référence future (nécessaire pour téléportation)
    (entity as any)._startPosition = defaultStartPosition;
    (entity as any)._spinningSawWorld = world;

    // Calcule les halfExtents en fonction du modelScale
    // Les valeurs de base sont pour modelScale: 1
    const baseHalfExtents = {
      x: 0.2,
      y: 1,
      z: 1,
    };
    const modelScale = spinningSaw.modelScale || 1;
    const scaledHalfExtents = {
      x: baseHalfExtents.x * modelScale,
      y: baseHalfExtents.y * modelScale,
      z: baseHalfExtents.z * modelScale,
    };

    // Ajoute un collider sensor pour détecter les collisions avec les joueurs
    // Le sensor permet de détecter les collisions sans bloquer le mouvement du joueur
    entity.createAndAddChildCollider({
      shape: ColliderShape.BLOCK,
      halfExtents: scaledHalfExtents,
      isSensor: true, // Sensor = détecte les collisions sans bloquer
      collisionGroups: {
        belongsTo: [CollisionGroup.ENTITY_SENSOR],
        collidesWith: [CollisionGroup.PLAYER],
      },
      tag: "spinning-saw-sensor",
      // Callback appelé quand une collision est détectée
      onCollision: async (other: Entity | any, started: boolean) => {
        // Ignore si la collision se termine (started === false)
        if (!started) return;

        // Vérifie si l'autre entité est un joueur
        if (!(other instanceof DefaultPlayerEntity)) {
          console.log(
            `[SpinningSaw ${spinningSaw.id}] L'entité n'est pas un DefaultPlayerEntity`
          );
          return;
        }

        const playerEntity = other as DefaultPlayerEntity;

        // Récupère la position de départ stockée dans l'entité
        const storedStartPosition = (entity as any)._startPosition as Position;
        const storedWorld = (entity as any)._spinningSawWorld as World;

        // Gère la collision et téléporte le joueur
        await handleSpinningSawCollision(
          storedWorld,
          playerEntity,
          storedStartPosition
        );
      },
    });

    entities.push(entity);
  }

  return entities;
}

/**
 * Retourne la position d'une spinning-saw par son ID
 * Retourne null si la spinning-saw n'existe pas
 * @param id - L'ID de la spinning-saw
 * @param spinningSawData - Les données JSON des spinning-saws (optionnel, utilise les données par défaut si non fourni)
 */
export function getSpinningSawPositionById(
  id: string,
  spinningSawData?: SpinningSawConfig
): Position | null {
  const config = (spinningSawData ||
    spinningSawDataDefault) as SpinningSawConfig;
  const spinningSaw = config.spinningSaws.find((s) => s.id === id);
  return spinningSaw ? spinningSaw.position : null;
}
