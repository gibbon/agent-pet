#!/usr/bin/env python3
"""Local dev server for the rich editor + pet-tester + playground.

Serves this folder AND exposes a tiny REST API so the rich editor can
persist saves to disk (instead of just localStorage):

    GET  /saves/index.json                — list of {slug, name, ...}
    GET  /saves/<slug>.json               — full save blob
    POST /api/saves/<slug>                — write save + refresh index
    DELETE /api/saves/<slug>              — remove save + refresh index

Files land in ./saves/ next to this script. ./deploy.sh copies them
into the deploy build dir so deployed pages can fetch the same paths.

One-time prerequisites (from the repo root):

    pnpm build                                            # widget bundles → dist/
    python3 scripts/build-rips-deploy.py tools/rich-editor # rips/ data

The dist/ symlink in this folder points at ../../dist so the editor
can pull the IIFE bundles directly.

Run from this folder:

    python3 serve.py 5174
"""
import http.server
import json
import mimetypes
import os
import sys
from datetime import datetime
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SAVES_DIR = ROOT / 'saves'
SAVES_DIR.mkdir(exist_ok=True)
INDEX_PATH = SAVES_DIR / 'index.json'

# Promoted preset overrides (separate from the inline STARTER_PRESETS in
# /presets.js). Each <slug>.json file contains a full preset shape:
#   { slug, label, ripSlug, accent, description, actions }
# presets.js merges these on top of the inline defaults at runtime.
PRESETS_DIR = ROOT / 'presets'
PRESETS_DIR.mkdir(exist_ok=True)
PRESETS_INDEX_PATH = PRESETS_DIR / 'index.json'

mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/avif', '.avif')


def read_index():
    if not INDEX_PATH.exists():
        return []
    try:
        return json.loads(INDEX_PATH.read_text())
    except Exception:
        return []


def write_index(entries):
    INDEX_PATH.write_text(json.dumps(entries, indent=2))


def rebuild_index():
    """Rebuild /saves/index.json from whatever .json files actually exist
    on disk. Cheap belt-and-braces against an out-of-sync index after a
    manual file edit."""
    entries = []
    for f in sorted(SAVES_DIR.glob('*.json')):
        if f.name == 'index.json':
            continue
        try:
            blob = json.loads(f.read_text())
        except Exception:
            continue
        entries.append({
            'slug': f.stem,
            'name': blob.get('name', f.stem),
            'timestamp': blob.get('savedAt', int(f.stat().st_mtime * 1000)),
            'ripSlug': blob.get('activeRipSlug', 'ryu'),
        })
    entries.sort(key=lambda e: -e['timestamp'])
    write_index(entries)
    return entries


def rebuild_presets_index():
    """Rebuild /presets/index.json from <slug>.json files in /presets/.
    Each entry surfaces the metadata fields the editor / pet-tester /
    playground use to render their pickers without fetching every full
    preset blob upfront."""
    entries = []
    for f in sorted(PRESETS_DIR.glob('*.json')):
        if f.name == 'index.json':
            continue
        try:
            blob = json.loads(f.read_text())
        except Exception:
            continue
        entries.append({
            'slug': blob.get('slug', f.stem),
            'label': blob.get('label', f.stem),
            'ripSlug': blob.get('ripSlug', 'ryu'),
            'accent': blob.get('accent', '#e74c3c'),
            'description': blob.get('description', ''),
            'updatedAt': int(f.stat().st_mtime * 1000),
        })
    entries.sort(key=lambda e: e['label'])
    PRESETS_INDEX_PATH.write_text(json.dumps(entries, indent=2))
    return entries


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.webp': 'image/webp',
        '.avif': 'image/avif',
    }

    def end_headers(self):
        # Loose CORS — the editor may be opened on a different port
        # (vite, file://, etc.) and POST to this server.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _read_slug(self, prefix):
        """Validate + return the slug after a /api/<group>/ prefix. Sends
        the right error and returns None if the path is malformed."""
        if not self.path.startswith(prefix):
            self.send_error(404)
            return None
        slug = self.path[len(prefix):].split('?')[0].strip('/')
        if not slug or '/' in slug or slug.startswith('.'):
            self.send_error(400, 'invalid slug')
            return None
        return slug

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8') if length else ''
        try:
            return json.loads(body), body
        except Exception as e:
            self.send_error(400, f'invalid JSON: {e}')
            return None, body

    def do_POST(self):
        if self.path.startswith('/api/saves/'):
            return self._post_save()
        if self.path.startswith('/api/presets/'):
            return self._post_preset()
        self.send_error(404)

    def _post_save(self):
        slug = self._read_slug('/api/saves/')
        if not slug: return
        blob, body = self._read_json_body()
        if blob is None: return
        if not isinstance(blob, dict) or 'manifest' not in blob:
            self.send_error(400, 'body must be {manifest, name, activeRipSlug, savedAt}')
            return
        # Stamp savedAt server-side so the file's mtime + the field agree
        # even if the client clock drifts. Keep client's value as a hint.
        blob.setdefault('savedAt', int(datetime.now().timestamp() * 1000))
        path = SAVES_DIR / f'{slug}.json'
        path.write_text(json.dumps(blob, indent=2))
        # Update index — replace any prior entry for this slug.
        entries = [e for e in read_index() if e.get('slug') != slug]
        entries.insert(0, {
            'slug': slug,
            'name': blob.get('name', slug),
            'timestamp': blob['savedAt'],
            'ripSlug': blob.get('activeRipSlug', 'ryu'),
        })
        write_index(entries)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True, 'slug': slug, 'path': str(path.relative_to(ROOT))}).encode('utf-8'))
        print(f'saved → {path.relative_to(ROOT)}  ({len(body)} bytes)')

    def _post_preset(self):
        """Promote a save to a preset. Body shape:
            { slug, label, ripSlug, accent?, description?, actions: {...} }
        Writes /presets/<slug>.json + refreshes /presets/index.json. The
        editor / pet-tester / playground fetch these on next reload to
        override (or extend) the inline defaults shipped in presets.js."""
        slug = self._read_slug('/api/presets/')
        if not slug: return
        blob, body = self._read_json_body()
        if blob is None: return
        if not isinstance(blob, dict):
            self.send_error(400, 'body must be a preset object')
            return
        for required in ('label', 'ripSlug', 'actions'):
            if required not in blob:
                self.send_error(400, f'preset missing "{required}"')
                return
        if not isinstance(blob.get('actions'), dict):
            self.send_error(400, 'preset.actions must be an object')
            return
        # Persist in our canonical shape (sorted keys, slug stamped).
        preset = {
            'slug': slug,
            'label': blob['label'],
            'ripSlug': blob['ripSlug'],
            'accent': blob.get('accent', '#e74c3c'),
            'description': blob.get('description', ''),
            'actions': blob['actions'],
        }
        path = PRESETS_DIR / f'{slug}.json'
        path.write_text(json.dumps(preset, indent=2))
        rebuild_presets_index()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True, 'slug': slug, 'path': str(path.relative_to(ROOT))}).encode('utf-8'))
        print(f'preset → {path.relative_to(ROOT)}  ({len(body)} bytes)')

    def do_DELETE(self):
        if self.path.startswith('/api/saves/'):
            return self._delete_save()
        if self.path.startswith('/api/presets/'):
            return self._delete_preset()
        self.send_error(404)

    def _delete_save(self):
        slug = self._read_slug('/api/saves/')
        if not slug: return
        path = SAVES_DIR / f'{slug}.json'
        if path.exists():
            path.unlink()
        entries = [e for e in read_index() if e.get('slug') != slug]
        write_index(entries)
        self.send_response(200)
        self.end_headers()
        print(f'deleted save → {slug}')

    def _delete_preset(self):
        slug = self._read_slug('/api/presets/')
        if not slug: return
        path = PRESETS_DIR / f'{slug}.json'
        if path.exists():
            path.unlink()
        rebuild_presets_index()
        self.send_response(200)
        self.end_headers()
        print(f'deleted preset → {slug}')



PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174

# Rebuild both indexes on boot so a freshly-cloned project picks up
# whatever's already in /saves/ + /presets/ without explicit POSTs.
rebuild_index()
rebuild_presets_index()

# ThreadingHTTPServer: each request runs in its own thread so a slow
# response (large rip image, simultaneous POST + GET while saving) does
# not block other browser requests. The default single-threaded server
# would queue everything behind one in-flight request and the browser's
# 6-per-origin pool would visibly stall ("pending" in the network tab).
# Line-buffer stdout so the server-start banner and per-request log
# lines appear in real time (important when launched via `./dev.sh`
# where bash redirects but doesn't tty-line-buffer Python).
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

try:
    httpd = ThreadingHTTPServer(('', PORT), Handler)
except OSError as e:
    print(f'cannot bind port {PORT}: {e}', file=sys.stderr)
    print(f'is another serve.py already running?  Try:  pkill -f "serve\\.py"', file=sys.stderr)
    sys.exit(1)

httpd.daemon_threads = True
print(f'serving on http://localhost:{PORT}  (saves → {SAVES_DIR.relative_to(ROOT.parent)})')
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print('shutting down…')
    httpd.server_close()
