// Configuration de l'île céleste 1
import type { Position } from "../shared/types";

/**
 * Configuration complète de l'île 1
 */
export const island1Config = {
  // Chemins vers les fichiers JSON de données
  parkourDataPath: "assets/islands/island1/parkour.json",
  coinDataPath: "assets/islands/island1/coin.json",

  // Positions des NPCs et entités décoratives
  npcs: {
    welcomeNPC: { x: 5.77, y: 14.3, z: 4.05 } as Position,
    skeletonSoldier: { x: 4.91, y: 13.3, z: -19.78 } as Position,
  },

  // Positions des bateaux
  boats: {
    mainBoat: { x: 26.95, y: 12.5, z: 35.6 } as Position,
  },

  // Positions des bulles de dialogue
  speechBubbles: {
    mainBubble: { x: 12.95, y: 152, z: -3.51 } as Position,
  },

  // Positions des flèches
  arrows: {
    startArrow: { x: 21.66, y: 13, z: 24.41 } as Position,
    boatArrow: { x: 27.08, y: 14.08, z: 36.09 } as Position,
  },
};
