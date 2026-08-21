import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('release-input-fingerprint.sh')


class FingerprintTest(unittest.TestCase):
    def make_root(self, td):
        root = pathlib.Path(td)
        for name in ('apps', 'packages', 'scripts'):
            (root / name).mkdir()
        (root / 'apps' / 'a.ts').write_text('alpha\n')
        (root / 'package.json').write_text('{"name":"first-check"}\n')
        return root

    def fingerprint(self, root):
        return subprocess.check_output(['bash', str(SCRIPT), str(root)], text=True).strip()

    def test_same_files_produce_same_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = self.make_root(td)
            self.assertEqual(self.fingerprint(root), self.fingerprint(root))

    def test_source_content_change_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = self.make_root(td)
            before = self.fingerprint(root)
            (root / 'apps' / 'a.ts').write_text('beta\n')
            self.assertNotEqual(before, self.fingerprint(root))

    def test_root_package_change_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = self.make_root(td)
            before = self.fingerprint(root)
            (root / 'package.json').write_text('{"name":"first-check","packageManager":"pnpm@11.9.0"}\n')
            self.assertNotEqual(before, self.fingerprint(root))


if __name__ == '__main__':
    unittest.main()
