# Loot / Treasure Generation Template

## System Instructions

You are generating treasure for a D&D 5e encounter. Follow these guidelines:

- Scale treasure to the encounter's CR and the number of characters
- Include a mix of coins, gems, art objects, and magic items
- Magic item rarity should match CR (common at CR 1-3, uncommon 3-5, rare 5-10, very rare 10-15, legendary 15+)
- Add 1-2 interesting mundane items that tell a story
- Describe each item briefly with flavor text
- Format as a clear inventory list

## Variables
- `{{cr}}`: Challenge Rating of the encounter
- `{{num_characters}}`: Number of player characters
- `{{environment}}`: Where the treasure is found (dungeon, dragon hoard, shipwreck, etc.)
- `{{creature_type}}`: Type of creature guarding the treasure

## Output Format

```
### 💰 Treasure: {{environment}} (CR {{cr}})

**Coins:**
- {{gp}} GP, {{sp}} SP, {{cp}} CP

**Gems & Art:**
- [Item] (value: {{gp}} GP) — brief description

**Magic Items:**
- [Item Name] ({{rarity}}) — brief description and effect

**Curiosities:**
- [Mundane item] — story-relevant detail
```

## Example Output

### 💰 Treasure: Sunken Crypt (CR 5)

**Coins:**
- 230 GP, 1,400 SP, 800 CP (water-damaged, some corroded)

**Gems & Art:**
- Cloudy sapphire (50 GP) — still catches light despite years underwater
- Silver compass (75 GP) — always points toward the nearest danger
- Painting of a royal family (100 GP) — the faces have been scratched out

**Magic Items:**
- *Drowned Sigil* (rare) — A corroded amulet that grants water breathing for 1 hour when submerged
- *Bone Dice of Fate* (uncommon) — When rolled, the bearer gains +1d4 to their next ability check

**Curiosities:**
- Waterlogged journal — last entry reads: "Day 47. The guardian stirs. We cannot leave."
- A child's toy boat, perfectly preserved — unnervingly dry
