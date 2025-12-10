import { Player, World } from "hytopia";

/**
 * Interface pour les données persistées du joueur concernant les coins et particules
 */
interface PlayerCoinData {
  gold?: number;
  collectedCoins?: string[];
  selectedIsland?: string;
  selectedParticle?: string;
  ownedParticles?: string[]; // Particules possédées par le joueur
}

/**
 * Prix d'une particule en or
 */
export const PARTICLE_COST = 15;

/**
 * Particules données par défaut à tous les joueurs (gratuites)
 */
export const DEFAULT_PARTICLES = ["particle1", "particle2", "particle3"];

/**
 * Vérifie si le joueur peut acheter une particule
 * @param player - Le joueur qui veut acheter
 * @param particleId - L'ID de la particule à acheter
 * @returns true si le joueur peut acheter la particule (a assez d'or et ne la possède pas déjà)
 */
export function canPurchaseParticle(
  player: Player,
  particleId: string
): boolean {
  const playerData = player.getPersistedData() as PlayerCoinData | undefined;

  // Initialise les données si elles n'existent pas
  if (!playerData || playerData.gold === undefined) {
    return false;
  }

  // Les particules par défaut ne peuvent pas être achetées
  if (DEFAULT_PARTICLES.includes(particleId)) {
    return false; // Déjà possédée par défaut, pas besoin d'acheter
  }

  // Vérifie si le joueur possède déjà la particule
  const ownedParticles = playerData.ownedParticles || [];
  if (ownedParticles.includes(particleId)) {
    return false; // Déjà possédée, pas besoin d'acheter
  }

  // Vérifie si le joueur a assez d'or
  return (playerData.gold || 0) >= PARTICLE_COST;
}

/**
 * Achète une particule pour le joueur
 * Déduit l'or et ajoute la particule à la liste des particules possédées
 * @param player - Le joueur qui achète
 * @param world - Le monde où se trouve le joueur
 * @param particleId - L'ID de la particule à acheter
 * @returns true si l'achat a réussi, false sinon
 */
export function purchaseParticle(
  player: Player,
  world: World,
  particleId: string
): boolean {
  // Récupère les données persistées du joueur
  let playerData = player.getPersistedData() as PlayerCoinData | undefined;

  // Initialise les données si elles n'existent pas
  if (playerData === undefined || playerData.gold === undefined) {
    playerData = {
      gold: 0,
      collectedCoins: [],
      ownedParticles: [],
    };
  }

  // Initialise les propriétés manquantes si nécessaire
  if (!playerData.gold) {
    playerData.gold = 0;
  }
  if (!playerData.collectedCoins) {
    playerData.collectedCoins = [];
  }
  if (!playerData.ownedParticles) {
    playerData.ownedParticles = [];
  }

  // Les particules par défaut ne peuvent pas être achetées (elles sont déjà possédées)
  if (DEFAULT_PARTICLES.includes(particleId)) {
    return true; // Déjà possédée par défaut, considéré comme un succès
  }

  // Vérifie si le joueur possède déjà la particule
  if (playerData.ownedParticles.includes(particleId)) {
    return true; // Déjà possédée, considéré comme un succès
  }

  // Vérifie si le joueur a assez d'or
  if ((playerData.gold || 0) < PARTICLE_COST) {
    return false; // Pas assez d'or
  }

  // Déduit l'or
  playerData.gold = (playerData.gold || 0) - PARTICLE_COST;

  // Ajoute la particule à la liste des particules possédées
  playerData.ownedParticles.push(particleId);

  // Sauvegarde les données persistées
  player.setPersistedData({
    gold: playerData.gold,
    collectedCoins: playerData.collectedCoins,
    selectedIsland: playerData.selectedIsland,
    selectedParticle: playerData.selectedParticle,
    ownedParticles: playerData.ownedParticles,
  } as Record<string, unknown>);

  // Met à jour l'or dans l'UI du joueur
  player.ui.sendData({
    type: "gold-update",
    gold: playerData.gold,
  });

  // Met à jour les particules possédées dans l'UI du joueur
  // S'assure que les particules par défaut sont toujours incluses
  const allOwnedParticles = [
    ...new Set([...DEFAULT_PARTICLES, ...playerData.ownedParticles]),
  ];
  player.ui.sendData({
    type: "owned-particles-update",
    ownedParticles: allOwnedParticles,
  });

  return true;
}

/**
 * Vérifie si le joueur possède une particule
 * @param player - Le joueur
 * @param particleId - L'ID de la particule
 * @returns true si le joueur possède la particule
 */
export function ownsParticle(player: Player, particleId: string): boolean {
  // Les particules par défaut sont toujours possédées
  if (DEFAULT_PARTICLES.includes(particleId)) {
    return true;
  }
  const playerData = player.getPersistedData() as PlayerCoinData | undefined;
  const ownedParticles = playerData?.ownedParticles || [];
  return ownedParticles.includes(particleId);
}
