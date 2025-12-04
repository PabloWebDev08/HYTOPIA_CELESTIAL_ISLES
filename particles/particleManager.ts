import { ParticleEmitter, DefaultPlayerEntity, World } from "hytopia";

/**
 * Types de particules disponibles
 */
export type ParticleType = "particle1" | "particle2" | "particle3";

/**
 * Configuration d'un émetteur de particules
 */
interface ParticleConfig {
  textureUri: string;
  colorStart: { r: number; g: number; b: number };
  sizeStart: number;
  sizeStartVariance: number;
  sizeEnd: number;
  sizeEndVariance: number;
  lifetime: number;
  lifetimeVariance: number;
  rate: number;
  maxParticles: number;
  velocity: { x: number; y: number; z: number };
  velocityVariance: { x: number; y: number; z: number };
  opacityStart: number;
  opacityEnd: number;
  offset: { x: number; y: number; z: number };
}

/**
 * Configurations prédéfinies pour chaque type de particule
 */
const PARTICLE_CONFIGS: Record<ParticleType, ParticleConfig> = {
  particle1: {
    // Particule de feu (configuration actuelle)
    textureUri: "particles/fire.png",
    colorStart: { r: 255, g: 255, b: 255 },
    sizeStart: 0.1,
    sizeStartVariance: 0.03,
    sizeEnd: 0.12,
    sizeEndVariance: 0.02,
    lifetime: 2,
    lifetimeVariance: 0.5,
    rate: 15,
    maxParticles: 30,
    velocity: { x: 0, y: 0.5, z: 0 },
    velocityVariance: { x: 0.3, y: 0.2, z: 0.3 },
    opacityStart: 0.8,
    opacityEnd: 0,
    offset: { x: 0, y: -0.5, z: 0 },
  },
  particle2: {
    // Particule magique
    textureUri: "particles/magic.png",
    colorStart: { r: 150, g: 100, b: 255 },
    sizeStart: 0.08,
    sizeStartVariance: 0.02,
    sizeEnd: 0.15,
    sizeEndVariance: 0.03,
    lifetime: 2.5,
    lifetimeVariance: 0.6,
    rate: 12,
    maxParticles: 25,
    velocity: { x: 0, y: 0.4, z: 0 },
    velocityVariance: { x: 0.4, y: 0.3, z: 0.4 },
    opacityStart: 0.9,
    opacityEnd: 0,
    offset: { x: 0, y: -0.5, z: 0 },
  },
  particle3: {
    // Particule de fumée
    textureUri: "particles/smoke.png",
    colorStart: { r: 200, g: 200, b: 200 },
    sizeStart: 0.12,
    sizeStartVariance: 0.04,
    sizeEnd: 0.2,
    sizeEndVariance: 0.05,
    lifetime: 3,
    lifetimeVariance: 0.8,
    rate: 10,
    maxParticles: 20,
    velocity: { x: 0, y: 0.3, z: 0 },
    velocityVariance: { x: 0.5, y: 0.2, z: 0.5 },
    opacityStart: 0.6,
    opacityEnd: 0,
    offset: { x: 0, y: -0.5, z: 0 },
  },
};

/**
 * Gestionnaire de particules pour les joueurs
 * Permet de créer et gérer les émetteurs de particules attachés aux joueurs
 */
export class ParticleManager {
  /**
   * Crée un émetteur de particules pour un joueur selon le type sélectionné
   * @param particleType Type de particule à créer
   * @param playerEntity Entité du joueur à laquelle attacher les particules
   * @param world Monde dans lequel spawner les particules
   * @returns L'émetteur de particules créé
   */
  static createParticleEmitter(
    particleType: ParticleType,
    playerEntity: DefaultPlayerEntity,
    world: World
  ): ParticleEmitter {
    const config = PARTICLE_CONFIGS[particleType];

    const emitter = new ParticleEmitter({
      attachedToEntity: playerEntity,
      offset: config.offset,
      textureUri: config.textureUri,
      colorStart: config.colorStart,
      sizeStart: config.sizeStart,
      sizeStartVariance: config.sizeStartVariance,
      sizeEnd: config.sizeEnd,
      sizeEndVariance: config.sizeEndVariance,
      lifetime: config.lifetime,
      lifetimeVariance: config.lifetimeVariance,
      rate: config.rate,
      maxParticles: config.maxParticles,
      velocity: config.velocity,
      velocityVariance: config.velocityVariance,
      opacityStart: config.opacityStart,
      opacityEnd: config.opacityEnd,
    });

    emitter.spawn(world);
    return emitter;
  }

  /**
   * Vérifie si un type de particule est valide
   * @param particleType Type à vérifier
   * @returns true si le type est valide
   */
  static isValidParticleType(
    particleType: string
  ): particleType is ParticleType {
    return particleType in PARTICLE_CONFIGS;
  }

  /**
   * Retourne le type de particule par défaut
   * @returns Le type de particule par défaut
   */
  static getDefaultParticleType(): ParticleType {
    return "particle1";
  }
}
