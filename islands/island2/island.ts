// Logique de l'île céleste 2
import { World } from "hytopia";
import { IslandBase } from "../shared/IslandBase";
import type { Position } from "../shared/types";
import { island2Config } from "./config";
import {
  createParkourEntities,
  getStartPosition as getParkourStartPosition,
  getPlatformPositionById as getParkourPlatformPositionById,
  type ParkourConfig,
} from "../shared/parkour";
import { createCoinEntities, type CoinConfig } from "../shared/coin";
import {
  createWelcomeNPC,
  createSkeletonSoldier,
  createSpeechBubble,
  createArrow,
} from "./welcomeNPCS";
// Import des données JSON pour l'île 2
import parkourData from "../../assets/islands/island2/parkour.json";
import coinData from "../../assets/islands/island2/coin.json";

/**
 * Classe représentant l'île céleste 2
 * Template vide prêt à être rempli lors de la création de l'île 2
 */
export class Island2 extends IslandBase {
  private parkourConfig: ParkourConfig;
  private coinConfig: CoinConfig;

  constructor() {
    super();
    // Charge les données JSON pour cette île
    this.parkourConfig = parkourData as ParkourConfig;
    this.coinConfig = coinData as CoinConfig;
  }

  /**
   * Crée toutes les entités spécifiques à l'île 2
   * @param world - Le monde où créer les entités
   */
  protected createEntities(world: World): void {
    // Crée les entités de parkour
    const parkourEntities = createParkourEntities(world, this.parkourConfig);
    this.entities.parkourEntities = parkourEntities;

    // Crée les entités de coins avec l'ID de l'île
    const coinEntities = createCoinEntities(world, this.coinConfig, "island2");
    this.entities.coinEntities = coinEntities;

    // Crée le NPC de bienvenue
    const welcomeNPC = createWelcomeNPC(world, island2Config.npcs.welcomeNPC);
    this.entities.npcs = [welcomeNPC];

    // Crée le skeleton soldier
    const skeletonSoldier = createSkeletonSoldier(
      world,
      island2Config.npcs.skeletonSoldier
    );
    this.entities.npcs.push(skeletonSoldier);

    // Crée les bulles de dialogue
    const mainBubble = createSpeechBubble(
      world,
      island2Config.speechBubbles.mainBubble
    );
    const secondBubble = createSpeechBubble(
      world,
      island2Config.speechBubbles.secondBubble,
      island2Config.speechBubbles.secondBubble.title,
      island2Config.speechBubbles.secondBubble.message
    );
    this.entities.speechBubbles = [mainBubble, secondBubble];

    // Crée les flèches
    const startArrow = createArrow(world, island2Config.arrows.startArrow);
    this.entities.arrows = [startArrow];
  }

  /**
   * Retourne la position de départ pour les joueurs
   * @returns La position de départ du parkour depuis le fichier JSON
   */
  getStartPosition(): Position {
    return getParkourStartPosition(this.parkourConfig);
  }

  /**
   * Retourne la position d'une plateforme par son ID
   * @param id - L'ID de la plateforme
   * @returns La position de la plateforme ou null si introuvable
   */
  getPlatformPositionById(id: string): Position | null {
    return getParkourPlatformPositionById(id, this.parkourConfig);
  }
}
