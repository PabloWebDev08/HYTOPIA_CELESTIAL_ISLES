// Configuration de l'île céleste 2
import type { Position, PositionWithRotation } from "../shared/types";

/**
 * Configuration complète de l'île 2
 * À remplir lors de la création de l'île 2
 */
export const island2Config = {
  // Chemins vers les fichiers JSON de données
  parkourDataPath: "assets/islands/island2/parkour.json",
  coinDataPath: "assets/islands/island2/coin.json",

  // Positions des NPCs et entités décoratives
  npcs: {
    welcomeNPC: {
      x: -9.01,
      y: 8.2,
      z: 14.12,
      rotation: { x: 0, y: 1.5, z: 0, w: 1 },
    } as PositionWithRotation,
    skeletonSoldier: {
      x: 3.95,
      y: 8.6,
      z: 30.41,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    } as PositionWithRotation,
  },

  // Positions des bulles de dialogue
  speechBubbles: {
    mainBubble: { x: 0, y: 0, z: -2.08 } as Position,
  },

  // Positions des flèches
  arrows: {
    startArrow: { x: 0, y: 0, z: 0 } as Position,
  },
};
