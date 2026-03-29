# Balance Reference

This document tracks expected player power at each game stage and the balance targets for enemies.
Use it to verify that changes maintain the intended difficulty curve.

---

## Design Principles

1. **Weapons are primary damage** — ability DPS must not exceed weapon DPS
2. **Abilities are supplementary** — powerful per-cast but limited by cooldown and mana
3. **Enemies are dangerous** — dying is a real possibility in mid-to-late content
4. **Regen is scarce** — 5/s of either HP or mana regen is "a lot", only achievable with high-tier gear
5. **Normal enemies die in 4-6 bow hits** from an appropriately-geared player

---

## Weapon Stats (after 50% attack rate buff)

Base values at tier multiplier 1.0 (T4):

| Weapon | Base Damage | Base Cooldown | DPS @T4 |
|--------|-------------|---------------|---------|
| Sword  | 95          | 445ms         | ~213    |
| Bow    | 55          | 247ms         | ~223    |
| Wand   | 45          | 290ms         | ~155    |

Sword: highest per-hit, melee range. Bow: highest ranged DPS. Wand: lowest DPS (offset by Relic AOE).

### Weapon DPS by Tier (average quality roll)

| Tier | Mult | Sword DMG | Sword DPS | Bow DMG | Bow DPS | Wand DMG | Wand DPS |
|------|------|-----------|-----------|---------|---------|----------|----------|
| T1   | 0.4  | 38        | 85        | 22      | 89      | 18       | 62       |
| T2   | 0.6  | 57        | 128       | 33      | 134     | 27       | 93       |
| T3   | 0.8  | 76        | 171       | 44      | 178     | 36       | 124      |
| T4   | 1.0  | 95        | 213       | 55      | 223     | 45       | 155      |
| T5   | 1.2  | 114       | 256       | 66      | 267     | 54       | 186      |
| T6   | 1.5  | 143       | 321       | 83      | 336     | 68       | 234      |
| T7   | 1.8  | 171       | 384       | 99      | 401     | 81       | 279      |
| T8   | 2.2  | 209       | 470       | 121     | 490     | 99       | 341      |
| T9   | 2.6  | 247       | 555       | 143     | 579     | 117      | 403      |
| T10  | 3.0  | 285       | 640       | 165     | 668     | 135      | 466      |
| T11  | 3.5  | 333       | 748       | 193     | 781     | 158      | 545      |
| T12  | 4.0  | 380       | 854       | 220     | 891     | 180      | 621      |

---

## Ability Stats (after nerf)

Formula: `cooldown = baseCooldown / (1 + 0.15 * mult)`, `manaCost = baseManaCost` (flat)

| Tier | Mult | Quiver CD | Quiver DMG | Helm CD | Helm DMG | Relic CD | Relic DMG |
|------|------|-----------|------------|---------|----------|----------|-----------|
| T1   | 0.4  | 802ms     | 56         | 943ms   | 32       | 1132ms   | 48        |
| T4   | 1.6  | 690ms     | 224        | 812ms   | 128      | 974ms    | 192       |
| T7   | 4.0  | 531ms     | 560        | 625ms   | 320      | 750ms    | 480       |

Mana costs (flat): Quiver 36, Helm 40, Relic 45

### Ability DPS vs Weapon DPS @T7

| Class    | Weapon DPS | Ability DPS (single) | Ratio |
|----------|------------|----------------------|-------|
| Archer   | 401        | 1054 (piercing line) | 2.6x but single-target comparable |
| Warrior  | 384        | 512 (per proj x8)    | AOE burst, not sustained |
| Arcanist | 279        | 640 (per proj x6)    | AOE burst, not sustained |

Abilities deal more burst but drain mana quickly. At base mana regen (~6/s), Quiver (36 mana) can only sustain ~1 cast/6s off regen alone.

---

## Player Effective HP by Game Stage

Effective HP = base HP (100 + (level-1)*3) + armor locked Health stat

| Stage | Level | Armor Tier | Effective HP |
|-------|-------|------------|--------------|
| T1 Shore | 1-5 | T1 | 100-160 |
| T1 Lowlands | 8-12 | T2-T3 | 200-320 |
| T1 Midlands | 15-20 | T3-T4 | 280-420 |
| T1 Highlands | 20-25 | T4-T5 | 360-530 |
| T1 Godlands | 25-30 | T5-T6 | 430-620 |
| T2 Shore | 25-30 | T5-T6 | 430-620 |
| T2 Lowlands | 30-35 | T6-T7 | 530-720 |
| T2 Midlands | 35-40 | T7-T8 | 630-850 |
| T2 Highlands | 40-45 | T8-T9 | 750-1000 |
| T2 Godlands | 45-50 | T9-T10 | 880-1170 |
| T3 Shore | 40-45 | T8-T9 | 750-1000 |
| T3 Lowlands | 45-50 | T9-T10 | 880-1170 |
| T3 Midlands | 50-55 | T10-T11 | 1020-1330 |
| T3 Highlands | 55-60 | T11-T12 | 1170-1530 |
| T3 Godlands | 60-65 | T12 | 1340-1530 |

---

## Regen Budget

### Base Regen (no gear)

| Level | HP Regen | Mana Regen |
|-------|----------|------------|
| 1     | 0        | 3.0        |
| 25    | 0.96     | 4.44       |
| 50    | 1.96     | 5.94       |

### Max Achievable Regen from Gear

| Source | HP Regen | Mana Regen |
|--------|----------|------------|
| T12 Heavy Armor (locked) | 5.0 | - |
| T12 Mantle (locked) | - | 3.0 |
| T6 Open Stat (best roll) | 2.0 HP or 5.0 Mana | |
| T7 Ring (fixed bonus) | 1.5 | - |
| T7 Ring (locked) | - | 16.0 |

**Theoretical max HP regen @L50:** 1.96 (base) + 5.0 (armor) + 2.0 (open) + 1.5 (ring) = **~10.5/s**
**Realistic HP regen @L50:** 1.96 + 3.5 + 1.0 + 1.0 = **~7.5/s**

**Theoretical max Mana regen @L50:** 5.94 (base) + 3.0 (mantle) + 5.0 (open) + 16.0 (ring locked) = **~30/s**
**Realistic Mana regen @L50:** 5.94 + 1.5 + 2.0 + 10.0 = **~19.5/s**

At 36 mana/cast for Quiver with 531ms CD: sustaining full spam requires ~68 mana/s. Realistic regen covers ~29% of that.

---

## Enemy HP Targets (4-6 bow hits = normal)

| Zone | Bow DMG/Hit | Normal HP (4-6) | Elite HP (8-12) |
|------|-------------|-----------------|-----------------|
| T1 Shore | ~22 | 90-130 | 175-260 |
| T1 Lowlands | ~38 | 150-230 | 300-460 |
| T1 Midlands | ~50 | 200-300 | 400-600 |
| T1 Highlands | ~60 | 240-360 | 480-720 |
| T1 Godlands | ~75 | 300-450 | 600-900 |
| T2 Shore | ~75 | 300-450 | 600-900 |
| T2 Lowlands | ~90 | 360-540 | 720-1080 |
| T2 Midlands | ~110 | 440-660 | 880-1320 |
| T2 Highlands | ~130 | 520-780 | 1040-1560 |
| T2 Godlands | ~155 | 620-930 | 1240-1860 |
| T3 Shore | ~130 | 520-780 | 1040-1560 |
| T3 Lowlands | ~155 | 620-930 | 1240-1860 |
| T3 Midlands | ~180 | 720-1080 | 1440-2160 |
| T3 Highlands | ~205 | 820-1230 | 1640-2460 |
| T3 Godlands | ~220 | 880-1320 | 1760-2640 |

---

## Enemy Damage Targets (~10-15% of player effective HP per hit)

| Zone | Player Eff. HP | Normal Dmg | Elite Dmg |
|------|----------------|------------|-----------|
| T1 Shore | ~130 | 12-18 | 20-25 |
| T1 Lowlands | ~260 | 25-35 | 40-50 |
| T1 Midlands | ~350 | 35-50 | 55-70 |
| T1 Highlands | ~450 | 45-65 | 70-90 |
| T1 Godlands | ~530 | 55-80 | 85-110 |
| T2 Shore | ~530 | 55-80 | 85-110 |
| T2 Lowlands | ~625 | 65-95 | 100-130 |
| T2 Midlands | ~740 | 75-110 | 115-150 |
| T2 Highlands | ~875 | 90-130 | 135-175 |
| T2 Godlands | ~1025 | 105-155 | 160-200 |
| T3 Shore | ~875 | 90-130 | 135-175 |
| T3 Lowlands | ~1025 | 105-155 | 160-200 |
| T3 Midlands | ~1175 | 120-175 | 180-240 |
| T3 Highlands | ~1350 | 140-200 | 210-280 |
| T3 Godlands | ~1435 | 150-220 | 230-300 |

---

## Boss Damage Progression

| Boss | Phase 1 | Phase 2 | Phase 3 | Player Eff. HP |
|------|---------|---------|---------|----------------|
| Jungle Warden | 40 | 55 | 70 | ~450 |
| Molten Wyrm | 80 | 120 | 160 | ~740 |
| The Architect | 110 | 160 | 200 | ~1025 |

---

## Key Balance Invariants

- [ ] Normal enemies die in 4-6 bow hits from appropriately-geared player
- [ ] Ability DPS (sustained) does not exceed weapon DPS
- [ ] HP regen from gear alone < 5/s until T10+ armor
- [ ] Players cannot out-regen enemy damage in their appropriate zone
- [ ] Boss Phase 3 projectiles threaten 15-25% of player HP per hit
- [ ] Mana regen sustains ability casts at ~30-50% of max cooldown rate
