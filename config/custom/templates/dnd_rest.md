---
name: Rest Mechanics
key: dnd_rest
icon: 🛌
description: Track short and long rest mechanics, hit dice, and recovery
---

# D&D 5e Rest Mechanics

## System Prompt

Track rest mechanics for the party. Process short rests (hit dice spending, feature recovery) and long rests (full recovery, spell slot restoration, watches). Apply any campaign-specific rest variants. Remind players of features that recharge on each rest type.

## Context

- **Party state:** {{party}}
- **Rest type:** {{rest_type}} (short/long)
- **Rest variant:** {{rest_variant}} (standard/gritty/epic)
- **Environment safety:** {{environment}}
- **Time available:** {{time_available}}

## Rest Rules Reference

### Short Rest (PHB p.186)
- **Duration:** At least 1 hour.
- **Healing:** Spend Hit Dice (roll HD + CON modifier per die).
- **Recovery:** Features marked "recharge on short rest" reset.
- **Spell slots:** No spell slot recovery (except Warlock's Pact Magic).
- **Conditions:** Some conditions may persist (e.g., Poisoned requires saving throw).

### Long Rest (PHB p.186)
- **Duration:** At least 8 hours, no more than 2 hours of strenuous activity.
- **Healing:** Recover all HP.
- **Hit Dice:** Recover half total HD (minimum 1).
- **Spell slots:** All expended slots recovered.
- **Features:** All expended features reset.
- **Exhaustion:** Reduce by 1 level (if any).
- **Conditions:** Most conditions end (check specific condition rules).

### Rest Variants (DMG p.267)
- **Gritty Realism:** Short rest = 8 hours, long rest = 7 days.
- **Epic Heroism:** Short rest = 5 minutes, long rest = 1 hour.

## Instructions

1. For each party member, show current HP, HD available, and conditions.
2. Process HD spending for short rests.
3. Track feature recovery (Second Wind, Action Surge, Channel Divinity, etc.).
4. For long rests, show watch rotation suggestions.
5. Apply environmental effects (unsafe location = risk of interruption).
6. Note any conditions that persist through rest.

## Output Format

```
## [Rest Type] — [Duration]

### [Character Name] ([Class Level])
- **Current HP:** [X]/[Max]
- **Hit Dice available:** [X]/[Max]
  - [If spending HD]: Spends [X]d[Y]+[CON] = [Total] → HP: [New]/[Max]
  - HD remaining: [X]/[Max]
- **Features recovered:** [List features]
- **Spell slots:** [Recovery status]
- **Conditions:** [Status after rest]

### Watch Rotation (Long Rest Only)
1. **Watch 1 ([X]h):** [Character] ([Reason])
2. **Watch 2 ([X]h):** [Character] ([Reason])
3. **Watch 3 ([X]h):** [Character] ([Reason])
4. **Watch 4 ([X]h):** [Character] ([Reason])

### Long Rest Results
- HP restored to maximum for all
- Spell slots restored to maximum
- Hit Dice recovered: half total (minimum 1)
- Exhaustion level reduced by 1 (if any)
- Conditions removed: [List]
- Conditions persisting: [List]
```

## Example

**Input:** Party: Theron (Ranger 3, HP 8/28), Mira (Fighter 3, HP 12/28, Poisoned), Rest type: short

**Output:**

## Short Rest — 1 Hour

### Theron (Ranger 3)
- **Current HP:** 8/28
- **Hit Dice available:** 2/3
  - Spends 1d10+2 = 7 → HP: 15/28
  - Spends 1d10+2 = 12 → HP: 27/28 (max)
  - HD remaining: 0/3
- **Features recovered:** Horde Breaker, Natural Explorer (already per-encounter)
- **Spell slots:** No slots recovered on short rest
- **Conditions:** None

### Mira (Fighter 3)
- **Current HP:** 12/28
- **Hit Dice available:** 2/3
  - Spends 1d10+1 = 6 → HP: 18/28
  - HD remaining: 1/3
- **Features recovered:** Second Wind (✅), Action Surge (already recovered on short rest)
- **Conditions:** Poisoned (⚠️ not removed by short rest — requires DC 15 CON save or persists)
