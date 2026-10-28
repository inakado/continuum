#!/usr/bin/env python3
"""Проверка CI-пакета и безопасная распаковка web; без доступа к данным приложения."""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

FILES = {'api-image.tar.gz', 'web.tar.gz', 'release.json'}


def verify(bundle, fingerprint, api_url):
    bundle = Path(bundle)
    expected = {}
    for line in (bundle / 'SHA256SUMS').read_text().splitlines():
        match = re.fullmatch(r'([a-f0-9]{64})  ([\w.-]+)', line)
        if not match or match[2] not in FILES or match[2] in expected:
            raise ValueError('Некорректный список контрольных сумм')
        expected[match[2]] = match[1]
    if set(expected) != FILES:
        raise ValueError('Неполный CI-пакет')
    for name, digest in expected.items():
        with (bundle / name).open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != digest:
            raise ValueError(f'Повреждён файл {name}')
    release = json.loads((bundle / 'release.json').read_text())
    if (release.get('schemaVersion') != 1 or not re.fullmatch(r'[a-f0-9]{64}', fingerprint)
            or release.get('fingerprint') != fingerprint
            or release.get('apiImage') != f'continuum-release-api:{fingerprint}'
            or not re.fullmatch(r'sha256:[a-f0-9]{64}', release.get('apiImageId', ''))
            or release.get('webApiBaseUrl') != api_url):
        raise ValueError('CI-пакет не соответствует целевому коду или API')
    return release


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


def extract_web(bundle, destination):
    with tarfile.open(Path(bundle) / 'web.tar.gz', 'r:gz') as archive:
        if sum(m.size for m in archive.getmembers()) > 2 * 1024**3:
            raise ValueError('Слишком большая web-сборка')
        archive.extractall(destination, filter='data')
    if not (Path(destination) / 'apps/web/server.js').is_file():
        raise ValueError('В пакете нет standalone server.js')


if __name__ == '__main__':
    command, *args = sys.argv[1:]
    if command == 'verify':
        print(json.dumps(verify(*args)))
    elif command == 'extract':
        extract_web(*args)
    elif command == 'migrations':
        release = json.loads(Path(args[0]).read_text())
        applied = json.loads(Path(args[1]).read_text())
        print('\n'.join(pending_migrations(release, applied)))
    else:
        raise SystemExit('Unknown command')
