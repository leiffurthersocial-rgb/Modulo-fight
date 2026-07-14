# New Game Mode Concepts (planned — not yet implemented)

The 4/8-player FFA modes were removed: with one local player they were really
"watch six bots fight each other", diluting what the engine does best —
readable, high-stakes duels. These concepts replace them with modes that keep
the player at the centre of every moment. They are ordered by
value-for-effort; each lists the mechanics, what already exists in the engine
to support it, and what would need building.

---

## 1. Boss Rush ⭐ (recommended first)

Fight all 8 fighters back-to-back, each with one stock, your damage carrying
over between duels. Between rounds you pick **one of three boons** (heal 40%,
+10% damage dealt, +1 mid-air jump, faster ult charge…). The final opponent is
a "boss" variant: 1.3× scale voxel model, more stocks, boosted stats.

- **Already exists:** the Survive wave-swap machinery (`nextOpponent`,
  in-place fighter replacement, wave events) is 90% of the flow. Carrying
  damage over = just not resetting `damage` between waves.
- **To build:** a between-round boon picker overlay (DOM, like the pause
  menu), a small `modifiers` object on `FighterRuntime` that combat/physics
  read, and a scale multiplier in `VoxelCharacter`/`FighterView` for the boss.
- **Why first:** biggest "new game" feel for the least new engine surface.

## 2. Crown Keeper (King of the Hill)

A golden crown (Jovan-approved) spawns mid-stage. Whoever holds it scores
points per second; getting hit hard drops it. First to 100 points wins. The
crown holder is slightly slowed (heavier head!) so the mode self-balances —
runners can't just flee forever.

- **Already exists:** timers, HUD score plumbing (Survive score), knockback
  thresholds to detect "hit hard".
- **To build:** a pickup entity (a third, non-fighter object in the sim —
  the projectile pool shows the pattern), a score HUD row, drop/respawn logic.
- **Pairs beautifully** with Jovan's crown identity and the existing arenas.

## 3. Volley (projectile deathmatch)

Every fighter's special is replaced by a projectile volley (the Laser Barrage
system, re-tinted per fighter) with generous cooldowns; melee damage is
halved. Stage hazards ping-pong bolts back at reduced damage. A completely
different, spacing-focused way to play the same roster.

- **Already exists:** the entire projectile system (fire cadence, pooling,
  collision, per-owner accent rendering) shipped with Erim's ultimate.
- **To build:** a mode flag that swaps attack data at match build time
  (`buildMatchConfig` already assembles per-mode fighter setups), bounce
  logic on platform collision.

## 4. Sudden Death Gauntlet

Both fighters start at **250%**. One clean hit usually kills. Best of 9
rounds, ~15 seconds each; if a round times out, the stage shrinks (blast
zones creep inward — the config is already plain data that can be lerped).
Pure reflexes, near-zero downtime, great for quick sessions.

- **Already exists:** `setDamage` (debug API already sets spawn damage),
  round flow can reuse respawn machinery, blast zones are mutable data.
- **To build:** round counter/UI, blast-zone lerp on timeout.

## 5. Tag Team 2v2

Pick two fighters; one is active, the partner waits off-stage. Tap a key to
swap (the incoming fighter dives in with brief invulnerability). Partner
slowly heals while benched. The AI opponent also runs a duo. Doubles the
roster-expression per match without cluttering the arena.

- **Already exists:** multi-fighter sim (it happily ran 8), in-place fighter
  swapping (Survive), spawn invulnerability.
- **To build:** bench state (a fighter excluded from sim stepping/camera),
  swap input + HUD for the benched partner, AI swap policy. The most new
  surface of the five — worth doing after the others prove the appetite.

---

### Suggested order

1. **Boss Rush** (reuses Survive; biggest payoff)
2. **Sudden Death Gauntlet** (small, thrilling, nearly free)
3. **Crown Keeper** (first non-fighter entity; unlocks future item modes)
4. **Volley** (leverages projectiles while they're fresh)
5. **Tag Team** (largest scope; do once modes 1–3 validate the menu flow)

Each mode slots into the existing architecture at exactly two points:
`buildMatchConfig` (assembly) and a `mode` switch inside `Simulation.step`
(rules) — the same seams Practice and Survive already use.
