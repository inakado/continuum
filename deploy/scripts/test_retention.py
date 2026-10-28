import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prune', Path(__file__).with_name('prune-releases.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RetentionTests(unittest.TestCase):
    def test_missing_metadata_never_deletes_releases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/'deploy'; old = root/'releases'/('a'*64); old.mkdir(parents=True)
            with self.assertRaises(ValueError): module.retained_states(root)
            self.assertTrue(old.exists())

    def test_preserves_two_runtimes_unknown_folders_and_other_projects(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/'deploy'; (root/'runtime').mkdir(parents=True)
            names = ['a'*64, 'b'*64, 'c'*64, 'unknown-user-files']
            for name in names: (root/'releases'/name).mkdir(parents=True)
            (root/'current').symlink_to(root/'releases'/names[0])
            images = {f'continuum-release-api:{name}': 'sha256:'+str(i)*64 for i,name in enumerate(names[:3], 1)}
            for role,index in [('current',0),('previous',1)]:
                (root/f'runtime/{role}.json').write_text(json.dumps({'fingerprint':names[index],'apiImageId':list(images.values())[index]}))
            def docker(args, **kwargs):
                if args[1:3] == ['image','ls']: return '\n'.join([*images,'orbit-api:old','postgres:16-alpine'])
                if args[1:3] == ['image','inspect']: return images[args[3]]
                if args[1:3] == ['ps','-aq']: return ''
                raise AssertionError(args)
            with patch.object(Path,'cwd',return_value=root.parent), patch.object(module.subprocess,'check_output',side_effect=docker), patch.object(module.subprocess,'run') as run:
                module.prune(root)
            self.assertTrue((root/'releases'/names[0]).exists())
            self.assertTrue((root/'releases'/names[1]).exists())
            self.assertFalse((root/'releases'/names[2]).exists())
            self.assertTrue((root/'releases'/names[3]).exists())
            commands = [call.args[0] for call in run.call_args_list]
            self.assertEqual(commands[0], ['docker','image','rm',list(images)[2]])
            self.assertEqual(len(commands),2)
            self.assertNotIn('--volumes',sum(commands,[]))


if __name__ == '__main__': unittest.main()
