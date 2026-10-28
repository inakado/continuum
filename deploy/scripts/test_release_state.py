import unittest
from release_state import pending_migrations, prepared


class ReleaseStateTests(unittest.TestCase):
    def test_rejects_wrong_prepared_runtime_before_activation(self):
        fp = 'a'*64
        image = 'continuum-release-api:'+fp
        image_id = 'sha256:'+'b'*64
        url = 'https://vl-physics.ru/api'
        release = {'fingerprint':fp,'apiImage':image,'apiImageId':image_id,'webApiBaseUrl':url}
        prepared(release,fp,image,image_id,url)
        for change in [{'fingerprint':'c'*64},{'apiImage':'other'},{'apiImageId':'sha256:'+'c'*64},{'webApiBaseUrl':'https://other.invalid'}]:
            with self.assertRaises(ValueError):prepared({**release,**change},fp,image,image_id,url)

    def test_migrations_preserve_applied_history_and_detect_new_schema(self):
        release = {'migrations':[{'name':'first','checksum':'old'},{'name':'second','checksum':'new'}]}
        applied = [{'name':'first','checksum':'old','finished':'date','rolledBack':None}]
        self.assertEqual(pending_migrations(release,applied),['second'])
        for change in [{'checksum':'edited'},{'finished':None},{'name':'unknown'}]:
            with self.assertRaises(ValueError):pending_migrations(release,[{**applied[0],**change}])
        with self.assertRaises(ValueError):pending_migrations({'migrations':release['migrations']*2},applied)


if __name__ == '__main__':unittest.main()
