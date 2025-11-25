// parkour.ts
import {
  World,
  Entity,
  RigidBodyType,
  ColliderShape,
  Quaternion,
} from "hytopia";
import parkourData from "./assets/parkour.json";

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

interface Movement {
  enabled: boolean;
  type: "linear" | "rotation";
  waypoints?: Position[];
  axis?: "x" | "y" | "z";
  speed: number;
  loop: boolean;
}

interface ParkourObstacle {
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

interface ParkourConfig {
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
 * Crée et place toutes les entités du parkour dans le monde
 */
export function createParkourEntities(world: World): Entity[] {
  const config = parkourData as ParkourConfig;
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
    entityOptions.rigidBodyOptions = {
      type: convertRigidBodyType(obstacle.rigidBodyOptions.type),
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
      // TODO: Implémenter la logique de mouvement selon le type
      // Exemple pour mouvement linéaire :
      // if (obstacle.movement.type === "linear" && obstacle.movement.waypoints) {
      //   setupLinearMovement(entity, obstacle.movement);
      // }
    }

    entities.push(entity);
  }

  return entities;
}

/**
 * Retourne la position de départ du parkour
 */
export function getStartPosition(): Position {
  const config = parkourData as ParkourConfig;
  return config.metadata.startPosition;
}

/**
 * Retourne la position d'une plateforme par son ID
 * Retourne null si la plateforme n'existe pas
 */
export function getPlatformPositionById(id: string): Position | null {
  const config = parkourData as ParkourConfig;
  const obstacle = config.obstacles.find((obs) => obs.id === id);
  return obstacle ? obstacle.position : null;
}
