/**
 * Fichier wrapper pour la compatibilité avec coin.ts
 * Ce fichier réexporte les fonctions de l'île 1 par défaut
 * Pour utiliser les NPCs d'une île spécifique, importez directement depuis islands/islandX/welcomeNPCS.ts
 */

// Réexporte toutes les fonctions de l'île 1 pour la compatibilité
export {
  createWelcomeNPC,
  createBoat,
  createSkeletonSoldier,
  createSpeechBubble,
  createArrow,
  updateAllSkeletonSoldiersLeaderboard,
} from "./islands/island1/welcomeNPCS";
