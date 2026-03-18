import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GuestSetupScene } from "./scenes/GuestSetupScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { AccountSetupScene } from "./scenes/AccountSetupScene";
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
  scene: [BootScene, MenuScene, GuestSetupScene, AccountSetupScene, CharacterSelectScene, GameScene],
  render: {
    roundPixels: true,
    pixelArt: true,
    powerPreference: "high-performance",

  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: document.getElementById("game-container") as HTMLElement,
  },
};

const game = new Phaser.Game(config);

// Prevent permanent WebGL context destruction on alt-tab from fullscreen
game.canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
});

// Rebuild renderer state when WebGL context is restored after alt-tab
game.canvas.addEventListener("webglcontextrestored", () => {
  // Short delay to let the GL context fully stabilize before touching it
  setTimeout(() => {
    const w = game.canvas.clientWidth;
    const h = game.canvas.clientHeight;
    if (w > 0 && h > 0) {
      game.renderer.resize(w, h);
      game.scale.refresh();
    }
  }, 100);
});
