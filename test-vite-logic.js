// Simulate the Vite logic to verify the dual-build sequencing
const modes = ['es', 'widget'];  // modes: undefined (default) and 'widget'

for (const mode of modes) {
  const isWidget = mode === 'widget';
  
  console.log('\n=== Mode: ' + (mode || '(default)') + ' ===');
  console.log('isWidget: ' + isWidget);
  const entryPath = 'src/' + (isWidget ? 'widget' : '') + '/index.ts';
  console.log('  entry: ' + entryPath.replace(/\/\//, '/'));
  console.log('  fileName: agent-pet' + (isWidget ? '-widget' : ''));
  console.log('  formats: ' + (isWidget ? 'iife' : 'es'));
  console.log('  emptyOutDir: ' + (!isWidget));
  console.log('  cssInjectedByJs plugin: ' + (isWidget ? 'YES' : 'NO'));
  console.log('  react alias: ' + (isWidget ? 'YES (preact/compat)' : 'NO'));
  console.log('  external deps: ' + (isWidget ? 'NONE (bundled)' : 'react, react-dom, react/jsx-runtime'));
}

console.log('\n=== Sequential build (npm run build) ===');
console.log('1. vite build          => Mode: undefined (es) => emptyOutDir: true  (cleans dist/)');
console.log('   Output: dist/agent-pet.es.js, dist/pet.css, dist/index.d.ts');
console.log('');
console.log('2. vite build --mode widget => Mode: widget => emptyOutDir: false (keeps previous)');
console.log('   Output: dist/agent-pet-widget.iife.js (appended, previous files preserved)');
