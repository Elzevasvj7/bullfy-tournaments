---
name: Newsletter Copywriter Styles
description: Dual copywriter system - Sofía (technical) and Valentina (storyteller for young audiences 20-40)
type: feature
---
The Newsletter Studio supports two copywriter styles selectable per edition via `copywriter_style` column in `newsletter_editions`:
- **technical** (default): Sofía Hernández — specialized financial copywriting, professional tone, for experienced readers
- **storyteller**: Valentina Torres — uses analogies, humor, storytelling to explain finance to 20-40 year olds with no experience

The edge function `newsletter-generate` dynamically swaps the copywriter agent profile and system prompt based on the selection. Storyteller mode adds extra instructions for simple language, everyday analogies, and emotional hooks.

Both agents are shown in the AGENT_PROFILES curriculum section in the UI with their respective backgrounds.
