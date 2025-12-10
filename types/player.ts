/**
 * Types partagés pour la gestion des joueurs
 */

/**
 * Interface pour les données persistées du joueur concernant les coins
 */
export interface PlayerCoinData {
  gold?: number;
  collectedCoins?: string[];
  selectedIsland?: string; // Île sélectionnée par le joueur
  selectedParticle?: string; // Particule sélectionnée par le joueur
  ownedParticles?: string[]; // Particules possédées par le joueur
}

