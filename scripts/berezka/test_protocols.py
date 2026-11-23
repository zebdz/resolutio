"""Protocol reconciliation compares complete ordered tables and records unsupported layouts."""
import unittest
from protocols import tables


class ProtocolTest(unittest.TestCase):
    def test_handles_all_three_printed_column_orders(self):
        for line in ["1    За   25   78.13%", "1   За   78.13%   25", "1   78.13%   25   За"]:
            text = "№   Варианты ответа   Проголосовало %\n" + line + "\nИТОГО"
            self.assertEqual(tables(text), [[(1, 25, 78.13)]])
