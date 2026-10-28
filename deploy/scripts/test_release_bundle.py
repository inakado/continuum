import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from release_bundle import extract_web, pending_migrations, verify


class ReleaseBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fp = 'a' * 64
        self.manifest = {'schemaVersion': 1, 'fingerprint': self.fp,
                         'apiImage': 'continuum-release-api:' + self.fp,
                         'apiImageId': 'sha256:' + 'b' * 64,
                         'webApiBaseUrl': 'https://vl-physics.ru/api',
                         'migrations': [{'name': 'first', 'checksum': 'old'}, {'name': 'second', 'checksum': 'new'}]}
        (self.root/'api-image.tar.gz').write_bytes(b'image')
        (self.root/'web.tar.gz').write_bytes(b'web')
        self.sign()

    def sign(self):
        (self.root/'release.json').write_text(json.dumps(self.manifest))
        (self.root/'SHA256SUMS').write_text('\n'.join(
            hashlib.sha256((self.root/name).read_bytes()).hexdigest() + '  ' + name
            for name in ['api-image.tar.gz', 'web.tar.gz', 'release.json']))

    def test_rejects_corruption_and_wrong_target_before_activation(self):
        self.assertEqual(verify(self.root, self.fp, 'https://vl-physics.ru/api'), self.manifest)
        for fp, url in [('c'*64, 'https://vl-physics.ru/api'), (self.fp, 'https://other.invalid/api')]:
            with self.assertRaises(ValueError): verify(self.root, fp, url)
        (self.root/'api-image.tar.gz').write_bytes(b'corrupt')
        with self.assertRaises(ValueError): verify(self.root, self.fp, 'https://vl-physics.ru/api')

    def test_checksum_file_cannot_read_arbitrary_paths(self):
        (self.root/'SHA256SUMS').write_text('a'*64 + '  ../../secret')
        with self.assertRaises(ValueError): verify(self.root, self.fp, 'https://vl-physics.ru/api')

    def test_migrations_preserve_applied_history_and_detect_new_schema(self):
        applied = [{'name': 'first', 'checksum': 'old', 'finished': 'date', 'rolledBack': None}]
        self.assertEqual(pending_migrations(self.manifest, applied), ['second'])
        for change in [{'checksum': 'edited'}, {'finished': None}, {'name': 'unknown'}]:
            with self.assertRaises(ValueError): pending_migrations(self.manifest, [{**applied[0], **change}])

    def test_archive_traversal_and_escaping_symlinks_are_rejected(self):
        for path, link in [('../escape', None), ('link', '/tmp/escape')]:
            with tarfile.open(self.root/'web.tar.gz', 'w:gz') as archive:
                item = tarfile.TarInfo(path)
                if link:
                    item.type = tarfile.SYMTYPE; item.linkname = link
                    archive.addfile(item)
                else:
                    item.size = 1; archive.addfile(item, io.BytesIO(b'x'))
            with self.assertRaises((tarfile.FilterError, ValueError)):
                extract_web(self.root, self.root/'unpack')
        self.assertFalse((self.root.parent/'escape').exists())


if __name__ == '__main__': unittest.main()
