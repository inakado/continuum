"""Исполняет настоящий installer до ошибки сборки/TERM, без Docker и сети."""
import os
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


class DeployCleanupTests(unittest.TestCase):
    def test_activation_failure_preserves_candidate_and_never_restarts_previous_runtime(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            scripts = root/'deploy/scripts'; scripts.mkdir(parents=True)
            for name in ['prune-releases.py', 'release_state.py']:
                shutil.copy2(SCRIPTS/name, scripts/name)
            env_dir = root/'deploy/env'; env_dir.mkdir()
            (env_dir/'api.env').write_text('BETTER_AUTH_SECRET='+('x'*32)+'\n')
            state = root/'deploy/runtime'; state.mkdir()
            old_fp, new_fp = 'b'*64, 'a'*64
            old_image, new_image = 'sha256:'+'1'*64, 'sha256:'+'2'*64
            old = root/'deploy/releases'/old_fp; old.mkdir(parents=True)
            (old/'keep').touch()
            (root/'deploy/current').symlink_to(old)
            current = json.dumps({'fingerprint': old_fp, 'apiImageId': old_image})
            (state/'current.json').write_text(current)
            candidate = root/'deploy/releases'/new_fp; candidate.mkdir()
            web = candidate/'web/apps/web'; (web/'public/vendor/mathjax').mkdir(parents=True)
            (web/'server.js').touch(); (web/'public/vendor/mathjax/tex-chtml.js').touch()
            release = candidate/'release.json'
            release.write_text(json.dumps({'fingerprint': new_fp, 'apiImage': 'continuum-release-api:'+new_fp,
                'apiImageId': new_image, 'webApiBaseUrl': 'https://test.invalid/api', 'migrations': []}))
            bin_dir = root/'bin'; bin_dir.mkdir()
            shims = {
                'id': 'echo 1001', 'git': 'exit 0', 'flock': 'exit 0',
                'systemctl': 'echo /srv/continuum/deploy/scripts/start-web.sh',
                'docker': 'printf "%s|%s\\n" "${CONTINUUM_API_IMAGE:-unset}" "$*" >> "$QA_DOCKER_LOG"\ncase "$*" in *"ps -q api"*) echo running;; *"image inspect"*) echo '+new_image+';; *"inspect running"*) echo '+old_image+';; *"exec -T"*) echo "[]";; esac',
                'node': 'if [ "$2" = fingerprint ]; then echo '+new_fp+'; else cp "$QA_RELEASE" "$3/release.json"; fi',
                'mv': 'python3 -c \'import os,sys; os.replace(sys.argv[-2],sys.argv[-1])\' "$@"',
                'sudo': 'exit 0', 'curl': 'exit 1', 'sleep': 'exit 0',
            }
            for name, body in shims.items():
                file = bin_dir/name; file.write_text('#!/bin/sh\n'+body+'\n'); file.chmod(0o755)
            log = root/'docker.log'
            env = {**os.environ, 'PATH': str(bin_dir)+os.pathsep+os.environ['PATH'],
                'APP_DIR': str(root), 'APP_DOMAIN': 'test.invalid', 'PREPARE_ONLY': 'no',
                'QA_DOCKER_LOG': str(log), 'QA_RELEASE': str(release)}
            result = subprocess.run(['bash', str(SCRIPTS/'deploy-on-vps.sh')], env=env, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 1, result.stdout+result.stderr)
            self.assertEqual((root/'deploy/current').resolve(), candidate.resolve())
            self.assertNotIn(old_image+'|', log.read_text())
            self.assertIn('Deploy a corrected release', result.stderr)
            self.assertEqual((state/'current.json').read_text(), current)
            self.assertTrue((old/'keep').exists())
            self.assertTrue((web/'server.js').exists())

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
