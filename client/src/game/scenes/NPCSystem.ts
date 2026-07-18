import Phaser from "phaser";

/**
 * NPC — a non-player character that stands still at its shop or designated spot.
 * Uses the same layered system as players: skin, eyes, hair, clothes, acc.
 */
export class NPC {
  private container: Phaser.GameObjects.Container;
  private skin: Phaser.GameObjects.Sprite;
  private eyes?: Phaser.GameObjects.Sprite;
  private hair?: Phaser.GameObjects.Sprite;
  private clothes?: Phaser.GameObjects.Sprite;
  private acc?: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Graphics;

  private scene: Phaser.Scene;
  private currentDir = "down";
  private isWalking = false;
  private opts: any;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: {
      name: string;
      skinTone: string;
      gender: "male" | "female";
      hairStyle: string;
      hairColor: string;
      eyeColor: string;
      clothesColor: string;
      accItem: string;
      color: string;
      npcKey: string;
    }
  ) {
    this.scene = scene;
    this.opts = opts;

    this.container = scene.add.container(x, y);
    this.container.setScale(2.4); // Upscale to 2.4 to match players
    
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.25);
    this.shadow.fillEllipse(0, 14, 18, 7);

    // Initial skins/layers setup
    this.skin = scene.add.sprite(0, 10, `pack_skin_${opts.skinTone}_idle`, 0);
    const g = opts.gender === "male" ? "Male" : "Female";
    this.eyes = scene.add.sprite(0, 10, `pack_eyes_${g}_${opts.eyeColor}_idle`, 0);
    this.hair = scene.add.sprite(0, 10, `pack_hair_${opts.hairStyle}_${opts.hairColor}_idle`, 0);
    this.clothes = scene.add.sprite(0, 10, opts.clothesColor ? `pack_clothes_${opts.clothesColor}_idle` : "")
      .setVisible(!!opts.clothesColor);
    this.acc = scene.add.sprite(0, 10, opts.accItem ? `pack_acc_${opts.accItem}_idle` : "")
      .setVisible(!!opts.accItem);

    // Name tag
    const tag = scene.add.text(0, -28, opts.name, {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "7px",
      color: opts.color,
      stroke: "#000000",
      strokeThickness: 3.5,
      resolution: 2,
    }).setOrigin(0.5, 1);

    this.container.add([this.shadow, this.skin, this.eyes!, this.hair!, this.clothes!, this.acc!, tag]);
    this.container.setSize(32, 48);
    
    // Not draggable anymore as per user request
    this.container.setInteractive();
    this.container.setData("type", "npc");
    this.container.setData("npcKey", opts.npcKey);

    // Play default idle animation
    this.playCurrentAnimation();
  }

  /** NPCs are static and stand still at their positions, no active movement updates needed */
  update(_time: number): void {
    // Empty — NPCs are static and stand still
  }

  private playCurrentAnimation(): void {
    const state = this.isWalking ? "walk" : "idle";
    const dir = this.currentDir;

    // 1. Skin Layer
    const skinAnim = `pack_skin_${this.opts.skinTone}_${state}_${dir}`;
    if (this.skin.anims.exists(skinAnim)) {
      this.skin.play(skinAnim, true);
    }

    // 2. Eyes Layer
    if (this.eyes) {
      const g = this.opts.gender === "male" ? "Male" : "Female";
      const eyeAnim = `pack_eyes_${g}_${this.opts.eyeColor}_${state}_${dir}`;
      if (this.eyes.anims.exists(eyeAnim)) {
        this.eyes.play(eyeAnim, true);
      } else {
        const fallbackAnim = `pack_eyes_${g}_${this.opts.eyeColor}_idle_${dir}`;
        if (this.eyes.anims.exists(fallbackAnim)) {
          this.eyes.play(fallbackAnim, true);
        }
      }
    }

    // 3. Hair Layer
    if (this.hair) {
      const hairAnim = `pack_hair_${this.opts.hairStyle}_${this.opts.hairColor}_${state}_${dir}`;
      if (this.hair.anims.exists(hairAnim)) {
        this.hair.play(hairAnim, true);
      } else {
        const fallbackAnim = `pack_hair_${this.opts.hairStyle}_${this.opts.hairColor}_idle_${dir}`;
        if (this.hair.anims.exists(fallbackAnim)) {
          this.hair.play(fallbackAnim, true);
        }
      }
    }

    // 4. Clothes Layer
    if (this.clothes && this.opts.clothesColor) {
      const clothesAnim = `pack_clothes_${this.opts.clothesColor}_${state}_${dir}`;
      if (this.clothes.anims.exists(clothesAnim)) {
        this.clothes.play(clothesAnim, true);
      } else {
        const fallbackAnim = `pack_clothes_${this.opts.clothesColor}_idle_${dir}`;
        if (this.clothes.anims.exists(fallbackAnim)) {
          this.clothes.play(fallbackAnim, true);
        }
      }
    }

    // 5. Accessory Layer
    if (this.acc && this.opts.accItem) {
      const accAnim = `pack_acc_${this.opts.accItem}_${state}_${dir}`;
      if (this.acc.anims.exists(accAnim)) {
        this.acc.play(accAnim, true);
      } else {
        const fallbackAnim = `pack_acc_${this.opts.accItem}_idle_${dir}`;
        if (this.acc.anims.exists(fallbackAnim)) {
          this.acc.play(fallbackAnim, true);
        }
      }
    }
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getNPCKey(): string {
    return this.container.getData("npcKey") as string;
  }
}

// NPC definitions - Spawn points mapped in front of buildings
export const NPC_DEFS = [
  {
    key: "banker",
    name: "Banker",
    x: 1530, y: 1110, // Standing in front of the BANK building door
    skinTone: "1", gender: "male" as const,
    hairStyle: "Josh", hairColor: "Black", eyeColor: "Brown",
    clothesColor: "Blue", accItem: "Beret",
    color: "#FFD700",
  },
  {
    key: "blacksmith",
    name: "Blacksmith",
    x: 1040, y: 640, // Standing in front of the Blacksmith shop
    skinTone: "2", gender: "male" as const,
    hairStyle: "Sebastian", hairColor: "Brown", eyeColor: "Brown",
    clothesColor: "Red", accItem: "Farm",
    color: "#FF8C00",
  },
  {
    key: "pirate",
    name: "Pirate",
    x: 250, y: 780, // Standing near the docks
    skinTone: "3", gender: "male" as const,
    hairStyle: "Standard", hairColor: "Ginger", eyeColor: "Black",
    clothesColor: "Purple", accItem: "Pirate",
    color: "#FF4500",
  },
  {
    key: "mermaid",
    name: "Mermaid",
    x: 1400, y: 500, // Near the shoreline/lake
    skinTone: "2", gender: "female" as const,
    hairStyle: "Silvermist", hairColor: "Blonde", eyeColor: "Green",
    clothesColor: "Green", accItem: "",
    color: "#00CED1",
  },
];

/** Spawn all NPCs in the scene */
export function spawnNPCs(scene: Phaser.Scene): NPC[] {
  const npcs: NPC[] = [];
  for (const def of NPC_DEFS) {
    const npc = new NPC(scene, def.x, def.y, { ...def, npcKey: def.key });
    npc.setVisible(true);
    npcs.push(npc);
  }
  return npcs;
}
