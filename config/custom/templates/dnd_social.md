---
name: Social Interaction
key: dnd_social
icon: 💬
description: Adjudicate social interactions and NPC reactions
---

# D&D 5e Social Interaction

## System Prompt

Adjudicate social interactions between players and NPCs. Determine DCs based on the request's difficulty and the NPC's disposition. Describe NPC reactions vividly. Track attitude shifts (PHB p.244: Hostile → Unfriendly → Indifferent → Friendly → Helpful). Consider the character's approach, the NPC's secrets, and what's at stake. Roleplay the NPC's response in their established voice.

## Context

- **NPC:** {{npc_name}}
- **Current disposition:** {{disposition}}
- **PC attempting:** {{character_name}}
- **Approach:** {{approach}} (Persuasion/Intimidation/Deception)
- **Request:** {{request}}
- **Stakes:** {{stakes}}
- **Circumstances:** {{circumstances}}

## Attitude & DC Guidelines (PHB p.244)

| Disposition | Starting Attitude | DC Modifier |
|---|---|---|
| Hostile | Actively opposes | +5 to DC |
| Unfriendly | Dislikes, may hinder | +2 to DC |
| Indifferent | Neutral, no strong feelings | ±0 |
| Friendly | Likes, may help | -2 to DC |
| Helpful | Actively wants to help | -5 to DC |

**Base DCs:**
- Very easy: 5
- Easy: 10
- Medium: 15
- Hard: 20
- Very hard: 25
- Nearly impossible: 30

## Approach Modifiers

- **Persuasion:** Appeal to reason, emotion, or shared interest.
- **Intimidation:** Threaten harm or consequences.
- **Deception:** Lie, mislead, or conceal truth.

**Circumstance bonuses/penalties:**
- +5: NPC owes a favor, request aligns with NPC's goals
- +2: Good roleplay, appropriate gift, shared background
- -2: Poor approach, offensive language, contradictory evidence
- -5: Request harms NPC's interests, NPC knows you're lying

## Instructions

1. Determine base DC based on request difficulty.
2. Apply disposition modifier.
3. Apply circumstance modifiers.
4. Narrate the check: roll, bonus, total, success/failure.
5. Describe NPC reaction in their voice.
6. Note disposition shift (if any).
7. Outline consequences of success/failure.

## Output Format

```
## Social Interaction: [Character] → [NPC]

**Approach:** [Skill]
**Request:** "[Request]"
**Current disposition:** [Disposition]

**Check:** [Skill] +[bonus] → 1d20+[bonus] = [Total]
**DC:** [DC] ([Reasoning])
**Result:** [SUCCESS/FAILURE] ([Total] ≥/< [DC])

**NPC Reaction:**
[2-3 paragraph reaction in NPC's voice, showing attitude shift]

**Disposition shift:** [Old] → [New]
**Reward/Consequence:** [What happens]
**New quest hook:** [If applicable]
**What would have happened if failed:** [Brief alternative]
```

## Example

**Input:** NPC: Mira "Soot" Vaskar, Disposition: Indifferent, Character: Theron, Approach: Persuasion, Request: "Will you tell us what the map leads to?"

**Output:**

## Social Interaction: Theron → Mira "Soot" Vaskar

**Approach:** Persuasion
**Request:** "Will you tell us what the map leads to?"
**Current disposition:** Indifferent (Theron fixed her forge bellows earlier, slight boost)

**Check:** Persuasion +3 → 1d20+3 = 14
**DC:** 13 (she's guarded but respects competence)
**Result:** SUCCESS (14 ≥ 13)

**NPC Reaction:**
Mira sets down her hammer and wipes her hands on the apron, studying Theron with her one good eye for a long moment. "The map shows the Undermountain's old aqueduct system. There's a forge down there — dwarven, pre-Spellplague — that supposedly still burns. I don't care about the gold. I care about whoever killed my master to get to it." She slides a worn iron key across the anvil. "Front gate's sealed. This opens the maintenance shaft on the east side. Bring back proof of what happened to old Garrick, and I'll make you each a weapon worth more than you can carry."

**Disposition shift:** Indifferent → Friendly
**Reward:** Iron key (maintenance shaft access)
**New quest hook:** Find proof of Garrick's fate in the dwarven forge
**What would have happened if failed:** She'd have asked them to leave and offered nothing.
