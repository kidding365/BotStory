import { describe, it, expect } from 'vitest';
import {
  IMAGE_STYLE_PRESETS,
  DEFAULT_IMAGE_STYLE_PRESET_ID,
  getPreset,
  matchPreset,
  isCustomised,
  applyPreset,
} from '../imageStylePresets';
import { World } from '../types';

function blankWorld(
  over: Partial<Pick<World, 'imageStyle' | 'imageStyleCharacterPre' | 'imageStyleCharacterPost' | 'imageStyleNonCharacterPre' | 'imageStyleNonCharacterPost'>> = {}
): Pick<World, 'imageStyle' | 'imageStyleCharacterPre' | 'imageStyleCharacterPost' | 'imageStyleNonCharacterPre' | 'imageStyleNonCharacterPost'> {
  return {
    imageStyle: null,
    imageStyleCharacterPre: '',
    imageStyleCharacterPost: '',
    imageStyleNonCharacterPre: '',
    imageStyleNonCharacterPost: '',
    ...over,
  };
}

describe('imageStylePresets', () => {
  it('exposes the IW catalog with the user-requested presets present', () => {
    const ids = IMAGE_STYLE_PRESETS.map((p) => p.id);
    expect(ids).toContain('photorealistic-1');
    expect(ids).toContain('photorealistic-2');
    expect(ids).toContain('pseudorealistic-cgi');
    expect(ids).toContain('anime');
    expect(ids).toContain('anime-2');
    expect(ids).toContain('pulp-fantasy');
    expect(ids).toContain('dark-fantasy');
    expect(ids).toContain('comic-book');
    expect(ids).toContain('noir-drawing');
    expect(ids).toContain('digital-illustration');
    expect(ids).toContain('concept-art');
    expect(ids).toContain('none');
  });

  it('regresses the verbatim Photorealistic-1 strings captured from the real College-of-Magic IW export', () => {
    const p1 = getPreset('photorealistic-1');
    expect(p1.imageStyleCharacterPre).toBe('Highly attractive, sexy medium close-up photograph of');
    expect(p1.imageStyleCharacterPost).toContain('IWBeautiful');
    expect(p1.imageStyleNonCharacterPre).toBe('Photograph of');
    expect(p1.imageStyleNonCharacterPost).toBe('High quality photograph. Setting: Medieval high fantasy.');
  });

  it('defaults to photorealistic-1 for new worlds (the IW default)', () => {
    expect(DEFAULT_IMAGE_STYLE_PRESET_ID).toBe('photorealistic-1');
  });

  it('getPreset returns the none preset for unknown ids', () => {
    const p = getPreset('does-not-exist');
    expect(p.id).toBe('none');
    expect(p.imageStyleCharacterPre).toBe('');
  });

  it('matchPreset identifies the IW-exported College of Magic strings as photorealistic-1', () => {
    const realIWWorld = blankWorld({
      imageStyle: 'photorealistic-1',
      imageStyleCharacterPre: 'Highly attractive, sexy medium close-up photograph of',
      imageStyleCharacterPost:
        'Authentic period medieval clothing. IWBeautiful IWBeautiful2 Smooth, flawless skin and a perfect face. Looking at the viewer. IWUpscaleFaceSmooth Setting: Medieval magical high fantasy.',
      imageStyleNonCharacterPre: 'Photograph of',
      imageStyleNonCharacterPost: 'High quality photograph. Setting: Medieval high fantasy.',
    });
    expect(matchPreset(realIWWorld).id).toBe('photorealistic-1');
  });

  it('matchPreset returns none for a blank world', () => {
    expect(matchPreset(blankWorld()).id).toBe('none');
  });

  it('matchPreset returns none for arbitrary hand-tuned strings', () => {
    const w = blankWorld({ imageStyleCharacterPre: 'oil painting of a small dog' });
    expect(matchPreset(w).id).toBe('none');
  });

  it('isCustomised flags arbitrary hand-tuned strings', () => {
    const w = blankWorld({ imageStyleCharacterPre: 'oil painting of a small dog' });
    expect(isCustomised(w)).toBe(true);
  });

  it('isCustomised returns false for a preset-matched world', () => {
    const w = blankWorld({
      imageStyleCharacterPre: 'Highly attractive, sexy medium close-up photograph of',
      imageStyleCharacterPost:
        'Authentic period medieval clothing. IWBeautiful IWBeautiful2 Smooth, flawless skin and a perfect face. Looking at the viewer. IWUpscaleFaceSmooth Setting: Medieval magical high fantasy.',
      imageStyleNonCharacterPre: 'Photograph of',
      imageStyleNonCharacterPost: 'High quality photograph. Setting: Medieval high fantasy.',
    });
    expect(isCustomised(w)).toBe(false);
  });

  it('isCustomised returns false for a fully blank world (no strings)', () => {
    expect(isCustomised(blankWorld())).toBe(false);
  });

  it('applyPreset writes the four imageStyle fields and tags world.imageStyle with the preset id', () => {
    const w = blankWorld() as World;
    const out = applyPreset({ ...w, id: 'w', title: 't', name: 't' } as World, 'anime');
    expect(out.imageStyle).toBe('anime');
    expect(out.imageStyleCharacterPre).toBe('Anime illustration of');
    expect(out.imageStyleCharacterPost).toContain('IWAnime');
    expect(out.imageStyleNonCharacterPre).toBe('Anime illustration of');
    expect(out.imageStyleNonCharacterPost).toContain('IWAnime');
  });

  it('applyPreset("none") clears all four fields and sets imageStyle back to null', () => {
    const base = applyPreset(blankWorld() as World, 'photorealistic-1');
    const cleared = applyPreset(base, 'none');
    expect(cleared.imageStyle).toBeNull();
    expect(cleared.imageStyleCharacterPre).toBeUndefined();
    expect(cleared.imageStyleCharacterPost).toBeUndefined();
    expect(cleared.imageStyleNonCharacterPre).toBeUndefined();
    expect(cleared.imageStyleNonCharacterPost).toBeUndefined();
  });

  it('applyPreset is a no-op on other World fields', () => {
    const w = {
      ...blankWorld(),
      id: 'preserve-me',
      title: 'original title',
      name: 'original name',
      instructions: 'do not touch',
    } as World;
    const out = applyPreset(w, 'comic-book');
    expect(out.id).toBe('preserve-me');
    expect(out.title).toBe('original title');
    expect(out.name).toBe('original name');
    expect(out.instructions).toBe('do not touch');
  });

  it('every preset has a unique id and the four imageStyle fields are strings', () => {
    const ids = IMAGE_STYLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of IMAGE_STYLE_PRESETS) {
      expect(typeof p.label).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.imageStyleCharacterPre).toBe('string');
      expect(typeof p.imageStyleCharacterPost).toBe('string');
      expect(typeof p.imageStyleNonCharacterPre).toBe('string');
      expect(typeof p.imageStyleNonCharacterPost).toBe('string');
    }
  });
});
