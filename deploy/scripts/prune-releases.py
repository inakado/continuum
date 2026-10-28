#!/usr/bin/env python3
"""Оставляет текущий/предыдущий runtime; не удаляет volumes, S3 и backup данных."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def retained_states(root):
    current = root/'runtime/current.json'
    if not current.is_file():
        raise ValueError('Current release metadata is required before cleanup')
    states = [json.loads(p.read_text()) for p in [current, root/'runtime/previous.json'] if p.is_file()]
    for state in states:
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', state.get('apiImageId', '')):
            raise ValueError('Invalid retained image identity')
        if state.get('fingerprint') is not None and not re.fullmatch(r'[a-f0-9]{64}', state['fingerprint']):
            raise ValueError('Invalid retained web identity')
    if (root/'current').resolve() != root/'releases'/states[0]['fingerprint']:
        raise ValueError('Runtime pointer differs from metadata')
    return states


def clean_temporary(root):
    # Вызывается под deploy.lock: активная сборка не может очищаться параллельно.
    for name in ['releases', 'runtime']:
        if (root/name).is_symlink():
            raise ValueError('Deployment directories must not be symlinks')
    for folder in (root/'releases').glob('.prepare-*'):
        if folder.is_dir() and not folder.is_symlink() and re.fullmatch(r'\.prepare-[A-Za-z0-9]{6}', folder.name):
            shutil.rmtree(folder)
    for name in ['candidate.json', 'applied.json', 'release.json']:
        (root/'runtime'/name).unlink(missing_ok=True)


def prune(root, temporary_only=False):
    root = Path(root).resolve()
    if (Path.cwd()/'deploy').is_symlink() or root != (Path.cwd()/'deploy').resolve():
        raise ValueError('Run cleanup from the application checkout only')
    if temporary_only:
        clean_temporary(root)
        return
    states = retained_states(root)
    clean_temporary(root)
    keep_images = {s['apiImageId'] for s in states}
    keep_web = {s.get('fingerprint') for s in states}
    for folder in (root/'releases').iterdir():
        if folder.is_dir() and not folder.is_symlink() and re.fullmatch(r'[a-f0-9]{64}', folder.name) and folder.name not in keep_web:
            shutil.rmtree(folder)
    lines = subprocess.check_output(['docker', 'image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], text=True).splitlines()
    for image in lines:
        if image.split(':')[0] not in {'continuum-release-api', 'continuum-prod-api'} or image.endswith(':<none>'):
            continue
        image_id = subprocess.check_output(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'], text=True).strip()
        used = subprocess.check_output(['docker', 'ps', '-aq', '--filter', f'ancestor={image_id}'], text=True).strip()
        if image_id not in keep_images and not used:
            subprocess.run(['docker', 'image', 'rm', image], check=True)
    subprocess.run(['docker', 'buildx', 'prune', '--builder', 'default', '--force', '--max-used-space', '4gb'], check=True)


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[2:] not in [[], ['--temporary-only']]:
        raise SystemExit('Usage: prune-releases.py APP_DIR/deploy [--temporary-only]')
    prune(sys.argv[1], temporary_only=sys.argv[2:] == ['--temporary-only'])
