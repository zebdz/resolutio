"""Exercise the trusted-machine extractor with synthetic MySQL dump data."""
import io
import unittest

from extract import read_dump


class DumpTest(unittest.TestCase):
    def test_reads_mysql_literals_without_executing_sql_or_loading_excluded_tables(self):
        dump = io.StringIO(
            "CREATE TABLE `companies` (\n  `id` int,\n  `title` text\n);\n"
            "INSERT INTO `companies` VALUES (1,'a, (b)\\'c\\n'),(2,NULL);\n"
            "INSERT INTO `children_information` VALUES (1,'private');\n"
        )
        self.assertEqual(read_dump(dump), {
            "companies": [{"id": 1, "title": "a, (b)'c\n"}, {"id": 2, "title": None}]
        })

    def test_membership_scopes_shared_accounts_and_removes_session_tokens(self):
        from extract import scope
        source = {
            "companies": [{"id": 1, "uri": "berezka"}],
            "company_user": [{"id": 11, "company_id": 1, "user_id": 7},
                             {"id": 12, "company_id": 2, "user_id": 7}],
            "users": [{"id": 7, "remember_token": "private", "additional_id": None},
                      {"id": 8, "remember_token": "outside"}]
        }
        result = scope(source)
        self.assertEqual(result["users"], [{"id": 7, "additional_id": None}])
        self.assertEqual([r["id"] for r in result["company_user"]], [11])

    def test_preserves_both_document_versions_and_quarantines_unassigned_paths(self):
        import tempfile
        from pathlib import Path
        from zipfile import ZipFile
        from extract import copy_assets
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name, body in [("primary", b"original"), ("alternate", b"revision")]:
                with ZipFile(root / name, "w") as archive:
                    archive.writestr("storage/67/ProtocolNew.docx", body)
                    archive.writestr("storage/67/other.txt", b"orphan")
                    archive.writestr("storage/99/outside", b"private")
            rows = {"polls": [{"id": 67, "protocol_doc": "/storage/67/ProtocolNew.docx"}],
                    "question_files": [], "questions": []}
            assets = copy_assets(rows, root / "primary", root / "alternate", root)
            self.assertEqual([(a["kind"], (root / "blobs" / a["sha256"]).read_bytes())
                              for a in assets], [
                ("protocol_doc", b"original"), ("alternate", b"revision"), ("unassigned", b"orphan")
            ])
