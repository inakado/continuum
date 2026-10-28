"""Исполняет настоящий installer до ошибки сборки/TERM, без Docker и сети."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


class DeployCleanupTests(unittest.TestCase):
    def test_exit_and_term_remove_temporary_build_and_preserve_error_status(self):
        for failure, expected in [('exit 42',42), ('kill -INT "$PPID"; exit 130',130), ('kill -TERM "$PPID"; exit 143',143)]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                scripts = root/'deploy/scripts'; scripts.mkdir(parents=True)
                for name in ['prune-releases.py','release_state.py']:
                    shutil.copy2(SCRIPTS/name,scripts/name)
                env_dir = root/'deploy/env'; env_dir.mkdir()
                (env_dir/'api.env').write_text('BETTER_AUTH_SECRET='+('x'*32)+'\n')
                releases = root/'deploy/releases'; releases.mkdir()
                (releases/'.prepare-Old123').mkdir()
                published = releases/('b'*64); published.mkdir()
                (published/'keep').touch()
                state = root/'deploy/runtime'; state.mkdir()
                for name in ['current.json','previous.json']:
                    (state/name).write_text('{"fingerprint":"old","apiImageId":"old"}')
                bin_dir = root/'bin'; bin_dir.mkdir()
                shims = {
                    'git': 'if [ "$1" = archive ]; then tar -cf - -T /dev/null; fi',
                    'flock': 'exit 0',
                    'docker': 'case "$*" in *"ps -q api"*) echo running;; *"exec -T"*) echo "[]";; *"inspect"*) echo sha256:'+'b'*64+';; esac',
                    'node': 'if [ "$2" = fingerprint ]; then echo '+'a'*64+'; else printf \'{"migrations":[]}\' > "$3/release.json"; fi',
                    'pnpm': failure,
                }
                for name,body in shims.items():
                    file = bin_dir/name; file.write_text('#!/bin/sh\n'+body+'\n'); file.chmod(0o755)
                env = {**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],
                       'APP_DIR':str(root),'APP_DOMAIN':'test.invalid','PREPARE_ONLY':'yes'}
                result = subprocess.run(['bash',str(SCRIPTS/'deploy-on-vps.sh')],env=env,capture_output=True,text=True,timeout=20)
                self.assertEqual(result.returncode,expected,result.stdout+result.stderr)
                self.assertFalse(list(releases.glob('.prepare-*')))
                self.assertTrue((published/'keep').exists())
                for name in ['candidate.json','applied.json','release.json']:
                    self.assertFalse((state/name).exists())
                for name in ['current.json','previous.json']:
                    self.assertEqual((state/name).read_text(),'{"fingerprint":"old","apiImageId":"old"}')


if __name__ == '__main__': unittest.main()
