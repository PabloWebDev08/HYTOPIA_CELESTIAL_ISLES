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
      x: -9.79,
      y: 13.2,
      z: -2.53,
      rotation: { x: 0, y: 1.5, z: 0, w: 1 },
    } as PositionWithRotation,
    skeletonSoldier: {
      x: -1.16,
      y: 12.6,
      z: 24.83,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    } as PositionWithRotation,
  },

  // Positions des bulles de dialogue
  speechBubbles: {
    mainBubble: {
      x: 39.91,
      y: 146.5,
      z: 17.83,
      rotation: { x: 0, y: 1, z: 0, w: 1 },
    } as PositionWithRotation,
    secondBubble: {
      x: 22.36,
      y: 61.5,
      z: 51.05,
      rotation: { x: 0, y: 1, z: 0, w: 1 },
      title: "Attention !",
      message:
        "Attendez que la plateforme soit sur le chemin retour pour commencer a sauter.",
    } as PositionWithRotation & { title?: string; message?: string },
  },

  // Positions des flèches
  arrows: {
    startArrow: { x: 3.67, y: 19, z: 1.01 } as Position,
  },
};
