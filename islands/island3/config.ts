// Configuration de l'île céleste 3
import type { Position, PositionWithRotation } from "../shared/types";

/**
 * Configuration complète de l'île 3
 * À remplir lors de la création de l'île 3
 */
export const island3Config = {
  // Chemins vers les fichiers JSON de données
  parkourDataPath: "assets/islands/island3/parkour.json",
  coinDataPath: "assets/islands/island3/coin.json",
  spinningSawDataPath: "assets/islands/island3/spinning-saw.json",

  // Positions des NPCs et entités décoratives
  npcs: {
    welcomeNPC: {
      x: 7.33,
      y: 14.2,
      z: -8.71,
      rotation: { x: 0, y: 1, z: 0, w: 1 },
    } as PositionWithRotation,
    skeletonSoldier: {
      x: -16.86,
      y: 13.6,
      z: -1.48,
      rotation: { x: 0, y: -1, z: 0, w: 1 },
    } as PositionWithRotation,
  },

  // Positions des bulles de dialogue
  speechBubbles: {
    mainBubble: {
      x: 1.59,
      y: 151.29,
      z: 3.48,
      rotation: { x: 0, y: 1, z: 0, w: 1 },
    } as PositionWithRotation,
  },
  // Positions des flèches
  arrows: {
    startArrow: { x: 0.53, y: 14.79, z: 3.95 } as Position,
  },
};
