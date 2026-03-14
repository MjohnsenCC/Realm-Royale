import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GuestSetupScene } from "./scenes/GuestSetupScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { GameScene } from "./scenes/GameScene";
import { AuthManager } from "./auth/AuthManager";

// Initialize auth (check for OAuth callback token in URL hash or restore from localStorage)
AuthManager.getInstance().initialize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  parent: "game-container",
  dom: { createContainer: true },
  scene: [BootScene, MenuScene, GuestSetupScene, CharacterSelectScene, GameScene],
  render: {
    roundPixels: true,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: document.getElementById("game-container") as HTMLElement,
  },
};

new Phaser.Game(config);
