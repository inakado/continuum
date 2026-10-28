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



if __name__ == '__main__':
    command, file, *args = sys.argv[1:]
    release = json.loads(Path(file).read_text())
    if command == 'migrations':
        print('\n'.join(pending_migrations(release, json.loads(Path(args[0]).read_text()))))
    elif command == 'prepared':
        prepared(release, *args)
    else:
        raise SystemExit('Unknown command')
