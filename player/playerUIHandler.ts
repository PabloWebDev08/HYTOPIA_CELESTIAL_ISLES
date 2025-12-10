/**
 * Gestionnaire des événements UI des joueurs
 * Gère les interactions avec l'interface utilisateur (sélection d'île, particules, saut)
 */

import { Player, World, Audio } from "hytopia";
import { PlayerUIEvent } from "hytopia";
import { IslandWorldManager } from "../islands/worldManager";
import { ParticleManager } from "../particles/particleManager";
import type { ParticleType } from "../particles/particleManager";
import {
  purchaseParticle,
  ownsParticle,
} from "../islands/shared/particlePurchase";
import { hasUnlockedIsland } from "../islands/shared/coin";
import type { PlayerCoinData } from "../types/player";
import { PlayerService } from "./playerService";
import { isPlayerOnGround, calculateJumpForce } from "./jumpHandler";

/**
 * Gestionnaire des événements UI pour les joueurs
 */
export class PlayerUIHandler {
  constructor(
    private playerService: PlayerService,
    private islandWorldManager: IslandWorldManager,
    private islandMapMapping: Record<string, any>
  ) {}

  /**
   * Configure les handlers d'événements UI pour un joueur
   * @param player - Le joueur
   * @param world - Le monde où se trouve le joueur
   */
  setupUIHandlers(player: Player, world: World): void {
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      if (data.type === "select-island") {
        this.handleSelectIsland(player, world, data.islandId as string);
        return;
      }

      if (data.type === "select-particle") {
        this.handleSelectParticle(player, world, data.particleId as string);
        return;
      }

      if (data.type === "jump-held") {
        this.handleJumpHeld(player, world, data.duration as number);
        return;
      }

      if (data.type === "jump-charge-update") {
        this.handleJumpChargeUpdate(
          player,
          data.progress as number,
          data.visible as boolean
        );
        return;
      }
    });
  }

  /**
   * Gère la sélection d'une île par le joueur
   * @param player - Le joueur
   * @param world - Le monde actuel
   * @param islandId - L'ID de l'île sélectionnée
   */
  private handleSelectIsland(
    player: Player,
    world: World,
    islandId: string
  ): void {
    if (!islandId || !this.islandMapMapping[islandId]) {
      return;
    }

    // Vérifie si l'île est déverrouillée
    if (!hasUnlockedIsland(player, islandId)) {
      // L'île est verrouillée, envoie un message d'erreur au joueur
      world.chatManager.sendPlayerMessage(
        player,
        `🔒 Cette île est verrouillée ! Vous devez collecter le dernier coin de l'île précédente pour y accéder.`,
        "FF0000"
      );
      return;
    }

    // Sauvegarde l'île sélectionnée dans les données persistées du joueur
    const currentData = player.getPersistedData() as PlayerCoinData;
    player.setPersistedData({
      ...currentData,
      selectedIsland: islandId,
    } as Record<string, unknown>);

    // Récupère le monde correspondant à l'île sélectionnée
    const targetWorld = this.islandWorldManager.getWorldForIsland(islandId);
    if (targetWorld) {
      // Fait rejoindre le joueur au monde de l'île sélectionnée
      // Cela déclenchera LEFT_WORLD sur le monde actuel et JOINED_WORLD sur le nouveau monde
      player.joinWorld(targetWorld);

      // Envoie un message au joueur
      // Le message sera envoyé dans le nouveau monde après le changement
      // On utilise un setTimeout pour s'assurer que le joueur est dans le nouveau monde
      setTimeout(() => {
        const newWorld = this.islandWorldManager.getWorldForIsland(islandId);
        if (newWorld) {
          newWorld.chatManager.sendPlayerMessage(
            player,
            `Vous avez rejoint ${islandId}!`,
            "00FF00"
          );
        }
      }, 100);
    }
  }

  /**
   * Gère la sélection/achat d'une particule par le joueur
   * @param player - Le joueur
   * @param world - Le monde actuel
   * @param particleId - L'ID de la particule sélectionnée
   */
  private handleSelectParticle(
    player: Player,
    world: World,
    particleId: string
  ): void {
    if (!particleId || !ParticleManager.isValidParticleType(particleId)) {
      return;
    }

    // Vérifie si le joueur possède déjà la particule
    const alreadyOwned = ownsParticle(player, particleId);

    // Si la particule n'est pas possédée, tente de l'acheter
    if (!alreadyOwned) {
      const purchaseSuccess = purchaseParticle(player, world, particleId);
      if (!purchaseSuccess) {
        // L'achat a échoué (pas assez d'or)
        world.chatManager.sendPlayerMessage(
          player,
          "Il vous manque de l'OR",
          "FF0000"
        );
        return; // Arrête ici, ne sélectionne pas la particule
      }
    }

    // La particule est maintenant possédée (soit elle l'était déjà, soit l'achat a réussi)
    // Sauvegarde la particule sélectionnée dans les données persistées du joueur
    const currentData = player.getPersistedData() as PlayerCoinData;
    player.setPersistedData({
      ...currentData,
      selectedParticle: particleId,
    } as Record<string, unknown>);

    // Récupère l'entité du joueur dans le monde actuel
    const playerEntity = this.playerService.getPlayerEntity(player, world);

    // Ne procède que si l'entité du joueur existe
    if (playerEntity) {
      // Met à jour l'émetteur de particules du joueur
      const newEmitter = ParticleManager.createParticleEmitter(
        particleId as ParticleType,
        playerEntity,
        world
      );
      this.playerService.setParticleEmitter(player.id, newEmitter);

      // Envoie un message de confirmation au joueur
      world.chatManager.sendPlayerMessage(
        player,
        `Particule "${particleId}" appliquée !`,
        "00FF00"
      );
    }
  }

  /**
   * Gère le saut du joueur (bouton de saut relâché)
   * @param player - Le joueur
   * @param world - Le monde actuel
   * @param duration - Durée en millisecondes pendant laquelle le bouton a été maintenu
   */
  private handleJumpHeld(player: Player, world: World, duration: number): void {
    const playerEntity = this.playerService.getPlayerEntity(player, world);
    if (!playerEntity) {
      return;
    }

    // Vérifie si le joueur est au sol avant de permettre le saut
    if (!isPlayerOnGround(playerEntity, world)) {
      const jumpChargeSceneUI = this.playerService.getJumpChargeSceneUI(
        player.id
      );
      if (jumpChargeSceneUI) {
        jumpChargeSceneUI.setState({ progress: 0, visible: false });
      }
      return;
    }

    const holdDuration = duration || 0;
    const jumpForce = calculateJumpForce(holdDuration);

    // Applique l'impulsion de saut
    playerEntity.applyImpulse({ x: 0, y: jumpForce, z: 0 });

    // Joue le son de saut attaché au joueur
    new Audio({
      uri: "audio/sfx/cartoon-jump.mp3",
      loop: false,
      volume: 0.5,
      attachedToEntity: playerEntity,
    }).play(world);

    // Réinitialise la barre de charge
    const jumpChargeSceneUI = this.playerService.getJumpChargeSceneUI(
      player.id
    );
    if (jumpChargeSceneUI) {
      jumpChargeSceneUI.setState({ progress: 0, visible: false });
    }
  }

  /**
   * Gère la mise à jour de la barre de charge de saut
   * @param player - Le joueur
   * @param progress - Progression de la charge (0-1)
   * @param visible - Visibilité de la barre
   */
  private handleJumpChargeUpdate(
    player: Player,
    progress: number,
    visible: boolean
  ): void {
    const jumpChargeSceneUI = this.playerService.getJumpChargeSceneUI(
      player.id
    );
    if (jumpChargeSceneUI) {
      jumpChargeSceneUI.setState({
        progress: progress || 0,
        visible: visible || false,
      });
    }
  }
}
