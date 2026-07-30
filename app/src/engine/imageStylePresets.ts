import { World } from './types';

/**
 * Named image-style presets backported from infiniteworlds.app.
 *
 * Each preset wraps the LLM's `outcome.visualVariables` (subject/appearance/
 * setting/expression) in `imageStyle{Character,NonCharacter}{Pre,Post}` prompt-template
 * strings that the composer.ts `buildImagePrompt` already understands. Selecting a preset
 * is a one-click way to populate those four fields with flavour-giving tokens
 * ("Photorealistic", "Pseudorealistic CGI", "Anime", "Pulp fantasy", …) instead of
 * hand-authoring them per world.
 *
 * The original strings are sourced from live IW recon (2026-07-28) plus the real
 * IW-exported College of Magic schema (docs/college_of_magic_schema.json) — the
 * "photorealistic-1" preset below is verbatim what IW actually ships. Other presets
 * use the standard IW tag-token conventions (`IW<Tokens>`).
 *
 * See docs/iw_image_style_presets.json for the full source catalog and provenance.
 */

export interface ImageStylePreset {
  id: string;
  label: string;
  description: string;
  imageStyleCharacterPre: string;
  imageStyleCharacterPost: string;
  imageStyleNonCharacterPre: string;
  imageStyleNonCharacterPost: string;
}

/**
 * Table of available presets. Kept hand-curated in TypeScript so it can be
 * type-checked and imported directly by UI surfaces; the docs/*.json copy is the
 * canonical editable catalog (regenerate this table from it when adding presets).
 */
export const IMAGE_STYLE_PRESETS: readonly ImageStylePreset[] = [
  {
    id: 'none',
    label: 'Default (no preset)',
    description:
      "Pass the LLM's raw visual prompt straight to the image model — IW's 'no style selected' baseline. Yields the flat scenic look the user wants to improve.",
    imageStyleCharacterPre: '',
    imageStyleCharacterPost: '',
    imageStyleNonCharacterPre: '',
    imageStyleNonCharacterPost: '',
  },
  {
    id: 'photorealistic-1',
    label: 'Photorealistic 1 (Default)',
    description:
      'IW Manticore / Flux default. Real strings captured from the College of Magic IW schema. Gives the camera-photo close-up look IW users see out of the box.',
    imageStyleCharacterPre: 'Highly attractive, sexy medium close-up photograph of',
    imageStyleCharacterPost:
      'Authentic period medieval clothing. IWBeautiful IWBeautiful2 Smooth, flawless skin and a perfect face. Looking at the viewer. IWUpscaleFaceSmooth Setting: Medieval magical high fantasy.',
    imageStyleNonCharacterPre: 'Photograph of',
    imageStyleNonCharacterPost: 'High quality photograph. Setting: Medieval high fantasy.',
  },
  {
    id: 'photorealistic-2',
    label: 'Photorealistic 2 (Hollywood movie)',
    description: 'Cinematic-flavour variant. Colour-graded key-lit movie still feel.',
    imageStyleCharacterPre: 'Cinematic Hollywood movie still, dramatic key-lit medium close-up of',
    imageStyleCharacterPost:
      'Anamorphic lens flare, teal-and-orange colour grading, shallow depth of field. IWBeautiful IWBeautiful2 IWPhotorealistic Realistic skin texture and pores. Looking at the viewer.',
    imageStyleNonCharacterPre: 'Cinematic Hollywood movie still, dramatic key-lit shot of',
    imageStyleNonCharacterPost:
      'Anamorphic lens flare, teal-and-orange colour grading, shallow depth of field. IWPhotorealistic Photorealistic high-detail cinematic.',
  },
  {
    id: 'pseudorealistic-cgi',
    label: 'Pseudorealistic CGI',
    description:
      "Photo-adjacent CGI render. Halfway between still photography and a high-end 3D render (Unreal/Octane) — IW's Manticore preset of the same name.",
    imageStyleCharacterPre: 'Pseudorealistic CGI render of',
    imageStyleCharacterPost:
      'High-end 3D render, Octane-quality subsurface skin, perfectly-lit shot-reverse-shot framing. IWPhotorealistic IWCGI Looking at the viewer. Impeccable detail.',
    imageStyleNonCharacterPre: 'Pseudorealistic CGI render of',
    imageStyleNonCharacterPost:
      'High-end 3D render, Octane-quality lighting and materials. IWCGI IWPhotorealistic Impeccable detail.',
  },
  {
    id: 'anime',
    label: 'Anime',
    description: 'Manticore / Flux Anime. Modern anime cel-shaded look with vibrant hair and detailed eyes.',
    imageStyleCharacterPre: 'Anime illustration of',
    imageStyleCharacterPost:
      'Anime cel shading, vibrant detailed hair, large expressive eyes. IWAnime Anime key visual quality. Looking at the viewer.',
    imageStyleNonCharacterPre: 'Anime illustration of',
    imageStyleNonCharacterPost: 'Anime cel shading, vibrant colour palette. IWAnime Anime background art quality.',
  },
  {
    id: 'anime-2',
    label: 'Anime 2',
    description:
      'Second Manticore Anime preset — softer shoujo/Studio-Ghibli-ish linework with watercolour wash backgrounds.',
    imageStyleCharacterPre: 'Soft anime watercolour illustration of',
    imageStyleCharacterPost:
      'Studio-Ghibli-inspired soft watercolour shading, gentle painted background, warm tones. IWAnime2 Anime key visual quality. Looking at the viewer.',
    imageStyleNonCharacterPre: 'Soft anime watercolour illustration of',
    imageStyleNonCharacterPost:
      'Studio-Ghibli-inspired soft watercolour shading. IWAnime2 Anime background-art quality.',
  },
  {
    id: 'pulp-fantasy',
    label: 'Pulp fantasy',
    description:
      'Old-school pulp novel cover / Frank Frazetta flavour — muscular figures, dramatic chiaroscuro, painted feel.',
    imageStyleCharacterPre: 'Pulp fantasy novel cover painting of',
    imageStyleCharacterPost:
      'Frank Frazetta-inspired muscular painted figure, dramatic chiaroscuro, oil-on-canvas pulp cover look. IWPulpFantasy IWFantasy Looking at the viewer.',
    imageStyleNonCharacterPre: 'Pulp fantasy novel cover painting of',
    imageStyleNonCharacterPost:
      'Frank Frazetta-inspired dramatic chiaroscuro, oil-on-canvas pulp fantasy. IWPulpFantasy IWFantasy.',
  },
  {
    id: 'dark-fantasy',
    label: 'Dark fantasy',
    description: 'Desaturated, brooding — Bloodborne / dark-souls concept art feel.',
    imageStyleCharacterPre: 'Dark fantasy illustration of',
    imageStyleCharacterPost:
      'Desaturated gothic colour palette, moody rim lighting, blood-stone aesthetic. IWDarkFantasy IWFantasy Looking at the viewer.',
    imageStyleNonCharacterPre: 'Dark fantasy illustration of',
    imageStyleNonCharacterPost:
      'Desaturated gothic colour palette, moody rim lighting, blood-stone aesthetic. IWDarkFantasy IWFantasy.',
  },
  {
    id: 'comic-book',
    label: 'Comic book',
    description: 'Western comic-book inked look — bold black ink outline, halftone shading, flat colour blocks.',
    imageStyleCharacterPre: 'Comic book panel illustration of',
    imageStyleCharacterPost:
      'Bold black inked outline, halftone dot shading, flat vibrant colour blocks. IWComicBook Looking at the viewer.',
    imageStyleNonCharacterPre: 'Comic book panel illustration of',
    imageStyleNonCharacterPost:
      'Bold black inked outline, halftone dot shading, flat vibrant colour blocks. IWComicBook.',
  },
  {
    id: 'noir-drawing',
    label: 'Noir drawing',
    description: 'Black-and-white noir pencil-and-ink feel, high-contrast shadows.',
    imageStyleCharacterPre: 'Noir ink drawing of',
    imageStyleCharacterPost:
      'Black-and-white ink and wash, stark light-on-dark shading, gritty noir atmosphere. IWNoir Looking at the viewer.',
    imageStyleNonCharacterPre: 'Noir ink drawing of',
    imageStyleNonCharacterPost:
      'Black-and-white ink and wash, stark light-on-dark shading, gritty noir atmosphere. IWNoir.',
  },
  {
    id: 'digital-illustration',
    label: 'Digital illustration',
    description: 'Modern digital editorial illustration — semi-realistic shapes, painterly brushwork.',
    imageStyleCharacterPre: 'Digital illustration of',
    imageStyleCharacterPost:
      'Painterly digital brushwork, semi-realistic shapes, editorial-illustration lighting. IWIllustration Looking at the viewer.',
    imageStyleNonCharacterPre: 'Digital illustration of',
    imageStyleNonCharacterPost:
      'Painterly digital brushwork, semi-realistic shapes, editorial-illustration lighting. IWIllustration.',
  },
  {
    id: 'concept-art',
    label: 'Concept art',
    description: 'Industry-standard concept-art pass — loose sketch energy, design-forward silhouettes.',
    imageStyleCharacterPre: 'Concept art of',
    imageStyleCharacterPost:
      'Loose painterly concept-art pass, design-forward silhouette, varied thumbnail energy. IWConceptArt Looking at the viewer.',
    imageStyleNonCharacterPre: 'Concept art of',
    imageStyleNonCharacterPost:
      'Loose painterly concept-art pass, design-forward silhouette, environmental concept art. IWConceptArt.',
  },
] as const;

const PRESET_BY_ID: Record<string, ImageStylePreset> = Object.fromEntries(
  IMAGE_STYLE_PRESETS.map((p) => [p.id, p])
);

export const DEFAULT_IMAGE_STYLE_PRESET_ID = 'photorealistic-1';

/** Find a preset by id, returning the 'none' preset as a safe fallback. */
export function getPreset(id: string | null | undefined): ImageStylePreset {
  if (id && PRESET_BY_ID[id]) return PRESET_BY_ID[id];
  return PRESET_BY_ID['none'];
}

/**
 * Heuristically identify which preset (if any) a World currently has applied,
 * by checking whether the world's four imageStyle* fields exactly match a
 * preset's. Used by the World editor's preset dropdown to mark the active selection
 * for imported worlds (such as the real College of Magic schema, which carries
 * the verbatim 'photorealistic-1' strings).
 */
export function matchPreset(world: Pick<
  World,
  | 'imageStyleCharacterPre'
  | 'imageStyleCharacterPost'
  | 'imageStyleNonCharacterPre'
  | 'imageStyleNonCharacterPost'
>): ImageStylePreset {
  const candidate = IMAGE_STYLE_PRESETS.find(
    (p) =>
      p.id !== 'none' &&
      (p.imageStyleCharacterPre || '') === (world.imageStyleCharacterPre || '') &&
      (p.imageStyleCharacterPost || '') === (world.imageStyleCharacterPost || '') &&
      (p.imageStyleNonCharacterPre || '') === (world.imageStyleNonCharacterPre || '') &&
      (p.imageStyleNonCharacterPost || '') === (world.imageStyleNonCharacterPost || '')
  );
  return candidate ?? PRESET_BY_ID['none'];
}

/**
 * Whether the world's imageStyle fields have been hand-customised away from any
 * preset. The world-editor uses this to let the author keep their hand-tuned
 * strings even when the preset dropdown has no exact match.
 */
export function isCustomised(world: Pick<
  World,
  | 'imageStyleCharacterPre'
  | 'imageStyleCharacterPost'
  | 'imageStyleNonCharacterPre'
  | 'imageStyleNonCharacterPost'
>): boolean {
  const matched = matchPreset(world);
  if (matched.id !== 'none') return false;
  return !!(
    world.imageStyleCharacterPre ||
    world.imageStyleCharacterPost ||
    world.imageStyleNonCharacterPre ||
    world.imageStyleNonCharacterPost
  );
}

/**
 * Apply a preset to a world, returning a new World with the four imageStyle*
 * Pre/Post fields set. `id = 'none'` clears them. Hand-customised strings can
 * always be re-applied by the world author via the editor's text fields.
 */
export function applyPreset<T extends World>(world: T, presetId: string): T {
  const preset = getPreset(presetId);
  return {
    ...world,
    imageStyle: preset.id === 'none' ? null : preset.id,
    imageStyleCharacterPre: preset.imageStyleCharacterPre || undefined,
    imageStyleCharacterPost: preset.imageStyleCharacterPost || undefined,
    imageStyleNonCharacterPre: preset.imageStyleNonCharacterPre || undefined,
    imageStyleNonCharacterPost: preset.imageStyleNonCharacterPost || undefined,
  };
}
