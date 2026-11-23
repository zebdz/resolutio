"""Compare structured text tables in original PDFs with snapshot ballots.
Unaligned or scanned pages are reported for document review, never inferred.
"""
import argparse
import collections
import json
from pathlib import Path
import re
import subprocess
from decimal import Decimal, ROUND_HALF_UP


def tables(text):
    groups = []
    active = False
    for line in text.splitlines():
        if "Варианты ответа" in line and "Проголосовало" in line:
            groups.append([])
            active = True
            continue
        if not active:
            continue
        if "ИТОГО" in line.upper():
            active = False
            continue
        # The PHP exports changed column order over time.
        match = re.match(r"^\s*(\d+)\s+(.*?)\s*([\d.,]+)%\s+(\d+)(?:\s+.*)?$", line)
        if match:
            groups[-1].append((int(match[1]), int(match[4]), float(match[3].replace(",", "."))))
            continue
        match = re.match(r"^\s*(\d+)\s+.*?\s+(\d+)\s+([\d.,]+)%\s*$", line)
        if match:
            groups[-1].append((int(match[1]), int(match[2]), float(match[3].replace(",", "."))))

    return groups


def compare(package):
    data = json.loads((package / "manifest.json").read_bytes())
    rows = data["rows"]
    counts = collections.Counter(v["answer_id"] for v in rows["votes"])
    summary = []
    for pdf in sorted((a for a in data["assets"] if a["kind"] == "protocol"), key=lambda a:a["poll"]):
        text = subprocess.check_output(["pdftotext", "-layout", str(package / "blobs" / pdf["sha256"]), "-"]).decode()
        groups = tables(text)
        questions = sorted((q for q in rows["questions"] if q["poll_id"] == pdf["poll"]),
                           key=lambda q:(q["position_in_poll"] or 0,q["id"]))
        report = dict(poll=pdf["poll"], compared=0, differences=[], unaligned=[])
        if len(groups) != len(questions):
            report["exception"] = "image-only" if not text.strip() else "unaligned tables"
        else:
            for q, group in zip(questions, groups):
                answers = sorted((a for a in rows["answers"] if a["question_id"] == q["id"]),key=lambda a:a["id"])
                if [r[0] for r in group] != list(range(1,len(answers)+1)):
                    report["unaligned"].append(q["id"])
                    continue
                total = sum(counts[a["id"]] for a in answers)
                for answer, (_, printed, percent) in zip(answers, group):
                    ballots = counts[answer["id"]]
                    expected = float((Decimal(100*ballots)/max(1,total)).quantize(Decimal(".01"),rounding=ROUND_HALF_UP))
                    report["compared"] += 1
                    if printed != ballots or percent != expected:
                        report["differences"].append(dict(question=q["id"],answer=answer["id"],pdfCount=printed,
                                                          count=ballots,pdfPercent=percent,percent=expected))
        summary.append(report)

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package",type=Path)
    print(json.dumps(compare(parser.parse_args().package),ensure_ascii=False,indent=2))
