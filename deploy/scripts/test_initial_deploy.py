"""Первый запуск реального installer: пустая БД, отказ для непустой и ошибка миграции."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent


class InitialDeployTests(unittest.TestCase):
    def run_initial(self, table_count='0', migration_fail=False, initial='yes'):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name).resolve()
        scripts = root/'deploy/scripts'; scripts.mkdir(parents=True)
        for name in ['prune-releases.py', 'release_state.py']:
            shutil.copy2(SCRIPTS/name, scripts/name)
        env_dir = root/'deploy/env'; env_dir.mkdir()
        (env_dir/'api.env').write_text('BETTER_AUTH_SECRET='+('x'*32)+'\n')
        fp, digest = 'a'*64, 'sha256:'+'b'*64
        release = root/'deploy/releases'/fp
        web = release/'web/apps/web'
        (web/'public/vendor/mathjax').mkdir(parents=True)
        (web/'server.js').touch(); (web/'public/vendor/mathjax/tex-chtml.js').touch()
        metadata = {'fingerprint':fp, 'apiImage':'continuum-release-api:'+fp, 'apiImageId':digest,
                    'webApiBaseUrl':'https://fresh.example/api', 'migrations':[{'name':'first','checksum':'abc'}]}
        (release/'release.json').write_text(json.dumps(metadata))
        bin_dir = root/'bin'; bin_dir.mkdir()
        shims = {
            'id':'echo 1001', 'git':'exit 0', 'flock':'exit 0',
            'systemctl':'echo "$APP_DIR/deploy/scripts/start-web.sh"',
            'docker': 'printf "%s\\n" "$*" >> "$QA_LOG"\ncase "$*" in\n'
                      '*"exec -T postgres"*) echo "$QA_TABLE_COUNT";;\n'
                      '*"image inspect"*) echo '+digest+';;\n'
                      '*"prisma migrate deploy"*) [ "$QA_MIGRATION_FAIL" != yes ] || exit 42;;\nesac',
            'node':'if [ "$2" = fingerprint ]; then echo '+fp+'; else cp "$QA_RELEASE" "$3/release.json"; fi',
            'mv':'python3 -c \'import os,sys; os.replace(sys.argv[-2],sys.argv[-1])\' "$@"',
            'sudo':'exit 0', 'curl':'exit 0',
        }
        for name, body in shims.items():
            p=bin_dir/name; p.write_text('#!/bin/sh\n'+body+'\n'); p.chmod(0o755)
        env={**os.environ, 'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'], 'APP_DIR':str(root),
             'APP_DOMAIN':'fresh.example', 'INITIAL_DEPLOY':initial, 'MIGRATIONS_APPROVED':'yes',
             'BACKUP_CONFIRMED':'no', 'QA_LOG':str(root/'docker.log'), 'QA_RELEASE':str(release/'release.json'),
             'QA_TABLE_COUNT':table_count, 'QA_MIGRATION_FAIL':'yes' if migration_fail else 'no'}
        result=subprocess.run(['bash',str(SCRIPTS/'deploy-on-vps.sh')],env=env,capture_output=True,text=True,timeout=20)
        return root, result

    def test_empty_database_bootstraps_without_a_fictional_previous_image_or_backup(self):
        root, result=self.run_initial()
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertTrue((root/'deploy/runtime/current.json').is_file())
        self.assertFalse((root/'deploy/runtime/previous.json').exists())
        self.assertIn('prisma migrate deploy',(root/'docker.log').read_text())

    def test_nonempty_database_is_refused_before_build_or_migration(self):
        root, result=self.run_initial(table_count='1')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('refuses a non-empty',result.stdout)
        log=(root/'docker.log').read_text()
        self.assertNotIn('build api',log)
        self.assertNotIn('prisma migrate deploy',log)

    def test_missing_runtime_requires_explicit_initial_mode(self):
        _, result=self.run_initial(initial='no')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('No API runtime',result.stdout)

    def test_failed_initial_migration_never_activates_web(self):
        root, result=self.run_initial(migration_fail=True)
        self.assertEqual(result.returncode,42,result.stdout+result.stderr)
        self.assertFalse((root/'deploy/current').exists())
        self.assertFalse((root/'deploy/runtime/current.json').exists())


if __name__ == '__main__': unittest.main()
