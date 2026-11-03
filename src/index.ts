export type * from './types';
export { Emitter } from './core/emitter';
export { hitFromOf, resolveTier } from './core/tiers';
export type { TierResolution } from './core/tiers';
export { OpeningSession, createOpeningSession } from './core/session';
export type { SessionOptions } from './core/session';
export { TearTracker, TurnGuard, splitPack, roughen } from './core/tear';
export type { Point, SplitResult } from './core/tear';
export { createPackOpener } from './render/opener';
export type { PackOpener } from './render/opener';
export { defaultPackArt } from './render/pack-art';
export { coverRect, PACK_TEMPLATE } from './render/pack-size';
export type { CropRect } from './render/pack-size';
export { extractPalette, paletteFromPixels } from './render/palette';
export { composePackArt, resolvePackTexture } from './render/pack-texture';
export type { ComposedArt, ResolvedPackTexture } from './render/pack-texture';
export type { Palette } from './render/palette';
export { generic5 } from './presets/generic';
export { SynthAudio } from './audio/synth';
export type { SynthOptions } from './audio/synth';
export { createFeedback } from './audio/controller';
export type { Feedback } from './audio/controller';
export { createCarousel3D } from './render/carousel3d';
export type { Carousel3D, Carousel3DItem, Carousel3DOptions } from './render/carousel3d';

/** Efectos incluidos en esta versión; la demo los muestra para comprobar que cargó el build nuevo. */
export const FEATURES = ['select-shelf', 'carousel-3d', 'box-intro', 'tear-3d', 'spring-tilt', 'holo-foil', 'particles', 'flow-light', 'tear-split', 'haul-fan', 'sfx-bus'] as const;
