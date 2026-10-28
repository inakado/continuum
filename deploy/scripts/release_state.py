#!/usr/bin/env python3
"""Проверки подготовленного runtime и истории миграций перед переключением."""
import json
import re
import sys
from pathlib import Path


def prepared(release, fingerprint, image, image_id, api_url):
    if (not re.fullmatch(r'[a-f0-9]{64}', fingerprint)
            or not re.fullmatch(r'sha256:[a-f0-9]{64}', image_id)
            or release.get('fingerprint') != fingerprint
            or release.get('apiImage') != image
            or release.get('apiImageId') != image_id
            or release.get('webApiBaseUrl') != api_url):
        raise ValueError('Подготовленный runtime не соответствует исходникам или image')


def pending_migrations(release, applied):
    expected = {m['name']: m['checksum'] for m in release['migrations']}
    if len(expected) != len(release['migrations']):
        raise ValueError('Повторная миграция в manifest')
    for row in applied:
        if row['rolledBack']:
            continue
        if not row['finished'] or expected.get(row['name']) != row['checksum']:
            raise ValueError('История миграций отличается от проверенного пакета')
    done = {row['name'] for row in applied if row['finished'] and not row['rolledBack']}
    return sorted(set(expected) - done)


def assets(web):
    web = Path(web).resolve()
    for name in ['server.js', 'public/vendor/mathjax/tex-chtml.js']:
        if not (web/name).is_file():
            raise ValueError(f'Нет ресурса standalone: {name}')
    for item in (web/'public').rglob('*'):
        if item.is_symlink() and (not item.exists() or not item.resolve().is_relative_to(web)):
            raise ValueError(f'Ресурс public зависит от внешнего каталога: {item}')


if __name__ == '__main__':
    command, file, *args = sys.argv[1:]
    release = json.loads(Path(file).read_text()) if command != 'assets' else None
    if command == 'migrations':
        print('\n'.join(pending_migrations(release, json.loads(Path(args[0]).read_text()))))
    elif command == 'prepared':
        prepared(release, *args)
    elif command == 'assets':
        assets(file)
    else:
        raise SystemExit('Unknown command')
