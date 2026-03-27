import Phaser from "phaser";
import { WeaponSubtype, RealmTier } from "@rotmg-lite/shared";

// Audio asset keys — single source of truth for all audio keys used across the codebase.
// Add new entries here when introducing new sounds/music.
export const AudioKeys = {
  // Weapon SFX
  SFX_SWORD_ATTACK: "sfx-sword-attack",
  SFX_BOW_ATTACK: "sfx-bow-attack",
  SFX_WAND_ATTACK: "sfx-wand-attack",
  // Realm music
  MUSIC_WILD: "music-the-wild",
  MUSIC_RUINS: "music-the-ruins",
  MUSIC_DEVINE_HELL: "music-devine-hell",
} as const;

// Weapon subtype → SFX key
const WEAPON_SFX_MAP: Record<number, string> = {
  [WeaponSubtype.Sword]: AudioKeys.SFX_SWORD_ATTACK,
  [WeaponSubtype.Bow]: AudioKeys.SFX_BOW_ATTACK,
  [WeaponSubtype.Wand]: AudioKeys.SFX_WAND_ATTACK,
};

// Realm tier → music key
const REALM_MUSIC_MAP: Record<number, string> = {
  [RealmTier.Wild]: AudioKeys.MUSIC_WILD,
  [RealmTier.Ruins]: AudioKeys.MUSIC_RUINS,
  [RealmTier.DevineHell]: AudioKeys.MUSIC_DEVINE_HELL,
};

const FADE_DURATION_MS = 1500;
const DEFAULT_SFX_VOLUME = 0.5;
const DEFAULT_MUSIC_VOLUME = 0.3;

export class AudioManager {
  private static instance: AudioManager;

  private scene: Phaser.Scene | null = null;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;
  private sfxVolume: number;
  private musicVolume: number;

  private constructor() {
    const savedSfx = localStorage.getItem("sfxVolume");
    const savedMusic = localStorage.getItem("musicVolume");
    this.sfxVolume = savedSfx !== null ? parseFloat(savedSfx) : DEFAULT_SFX_VOLUME;
    this.musicVolume = savedMusic !== null ? parseFloat(savedMusic) : DEFAULT_MUSIC_VOLUME;
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /** Bind to a Phaser scene. Call once from GameScene.create(). */
  init(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  // ── SFX ──────────────────────────────────────────────────────────────

  /** Play the attack SFX matching a WeaponSubtype (Sword / Bow / Wand). */
  playWeaponSfx(weaponSubtype: number): void {
    const key = WEAPON_SFX_MAP[weaponSubtype];
    if (key) this.playSfx(key);
  }

  /** Generic SFX player. Use for abilities, UI clicks, etc. in the future. */
  playSfx(key: string, volume?: number): void {
    if (!this.scene) return;
    if (this.scene.sound.locked) {
      this.scene.sound.once("unlocked", () => {
        this.scene!.sound.play(key, { volume: volume ?? this.sfxVolume });
      });
      return;
    }
    this.scene.sound.play(key, { volume: volume ?? this.sfxVolume });
  }

  // ── Music ────────────────────────────────────────────────────────────

  /**
   * Call on every zone change.
   * Pass the realm tier (1/2/3) for hostile zones, or null for Nexus/Vault/Dungeon.
   */
  onZoneChanged(realmTier: number | null): void {
    if (realmTier === null) {
      this.stopMusic();
      return;
    }
    const targetKey = REALM_MUSIC_MAP[realmTier];
    if (!targetKey) {
      this.stopMusic();
      return;
    }
    if (this.currentMusicKey === targetKey) return;
    this.crossfadeTo(targetKey);
  }

  private crossfadeTo(newKey: string): void {
    if (!this.scene) return;

    const startNew = () => {
      if (!this.scene) return;
      // Handle locked audio context (browser autoplay policy)
      if (this.scene.sound.locked) {
        this.scene.sound.once("unlocked", () => this.crossfadeTo(newKey));
        return;
      }
      this.currentMusic = this.scene.sound.add(newKey, { loop: true, volume: 0 });
      this.currentMusic.play();
      this.currentMusicKey = newKey;
      this.scene.tweens.add({
        targets: this.currentMusic,
        volume: this.musicVolume,
        duration: FADE_DURATION_MS,
      });
    };

    if (this.currentMusic && (this.currentMusic as Phaser.Sound.WebAudioSound).isPlaying) {
      // Fade out current track, then start new one
      const old = this.currentMusic;
      this.currentMusic = null;
      this.currentMusicKey = null;
      this.scene.tweens.add({
        targets: old,
        volume: 0,
        duration: FADE_DURATION_MS,
        onComplete: () => {
          old.stop();
          old.destroy();
          startNew();
        },
      });
    } else {
      // Nothing playing — start directly
      if (this.currentMusic) {
        this.currentMusic.stop();
        this.currentMusic.destroy();
        this.currentMusic = null;
        this.currentMusicKey = null;
      }
      startNew();
    }
  }

  private stopMusic(): void {
    if (!this.currentMusic || !this.scene) {
      this.currentMusicKey = null;
      return;
    }
    const old = this.currentMusic;
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.scene.tweens.add({
      targets: old,
      volume: 0,
      duration: FADE_DURATION_MS,
      onComplete: () => {
        old.stop();
        old.destroy();
      },
    });
  }

  // ── Volume controls ──────────────────────────────────────────────────

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem("sfxVolume", String(this.sfxVolume));
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem("musicVolume", String(this.musicVolume));
    if (this.currentMusic) {
      (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(this.musicVolume);
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  /** Clean up when leaving GameScene. */
  destroy(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
    }
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.scene = null;
  }
}
