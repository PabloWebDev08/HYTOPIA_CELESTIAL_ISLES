# Système de gestion des îles

Ce dossier contient le système modulaire de gestion des îles pour le jeu.

## Structure

```
/islands/
  /shared/              # Code partagé entre toutes les îles
    - types.ts          # Types et interfaces communs
    - IslandBase.ts     # Classe de base abstraite pour les îles
  /island1/             # Île céleste 1 (implémentée)
    - island.ts         # Logique de création de l'île
    - config.ts         # Configuration (positions NPCs, etc.)
  /island2/             # Île céleste 2 (template vide)
    - island.ts
    - config.ts
  - islandManager.ts    # Gestionnaire central des îles
```

## Comment ajouter une nouvelle île

### 1. Créer les fichiers JSON de données

Créez les fichiers JSON dans `/assets/islands/islandX/` :

- `parkour.json` - Configuration du parcours de parkour
- `coin.json` - Configuration des coins à collecter

### 2. Créer le dossier de l'île

Créez un nouveau dossier `/islands/islandX/` avec :

- `config.ts` - Configuration de l'île (positions NPCs, bateaux, etc.)
- `island.ts` - Classe implémentant l'interface `Island`

### 3. Exemple de config.ts

```typescript
import { Position } from "../shared/types";

export const islandXConfig = {
  parkourDataPath: "assets/islands/islandX/parkour.json",
  coinDataPath: "assets/islands/islandX/coin.json",
  npcs: {
    welcomeNPC: { x: 0, y: 10, z: 0 } as Position,
  },
  // ... autres configurations
};
```

### 4. Exemple de island.ts

```typescript
import { World } from "hytopia";
import { IslandBase } from "../shared/IslandBase";
import { Position } from "../shared/types";
import { islandXConfig } from "./config";
import { createParkourEntities, ParkourConfig } from "../../parkour";
import { createCoinEntities, CoinConfig } from "../../coin";
import parkourData from "../../assets/islands/islandX/parkour.json";
import coinData from "../../assets/islands/islandX/coin.json";

export class IslandX extends IslandBase {
  private parkourConfig: ParkourConfig;
  private coinConfig: CoinConfig;

  constructor() {
    super();
    this.parkourConfig = parkourData as ParkourConfig;
    this.coinConfig = coinData as CoinConfig;
  }

  protected createEntities(world: World): void {
    // Crée toutes les entités de l'île
    const parkourEntities = createParkourEntities(world, this.parkourConfig);
    this.entities.parkourEntities = parkourEntities;

    const coinEntities = createCoinEntities(world, this.coinConfig);
    this.entities.coinEntities = coinEntities;

    // ... autres entités
  }

  getStartPosition(): Position {
    // Retourne la position de départ
  }

  getPlatformPositionById(id: string): Position | null {
    // Retourne la position d'une plateforme par son ID
  }
}
```

### 5. Enregistrer l'île dans IslandManager

Ajoutez votre île dans `islandManager.ts` :

```typescript
import { IslandX } from "./islandX/island";

private registerIslands(): void {
  // ...
  this.islands.set("islandX", new IslandX());
}
```

### 6. Charger l'île dans index.ts

L'île sera automatiquement disponible via `islandManager.loadIsland("islandX")`.

## Avantages de cette architecture

- **Modularité** : Chaque île est indépendante
- **Scalabilité** : Facile d'ajouter de nouvelles îles
- **Maintenabilité** : Code organisé et clair
- **Réutilisabilité** : Modules partagés (`parkour.ts`, `coin.ts`, etc.)
