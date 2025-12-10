// spinning-saw.ts
import {
  World,
  Entity,
  RigidBodyType,
  Quaternion,
  DefaultPlayerEntity,
  CollisionGroup,
  ColliderShape,
  WorldLoopEvent,
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

export interface Movement {
  enabled: boolean;
  type: "linear" | "rotation";
  waypoints?: Position[];
  axis?: "x" | "y" | "z";
  speed: number;
  loop: boolean;
}

export interface SpinningSaw {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  modelScale?: number;
  movement?: Movement;
}

export interface SpinningSawConfig {
  metadata: {
    name: string;
    description: string;
  };
  spinningSaws: SpinningSaw[];
}

/**
 * Calcule la distance entre deux positions
 */
function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Interpole linéairement entre deux positions
 */
function lerpPosition(start: Position, end: Position, t: number): Position {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

/**
 * Configure le mouvement linéaire d'une entité entre des waypoints
 * Utilise les événements WorldLoopEvent.TICK_START au lieu de setInterval pour une meilleure intégration avec le SDK
 * @param entity - L'entité à déplacer
 * @param movement - La configuration du mouvement
 */
function setupLinearMovement(entity: Entity, movement: Movement): void {
  // Vérifie que les waypoints sont définis et qu'il y en a au moins 2
  if (!movement.waypoints || movement.waypoints.length < 2) {
    console.warn(
      `Mouvement linéaire ignoré pour ${entity.name}: au moins 2 waypoints requis`
    );
    return;
  }

  // Vérifie que l'entité est spawnée et a un monde
  if (!entity.isSpawned || !entity.world) {
    console.warn(
      `Mouvement linéaire ignoré pour ${entity.name}: l'entité doit être spawnée`
    );
    return;
  }

  const world = entity.world;
  let currentWaypointIndex = 0;
  let currentPosition = { ...movement.waypoints[0] };
  let targetWaypointIndex = 1;
  let targetWaypoint = movement.waypoints[targetWaypointIndex];
  let elapsedTimeMs = 0; // Temps écoulé en millisecondes depuis le début du segment actuel

  // Fonction de mise à jour appelée à chaque tick du monde
  const tickHandler = ({ tickDeltaMs }: { tickDeltaMs: number }) => {
    // Vérifie que l'entité est toujours spawnée
    if (!entity.isSpawned || !entity.world) {
      // Nettoie le listener si l'entité n'est plus spawnée
      world.loop.off(WorldLoopEvent.TICK_START, tickHandler);
      return;
    }

    // Accumule le temps écoulé depuis le début du segment actuel
    elapsedTimeMs += tickDeltaMs;

    // Calcule la distance entre le waypoint de départ et d'arrivée du segment actuel
    const startWaypoint = movement.waypoints![currentWaypointIndex];
    const endWaypoint = movement.waypoints![targetWaypointIndex];
    const segmentDistance = getDistance(startWaypoint, endWaypoint);

    // Calcule le temps nécessaire pour parcourir ce segment à la vitesse donnée (en millisecondes)
    const timeToReachMs = (segmentDistance / movement.speed) * 1000;

    // Calcule le progrès (0 à 1) vers le waypoint cible
    let progress = elapsedTimeMs / timeToReachMs;

    if (progress >= 1.0) {
      // A atteint le waypoint cible
      currentPosition = { ...endWaypoint };
      // Utilise setNextKinematicPosition pour que le moteur physique
      // calcule correctement les collisions et pousse les entités en contact (comme le joueur)
      entity.setNextKinematicPosition(currentPosition);

      // Passe au waypoint suivant
      currentWaypointIndex = targetWaypointIndex;
      targetWaypointIndex++;

      // Gère la fin du parcours
      if (targetWaypointIndex >= movement.waypoints!.length) {
        if (movement.loop) {
          // En boucle, retourne au début
          targetWaypointIndex = 0;
        } else {
          // Pas de boucle, arrête le mouvement en retirant le listener
          world.loop.off(WorldLoopEvent.TICK_START, tickHandler);
          return;
        }
      }

      // Met à jour le waypoint cible et réinitialise le temps
      targetWaypoint = movement.waypoints![targetWaypointIndex];
      elapsedTimeMs = 0;
    } else {
      // Interpole la position entre le waypoint actuel et le suivant
      currentPosition = lerpPosition(startWaypoint, endWaypoint, progress);
      // Utilise setNextKinematicPosition pour que le moteur physique
      // calcule correctement les collisions et pousse les entités en contact (comme le joueur)
      entity.setNextKinematicPosition(currentPosition);
    }
  };

  // Écoute les événements de tick du WorldLoop du monde
  world.loop.on(WorldLoopEvent.TICK_START, tickHandler);

  // Stocke la référence au handler sur l'entité pour pouvoir le nettoyer si nécessaire
  (entity as any)._movementTickHandler = tickHandler;
  (entity as any)._movementWorld = world;
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
    // Détermine le type de rigid body en fonction de la présence d'un mouvement
    // Si le mouvement est activé, utilise KINEMATIC_POSITION pour permettre le mouvement contrôlé
    const rigidBodyType = spinningSaw.movement?.enabled
      ? RigidBodyType.KINEMATIC_POSITION
      : RigidBodyType.FIXED;

    // Prépare les options de l'entité
    const entityOptions: any = {
      name: spinningSaw.name,
      modelUri: "models/environment/Gameplay/spinning-saw.gltf",
      modelLoopedAnimations: ["idle"], // Animation "idle" en boucle
      rigidBodyOptions: {
        type: rigidBodyType,
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

    // Si l'entité a un mouvement, configurez-le ici
    if (spinningSaw.movement?.enabled) {
      if (
        spinningSaw.movement.type === "linear" &&
        spinningSaw.movement.waypoints
      ) {
        setupLinearMovement(entity, spinningSaw.movement);
      } else if (spinningSaw.movement.type === "rotation") {
        // TODO: Implémenter la logique de rotation si nécessaire
        console.warn(
          `Le mouvement de type "rotation" n'est pas encore implémenté pour ${spinningSaw.name}`
        );
      }
    }

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
