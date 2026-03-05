import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { GameScene } from "./scenes/GameScene";
import { AuthManager } from "./auth/AuthManager";

// Initialize auth (check for OAuth callback token in URL hash or restore from localStorage)
AuthManager.getInstance().initialize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  parent: document.body,
  dom: { createContainer: true },
  scene: [BootScene, MenuScene, CharacterSelectScene, GameScene],
  render: { roundPixels: true },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
