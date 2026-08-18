# Free Video Upscaler — Design Direction

## Three stylistic approaches

### Theme Name: Darkroom Console
Very dark, technical, and cinematic, with amber status lights and a film-lab atmosphere. The interface would feel like a focused post-production instrument.

**Probability:** 0.06

### Theme Name: Signal Garden
A bright, editorial interface inspired by broadcast test cards, paper labels, and soft mint calibration marks. It makes a technical tool feel calm, approachable, and trustworthy.

**Probability:** 0.03

### Theme Name: Precision Atelier
A refined, light interface combining graphite typography, warm paper, and a single vivid coral signal color. It frames local processing as a craft: deliberate, private, and exact.

**Probability:** 0.08

## Selected Approach: Precision Atelier

### Design Movement
Swiss editorial modernism softened by analog post-production culture: precise alignment, high-contrast type, tactile surfaces, and visible technical detail without looking like a developer dashboard.

### Core Principles
1. Make the processing state legible at a glance.
2. Use asymmetry and editorial hierarchy instead of a centered marketing stack.
3. Pair tactile warmth with credible technical language.
4. Keep every action local, reversible, and explicit.

### Color Philosophy
Warm paper and graphite create a calm workspace rather than a cold utility. The signature coral signal color marks action, progress, and successful output; a cool mineral green is reserved for privacy and local-processing reassurance. Color is functional, not decorative.

### Layout Paradigm
A split workbench: a narrow editorial rail establishes context and constraints while the larger right-hand canvas holds the upload, preview, controls, and export state. The layout should feel like a page spread with a work surface, not a centered card.

### Signature Elements
- Coral registration marks and thin calibration rules.
- A framed before/after preview with a draggable comparison handle.
- Small monospace technical labels for format, scale, and processing state.

### Interaction Philosophy
Interactions should feel like physical controls: clear labels, immediate feedback, and no hidden server-side steps. Dragging, choosing a scale, and exporting should update visible technical readouts. The app should explain its limits without interrupting the workflow.

### Animation
Use short, decisive transitions under 260ms. Progress should move with a quiet linear shimmer only during processing. Panels enter with a slight upward translation and opacity change; never use bouncing or excessive glow. Respect reduced-motion preferences.

### Typography System
Use Fraunces for expressive editorial headlines and IBM Plex Sans for interface copy. Use IBM Plex Mono for metadata, numeric readouts, file details, and status labels. Headlines are compact and slightly oversized; body copy is 15–17px with generous line height; labels are uppercase with letter spacing.

### Brand Essence
A private, free video enhancement workbench for creators who want sharper exports without uploading their footage anywhere. **Precise, generous, independent.**

### Brand Voice
Headlines are direct and quietly confident. CTAs describe the action and the privacy model rather than using generic growth language.

- “Sharpen the signal. Keep the footage.”
- “Choose a scale, then export locally.”

### Wordmark & Logo
A compact mark made from two offset rectangular frames and one coral registration notch, suggesting a video frame being aligned and enlarged. The wordmark uses a custom condensed serif treatment rather than a default sans-serif label.

### Signature Brand Color
Signal Coral: `#F05A47` — a warm, ownable accent that reads as an active processing indicator against paper and graphite.
