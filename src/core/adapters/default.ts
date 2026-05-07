import type { PetAdapter, PetInteraction } from '../types';

// Maps common host state strings to PetInteraction. Override or replace
// this with your own adapter via PetProvider's `adapter` prop.
const STATE_MAP: Record<string, PetInteraction> = {
  idle: 'idle',
  active: 'hover',
  thinking: 'hover',
  building: 'hover',
  working: 'hover',
  delegating: 'hover',
  success: 'idle',
  done: 'idle',
  completed: 'idle',
  error: 'waiting',
  failed: 'waiting',
  waiting: 'waiting',
};

export const defaultPetAdapter: PetAdapter = {
  map(hostState: string): PetInteraction {
    return STATE_MAP[hostState.toLowerCase()] ?? 'idle';
  },
};
