---
name: NPC Generation
key: dnd_npc
icon: 🎭
description: Create memorable NPCs with personality, stats, and dialogue
---

# D&D 5e NPC Generation

## System Prompt

Generate a vivid, memorable D&D 5e NPC suitable for the campaign setting. The NPC should feel like a person the players will remember — give them distinctive speech patterns, a hidden depth, and a reason to exist in the world. Include everything the DM needs to roleplay them convincingly at the table.

## Context

- **Setting:** {{campaign_setting}}
- **Location:** {{location}}
- **NPC Role:** {{npc_role}}
- **Race preference:** {{race}}
- **Alignment suggestion:** {{alignment}}
- **Combat capability:** {{cr}}

## Instructions

1. Create a unique NPC with a memorable name and appearance.
2. Define personality using the PHB bond/ideal/flaw/trait structure.
3. Write a distinctive speaking style with 2-3 dialogue examples.
4. Include at least one secret that can drive plot hooks.
5. If combat-capable (CR specified), provide a complete stat block.
6. Give the NPC a reason to exist in this specific location.
7. Consider how the NPC connects to the broader world — factions, family, rivals.

## Output Format

```
## [Name] "[Nickname]" [Surname]

**Race:** [Race] | **Age:** [age] | **Alignment:** [alignment]
**Occupation:** [job]
**Location:** [where they're found]

### Appearance
[2-3 sentences of vivid physical description]

### Personality
- **Trait 1:** "[quote or description]"
- **Trait 2:** "[quote or description]"
- **Ideal:** **[Ideal Name].** [Description]
- **Bond:** "[Personal connection or motivation]"
- **Flaw:** "[Weakness or blind spot]"
- **Secret:** [Hidden truth that drives drama]

### Speaking Style
[Brief description of voice, vocabulary, mannerisms]

> "[Dialogue example — first meeting / neutral]"
>
> "[Dialogue example — friendly / helpful]"
>
> "[Dialogue example — angry / threatened]"

### Stat Block [if combat-capable]
[Full 5e stat block format]
```

## Example

**Input:** Role: blacksmith, Location: Baldur's Gate Slag Quarter, Race: Tiefling

## Mira "Soot" Vaskar

**Race:** Tiefling | **Age:** 38 | **Alignment:** Chaotic Good
**Occupation:** Blacksmith & underground arms dealer
**Location:** The Slag Quarter, Baldur's Gate

### Appearance
A stocky tiefling woman with ashen-gray skin and small curved horns that look like they've been filed down for practicality. Her forearms are scarred from years of hammer strikes gone awry. She wears a heavy leather apron over a stained linen shirt, and her hair is cropped short and always has a faint metallic smell. One eye is amber, the other milky white — she's half-blind.

### Personality
- **Trait:** "I judge people by how they treat their tools, not their words."
- **Trait:** "I have a dark sense of humor and a louder laugh than you'd expect."
- **Ideal:** **Freedom.** Chains are meant to be broken — whether they're on wrists or laws.
- **Bond:** "The old dwarven smith who taught me vanished. I'll find him or his killer."
- **Flaw:** "I'll sell weapons to anyone if the gold is right. I don't ask what they're for."
- **Secret:** She's forging replicas of a legendary dwarven warhammer to draw out the thieves who stole the original from her mentor.

### Speaking Style
Gruff, direct, frequently uses smithing metaphors. Drops consonants when tired. Laughs like a barking dog. Switches to Infernal when angry.

> "You want a blade? Fine. But I don't sell to folk who can't hold one proper. Show me your calluses or get out of my forge."
>
> "Huh. You actually waited for me to finish my work before talking. That's... rare. Sit down. I've got ale somewhere."
>
> *(In Infernal, quiet and dangerous):* "If you touch that anvil again, I'll forge your fingers into hinges."

### Stat Block
**Mira "Soot" Vaskar.** Medium humanoid (tiefling), Chaotic Good
___
**Armor Class** 15 (chain shirt)
**Hit Points** 44 (8d8 + 8)
**Speed** 30 ft.
___
| STR | DEX | CON | INT | WIS | CHA |
|---|---|---|---|---|---|
| 14 (+2) | 12 (+1) | 13 (+1) | 10 (+0) | 11 (+0) | 16 (+3) |
___
**Skills:** Athletics +4, Intimidation +5, Persuasion +5
**Senses:** Darkvision 60 ft., passive Perception 10
**Languages:** Common, Infernal
**Challenge:** 1/2 (100 XP)

**Hellish Resistance.** Mira has resistance to fire damage.

**Actions:**
*Multiattack.* Mira makes two warhammer attacks.
*Warhammer.* Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) bludgeoning damage.
*Hellish Rebuke (1/Day).* When Mira takes damage, she can force the attacker to make a DC 13 Dexterity save, taking 2d10 fire damage on a failed save.
