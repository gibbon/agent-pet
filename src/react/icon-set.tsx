// Icon override contract. Consumers pass their own `<Icon>`-compatible
// React components via the `icons` prop on PetSettings / PetRail; any
// omitted slot falls back to the bundled SVG defaults exported from
// icons.tsx. Useful when an app has its own design-system icon library
// (e.g. open-design's brand-consistent <Icon> set, or framework-native
// icon kits like Lucide / Heroicons / Tabler) and doesn't want
// agent-pet's default SVGs to look out of place.

import type { CSSProperties, ComponentType } from 'react';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconCopy,
  IconDownload,
  IconEye,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconSpinner,
  IconUpload,
} from './icons';

export interface IconProps {
  size?: number;
  style?: CSSProperties;
}

export type IconComponent = ComponentType<IconProps>;

/** All icons used by PetSettings + PetRail. Override any subset; missing
 *  slots fall back to the bundled defaults. */
export interface PetIcons {
  Check: IconComponent;
  ChevronLeft: IconComponent;
  ChevronRight: IconComponent;
  Close: IconComponent;
  Copy: IconComponent;
  Download: IconComponent;
  Eye: IconComponent;
  Refresh: IconComponent;
  Settings: IconComponent;
  Sparkles: IconComponent;
  Spinner: IconComponent;
  Upload: IconComponent;
}

export const DEFAULT_PET_ICONS: PetIcons = {
  Check: IconCheck,
  ChevronLeft: IconChevronLeft,
  ChevronRight: IconChevronRight,
  Close: IconClose,
  Copy: IconCopy,
  Download: IconDownload,
  Eye: IconEye,
  Refresh: IconRefresh,
  Settings: IconSettings,
  Sparkles: IconSparkles,
  Spinner: IconSpinner,
  Upload: IconUpload,
};

export function mergeIcons(overrides?: Partial<PetIcons>): PetIcons {
  if (!overrides) return DEFAULT_PET_ICONS;
  return { ...DEFAULT_PET_ICONS, ...overrides };
}
