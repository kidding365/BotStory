import { World } from './types';

/**
 * Named image-style presets backported from infiniteworlds.app.
 *
 * Each preset wraps the LLM's `outcome.visualVariables` (subject/appearance/
 * setting/expression) in `imageStyle{Character,NonCharacter}{Pre,Post}` prompt-template
 * strings that the composer.ts `buildImagePrompt` already understands. Selecting a preset
 * is a one-click way to populate those four fields with flavour-giving tokens
 * ("Photorealistic", "Pseudorealistic CGI", "Anime") instead of hand-authoring them per world.
 *
 * Trimmed 2026-07-30 on user direction: the original 12-preset catalog was over-precise —
 * the "Photorealistic" variants (Hollywood movie / Dramatic / Candid / etc.) were not that
 * different in practice; image quality mostly depends on how well the LLM-explained prompt
 * is structured, not on which cinematic tokens are appended. The hidden gem is
 * "Pseudorealistic CGI" — with the right narrative prompt it can produce both photoreal
 * and anime-styled frames. Keep the catalog lean to avoid choice-paralysis.
 *
 * The original strings are sourced from live IW recon (2026-07-28) plus the real
 * IW-exported College of Magic schema (docs/college_of_magic_schema.json) — the
 * "photorealistic" preset below is verbatim what IW ships under "Photorealistic 1 (Default)"
 * for Manticore. The other presets use the standard IW tag-token conventions
 * (`IW<Tokens>`). The preset id was renamed from `photorealistic-1` → `photorealistic`
 * when the catalog was trimmed; importer round-trips still recognise a world carrying
 * `imageStyle: "photorealistic-1"` via the `matchPreset` exact-string match on the four
 * textarea values (so the College of Magic schema continues to autoflow to "Photorealistic").
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
    id: 'photorealistic',
    label: 'Photorealistic',
    description:
      'IW Manticore / Flux default. Real strings captured from the College of Magic IW schema. Gives the camera-photo close-up look IW users see out of the box.',
    imageStyleCharacterPre: 'Highly attractive, sexy medium close-up photograph of',
    imageStyleCharacterPost:
      'Authentic period medieval clothing. IWBeautiful IWBeautiful2 Smooth, flawless skin and a perfect face. Looking at the viewer. IWUpscaleFaceSmooth Setting: Medieval magical high fantasy.',
    imageStyleNonCharacterPre: 'Photograph of',
    imageStyleNonCharacterPost: 'High quality photograph. Setting: Medieval high fantasy.',
  },
  {
    id: 'pseudorealistic-cgi',
    label: 'Pseudorealistic CGI',
    description:
      'Hidden gem — halfway between photography and a high-end 3D render (Unreal/Octane). With well-explained prompts it can produce both photoreal and anime-styled frames, so it is the most flexible single-preset choice for users who do not want to flip presets per scene.',
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
] as const;

const PRESET_BY_ID: Record<string, ImageStylePreset> = Object.fromEntries(
  IMAGE_STYLE_PRESETS.map((p) => [p.id, p])
);

export const DEFAULT_IMAGE_STYLE_PRESET_ID = 'photorealistic';

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
 * the verbatim 'photorealistic' strings — matchPreset also recognises worlds that
 * were saved with the legacy id `photorealistic-1` via the same exact-string match).
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
