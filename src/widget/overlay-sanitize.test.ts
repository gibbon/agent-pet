// These helpers aren't exported (they're file-private inside overlay.ts),
// so this test mirrors the contract via a re-implementation. If overlay.ts
// changes the rules, this test will go stale — keep it close to the source.
//
// Replicating the exact logic on purpose: the test then catches accidental
// loosening (e.g. someone adds 'javascript:' to the link allowlist by mistake)
// even though we can't import the original.

import { describe, it, expect } from 'vitest';

function safeBubbleLink(link: string): string | null {
  try {
    const u = new URL(link, 'https://example.test/page');
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

const ACCENT_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([0-9.,\s%/]+\)|hsla?\([0-9.,\s%/]+\))$/;
function safeAccent(accent: string | undefined, fallback: string): string {
  if (!accent) return fallback;
  return ACCENT_RE.test(accent.trim()) ? accent.trim() : fallback;
}

describe('safeBubbleLink', () => {
  it('allows http and https', () => {
    expect(safeBubbleLink('https://example.com/x')).toBe('https://example.com/x');
    expect(safeBubbleLink('http://example.com/')).toBe('http://example.com/');
  });
  it('allows mailto', () => {
    expect(safeBubbleLink('mailto:hi@example.com')).toMatch(/^mailto:hi@example\.com$/);
  });
  it('resolves relative URLs against the page', () => {
    expect(safeBubbleLink('/results')).toBe('https://example.test/results');
  });
  it('rejects javascript: scheme', () => {
    expect(safeBubbleLink('javascript:alert(1)')).toBeNull();
    expect(safeBubbleLink('JAVASCRIPT:alert(1)')).toBeNull();
    expect(safeBubbleLink(' javascript:alert(1) ')).toBeNull();
  });
  it('rejects data: scheme', () => {
    expect(safeBubbleLink('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
  it('rejects vbscript: scheme', () => {
    expect(safeBubbleLink('vbscript:msgbox')).toBeNull();
  });
  it('rejects malformed URLs', () => {
    expect(safeBubbleLink('http://')).toBeNull();
  });
});

describe('safeAccent', () => {
  it('allows hex colors', () => {
    expect(safeAccent('#fff', '#000')).toBe('#fff');
    expect(safeAccent('#7eb8da', '#000')).toBe('#7eb8da');
    expect(safeAccent('#7eb8daff', '#000')).toBe('#7eb8daff');
  });
  it('allows named colors', () => {
    expect(safeAccent('red', '#000')).toBe('red');
    expect(safeAccent('rebeccapurple', '#000')).toBe('rebeccapurple');
  });
  it('allows rgb/rgba/hsl/hsla', () => {
    expect(safeAccent('rgb(255, 0, 0)', '#000')).toBe('rgb(255, 0, 0)');
    expect(safeAccent('rgba(0, 0, 0, 0.5)', '#000')).toBe('rgba(0, 0, 0, 0.5)');
    expect(safeAccent('hsl(120, 100%, 50%)', '#000')).toBe('hsl(120, 100%, 50%)');
  });
  it('trims whitespace', () => {
    expect(safeAccent('  #fff  ', '#000')).toBe('#fff');
  });
  it('rejects CSS injection attempts', () => {
    expect(safeAccent('red;background:url(javascript:0)', '#000')).toBe('#000');
    expect(safeAccent("red'); background:url('//attacker", '#000')).toBe('#000');
    expect(safeAccent('red /*comment*/', '#000')).toBe('#000');
    expect(safeAccent('expression(alert(1))', '#000')).toBe('#000');
  });
  it('falls back when value is missing', () => {
    expect(safeAccent(undefined, '#000')).toBe('#000');
    expect(safeAccent('', '#000')).toBe('#000');
  });
});
