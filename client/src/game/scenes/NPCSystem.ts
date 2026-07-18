import Phaser from "phaser";

/**
 * NPC — a non-player character that walks around and can be clicked.
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
  private walkTimer = 0;
  private walkInterval = 1000 + Math.random() * 2000;
  private dirTimer = 0;
  private dirInterval = 2000 + Math.random() * 3000;
  private isWalking = false;
  private targetX: number | null = null;
  private targetY: number | null = null;
  private moveSpeed = 0.06;

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
    this.container = scene.add.container(x, y);
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.25);
    this.shadow.fillEllipse(0, 14, 18, 7);

    this.skin = scene.add.sprite(0, 10, "pack_skin_1_idle", 0);
    const g = opts.gender === "male" ? "Male" : "Female";
    this.eyes = scene.add.sprite(0, 10, `pack_eyes_${g}_${opts.eyeColor}_idle`, 0);
    this.hair = scene.add.sprite(0, 10, `pack_hair_${opts.hairStyle}_${opts.hairColor}_idle`, 0);
    this.clothes = scene.add.sprite(0, 10, opts.clothesColor ? `pack_clothes_${opts.clothesColor}_idle` : "")
      .setVisible(!!opts.clothesColor);
    this.acc = scene.add.sprite(0, 10, opts.accItem ? `pack_acc_${opts.accItem}_idle` : "")
      .setVisible(!!opts.accItem);

    scene.add.text(0, -28, opts.name, {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "7px",
      color: opts.color,
      stroke: "#000000",
      strokeThickness: 3.5,
      resolution: 2,
    }).setOrigin(0.5, 1);

    this.container.add([this.shadow, this.skin, this.eyes!, this.hair!, this.clothes!, this.acc!]);
    this.container.setSize(32, 48);
    this.container.setInteractive({ draggable: true });
    this.container.setData("type", "npc");
    this.container.setData("npcKey", opts.npcKey);
  }

  /** Advance NPC AI (call from scene update loop) */
  update(_time: number): void {
    this.walkTimer += 16;
    this.dirTimer += 16;

    // Move toward target if set
    if (this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.container.x;
      const dy = this.targetY - this.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 4) {
        this.isWalking = true;
        this.moveNPC(dx / dist, dy / dist, 16);
      } else {
        this.targetX = null;
        this.targetY = null;
        this.isWalking = false;
      }
    }

    if (this.dirTimer >= this.dirInterval) {
      this.dirTimer = 0;
      this.dirInterval = 2000 + Math.random() * 3000;
      this.pickNewTarget();
    }

    if (this.walkTimer >= this.walkInterval) {
      this.walkTimer = 0;
      this.walkInterval = 800 + Math.random() * 1200;
    }
  }

  private pickNewTarget(): void {
    this.targetX = Phaser.Math.Between(200, 1400);
    this.targetY = Phaser.Math.Between(300, 1100);
  }

  private moveNPC(dx: number, dy: number, delta: number): void {
    const spd = this.moveSpeed * delta;
    this.container.x = Phaser.Math.Clamp(this.container.x + dx * spd, 32, 1568);
    this.container.y = Phaser.Math.Clamp(this.container.y + dy * spd, 32, 1248);

    // Determine direction for animation
    if (Math.abs(dx) > Math.abs(dy)) {
      this.currentDir = dx > 0 ? "right" : "left";
    } else {
      this.currentDir = dy > 0 ? "down" : "up";
    }

    this.playCurrentAnimation();
  }

  private playCurrentAnimation(): void {
    const state = this.isWalking ? "walk" : "idle";
    const dir = this.currentDir;

    // Use the anim key pattern: pack_skin_1_{state}_{dir}
    const skinAnim = `pack_skin_1_${state}_${dir}`;
    if (this.skin.anims.currentAnim?.key !== skinAnim && this.skin.anims.exists(skinAnim)) {
      this.skin.play(skinAnim, true);
    }

    if (this.hair && this.hair.anims.exists(`pack_hair_${this.hair.texture.key}_${state}_${dir}`)) {
      this.hair.play(`pack_hair_${this.hair.texture.key}_${state}_${dir}`, true);
    }
    if (this.clothes && this.clothes.visible) {
      const clothesAnim = `pack_clothes_${this.clothes.texture.key}_${state}_${dir}`;
      if (this.clothes.anims.exists(clothesAnim)) {
        this.clothes.play(clothesAnim, true);
      }
    }
    if (this.acc && this.acc.visible) {
      const accAnim = `pack_acc_${this.acc.texture.key}_${state}_${dir}`;
      if (this.acc.anims.exists(accAnim)) {
        this.acc.play(accAnim, true);
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

// NPC definitions
export const NPC_DEFS = [
  {
    key: "banker",
    name: "Banker",
    x: 600, y: 600,
    skinTone: "1", gender: "male" as const,
    hairStyle: "Josh", hairColor: "Black", eyeColor: "Brown",
    clothesColor: "Blue", accItem: "Beret",
    color: "#FFD700",
  },
  {
    key: "blacksmith",
    name: "Blacksmith",
    x: 1000, y: 700,
    skinTone: "2", gender: "male" as const,
    hairStyle: "Sebastian", hairColor: "Brown", eyeColor: "Brown",
    clothesColor: "Red", accItem: "Farm",
    color: "#FF8C00",
  },
  {
    key: "pirate",
    name: "Pirate",
    x: 800, y: 900,
    skinTone: "3", gender: "male" as const,
    hairStyle: "Standard", hairColor: "Ginger", eyeColor: "Black",
    clothesColor: "Purple", accItem: "Pirate",
    color: "#FF4500",
  },
  {
    key: "mermaid",
    name: "Mermaid",
    x: 1400, y: 500,
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
