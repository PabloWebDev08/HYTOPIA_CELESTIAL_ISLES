/**
 * HYTOPIA SDK Boilerplate
 *
 * This is a simple boilerplate to get started on your project.
 * It implements the bare minimum to be able to run and connect
 * to your game server and run around as the basic player entity.
 *
 * From here you can begin to implement your own game logic
 * or do whatever you want!
 *
 * You can find documentation here: https://github.com/hytopiagg/sdk/blob/main/docs/server.md
 *
 * For more in-depth examples, check out the examples folder in the SDK, or you
 * can find it directly on GitHub: https://github.com/hytopiagg/sdk/tree/main/examples/payload-game
 *
 * You can officially report bugs or request features here: https://github.com/hytopiagg/sdk/issues
 *
 * To get help, have found a bug, or want to chat with
 * other HYTOPIA devs, join our Discord server:
 * https://discord.gg/DXCXJbHSJX
 *
 * Official SDK Github repo: https://github.com/hytopiagg/sdk
 * Official SDK NPM Package: https://www.npmjs.com/package/hytopia
 */

import {
  startServer,
  Audio,
  DefaultPlayerEntity,
  PlayerEvent,
  PlayerUIEvent,
  SceneUI,
  CollisionGroup,
  ParticleEmitter,
} from "hytopia";

import worldMap from "./assets/map_hub.json";
import {
  createParkourEntities,
  getStartPosition,
  getPlatformPositionById,
} from "./parkour";
import { createWelcomeNPC } from "./welcomeNPCS";

/**
 * startServer is always the entry point for our game.
 * It accepts a single function where we should do any
 * setup necessary for our game. The init function is
 * passed a World instance which is the default
 * world created by the game server on startup.
 *
 * Documentation: https://github.com/hytopiagg/sdk/blob/main/docs/server.startserver.md
 */

startServer((world) => {
  /**
   * Enable debug rendering of the physics simulation.
   * This will overlay lines in-game representing colliders,
   * rigid bodies, and raycasts. This is useful for debugging
   * physics-related issues in a development environment.
   * Enabling this can cause performance issues, which will
   * be noticed as dropped frame rates and higher RTT times.
   * It is intended for development environments only and
   * debugging physics.
   */

  // world.simulation.enableDebugRendering(true);

  /**
   * Load our map.
   * You can build your own map using https://build.hytopia.com
   * After building, hit export and drop the .json file in
   * the assets folder as map.json.
   */
  world.loadMap(worldMap);

  // Crée le parkour
  const parkourEntities = createParkourEntities(world);
  const welcomeNPC = createWelcomeNPC(world, { x: 45.08, y: 2.79, z: 29.38 });

  /**
   * Handle player joining the game. The PlayerEvent.JOINED_WORLD
   * event is emitted to the world when a new player connects to
   * the game. From here, we create a basic player
   * entity instance which automatically handles mapping
   * their inputs to control their in-game entity and
   * internally uses our player entity controller.
   *
   * The HYTOPIA SDK is heavily driven by events, you
   * can find documentation on how the event system works,
   * here: https://dev.hytopia.com/sdk-guides/events
   */
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: "Player",
    });

    // Utilise la position de départ du parkour
    const startPos = getStartPosition();
    playerEntity.spawn(world, startPos);

    // Crée un émetteur de particules attaché au joueur
    //
    // OPTIONS DE POSITIONNEMENT :
    //
    // Méthode 1 : Utiliser 'offset' pour décaler depuis le centre du joueur
    //   offset: { x: 0, y: 1.5, z: 0 }  // Au-dessus de la tête (y positif = haut)
    //   offset: { x: 0, y: -0.5, z: 0 } // Aux pieds (y négatif = bas)
    //   offset: { x: 0.5, y: 0, z: 0 }  // À droite du joueur (x positif = droite)
    //
    // Méthode 2 : Utiliser 'attachedToEntityNodeName' pour attacher à un nœud spécifique
    //   Nœuds disponibles : 'head_anchor', 'hand_right_anchor', 'hand_left_anchor',
    //   'back_anchor', 'torso_anchor', 'foot_left_anchor', 'foot_right_anchor'
    //
    // Vous pouvez combiner les deux méthodes pour un positionnement précis !
    const playerParticleEmitter = new ParticleEmitter({
      attachedToEntity: playerEntity,
      // Optionnel : attacher à un nœud spécifique du modèle
      // attachedToEntityNodeName: "head_anchor", // Exemple : émet depuis la tête
      // Optionnel : décalage relatif depuis le centre ou le nœud
      offset: { x: 0, y: -0.5, z: 0 }, // Centre du joueur par défaut
      textureUri: "particles/magic.png",
      colorStart: { r: 255, g: 255, b: 255 }, // Couleur blanche de base
      // OPTIONS DE TAILLE DES PARTICULES :
      // sizeStart : Taille de départ (en blocs). Valeurs typiques : 0.05 à 0.3
      // sizeEnd : Taille de fin (optionnel). Si défini, les particules grandissent/rétrécissent
      // sizeStartVariance : Variation de la taille de départ (+/- cette valeur)
      // sizeEndVariance : Variation de la taille de fin (si sizeEnd est défini)
      sizeStart: 0.1, // Taille de départ des particules (ajustez cette valeur pour changer la taille)
      sizeStartVariance: 0.03, // Variation de la taille de départ
      sizeEnd: 0.12, // Taille de fin (les particules grandissent légèrement pendant leur vie)
      sizeEndVariance: 0.02, // Variation de la taille de fin
      lifetime: 2, // Durée de vie des particules en secondes
      lifetimeVariance: 0.5, // Variation de la durée de vie
      rate: 15, // Nombre de particules émises par seconde
      maxParticles: 30, // Nombre maximum de particules visibles
      velocity: { x: 0, y: 0.5, z: 0 }, // Vitesse verticale vers le haut
      velocityVariance: { x: 0.3, y: 0.2, z: 0.3 }, // Variation de la vitesse
      opacityStart: 0.8, // Opacité de départ
      opacityEnd: 0, // Opacité de fin (disparaît progressivement)
    });

    // Spawn l'émetteur de particules dans le monde
    playerParticleEmitter.spawn(world);

    // Configure les groupes de collision pour empêcher les joueurs de se rentrer dedans
    // Les colliders solides (hitbox) peuvent entrer en collision avec les blocs, entités,
    // entités environnementales (plantes, arbres, décor) mais pas avec les autres joueurs
    playerEntity.setCollisionGroupsForSolidColliders({
      belongsTo: [CollisionGroup.PLAYER],
      collidesWith: [
        CollisionGroup.BLOCK,
        CollisionGroup.ENTITY,
        CollisionGroup.ENTITY_SENSOR,
        CollisionGroup.ENVIRONMENT_ENTITY, // Plantes, arbres, éléments décoratifs
      ],
    });

    // Configure aussi les colliders capteurs (sensors) pour éviter les faux positifs
    // avec d'autres joueurs (comme le capteur de sol qui pourrait détecter un autre joueur)
    playerEntity.setCollisionGroupsForSensorColliders({
      belongsTo: [CollisionGroup.ENTITY_SENSOR],
      collidesWith: [
        CollisionGroup.BLOCK,
        CollisionGroup.ENTITY,
        CollisionGroup.ENVIRONMENT_ENTITY, // Plantes, arbres, éléments décoratifs
      ],
    });

    // Les entités du parkour sont déjà créées et spawnées dans createParkourEntities
    // Pas besoin de les respawner ici

    // Load our game UI for this player
    player.ui.load("ui/index.html");

    // Crée une Scene UI pour la barre de charge verticale au-dessus du joueur
    const jumpChargeSceneUI = new SceneUI({
      templateId: "jump-charge-bar",
      attachedToEntity: playerEntity,
      state: { progress: 0, visible: false },
      offset: { x: 0, y: 1.8, z: 0 }, // Position au-dessus de la tête du joueur
    });

    jumpChargeSceneUI.load(world);

    // Fonction helper pour vérifier si le joueur est au sol
    // Utilise un raycast vers le bas pour détecter le sol
    const isPlayerOnGround = (): boolean => {
      const playerPosition = playerEntity.position;
      // Origine du raycast légèrement en dessous du centre du joueur
      const raycastOrigin = {
        x: playerPosition.x,
        y: playerPosition.y - 0.5, // Ajuste pour partir des pieds
        z: playerPosition.z,
      };
      // Direction vers le bas
      const raycastDirection = { x: 0, y: -1, z: 0 };
      // Distance maximale pour détecter le sol (1 bloc)
      const raycastDistance = 1.0;

      // Effectue le raycast en excluant le rigid body du joueur
      const raycastResult = world.simulation.raycast(
        raycastOrigin,
        raycastDirection,
        raycastDistance,
        {
          filterExcludeRigidBody: playerEntity.rawRigidBody,
        }
      );

      // Retourne true si le raycast a touché un bloc ou une entité
      return (
        raycastResult?.hitBlock !== undefined ||
        raycastResult?.hitEntity !== undefined
      );
    };

    // Écoute les messages de l'UI concernant le saut maintenu
    // Quand le joueur maintient le bouton de saut, on calcule la force proportionnelle
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      if (data.type === "jump-held") {
        // Vérifie si le joueur est au sol avant de permettre le saut
        if (!isPlayerOnGround()) {
          // Le joueur n'est pas au sol, on ignore le saut
          jumpChargeSceneUI.setState({ progress: 0, visible: false });
          return;
        }

        const duration = data.duration || 0; // Durée en millisecondes

        // Configuration du saut
        const minJumpForce = 10; // Force minimale du saut (saut normal)
        const maxJumpForce = 50; // Force maximale du saut (saut chargé)
        const maxHoldDuration = 1000; // Durée maximale en ms (1 seconde) pour atteindre la force max

        // Normalise la durée entre 0 et 1
        const normalizedDuration = Math.min(duration / maxHoldDuration, 1);

        // Calcule la force du saut proportionnellement à la durée
        const jumpForce =
          minJumpForce + normalizedDuration * (maxJumpForce - minJumpForce);

        // Applique l'impulsion verticale au joueur pour le faire sauter plus haut
        playerEntity.applyImpulse({ x: 0, y: jumpForce, z: 0 });

        // Joue le son de saut
        new Audio({
          uri: "audio/sfx/cartoon-jump.mp3",
          loop: false,
          volume: 0.5,
        }).play(world);

        // Cache la barre de charge après le saut
        jumpChargeSceneUI.setState({ progress: 0, visible: false });
      } else if (data.type === "jump-charge-update") {
        // Met à jour la progression de la barre de charge en temps réel
        jumpChargeSceneUI.setState({
          progress: data.progress || 0,
          visible: data.visible || false,
        });
      }
    });

    // Send a nice welcome message that only the player who joined will see ;)
    world.chatManager.sendPlayerMessage(
      player,
      "Welcome to the game!",
      "00FF00"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Use WASD to move around & space to jump."
    );
    world.chatManager.sendPlayerMessage(player, "Hold shift to sprint.");
    world.chatManager.sendPlayerMessage(
      player,
      "Hold jump button longer to jump higher!",
      "FFFF00"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Random cosmetic items are enabled for testing!"
    );
    world.chatManager.sendPlayerMessage(
      player,
      "Press \\ to enter or exit debug view."
    );
  });

  /**
   * Handle player leaving the game. The PlayerEvent.LEFT_WORLD
   * event is emitted to the world when a player leaves the game.
   * Because HYTOPIA is not opinionated on join and
   * leave game logic, we are responsible for cleaning
   * up the player and any entities associated with them
   * after they leave. We can easily do this by
   * getting all the known PlayerEntity instances for
   * the player who left by using our world's EntityManager
   * instance.
   *
   * The HYTOPIA SDK is heavily driven by events, you
   * can find documentation on how the event system works,
   * here: https://dev.hytopia.com/sdk-guides/events
   */
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    world.entityManager
      .getPlayerEntitiesByPlayer(player)
      .forEach((entity) => entity.despawn());
  });

  /**
   * A silly little easter egg command. When a player types
   * "/rocket" in the game, they'll get launched into the air!
   */
  world.chatManager.registerCommand("/rocket", (player) => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((entity) => {
      entity.applyImpulse({ x: 0, y: 20, z: 0 });
    });
  });

  /**
   * Commande pour téléporter le joueur à une plateforme spécifique
   * Usage: /teleport <platform-id>
   * Exemple: /teleport start-platform
   */
  world.chatManager.registerCommand("/teleport", (player, args) => {
    // Vérifie qu'un ID de plateforme a été fourni
    // args est un tableau de mots séparés par des espaces après /teleport
    if (!args || args.length === 0) {
      world.chatManager.sendPlayerMessage(
        player,
        "Usage: /teleport <platform-id>",
        "FF0000"
      );
      world.chatManager.sendPlayerMessage(
        player,
        "Exemple: /teleport start-platform",
        "FF0000"
      );
      return;
    }

    const platformId = args[0];
    const platformPosition = getPlatformPositionById(platformId);

    // Vérifie si la plateforme existe
    if (!platformPosition) {
      world.chatManager.sendPlayerMessage(
        player,
        `Plateforme avec l'ID "${platformId}" introuvable.`,
        "FF0000"
      );
      return;
    }

    // Téléporte toutes les entités du joueur à la position de la plateforme
    // On ajoute un petit offset en Y pour être au-dessus de la plateforme
    const teleportPosition = {
      x: platformPosition.x,
      y: platformPosition.y + 2, // 2 blocs au-dessus de la plateforme
      z: platformPosition.z,
    };

    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((entity) => {
      entity.setPosition(teleportPosition);
    });

    world.chatManager.sendPlayerMessage(
      player,
      `Téléporté vers la plateforme "${platformId}"`,
      "00FF00"
    );
  });

  /**
   * Play some peaceful ambient music to
   * set the mood!
   */

  new Audio({
    uri: "audio/music/hytopia-main-theme.mp3",
    loop: true,
    volume: 0.1,
  }).play(world);
});
