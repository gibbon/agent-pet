import type { PetAdapter, PetInteraction } from '../types';

// Maps common host state strings to PetInteraction. Override or replace
// this with your own adapter via PetProvider's `adapter` prop.
//
// Each named state targets a distinct atlas row so visual feedback is
// meaningful out of the box:
//   thinking   → review row
//   building   → running row
//   delegating → running-right row
//   success    → jumping row
//   error      → failed row
//   waiting    → waiting row (idle inactivity)
const STATE_MAP: Record<string, PetInteraction> = {
  idle:       'idle',
  active:     'hover',
  hover:      'hover',
  thinking:   'thinking',
  building:   'working',
  working:    'working',
  delegating: 'sending',
  sending:    'sending',
  leaving:    'leaving',
  away:       'leaving',
  success:    'excited',
  done:       'excited',
  completed:  'excited',
  excited:    'excited',
  error:      'failed',
  failed:     'failed',
  greeting:   'greeting',
  hello:      'greeting',
  welcome:    'greeting',
  waiting:    'waiting',
};

export const defaultPetAdapter: PetAdapter = {
  map(hostState: string): PetInteraction {
    return STATE_MAP[hostState.toLowerCase()] ?? 'idle';
  },
};
