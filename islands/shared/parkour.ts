// parkour.ts
import {
  World,
  Entity,
  RigidBodyType,
  ColliderShape,
  Quaternion,
  WorldLoopEvent,
} from "hytopia";
// Import par défaut pour compatibilité avec le code existant
import parkourDataDefault from "../../assets/islands/island1/parkour.json";

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

interface Movement {
  enabled: boolean;
  type: "linear" | "rotation";
  waypoints?: Position[];
  axis?: "x" | "y" | "z";
  speed: number;
  loop: boolean;
}

export interface ParkourObstacle {
  id: string;
  name: string;
  position: Position;
  rotation: Rotation;
  blockTextureUri?: string;
  modelUri?: string;
  modelTextureUri?: string;
  modelScale?: number;
  modelPreferredShape?: string;
  rigidBodyOptions: {
    type: "fixed" | "dynamic" | "kinematic_position" | "kinematic_velocity";
    rotation?: Rotation;
  };
  movement?: Movement;
  parkourData: {
    type: "platform" | "wall" | "gap";
    requiredJumpForce: number;
    size: { width: number; height: number; depth: number };
  };
}

export interface ParkourConfig {
  metadata: {
    name: string;
    description: string;
    startPosition: Position;
  };
  obstacles: ParkourObstacle[];
}

/**
 * Convertit le type de rigid body depuis le JSON vers l'enum RigidBodyType
 */
function convertRigidBodyType(type: string): RigidBodyType {
  switch (type) {
    case "fixed":
      return RigidBodyType.FIXED;
    case "dynamic":
      return RigidBodyType.DYNAMIC;
    case "kinematic_position":
      return RigidBodyType.KINEMATIC_POSITION;
    case "kinematic_velocity":
      return RigidBodyType.KINEMATIC_VELOCITY;
    default:
      return RigidBodyType.DYNAMIC; // Par défaut
  }
}

/**
 * Convertit le shape string vers l'enum ColliderShape si nécessaire
 */
function convertColliderShape(
  shape: string | undefined
): ColliderShape | undefined {
  if (!shape) return undefined;

  // Convertit les strings courants vers l'enum
  const shapeMap: Record<string, ColliderShape> = {
    box: ColliderShape.BLOCK,
    block: ColliderShape.BLOCK,
    capsule: ColliderShape.CAPSULE,
    ball: ColliderShape.BALL,
    sphere: ColliderShape.BALL, // Alias pour "ball"
  };

  return shapeMap[shape.toLowerCase()];
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
 * Crée et place toutes les entités du parkour dans le monde
 * @param world - Le monde où créer les entités
 * @param parkourData - Les données JSON du parkour (optionnel, utilise les données par défaut si non fourni)
 */
export function createParkourEntities(
  world: World,
  parkourData?: ParkourConfig
): Entity[] {
  const config = (parkourData || parkourDataDefault) as ParkourConfig;
  const entities: Entity[] = [];

  // Crée chaque obstacle
  for (const obstacle of config.obstacles) {
    // Prépare les options de l'entité
    const entityOptions: any = {
      name: obstacle.name,
    };

    // Si blockTextureUri est présent, on utilise une entité de bloc
    if (obstacle.blockTextureUri) {
      entityOptions.blockTextureUri = obstacle.blockTextureUri;
      // Calcule blockHalfExtents depuis la taille du parkourData
      // blockHalfExtents représente la moitié de chaque dimension
      entityOptions.blockHalfExtents = {
        x: obstacle.parkourData.size.width / 2,
        y: obstacle.parkourData.size.height / 2,
        z: obstacle.parkourData.size.depth / 2,
      };
    } else if (obstacle.modelUri) {
      // Sinon, on utilise un modèle 3D si modelUri est présent
      entityOptions.modelUri = obstacle.modelUri;

      // Configure la texture du modèle si présente
      if (obstacle.modelTextureUri) {
        entityOptions.modelTextureUri = obstacle.modelTextureUri;
      }

      // Configure l'échelle du modèle
      if (obstacle.modelScale !== undefined) {
        entityOptions.modelScale = obstacle.modelScale;
      }

      // Configure la forme préférée du collider
      const preferredShape = convertColliderShape(obstacle.modelPreferredShape);
      if (preferredShape) {
        entityOptions.modelPreferredShape = preferredShape;
      }
    }

    // Configure les options du rigid body
    // Si le mouvement est activé, force le type à KINEMATIC_POSITION pour permettre le mouvement contrôlé
    const rigidBodyType = obstacle.movement?.enabled
      ? RigidBodyType.KINEMATIC_POSITION
      : convertRigidBodyType(obstacle.rigidBodyOptions.type);

    entityOptions.rigidBodyOptions = {
      type: rigidBodyType,
    };

    // Ajoute la rotation au rigid body si spécifiée
    if (obstacle.rigidBodyOptions.rotation) {
      entityOptions.rigidBodyOptions.rotation =
        obstacle.rigidBodyOptions.rotation;
    }

    // Crée l'entité
    const entity = new Entity(entityOptions);

    // Convertit la rotation en Quaternion si fournie
    // Le JSON contient déjà une quaternion complète (x, y, z, w)
    const rotation = obstacle.rotation
      ? new Quaternion(
          obstacle.rotation.x,
          obstacle.rotation.y,
          obstacle.rotation.z,
          obstacle.rotation.w
        )
      : undefined;

    // Spawn l'entité dans le monde avec sa position et rotation
    entity.spawn(world, obstacle.position, rotation);

    // Stocke la position originale pour référence future
    (entity as any)._originalPosition = obstacle.position;

    // Si l'entité a un mouvement, configurez-le ici
    if (obstacle.movement?.enabled) {
      if (obstacle.movement.type === "linear" && obstacle.movement.waypoints) {
        setupLinearMovement(entity, obstacle.movement);
      } else if (obstacle.movement.type === "rotation") {
        // TODO: Implémenter la logique de rotation si nécessaire
        console.warn(
          `Le mouvement de type "rotation" n'est pas encore implémenté pour ${obstacle.name}`
        );
      }
    }

    entities.push(entity);
  }

  return entities;
}

/**
 * Retourne la position de départ du parkour
 * @param parkourData - Les données JSON du parkour (optionnel, utilise les données par défaut si non fourni)
 */
export function getStartPosition(parkourData?: ParkourConfig): Position {
  const config = (parkourData || parkourDataDefault) as ParkourConfig;
  return config.metadata.startPosition;
}

/**
 * Retourne la position d'une plateforme par son ID
 * Retourne null si la plateforme n'existe pas
 * @param id - L'ID de la plateforme
 * @param parkourData - Les données JSON du parkour (optionnel, utilise les données par défaut si non fourni)
 */
export function getPlatformPositionById(
  id: string,
  parkourData?: ParkourConfig
): Position | null {
  const config = (parkourData || parkourDataDefault) as ParkourConfig;
  const obstacle = config.obstacles.find((obs) => obs.id === id);
  return obstacle ? obstacle.position : null;
}
