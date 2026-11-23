"""Prepare the private Berezka transfer package on the machine holding the dumps.
Decode mysqldump literals as data. Only explicitly scoped relations can leave this process.
"""
import re

TABLES = set("""
companies company_user users users_additional_fields positions polls questions
answers votes question_files organizers speakers quorums entities entity_poll
entity_user company_entity items rights right_user company_right types_of_rights
types_of_polls anonymous_votes
""".split())

ESCAPES = {"n": "\n", "r": "\r", "t": "\t", "0": "\0", "b": "\b", "Z": "\x1a"}
LITERAL = re.compile(r"'((?:[^'\\]++|\\.)*)'|(NULL)|(-?\d+(?:\.\d+)?)")


def decode_rows(payload, columns):
    pos = 0
    while payload[pos] == "(":
        row = {}
        for index, column in enumerate(columns):
            pos += 1
            match = LITERAL.match(payload, pos)
            if not match:
                raise ValueError("Unsupported MySQL literal")
            string, null, number = match.groups()
            if string is not None:
                value = re.sub(r"\\(.)", lambda m: ESCAPES.get(m[1], m[1]), string)
            elif null:
                value = None
            else:
                value = float(number) if "." in number else int(number)
            row[column] = value
            pos = match.end()
            if payload[pos] != (")" if index == len(columns) - 1 else ","):
                raise ValueError("Source schema and INSERT disagree")
        yield row
        pos += 1
        if payload[pos:] == ";":
            return
        if payload[pos:pos + 2] != ",(":
            raise ValueError("Unsupported INSERT syntax")
        pos += 1


def read_dump(lines):
    schema = {}
    rows = {}
    table = None
    for line in lines:
        create = re.match(r"CREATE TABLE `(\w+)`", line)
        if create:
            table = create[1]
            if table in TABLES:
                schema[table] = []
                rows[table] = []
        elif line.startswith(")"):
            table = None
        elif table in TABLES and (column := re.match(r"  `(\w+)`", line)):
            schema[table].append(column[1])
        elif insert := re.match(r"INSERT INTO `(\w+)` VALUES ", line):
            if insert[1] in TABLES:
                rows[insert[1]].extend(decode_rows(line[insert.end():].rstrip(), schema[insert[1]]))

    return rows


def scope(source):
    scoped = {}

    def select(table, column, values):
        scoped[table] = sorted(
            (r for r in source.get(table, []) if r[column] in values),
            key=lambda r: r["id"]
        )

        return {r["id"] for r in scoped[table]}

    def refs(table, column):
        return {r[column] for r in scoped[table] if r.get(column) is not None}

    select("companies", "id", {1})
    if [r["uri"] for r in scoped["companies"]] != ["berezka"]:
        raise ValueError("Company 1 must be berezka")
    for table in ("company_user", "company_entity", "company_right", "positions",
                  "polls", "organizers", "quorums", "items"):
        select(table, "company_id", {1})
    users = select("users", "id", refs("company_user", "user_id"))
    if users != refs("company_user", "user_id"):
        raise ValueError("Dangling membership")
    scoped["users"] = [{k: v for k, v in row.items() if k != "remember_token"}
                       for row in scoped["users"]]
    select("users_additional_fields", "id", refs("users", "additional_id"))
    entities = select("entities", "id", refs("company_entity", "entity_id"))
    select("entity_user", "entity_id", entities)
    select("entity_poll", "entity_id", entities)
    select("right_user", "user_id", users)
    select("rights", "id", refs("right_user", "right_id") | refs("company_right", "right_id"))
    select("types_of_rights", "id", refs("rights", "type_of_right"))
    select("types_of_polls", "id", refs("polls", "type_of_poll"))
    polls = refs("polls", "id")
    for row in source.get("questions", []):
        if (row["poll_id"] in polls) != (row["company_id"] == 1):
            raise ValueError("Conflicting question scope")
    questions = select("questions", "poll_id", polls)
    for table in ("answers", "votes", "speakers", "question_files", "anonymous_votes"):
        select(table, "question_id", questions)
    answer_questions = {r["id"]: r["question_id"] for r in scoped["answers"]}
    ballots = set()
    for vote in scoped["votes"]:
        key = (vote["question_id"], vote["user_id"])
        if (vote["user_id"] not in users or vote["question_id"] != answer_questions.get(vote["answer_id"])
                or key in ballots):
            raise ValueError("Invalid ballot relationship")
        ballots.add(key)
    if scoped.pop("anonymous_votes"):
        raise ValueError("Unexpected anonymous votes")
    for table, column, allowed in (("questions", "author", users), ("entity_poll", "poll_id", polls),
                                   ("entity_user", "user_id", users),):
        if refs(table, column) - allowed:
            raise ValueError(f"Unscoped {table}.{column}")

    return scoped


def copy_assets(rows, primary_path, alternate_path, output):
    import base64
    import hashlib
    import json
    from zipfile import ZipFile

    blobs = output / "blobs"
    blobs.mkdir(mode=0o700)
    assets = []

    def store(body, path, kind, **ownership):
        digest = hashlib.sha256(body).hexdigest()
        dest = blobs / digest
        if not dest.exists():
            dest.write_bytes(body)
        assets.append(dict(path=path, kind=kind, sha256=digest, size=len(body), **ownership))

    questions = {r["id"]: r["poll_id"] for r in rows["questions"]}
    refs = {}
    for poll in rows["polls"]:
        for kind in ("protocol", "protocol_doc", "blank_doc", "blank_with_answers_doc"):
            if path := poll.get(kind):
                refs[path.removeprefix("/storage/") if path.startswith("/storage/storage/") else path.lstrip("/")] = (kind, {"poll": poll["id"]})
    for row in rows["question_files"]:
        refs[row["path_to_file"]] = ("question_file", {"question": row["question_id"], "file": row["id"],
                                                       "poll": questions[row["question_id"]]})
    poll_ids = {str(p["id"]) for p in rows["polls"]}
    with ZipFile(primary_path) as primary, ZipFile(alternate_path) as alternate:
        paths = {p.filename for p in primary.infolist() if not p.is_dir()}
        if refs.keys() - paths:
            raise ValueError("Missing referenced file")
        for path in sorted(paths):
            parts = path.split("/")
            if len(parts) < 3 or parts[0] != "storage" or parts[1] not in poll_ids:
                if path in refs:
                    raise ValueError("Referenced file outside scoped directories")
                continue
            kind, owner = refs.get(path, ("unassigned", {"poll": int(parts[1])}))
            body = primary.read(path)
            if kind == "protocol" and not body.startswith(b"%PDF-"):
                raise ValueError("Protocol has invalid PDF signature")
            store(body, path, kind, **owner)
            if path in alternate.NameToInfo:
                other = alternate.read(path)
                if other != body:
                    store(other, path, "alternate", **owner)
    for q in rows["questions"]:
        try:
            draft = json.loads(q["text"])
        except ValueError:
            continue
        for key, entity in draft["entityMap"].items():
            src = entity.get("data", {}).get("src", "")
            if src.startswith("data:image/"):
                header, content = src.split(",", 1)
                if header not in ("data:image/png;base64", "data:image/jpeg;base64", "data:image/gif;base64", "data:image/webp;base64"):
                    raise ValueError("Unexpected inline image type")
                store(base64.b64decode(content, validate=True), f"inline/{q['id']}/{key}", "inline",
                      question=q["id"], poll=q["poll_id"], mime=header[5:-7])

    return assets


SOURCE_DIGESTS = [
    "0682c7dba8a8eb30243ae10a7cd97e677a54a7d254d2ecc6e97b4b253bf60c39",
    "9389c6a781a7ac85c2d7e55e3bc41608a35694b262c95c6611566983fb874b30",
    "285d7cadd406fd5dd5e3df3ccac20241904826ad51b34d4bb8845663d8667566",
]


def main():
    import argparse
    import hashlib
    import json
    import os
    from collections import Counter
    from pathlib import Path
    from tempfile import TemporaryDirectory

    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("sql", "primary", "alternate", "output"):
        parser.add_argument(arg, type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    for path, expected in zip([args.sql, args.primary, args.alternate], SOURCE_DIGESTS):
        with path.open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != expected:
                parser.error(f"Source digest differs for {path.name}")
    if args.output.exists():
        parser.error("Choose a new package directory")
    with args.sql.open(encoding="utf-8") as f:
        rows = scope(read_dump(f))
    with TemporaryDirectory(dir=args.output.parent) as tmp:
        package = Path(tmp) / "package"
        package.mkdir()
        assets = copy_assets(rows, args.primary, args.alternate, package)
        counts = {k:len(v) for k,v in rows.items()}
        required = dict(users=162, company_user=162, polls=51, questions=506, answers=2153,
                        votes=6190, right_user=161, question_files=1154, users_additional_fields=69)
        if any(counts[k] != n for k,n in required.items()):
            parser.error("Relational inventory mismatch")
        if Counter(a["kind"] for a in assets) != dict(protocol=24, protocol_doc=16, blank_doc=2,
                blank_with_answers_doc=8, question_file=1154, unassigned=21, alternate=1, inline=30):
            parser.error("Asset inventory mismatch")
        manifest = json.dumps(dict(version=1, sources=SOURCE_DIGESTS, rows=rows, assets=assets),
                              ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
        (package / "manifest.json").write_bytes(manifest)
        package.rename(args.output)
        print(json.dumps(dict(counts=counts, assets=len(assets), sha256=hashlib.sha256(manifest).hexdigest())))


if __name__ == "__main__":
    main()
