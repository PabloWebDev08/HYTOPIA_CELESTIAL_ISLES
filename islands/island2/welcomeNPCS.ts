import { Entity, World, RigidBodyType, SceneUI, Quaternion } from "hytopia";
import { getLeaderboard } from "../../coin";
import type { PositionWithRotation } from "../shared/types";

// ID de l'île pour ce fichier
const ISLAND_ID = "island2";

// Stocke toutes les instances de skeleton soldiers créées pour pouvoir les mettre à jour
const skeletonSoldierInstances: SkeletonSoldierEntity[] = [];

/**
 * NPC de bienvenue qui affiche une carte de bienvenue au-dessus de lui
 */
class WelcomeNPC extends Entity {
  private welcomeCardSceneUI: SceneUI | null = null;

  constructor() {
    super({
      modelUri: "models/npcs/bonecaambalabu.gltf",
      name: "Welcome NPC",
      modelScale: 1,
      modelLoopedAnimations: ["idle"],
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // NPC fixe qui ne bouge pas
      },
    });
  }

  /**
   * Crée et charge la SceneUI de la carte de bienvenue
   * Doit être appelé après que l'entité soit spawnée
   */
  public setupWelcomeCard(): void {
    if (!this.world) return;

    // Crée la SceneUI pour la carte de bienvenue
    this.welcomeCardSceneUI = new SceneUI({
      templateId: "welcome-npc-card",
      attachedToEntity: this,
      offset: { x: 0, y: 2.5, z: 0 }, // Au-dessus de la tête du NPC
      state: {
        visible: true, // Affiche la carte en permanence
        title: "Bienvenue sur l'île céleste 2 !",
        message:
          "Message de bienvenue pour l'île 2. <br> À personnaliser selon vos besoins.",
      },
      viewDistance: 30, // Visible jusqu'à 30 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.welcomeCardSceneUI.load(this.world);
  }
}
/**
 * Crée et spawn le NPC de bienvenue dans le monde
 * @param world - Le monde où spawner le NPC
 * @param position - La position où spawner le NPC avec rotation optionnelle (optionnel, par défaut à l'origine)
 * @returns L'entité NPC créée
 */
export function createWelcomeNPC(
  world: World,
  position: PositionWithRotation = { x: 8.13, y: 13, z: 0 }
): WelcomeNPC {
  const npc = new WelcomeNPC();

  // Convertit la rotation en Quaternion si fournie
  const rotation = position.rotation
    ? new Quaternion(
        position.rotation.x,
        position.rotation.y,
        position.rotation.z,
        position.rotation.w
      )
    : undefined;

  npc.spawn(world, position, rotation);

  // Configure la carte de bienvenue après le spawn
  // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
  setTimeout(() => {
    npc.setupWelcomeCard();
  }, 100);

  return npc;
}

/**
 * Met à jour le leaderboard de tous les skeleton soldiers créés
 * Cette fonction peut être appelée depuis coin.ts quand le leaderboard change
 * @param leaderboard - Les nouvelles données du leaderboard
 */
export function updateAllSkeletonSoldiersLeaderboard(
  leaderboard: Array<{ playerName: string; timestamp: number }>
): void {
  console.log(
    `[Island2] Mise à jour de ${skeletonSoldierInstances.length} skeleton soldiers avec le nouveau leaderboard`
  );
  skeletonSoldierInstances.forEach((skeletonSoldier) => {
    skeletonSoldier.updateLeaderboard(leaderboard);
  });
}

/**
 * Entité de skeleton soldier
 */
class SkeletonSoldierEntity extends Entity {
  private leaderboardSceneUI: SceneUI | null = null;

  constructor() {
    super({
      modelUri: "models/npcs/skeleton-soldier.gltf",
      name: "Skeleton Soldier",
      modelScale: 1,
      modelLoopedAnimations: ["idle"],
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // NPC fixe qui ne bouge pas
      },
    });
  }

  /**
   * Crée et charge la SceneUI du leaderboard attachée au skeleton soldier
   * Doit être appelé après que l'entité soit spawnée
   */
  public async setupLeaderboard(): Promise<void> {
    if (!this.world) return;

    // Récupère le leaderboard initial pour cette île
    const leaderboard = await getLeaderboard(ISLAND_ID);

    // Crée la SceneUI pour le leaderboard
    this.leaderboardSceneUI = new SceneUI({
      templateId: "skeleton-leaderboard",
      attachedToEntity: this,
      offset: { x: 0, y: 3, z: 0 }, // Au-dessus du skeleton soldier
      state: {
        visible: true, // Affiche le leaderboard en permanence
        title: "🏆 Leaderboard 🏆",
        subtitle: "Les 10 derniers joueurs à avoir terminé le niveau",
        leaderboard: leaderboard,
      },
      viewDistance: 30, // Visible jusqu'à 30 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.leaderboardSceneUI.load(this.world);
  }

  /**
   * Met à jour le leaderboard affiché
   * @param leaderboard - Les nouvelles données du leaderboard
   */
  public updateLeaderboard(
    leaderboard: Array<{ playerName: string; timestamp: number }>
  ): void {
    if (this.leaderboardSceneUI) {
      console.log(
        `[Island2] Mise à jour du leaderboard avec ${leaderboard.length} entrées`
      );
      this.leaderboardSceneUI.setState({
        visible: true,
        title: "🏆 Leaderboard 🏆",
        subtitle: "Les 10 derniers joueurs à avoir terminé le niveau",
        leaderboard: leaderboard,
      });
    } else {
      console.warn(
        "[Island2] Impossible de mettre à jour le leaderboard : leaderboardSceneUI est null"
      );
    }
  }
}

/**
 * Crée et spawn le skeleton soldier dans le monde
 * @param world - Le monde où spawner le skeleton soldier
 * @param position - La position où spawner le skeleton soldier avec rotation optionnelle (optionnel, par défaut à la position spécifiée)
 * @returns L'entité skeleton soldier créée
 */
export function createSkeletonSoldier(
  world: World,
  position: PositionWithRotation = { x: 0, y: 0, z: 0 }
): SkeletonSoldierEntity {
  const skeletonSoldier = new SkeletonSoldierEntity();

  // Utilise la rotation de la config si fournie, sinon rotation par défaut de 180° autour de Y
  const rotation = position.rotation
    ? new Quaternion(
        position.rotation.x,
        position.rotation.y,
        position.rotation.z,
        position.rotation.w
      )
    : new Quaternion(0, 1, 0, 0); // Rotation par défaut de 180° autour de Y

  skeletonSoldier.spawn(world, position, rotation);

  // Ajoute le skeleton soldier à la liste des instances
  skeletonSoldierInstances.push(skeletonSoldier);

  // Configure le leaderboard après le spawn
  // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
  setTimeout(async () => {
    await skeletonSoldier.setupLeaderboard();
  }, 100);

  return skeletonSoldier;
}

/**
 * Entité de bulle de dialogue
 */
class SpeechBubbleEntity extends Entity {
  private cardSceneUI: SceneUI | null = null;

  constructor() {
    super({
      modelUri: "models/environment/Gameplay/speech-bubble.gltf",
      name: "Speech Bubble",
      modelScale: 1,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Bulle fixe qui ne bouge pas
      },
    });
  }

  /**
   * Crée et charge la SceneUI de la carte attachée à la bulle de dialogue
   * Doit être appelé après que l'entité soit spawnée
   */
  public setupCard(): void {
    if (!this.world) return;

    // Crée la SceneUI pour la carte
    this.cardSceneUI = new SceneUI({
      templateId: "welcome-npc-card",
      attachedToEntity: this,
      offset: { x: 0, y: 2.5, z: 0 }, // Au-dessus de la bulle
      state: {
        visible: true, // Affiche la carte en permanence
        title: "Attention !",
        message:
          "Message de la bulle de dialogue pour l'île 2. À personnaliser selon vos besoins.",
      },
      viewDistance: 30, // Visible jusqu'à 30 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.cardSceneUI.load(this.world);
  }
}

/**
 * Crée et spawn la bulle de dialogue dans le monde
 * @param world - Le monde où spawner la bulle de dialogue
 * @param position - La position où spawner la bulle de dialogue (optionnel, par défaut à la position spécifiée)
 * @returns L'entité bulle de dialogue créée
 */
export function createSpeechBubble(
  world: World,
  position: { x: number; y: number; z: number } = { x: 0, y: 0, z: -2.08 }
): SpeechBubbleEntity {
  const speechBubble = new SpeechBubbleEntity();
  speechBubble.spawn(world, position);

  // Configure la carte après le spawn
  // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
  setTimeout(() => {
    speechBubble.setupCard();
  }, 100);

  return speechBubble;
}

/**
 * Entité de flèche indiquant le début du parcours
 */
class ArrowEntity extends Entity {
  private cardSceneUI: SceneUI | null = null;

  constructor() {
    super({
      modelUri: "models/environment/Gameplay/arrow.gltf",
      name: "Arrow",
      modelScale: 1,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Flèche fixe qui ne bouge pas
      },
    });
  }

  /**
   * Crée et charge la SceneUI de la carte attachée à la flèche
   * Doit être appelé après que l'entité soit spawnée
   */
  public setupCard(): void {
    if (!this.world) return;

    // Crée la SceneUI pour la carte
    this.cardSceneUI = new SceneUI({
      templateId: "welcome-npc-card",
      attachedToEntity: this,
      offset: { x: 0, y: 2.5, z: 0 }, // Au-dessus de la flèche
      state: {
        visible: true, // Affiche la carte en permanence
        title: "Le parcours commence ici !",
        message: "",
      },
      viewDistance: 30, // Visible jusqu'à 30 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.cardSceneUI.load(this.world);
  }
}

/**
 * Crée et spawn la flèche dans le monde
 * @param world - Le monde où spawner la flèche
 * @param position - La position où spawner la flèche (optionnel, par défaut à la position spécifiée)
 * @param showCard - Si true, affiche la carte au-dessus de la flèche (par défaut: true)
 * @returns L'entité flèche créée
 */
export function createArrow(
  world: World,
  position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  showCard: boolean = true
): ArrowEntity {
  const arrow = new ArrowEntity();
  arrow.spawn(world, position);

  // Configure la carte après le spawn seulement si showCard est true
  if (showCard) {
    // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
    setTimeout(() => {
      arrow.setupCard();
    }, 100);
  }

  return arrow;
}
