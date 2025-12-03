// Logique de l'île céleste 1
import { World, Entity } from "hytopia";
import { IslandBase } from "../shared/IslandBase";
import type { Position, IslandEntities } from "../shared/types";
import { island1Config } from "./config";
import {
  createParkourEntities,
  getStartPosition as getParkourStartPosition,
  getPlatformPositionById as getParkourPlatformPositionById,
  type ParkourConfig,
} from "../../parkour";
import { createCoinEntities, type CoinConfig } from "../../coin";
import {
  createWelcomeNPC,
  createBoat,
  createSkeletonSoldier,
  createSpeechBubble,
  createArrow,
} from "../../welcomeNPCS";
// Import des données JSON pour l'île 1
import parkourData from "../../assets/islands/island1/parkour.json";
import coinData from "../../assets/islands/island1/coin.json";

/**
 * Classe représentant l'île céleste 1
 * Implémente toute la logique de création des entités de cette île
 */
export class Island1 extends IslandBase {
  private parkourConfig: ParkourConfig;
  private coinConfig: CoinConfig;

  constructor() {
    super();
    // Charge les données JSON pour cette île
    this.parkourConfig = parkourData as ParkourConfig;
    this.coinConfig = coinData as CoinConfig;
  }

  /**
   * Crée toutes les entités spécifiques à l'île 1
   * @param world - Le monde où créer les entités
   */
  protected createEntities(world: World): void {
    // Crée les entités de parkour
    const parkourEntities = createParkourEntities(world, this.parkourConfig);
    this.entities.parkourEntities = parkourEntities;

    // Crée les entités de coins
    const coinEntities = createCoinEntities(world, this.coinConfig);
    this.entities.coinEntities = coinEntities;

    // Crée le NPC de bienvenue
    const welcomeNPC = createWelcomeNPC(world, island1Config.npcs.welcomeNPC);
    this.entities.npcs = [welcomeNPC];

    // Crée le skeleton soldier
    const skeletonSoldier = createSkeletonSoldier(
      world,
      island1Config.npcs.skeletonSoldier
    );
    this.entities.npcs.push(skeletonSoldier);

    // Crée le bateau
    const boat = createBoat(world, island1Config.boats.mainBoat);
    this.entities.boats = [boat];

    // Crée la bulle de dialogue
    const speechBubble = createSpeechBubble(
      world,
      island1Config.speechBubbles.mainBubble
    );
    this.entities.speechBubbles = [speechBubble];

    // Crée les flèches
    const startArrow = createArrow(world, island1Config.arrows.startArrow);
    const boatArrow = createArrow(world, island1Config.arrows.boatArrow, false);
    this.entities.arrows = [startArrow, boatArrow];
  }

  /**
   * Retourne la position de départ pour les joueurs
   * @returns La position de départ du parkour
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
