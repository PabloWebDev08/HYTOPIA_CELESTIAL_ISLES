// Logique de l'île céleste 3
import { World } from "hytopia";
import { IslandBase } from "../shared/IslandBase";
import type { Position } from "../shared/types";
import { island3Config } from "./config";
import {
  createParkourEntities,
  getStartPosition as getParkourStartPosition,
  getPlatformPositionById as getParkourPlatformPositionById,
  type ParkourConfig,
} from "../shared/parkour";
import { createCoinEntities, type CoinConfig } from "../shared/coin";
import {
  createSpinningSawEntities,
  type SpinningSawConfig,
} from "../shared/spinning-saw";
import {
  createWelcomeNPC,
  createSkeletonSoldier,
  createSpeechBubble,
  createArrow,
} from "./welcomeNPCS";
// Import des données JSON pour l'île 3
import parkourData from "../../assets/islands/island3/parkour.json";
import coinData from "../../assets/islands/island3/coin.json";
import spinningSawData from "../../assets/islands/island3/spinning-saw.json";

/**
 * Classe représentant l'île céleste 3
 * Template vide prêt à être rempli lors de la création de l'île 3
 */
export class Island3 extends IslandBase {
  private parkourConfig: ParkourConfig;
  private coinConfig: CoinConfig;
  private spinningSawConfig: SpinningSawConfig;

  constructor() {
    super();
    // Charge les données JSON pour cette île
    this.parkourConfig = parkourData as ParkourConfig;
    this.coinConfig = coinData as CoinConfig;
    this.spinningSawConfig = spinningSawData as SpinningSawConfig;
  }

  /**
   * Crée toutes les entités spécifiques à l'île 3
   * @param world - Le monde où créer les entités
   */
  protected createEntities(world: World): void {
    // Crée les entités de parkour
    const parkourEntities = createParkourEntities(world, this.parkourConfig);
    this.entities.parkourEntities = parkourEntities;

    // Crée les entités de coins avec l'ID de l'île
    const coinEntities = createCoinEntities(world, this.coinConfig, "island3");
    this.entities.coinEntities = coinEntities;

    // Crée les entités de spinning-saws avec la position de départ
    const startPosition = this.getStartPosition();
    const spinningSawEntities = createSpinningSawEntities(
      world,
      this.spinningSawConfig,
      startPosition
    );
    this.entities.spinningSawEntities = spinningSawEntities;

    // Crée le NPC de bienvenue
    const welcomeNPC = createWelcomeNPC(world, island3Config.npcs.welcomeNPC);
    this.entities.npcs = [welcomeNPC];

    // Crée le skeleton soldier
    const skeletonSoldier = createSkeletonSoldier(
      world,
      island3Config.npcs.skeletonSoldier
    );
    this.entities.npcs.push(skeletonSoldier);

    // Crée les bulles de dialogue
    const mainBubble = createSpeechBubble(
      world,
      island3Config.speechBubbles.mainBubble
    );
    this.entities.speechBubbles = [mainBubble];

    // Crée les flèches
    const startArrow = createArrow(world, island3Config.arrows.startArrow);
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
