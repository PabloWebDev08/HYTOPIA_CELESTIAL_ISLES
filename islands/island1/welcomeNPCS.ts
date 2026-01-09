import { Entity, World, RigidBodyType, SceneUI, Quaternion } from "hytopia";
import { getLeaderboard } from "../shared/coin";

// ID de l'île pour ce fichier
const ISLAND_ID = "island1";

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
        title: "Hello, young castaway!",
        message:
          "Wasn't that shipwreck too rough? <br> By chance you are still alive! <br> You are on the first celestial island! <br> Here gravity is not the same! <br> You see these small particles,<br>they help you jump higher! <br> Stay pressed on the jump key,<br> to fly! <br> On this island, there is only one way,<br> reach the summit!",
      },
      viewDistance: 30, // Visible jusqu'à 15 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.welcomeCardSceneUI.load(this.world);
  }
}
/**
 * Crée et spawn le NPC de bienvenue dans le monde
 * @param world - Le monde où spawner le NPC
 * @param position - La position où spawner le NPC (optionnel, par défaut à l'origine)
 * @returns L'entité NPC créée
 */
export function createWelcomeNPC(
  world: World,
  position: { x: number; y: number; z: number } = { x: 0, y: 10, z: 0 }
): WelcomeNPC {
  const npc = new WelcomeNPC();
  npc.spawn(world, position);

  // Configure la carte de bienvenue après le spawn
  // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
  setTimeout(() => {
    npc.setupWelcomeCard();
  }, 100);

  return npc;
}

/**
 * Entité de bateau Minecraft
 */
class BoatEntity extends Entity {
  constructor() {
    super({
      modelUri: "models/minecraft_boat.glb",
      name: "Boat",
      modelScale: 4,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Bateau fixe qui ne bouge pas
      },
    });
  }
}

/**
 * Crée et spawn le bateau dans le monde
 * @param world - Le monde où spawner le bateau
 * @param position - La position où spawner le bateau (optionnel, par défaut à la position spécifiée)
 * @returns L'entité bateau créée
 */
export function createBoat(
  world: World,
  position: { x: number; y: number; z: number } = { x: 22.93, y: 12, z: 26.02 }
): BoatEntity {
  const boat = new BoatEntity();
  boat.spawn(world, position);

  return boat;
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
    `[Island1] Mise à jour de ${skeletonSoldierInstances.length} skeleton soldiers avec le nouveau leaderboard`
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
        subtitle: "The 10 last players to have completed the level",
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
        `[Island1] Update leaderboard with ${leaderboard.length} entries`
      );
      this.leaderboardSceneUI.setState({
        visible: true,
        title: "🏆 Leaderboard 🏆",
        subtitle: "The 10 last players to have completed the level",
        leaderboard: leaderboard,
      });
    } else {
      console.warn(
        "[Island1] Impossible to update the leaderboard : leaderboardSceneUI is null"
      );
    }
  }
}

/**
 * Crée et spawn le skeleton soldier dans le monde
 * @param world - Le monde où spawner le skeleton soldier
 * @param position - La position où spawner le skeleton soldier (optionnel, par défaut à la position spécifiée)
 * @returns L'entité skeleton soldier créée
 */
export function createSkeletonSoldier(
  world: World,
  position: { x: number; y: number; z: number } = { x: 4.91, y: 13, z: -19.78 }
): SkeletonSoldierEntity {
  const skeletonSoldier = new SkeletonSoldierEntity();

  // Rotation de 180 degrés autour de l'axe Y pour qu'il regarde vers la map
  // Quaternion pour rotation de 180° autour de Y : (x: 0, y: 1, z: 0, w: 0)
  const rotation = new Quaternion(0, 1, 0, 0);

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
          "If you don't see any coin here, wait 30 seconds : another adventurer is certainly passed before you! <br> Don't forget to pick up at least one coin to be qualified and unlock access to the Celestial Island 2.",
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
  position: { x: number; y: number; z: number } = { x: 12.95, y: 151, z: -3.51 }
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
        title: "The journey begins here!",
        message: "",
      },
      viewDistance: 30, // Visible jusqu'à 30 blocs de distance
    });

    // Charge la SceneUI dans le monde
    this.cardSceneUI.load(this.world);
  }
}

/**
 * Entité "point d'interrogation" (repère d'aide) qui affiche une carte au-dessus
 */
class QuestionMarkEntity extends Entity {
  private cardSceneUI: SceneUI | null = null;

  constructor() {
    super({
      modelUri: "models/environment/Gameplay/question-mark.gltf",
      name: "Question Mark",
      modelScale: 1,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Repère fixe qui ne bouge pas
      },
    });
  }

  /**
   * Crée et charge la SceneUI de la carte attachée au point d'interrogation
   * Doit être appelé après que l'entité soit spawnée
   */
  public setupCard(): void {
    if (!this.world) return;

    // Crée la SceneUI pour la carte
    this.cardSceneUI = new SceneUI({
      templateId: "welcome-npc-card",
      attachedToEntity: this,
      offset: { x: 0, y: 2.5, z: 0 }, // Au-dessus du modèle
      state: {
        visible: true, // Affiche la carte en permanence
        title: "Game rules",
        message:
          "HOLD DOWN the Space bar (PC) or the Jump button (mobile) to jump higher.<br>" +
          "⚠️ Don't just press it once: hold it down!<br>" +
          "A power bar appears above the player.<br>" +
          "Reach the last coin on the last platform to access the next island.<br>" +
          "The coins you collect can be used to buy particles in the menu at the top right.",
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
  position: { x: number; y: number; z: number } = { x: 21.66, y: 13, z: 24.41 },
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

/**
 * Crée et spawn le point d'interrogation dans le monde
 * @param world - Le monde où spawner l'entité
 * @param position - La position où spawner l'entité (optionnel)
 * @returns L'entité point d'interrogation créée
 */
export function createQuestionMark(
  world: World,
  position: { x: number; y: number; z: number } = { x: 0, y: 10, z: 0 }
): QuestionMarkEntity {
  const questionMark = new QuestionMarkEntity();
  questionMark.spawn(world, position);

  // Configure la carte après le spawn
  // On utilise setTimeout pour s'assurer que l'entité est complètement initialisée
  setTimeout(() => {
    questionMark.setupCard();
  }, 100);

  return questionMark;
}
