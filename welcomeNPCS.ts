import { Entity, World, RigidBodyType, SceneUI } from "hytopia";

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
