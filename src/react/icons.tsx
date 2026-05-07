import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  style?: CSSProperties;
}

export function IconSettings({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm5.9-2.5a5.9 5.9 0 0 0-.06-.5l1.2-.93a.3.3 0 0 0 .07-.38l-1.14-1.97a.3.3 0 0 0-.36-.13l-1.4.56a5.6 5.6 0 0 0-.87-.5l-.21-1.49A.3.3 0 0 0 10.83 2H8.17a.3.3 0 0 0-.3.26l-.21 1.49a5.6 5.6 0 0 0-.87.5l-1.4-.56a.3.3 0 0 0-.36.13L3.9 5.79a.3.3 0 0 0 .07.38l1.2.93a5.9 5.9 0 0 0-.06.5c0 .17.02.34.06.5l-1.2.93a.3.3 0 0 0-.07.38l1.14 1.97a.3.3 0 0 0 .36.13l1.4-.56c.27.19.56.35.87.5l.21 1.49c.04.15.17.26.3.26h2.66a.3.3 0 0 0 .3-.26l.21-1.49c.31-.15.6-.31.87-.5l1.4.56a.3.3 0 0 0 .36-.13l1.14-1.97a.3.3 0 0 0-.07-.38l-1.2-.93c.04-.16.06-.33.06-.5z"/>
    </svg>
  );
}

export function IconClose({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M12.7 4.7l-1.4-1.4L8 6.6 4.7 3.3 3.3 4.7 6.6 8l-3.3 3.3 1.4 1.4L8 9.4l3.3 3.3 1.4-1.4L9.4 8z"/>
    </svg>
  );
}

export function IconCheck({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M6.5 12L2 7.5l1.4-1.4 3.1 3.1 6.1-6.1 1.4 1.4z"/>
    </svg>
  );
}

export function IconSparkles({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5zm5 8l.8 1.7 1.7.8-1.7.8L13 14l-.8-1.7-1.7-.8 1.7-.8zM3 11l.5 1 1 .5-1 .5L3 14l-.5-1-1-.5 1-.5z"/>
    </svg>
  );
}

export function IconEye({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
    </svg>
  );
}

export function IconUpload({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M8 1L4 5h3v5h2V5h3zm-6 11h12v2H2z"/>
    </svg>
  );
}

export function IconDownload({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M8 11L4 7h3V2h2v5h3zm-6 2h12v2H2z"/>
    </svg>
  );
}

export function IconRefresh({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M13.6 2.4A7 7 0 0 0 1 8h1.5A5.5 5.5 0 0 1 13 4.4V2l3 3-3 3V5.6A5.5 5.5 0 0 1 2.5 8H1a7 7 0 0 0 12.6-5.6z"/>
    </svg>
  );
}

export function IconCopy({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M10 2H2v10h2V4h6zM4 12V4h2v2h2v8H4zm2-6v8h6V6l-2-2h-4zm4 0 2 2h-2z"/>
    </svg>
  );
}

export function IconSpinner({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'ap-spin 0.8s linear infinite', ...style }} aria-hidden>
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25"/>
      <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round"/>
    </svg>
  );
}

export function IconChevronLeft({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M10 3L5 8l5 5-1.4 1.4L2.2 8l6.4-6.4z"/>
    </svg>
  );
}

export function IconChevronRight({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} aria-hidden>
      <path d="M6 3l5 5-5 5-1.4-1.4L8.2 8 4.6 4.4z"/>
    </svg>
  );
}
