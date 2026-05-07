import { PetConfig } from '../core/types';
interface Props {
    pet?: PetConfig;
    onOpenSettings?: () => void;
    onDismissSpeech?: () => void;
    size?: number;
    storageKey?: string;
    hostState?: string;
    /** Speech item pushed from the host's bus queue. Takes priority over ambient text. */
    currentSpeech?: {
        text: string;
        link?: string;
    } | null;
}
export declare function PetOverlay({ onOpenSettings, onDismissSpeech, size, storageKey, hostState, currentSpeech }: Props): import("react/jsx-runtime").JSX.Element | null;
export {};
