// Gestionnaires d'événements UI pour les joueurs
import {
  Player,
  World,
  PlayerUIEvent,
  DefaultPlayerEntity,
  SceneUI,
  Audio,
  ParticleEmitter,
  WorldLoopEvent,
  type WorldMap,
} from "hytopia";
import { IslandWorldManager } from "../worldManager";
import { ParticleManager } from "../../particles/particleManager";
import type { ParticleType } from "../../particles/particleManager";
import { purchaseParticle, ownsParticle } from "./particlePurchase";
import { hasUnlockedIsland } from "./coin";
import type { PlayerCoinData } from "./types";
import {
  requestKinematicUpdateSuppression,
  setPendingIslandJoinMessage,
} from "./runtimeState";
import { sendInitialUIData } from "./playerInitialization";

/**
 * Interface pour les dépendances nécessaires aux handlers UI
 */
export interface PlayerUIHandlersDependencies {
  islandWorldManager: IslandWorldManager;
  playerEntitiesByWorld: Map<World, Map<string, DefaultPlayerEntity>>;
  playerParticleEmitters: Map<string, ParticleEmitter>;
  islandMapMapping: Record<string, WorldMap>;
}

/**
 * Interface pour les données d'événement de saut
 */
interface JumpEventData {
  type:
    | "jump-held"
    | "jump-charge-start"
    | "jump-charge-stop"
    | "jump-charge-update"; // rétro-compat (ancienne UI)
  duration?: number;
  progress?: number;
  visible?: boolean;
}

/**
 * Vérifie si le joueur est au sol en utilisant le contrôleur du SDK
 * Cette méthode est beaucoup plus performante que le raycast, surtout pour mobile
 * @param playerEntity - L'entité du joueur
 * @returns true si le joueur est au sol, false sinon
 */
function isPlayerOnGround(playerEntity: DefaultPlayerEntity): boolean {
  // Utilise la propriété isGrounded du contrôleur qui utilise des capteurs de collision
  // C'est beaucoup plus performant que le raycast, surtout pour mobile
  // DefaultPlayerEntity utilise toujours DefaultPlayerEntityController par défaut
  const controller = playerEntity.controller;

  // Vérifie si le contrôleur a la propriété isGrounded (propriété de DefaultPlayerEntityController)
  // Utilise une vérification de type basée sur les propriétés plutôt que instanceof
  if (
    controller &&
    "isGrounded" in controller &&
    typeof controller.isGrounded === "boolean"
  ) {
    return controller.isGrounded;
  }

  // Fallback: si le contrôleur n'est pas disponible ou n'a pas isGrounded,
  // on renvoie false (plus sûr) : un test basé sur la vélocité peut considérer "au sol"
  // au sommet d'un saut (vélocité proche de 0) et autoriser des doubles sauts selon le framerate.
  return false;
}

/**
 * Vérifie si le joueur peut sauter (au sol ou dans l'eau)
 * Permet le saut même dans l'eau après la mise à jour du SDK
 * @param playerEntity - L'entité du joueur
 * @returns true si le joueur peut sauter, false sinon
 */
function canPlayerJump(playerEntity: DefaultPlayerEntity): boolean {
  const controller = playerEntity.controller;

  // Vérifie si le joueur est au sol
  const isGrounded = isPlayerOnGround(playerEntity);

  // Vérifie si le joueur est dans l'eau (isSwimming est une propriété de DefaultPlayerEntityController)
  let isSwimming = false;
  if (
    controller &&
    "isSwimming" in controller &&
    typeof controller.isSwimming === "boolean"
  ) {
    isSwimming = controller.isSwimming;
  }

  // Le joueur peut sauter s'il est au sol OU dans l'eau
  return isGrounded || isSwimming;
}

/**
 * Gère la sélection d'île par le joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param islandId - L'ID de l'île sélectionnée
 * @param deps - Les dépendances nécessaires
 */
function handleSelectIsland(
  player: Player,
  world: World,
  islandId: string,
  deps: PlayerUIHandlersDependencies
): void {
  if (!deps.islandMapMapping[islandId]) {
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

  const currentData = player.getPersistedData() as PlayerCoinData;
  player.setPersistedData({
    ...currentData,
    selectedIsland: islandId,
  } as Record<string, unknown>);

  // Récupère le monde correspondant à l'île sélectionnée
  const targetWorld = deps.islandWorldManager.getWorldForIsland(islandId);
  if (targetWorld) {
    // IMPORTANT (SDK-friendly):
    // Player.joinWorld() implique une reconnexion côté client. Pour éviter que le client
    // reçoive des updates d'entités kinematic avant leurs SPAWN, on gèle temporairement
    // les mouvements réseau dans le monde cible (voir check dans islands/shared/parkour.ts).
    requestKinematicUpdateSuppression(targetWorld, 1200);

    // IMPORTANT:
    // On nettoie les ressources du joueur AVANT le changement de monde.
    // Sinon, le handler LEFT_WORLD (ancien monde) peut despawn après que le client
    // ait déjà réinitialisé son EntityManager pour le nouveau monde, ce qui génère
    // des erreurs du type "Entity X not created ... missing fields" côté client.
    const worldPlayerMap = deps.playerEntitiesByWorld.get(world);
    const playerEntity = worldPlayerMap?.get(player.id);
    if (playerEntity?.isSpawned) {
      playerEntity.despawn();
    }
    if (worldPlayerMap) {
      worldPlayerMap.delete(player.id);
      // Optionnel: si plus aucun joueur tracké dans ce monde, on peut nettoyer la map
      if (worldPlayerMap.size === 0) {
        deps.playerEntitiesByWorld.delete(world);
      }
    }

    const particleEmitter = deps.playerParticleEmitters.get(player.id);
    if (particleEmitter) {
      particleEmitter.despawn();
      deps.playerParticleEmitters.delete(player.id);
    }

    cleanupJumpAudio(player.id);

    // Fait rejoindre le joueur au monde de l'île sélectionnée
    // Cela déclenchera LEFT_WORLD sur le monde actuel et JOINED_WORLD sur le nouveau monde
    // On stocke une intention de message à afficher dans le nouveau monde (sans setTimeout).
    setPendingIslandJoinMessage(player.id, islandId);
    player.joinWorld(targetWorld);
  }
}

/**
 * Gère la sélection/achat de particule par le joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param particleId - L'ID de la particule sélectionnée
 * @param deps - Les dépendances nécessaires
 */
function handleSelectParticle(
  player: Player,
  world: World,
  particleId: string,
  deps: PlayerUIHandlersDependencies
): void {
  if (!ParticleManager.isValidParticleType(particleId)) {
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

  // Récupère d'abord l'entité du joueur dans le monde actuel
  const worldPlayerMap = deps.playerEntitiesByWorld.get(world);
  const playerEntity = worldPlayerMap?.get(player.id);

  // Ne procède que si l'entité du joueur existe
  if (playerEntity) {
    // Récupère l'émetteur de particules actuel du joueur
    const currentEmitter = deps.playerParticleEmitters.get(player.id);
    if (currentEmitter) {
      // Détruit l'ancien émetteur de particules
      currentEmitter.despawn();
      deps.playerParticleEmitters.delete(player.id);
    }

    // Crée un nouvel émetteur de particules avec le type sélectionné
    const newEmitter = ParticleManager.createParticleEmitter(
      particleId as ParticleType,
      playerEntity,
      world
    );
    deps.playerParticleEmitters.set(player.id, newEmitter);

    // Envoie un message de confirmation au joueur
    world.chatManager.sendPlayerMessage(
      player,
      `Particule "${particleId}" appliquée !`,
      "00FF00"
    );
  }
}

/**
 * Cache pour les instances Audio de saut par joueur
 * Permet de réutiliser les instances Audio au lieu d'en créer de nouvelles à chaque saut
 * Cela améliore les performances, surtout sur mobile
 */
const jumpAudioCache = new Map<string, Audio>();

/**
 * Cache pour l'animation de la barre de charge de saut (SceneUI) par joueur.
 * Mobile-first: on évite d'envoyer la progression depuis l'UI (spam réseau).
 * Le serveur calcule la progression en fonction du temps et pousse des updates à fréquence limitée.
 */
type JumpChargeTicker = {
  world: World;
  tickHandler: ({ tickDeltaMs }: { tickDeltaMs: number }) => void;
};

const jumpChargeTickerCache = new Map<string, JumpChargeTicker>();

// Doit correspondre à la durée max côté UI (assets/ui/index.html)
const JUMP_CHARGE_MAX_HOLD_DURATION_MS = 1000;
// Fréquence des updates serveur → client pour une animation fluide mais légère (mobile)
const JUMP_CHARGE_UI_UPDATE_INTERVAL_MS = 66; // ~15 Hz

function stopJumpChargeProgressUpdates(playerId: string): void {
  const existing = jumpChargeTickerCache.get(playerId);
  if (!existing) return;

  existing.world.loop.off(WorldLoopEvent.TICK_START, existing.tickHandler);
  jumpChargeTickerCache.delete(playerId);
}

function startJumpChargeProgressUpdates(
  playerEntity: DefaultPlayerEntity,
  world: World,
  jumpChargeSceneUI: SceneUI
): void {
  const playerId = playerEntity.player.id;

  // Évite d'empiler plusieurs tick handlers
  stopJumpChargeProgressUpdates(playerId);

  const startTimeMs = Date.now();
  let accumulatedMs = 0;
  let isMaxed = false;

  // Affiche immédiatement la barre à 0
  jumpChargeSceneUI.setState({ progress: 0, visible: true });

  const tickHandler = ({ tickDeltaMs }: { tickDeltaMs: number }) => {
    // Nettoyage automatique si le joueur n'est plus valide dans ce monde
    if (
      !playerEntity.isSpawned ||
      !playerEntity.world ||
      playerEntity.world !== world
    ) {
      stopJumpChargeProgressUpdates(playerId);
      return;
    }

    // Si on a déjà atteint 100%, inutile de recalculer à chaque tick
    if (isMaxed) return;

    accumulatedMs += tickDeltaMs;
    if (accumulatedMs < JUMP_CHARGE_UI_UPDATE_INTERVAL_MS) return;
    accumulatedMs = 0;

    const elapsedMs = Date.now() - startTimeMs;
    const progress = Math.min(elapsedMs / JUMP_CHARGE_MAX_HOLD_DURATION_MS, 1);

    jumpChargeSceneUI.setState({ progress, visible: true });

    if (progress >= 1) {
      isMaxed = true;
    }
  };

  world.loop.on(WorldLoopEvent.TICK_START, tickHandler);
  jumpChargeTickerCache.set(playerId, { world, tickHandler });
}

/**
 * Cache pour suivre l'état de nage précédent de chaque joueur
 * Permet de détecter quand le joueur entre dans l'eau
 */
const playerSwimmingStateCache = new Map<string, boolean>();

/**
 * Cache pour les instances Audio d'éclaboussure par joueur
 * Permet de réutiliser les instances Audio pour les sons d'eau
 */
const splashAudioCache = new Map<string, Audio>();

/**
 * Cache pour les instances Audio "nage" (boucle) par joueur
 * Mobile-first: on réutilise l'instance au lieu d'en recréer une à chaque entrée/sortie de l'eau
 */
const swimLoopAudioCache = new Map<string, Audio>();

/**
 * Gère les événements de saut (jump-held et jump-charge-update)
 * Optimisé pour mobile avec utilisation des bonnes pratiques du SDK
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde actuel
 * @param jumpChargeSceneUI - La SceneUI de la barre de charge
 * @param data - Les données de l'événement
 */
function handleJumpEvents(
  playerEntity: DefaultPlayerEntity,
  world: World,
  jumpChargeSceneUI: SceneUI,
  data: JumpEventData
): void {
  // Validation de base
  if (!playerEntity.isSpawned || !world) {
    return;
  }

  if (data.type === "jump-charge-start") {
    // Démarre l'animation côté serveur (pas de spam réseau depuis l'UI)
    startJumpChargeProgressUpdates(playerEntity, world, jumpChargeSceneUI);
    return;
  }

  if (data.type === "jump-charge-stop") {
    // Stoppe l'animation et cache la barre
    stopJumpChargeProgressUpdates(playerEntity.player.id);
    jumpChargeSceneUI.setState({ progress: 0, visible: false });
    return;
  }

  if (data.type === "jump-held") {
    // Sécurité: stoppe aussi l'animation ici (au cas où "stop" arrive en retard)
    stopJumpChargeProgressUpdates(playerEntity.player.id);

    // Vérifie si le joueur peut sauter (au sol ou dans l'eau)
    // Permet le saut dans l'eau après la mise à jour du SDK
    if (!canPlayerJump(playerEntity)) {
      jumpChargeSceneUI.setState({ progress: 0, visible: false });
      return;
    }

    // Vérifie également la vélocité verticale pour éviter les doubles sauts
    // Si le joueur monte déjà rapidement, ignore le saut (protection anti-spam)
    const currentVelocity = playerEntity.linearVelocity;
    if (currentVelocity.y > 2) {
      jumpChargeSceneUI.setState({ progress: 0, visible: false });
      return;
    }

    const duration = Math.max(0, data.duration || 0);

    // Configuration du saut
    const minJumpForce = 10;
    const maxJumpForce = 40;
    const maxHoldDuration = 1000;

    // Calcule la force de saut basée sur la durée de maintien
    const normalizedDuration = Math.min(duration / maxHoldDuration, 1);
    const jumpForce =
      minJumpForce + normalizedDuration * (maxJumpForce - minJumpForce);

    // Applique l'impulsion de saut
    // Note: applyImpulse est la méthode recommandée par le SDK pour les sauts personnalisés
    playerEntity.applyImpulse({ x: 0, y: jumpForce, z: 0 });

    // Joue le son de saut en réutilisant l'instance Audio si elle existe
    // Cela évite de créer une nouvelle instance à chaque saut, améliorant les performances
    const playerId = playerEntity.player.id;
    let jumpAudio = jumpAudioCache.get(playerId);

    // Vérifie si l'instance Audio existe et si l'entité attachée est toujours valide
    // Après un changement de map, l'entité peut être désactivée, il faut donc recréer l'audio
    if (
      !jumpAudio ||
      !jumpAudio.attachedToEntity ||
      !jumpAudio.attachedToEntity.isSpawned
    ) {
      // Crée une nouvelle instance Audio si elle n'existe pas ou si l'entité attachée n'est plus valide
      jumpAudio = new Audio({
        uri: "audio/sfx/cartoon-jump.mp3",
        loop: false,
        volume: 0.5,
        attachedToEntity: playerEntity,
      });
      jumpAudioCache.set(playerId, jumpAudio);
    }

    // Joue le son en forçant la relecture (restart: true)
    // Cela permet de jouer le son même s'il est déjà en cours de lecture
    // Sans restart: true, play() ne fait rien si l'audio est déjà en train de jouer
    jumpAudio.play(world, true);

    // Réinitialise la barre de charge
    jumpChargeSceneUI.setState({ progress: 0, visible: false });
  } else if (data.type === "jump-charge-update") {
    // Met à jour la barre de charge pendant le maintien du bouton
    // Clamp les valeurs pour éviter les valeurs invalides
    const progress = Math.max(0, Math.min(1, data.progress || 0));
    const visible = data.visible ?? false;

    // Si un ancien client envoie encore des updates, on stoppe le ticker serveur
    // et on se contente d'appliquer la valeur reçue.
    stopJumpChargeProgressUpdates(playerEntity.player.id);

    jumpChargeSceneUI.setState({
      progress,
      visible,
    });
  }
}

/**
 * Vérifie si le joueur vient d'entrer dans l'eau et joue le son d'éclaboussure si nécessaire
 * @param playerEntity - L'entité du joueur
 * @param world - Le monde actuel
 */
export function checkWaterEntry(
  playerEntity: DefaultPlayerEntity,
  world: World
): void {
  const controller = playerEntity.controller;
  if (!controller) return;

  // Vérifie si le joueur est dans l'eau
  let isSwimming = false;
  if (
    "isSwimming" in controller &&
    typeof controller.isSwimming === "boolean"
  ) {
    isSwimming = controller.isSwimming;
  }

  const playerId = playerEntity.player.id;
  const wasSwimming = playerSwimmingStateCache.get(playerId) ?? false;

  // Si le joueur vient d'entrer dans l'eau (transition de false à true)
  if (!wasSwimming && isSwimming) {
    // Récupère ou crée l'instance Audio d'éclaboussure
    let splashAudio = splashAudioCache.get(playerId);

    // Vérifie si l'instance Audio existe et si l'entité attachée est toujours valide
    if (
      !splashAudio ||
      !splashAudio.attachedToEntity ||
      !splashAudio.attachedToEntity.isSpawned
    ) {
      // Crée une nouvelle instance Audio si elle n'existe pas ou si l'entité attachée n'est plus valide
      splashAudio = new Audio({
        uri: "audio/sfx/liquid/large-splash.mp3",
        loop: false,
        volume: 0.25,
        attachedToEntity: playerEntity,
      });
      splashAudioCache.set(playerId, splashAudio);
    }

    // Joue le son d'éclaboussure
    splashAudio.play(world, true);

    // Démarre le son de nage (boucle) tant que le joueur est dans l'eau
    let swimAudio = swimLoopAudioCache.get(playerId);

    // Vérifie si l'instance Audio existe et si l'entité attachée est toujours valide
    if (
      !swimAudio ||
      !swimAudio.attachedToEntity ||
      !swimAudio.attachedToEntity.isSpawned
    ) {
      swimAudio = new Audio({
        uri: "audio/sfx/swimming-sounds.mp3",
        loop: true,
        volume: 0.25,
        attachedToEntity: playerEntity,
      });
      swimLoopAudioCache.set(playerId, swimAudio);
    }

    // restart=true: garantit un démarrage immédiat à l'entrée dans l'eau
    swimAudio.play(world, true);
  }

  // Si le joueur vient de sortir de l'eau (transition de true à false)
  if (wasSwimming && !isSwimming) {
    const swimAudio = swimLoopAudioCache.get(playerId);
    swimAudio?.pause();
  }

  // Met à jour l'état de nage dans le cache
  playerSwimmingStateCache.set(playerId, isSwimming);
}

/**
 * Nettoie le cache Audio pour un joueur donné
 * À appeler quand un joueur quitte le monde pour éviter les fuites mémoire
 * @param playerId - L'ID du joueur
 */
export function cleanupJumpAudio(playerId: string): void {
  jumpAudioCache.delete(playerId);
  splashAudioCache.delete(playerId);
  const swimAudio = swimLoopAudioCache.get(playerId);
  swimAudio?.pause();
  swimLoopAudioCache.delete(playerId);
  playerSwimmingStateCache.delete(playerId);
  stopJumpChargeProgressUpdates(playerId);
}

/**
 * Configure tous les handlers d'événements UI pour un joueur
 * @param player - Le joueur
 * @param world - Le monde actuel
 * @param playerEntity - L'entité du joueur
 * @param jumpChargeSceneUI - La SceneUI de la barre de charge
 * @param deps - Les dépendances nécessaires
 */
export function setupPlayerUIHandlers(
  player: Player,
  world: World,
  playerEntity: DefaultPlayerEntity,
  jumpChargeSceneUI: SceneUI,
  deps: PlayerUIHandlersDependencies
): void {
  // IMPORTANT:
  // `setupPlayerUIHandlers` est appelé à chaque JOINED_WORLD. Le Player persiste entre les mondes,
  // donc sans nettoyage on empile les listeners → événements UI traités plusieurs fois
  // (ex: saut doublé, actions répétées).
  player.ui.offAll(PlayerUIEvent.DATA);

  // Écoute les messages de l'UI
  player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
    // Handshake: l'UI notifie qu'elle est prête → on envoie les données initiales.
    if (data.type === "ui-ready") {
      sendInitialUIData(player);
      return;
    }

    if (data.type === "select-island") {
      const islandId = data.islandId as string;
      if (islandId) {
        handleSelectIsland(player, world, islandId, deps);
      }
      return;
    }

    if (data.type === "select-particle") {
      const particleId = data.particleId as string;
      if (particleId) {
        handleSelectParticle(player, world, particleId, deps);
      }
      return;
    }

    if (
      data.type === "jump-held" ||
      data.type === "jump-charge-start" ||
      data.type === "jump-charge-stop" ||
      data.type === "jump-charge-update"
    ) {
      handleJumpEvents(
        playerEntity,
        world,
        jumpChargeSceneUI,
        data as JumpEventData
      );
    }
  });
}
