import { Entity, World, RigidBodyType, SceneUI, Quaternion } from "hytopia";
import { getLeaderboard } from "./coin";

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
        title: "Holla naufragé !",
        message:
          "Pas trop dur ce naufrage ? <br> Par chance tu es toujours en vie !<br> Te voila sur l'ile céleste ! Ici la gravité n'est plus la même !",
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

    // Récupère le leaderboard initial
    const leaderboard = await getLeaderboard();

    // Crée la SceneUI pour le leaderboard
    this.leaderboardSceneUI = new SceneUI({
      templateId: "boat-leaderboard",
      attachedToEntity: this,
      offset: { x: 0, y: 3, z: 0 }, // Au-dessus du skeleton soldier
      state: {
        visible: true, // Affiche le leaderboard en permanence
        title: "🏆 Leaderboard",
        subtitle: "Dernier Coin Collecté",
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
      this.leaderboardSceneUI.setState({
        leaderboard: leaderboard,
      });
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
