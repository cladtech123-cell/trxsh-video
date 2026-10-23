"""Add the narrated-tutorial layer to a project made with cinetic's new-film.sh (Remotion starter).

    python <skill>/scripts/add_tutorial.py <project-dir> [--force]

Copies template/ into the project (src/tutorial, src/ui/kit.tsx, src/fx/Cursor.tsx, src/brand/tokens.ts,
scripts/tutorial-events.ts, tools/*, narration/script.json) and registers the Tutorial composition and
the TutorialFrame still in src/Root.tsx. Existing files are kept unless --force (screens.tsx and
script.json are the project's own once edited); the starter's tokens.ts and Cursor.tsx are replaced,
because the tutorial needs keys and a cursor shape they lack.
"""
import argparse, os, shutil, sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(SKILL, 'template')

IMPORTS = """import { TOTAL as TUT_TOTAL } from './tutorial/events';
import { Tutorial, TutorialScene } from './tutorial/Tutorial';
import { FontGate as TutorialFontGate } from './lib/FontGate';

const TutorialFrame: React.FC<{ F: number }> = ({ F }) => (
  <TutorialFontGate>
    <TutorialScene F={F} />
  </TutorialFontGate>
);
"""
COMPOSITIONS = """    {/* The narrated tutorial (narration/timeline.json drives it): render with tools/build-tutorial.sh. */}
    <Composition id="Tutorial" component={Tutorial} durationInFrames={TUT_TOTAL} fps={60} width={1920} height={1080} />
    <Still id="TutorialFrame" component={TutorialFrame} width={1920} height={1080} defaultProps={{ F: 0 }} />
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('project')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    root = os.path.join(a.project, 'src', 'Root.tsx')
    if not os.path.exists(root):
        sys.exit(f'add_tutorial: {root} not found: scaffold the project first (cinetic scripts/new-film.sh)')
    copied, kept = [], []
    for d, _, files in os.walk(TEMPLATE):
        for f in files:
            src = os.path.join(d, f)
            rel = os.path.relpath(src, TEMPLATE).replace('\\', '/')
            dst = os.path.join(a.project, rel)
            starter_file = rel in ('src/brand/tokens.ts', 'src/fx/Cursor.tsx')
            if os.path.exists(dst) and not (a.force or starter_file):
                kept.append(rel)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            copied.append(rel)
    s = open(root, encoding='utf-8').read()
    if 'id="Tutorial"' not in s:
        last_import = s.rfind('\nimport ')
        end = s.index('\n', s.index(';', last_import)) + 1
        s = s[:end] + IMPORTS + s[end:]
        close = s.rindex('  </>')
        s = s[:close] + COMPOSITIONS + s[close:]
        open(root, 'w', encoding='utf-8').write(s)
        print('add_tutorial: registered Tutorial + TutorialFrame in src/Root.tsx')
    print(f'add_tutorial: copied {len(copied)} files' + (f', kept {len(kept)} existing: {kept}' if kept else ''))
    print('next: src/brand/tokens.ts (the site colours), src/tutorial/screens.tsx (the site screens), narration/script.json (the narration)')


if __name__ == '__main__':
    main()
