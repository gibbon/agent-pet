// Vanilla DOM sprite renderer. Replaces the React PetSpriteFace component
// for the widget builds (IIFE + ES module). The React version stays in
// src/react/PetSpriteFace.tsx for npm React consumers.
//
// Three rendering modes:
//   - glyph fallback (no imageUrl)         — emoji centered
//   - single-frame static image            — background-image, fixed
//   - animated multi-frame (no atlas)      — CSS keyframes step through cols
//   - atlas-based (rowsDef)                — JS frame timer steps within a row

import type { PetAtlasLayout, PetAtlasRowDef, ResolvedPet } from '../core/types';

export class PetSprite {
  private element: HTMLElement;
  private mode: 'empty' | 'glyph' | 'static' | 'frames' | 'atlas' = 'empty';
  private active: ResolvedPet | null = null;
  private rowId: string | undefined;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private currentFrame = 0;
  private currentRow: PetAtlasRowDef | null = null;

  constructor(parent: HTMLElement, private size: number) {
    this.element = document.createElement('span');
    this.element.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.element);
  }

  setActive(active: ResolvedPet | null, rowId?: string): void {
    this.active = active;
    this.rowId = rowId;
    this.render();
  }

  setRow(rowId: string | undefined): void {
    if (this.rowId === rowId) return;
    this.rowId = rowId;
    if (this.mode === 'atlas') this.startAtlasFrameTimer();
  }

  setSize(size: number): void {
    if (this.size === size) return;
    this.size = size;
    this.render();
  }

  destroy(): void {
    if (this.frameTimer) clearInterval(this.frameTimer);
    this.frameTimer = null;
    this.element.remove();
  }

  private render(): void {
    if (this.frameTimer) { clearInterval(this.frameTimer); this.frameTimer = null; }
    const a = this.active;
    if (!a) {
      this.mode = 'empty';
      this.element.className = '';
      this.element.style.cssText = '';
      this.element.textContent = '';
      return;
    }
    if (!a.imageUrl) {
      this.mode = 'glyph';
      this.applyGlyphStyles();
      return;
    }
    if (a.atlas && a.atlas.rowsDef.length > 0) {
      this.mode = 'atlas';
      this.applyAtlasStyles(a.atlas);
      this.startAtlasFrameTimer();
      return;
    }
    const frames = Math.max(1, a.frames ?? 1);
    if (frames === 1) {
      this.mode = 'static';
      this.applyStaticImageStyles(a.imageUrl);
      return;
    }
    this.mode = 'frames';
    this.applyFramesStyles(a.imageUrl, frames, Math.max(1, a.fps ?? 6));
  }

  private applyGlyphStyles(): void {
    const a = this.active!;
    this.element.className = '';
    this.element.style.cssText = [
      `font-size:${Math.round(this.size * 0.85)}px`,
      `width:${this.size}px`,
      `height:${this.size}px`,
      'line-height:1',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    this.element.textContent = a.glyph;
  }

  private applyStaticImageStyles(imageUrl: string): void {
    this.element.className = 'ap-image ap-static';
    this.element.style.cssText = [
      `background-image:url(${JSON.stringify(imageUrl)})`,
      'background-size:cover',
      'background-position:center',
      `width:${this.size}px`,
      `height:${this.size}px`,
      'display:inline-block',
    ].join(';');
    this.element.textContent = '';
  }

  private applyFramesStyles(imageUrl: string, frames: number, fps: number): void {
    const durationMs = Math.round((frames / fps) * 1000);
    this.element.className = 'ap-image ap-frames';
    this.element.style.cssText = [
      `background-image:url(${JSON.stringify(imageUrl)})`,
      `background-size:${frames * 100}% 100%`,
      `animation:ap-frames ${durationMs}ms steps(${frames}, jump-none) infinite`,
      `width:${this.size}px`,
      `height:${this.size}px`,
      'display:inline-block',
    ].join(';');
    this.element.textContent = '';
  }

  private applyAtlasStyles(atlas: PetAtlasLayout): void {
    const a = this.active!;
    const cols = Math.max(1, atlas.cols);
    const rows = Math.max(1, atlas.rows);
    this.element.className = 'ap-image ap-atlas';
    this.element.style.cssText = [
      `background-image:url(${JSON.stringify(a.imageUrl!)})`,
      `background-size:${cols * 100}% ${rows * 100}%`,
      'transition:background-position-y 220ms ease',
      `width:${this.size}px`,
      `height:${this.size}px`,
      'display:inline-block',
    ].join(';');
    this.element.textContent = '';
  }

  private startAtlasFrameTimer(): void {
    if (this.frameTimer) clearInterval(this.frameTimer);
    const a = this.active;
    if (!a?.atlas || a.atlas.rowsDef.length === 0) return;
    const def =
      a.atlas.rowsDef.find((r) => r.id === this.rowId) ??
      a.atlas.rowsDef.find((r) => r.id === 'idle') ??
      a.atlas.rowsDef[0]!;
    this.currentRow = def;
    this.currentFrame = 0;
    this.applyAtlasFrame();
    const rowFrames = Math.max(1, def.frames);
    if (rowFrames <= 1) return;
    const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, def.fps)));
    this.frameTimer = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % rowFrames;
      this.applyAtlasFrame();
    }, intervalMs);
  }

  private applyAtlasFrame(): void {
    const a = this.active;
    if (!a?.atlas || !this.currentRow) return;
    const cols = Math.max(1, a.atlas.cols);
    const rows = Math.max(1, a.atlas.rows);
    const xPct = cols > 1 ? (this.currentFrame / (cols - 1)) * 100 : 0;
    const yPct = rows > 1 ? (this.currentRow.index / (rows - 1)) * 100 : 0;
    this.element.style.backgroundPosition = `${xPct}% ${yPct}%`;
  }
}
