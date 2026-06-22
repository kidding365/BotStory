# Model Tiers and Image Logic

BotStory utilizes a tiered AI and Image generation system to balance cost, speed, and quality.

## 1. AI Model Hierarchy

| Model | Tier | Characteristics | Typical Cost/Turn |
| :--- | :--- | :--- | :--- |
| **Lynx** | Low | Lightweight, fast, cost-efficient. | 30 - 50 |
| **Grimalkin** | Mid | Balanced quality and cost. | 55 - 95 |
| **Smilodon** | High | The general-purpose standard. | 70 - 120 |
| **Massivecat** | Ultra | Most powerful, highest reasoning capacity. | 100 - 175 |
| **Caracal** | Creative | Low-cost thinking model, can be erratic. | 45 - 65 |
| **Leopard** | Dark | Specialized in darker, grittier tones. | 140 - 175 |

### **Thinking Variants**
Models like `Lynx-thinking`, `Smilodon-thinking`, and `Massivecat-thinking` implement a "Chain of Thought" process. They are slower and more expensive but significantly better at complex state tracking and narrative consistency.

## 2. Image Generation Logic

### **Models**
- **Manticore**: The flagship model. Versatile and high-quality.
- **Wyvern**: High potential but inconsistent.
- **Flux.1**: Legacy model, largely replaced by Manticore.

### **Style Architecture**
Images are not generated from a single prompt but from a **composite assembly**:
`Final Image Prompt` = `Model Style Preset` + `Character Guidance` + `Appearance Prompt` + `Setting Prompt`

- **Style Presets**: Pre-defined prompts (e.g., "Photorealistic 1") that set the overall aesthetic.
- **Appearance**: A specific description of the subject (e.g., "aged parchment with a red wax seal").
- **Setting**: A description of the environment (e.g., "stone-walled dorm room at night").

### **Generation Parameters**
- **Frequency**: `Always` / `On Change` (only if the subject changes) / `Never`.
- **Count**: 1, 2, or 3 alternatives per turn.
