# Verify a poll seal from local files

Save the original receipt when casting the ballot. Its secret and original selections are private.
After the poll finishes and seals, download the evidence you can access. Keep the JSON files byte
for byte, including the embedded canonical strings. Formatting them changes their commitments.

| GET under `/api/polls/<pollId>/seal/` | File            | Who can download it                                                                                                                                              |
| ------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                            | `manifest.json` | Anyone. Contains the five section commitments.                                                                                                                   |
| `proof`                               | `<pollId>.ots`  | Anyone once proof bytes exist. The server serves its latest confirmed proof when available.                                                                      |
| `sections`                            | `sections.json` | Viewers with current results access receive the poll and tallies. Named-voter access adds the register and salted vote list. Only admins receive signer details. |
| `my-proof`                            | `bundle.json`   | Each authenticated voter with sealed votes receives their own leaves and inclusion paths. Current results access also permits the poll labels.                   |

A former member can still verify their original ballot using their bundle. Without permission to
see current results, they can authenticate labels using a previously saved canonical poll section.
A missing seal or unavailable public proof returns HTTP 404. Private downloads require a session
and return HTTP 403 when access is denied.

A voter with a confirmed email can also receive the original `receipt.json` at cast time. Once a
proof is available, a separate email carries `bundle.json` and `<pollId>.ots`. The bundle includes
the manifest and the canonical poll labels the voter may see at delivery time. Verify those files
with `--receipt`, `--bundle` and `--proof`. Keep the original receipt private.

## Run the standalone verifier

From the repository with its locked dependencies installed, build the distributable. This example
copies the verifier and the synthetic voting fixture into a fresh directory.

```sh
yarn build:seal-verifier
verify_dir=$(mktemp -d)
cp build/verify-seal.mjs "$verify_dir/"
cp src/domain/seal/__tests__/fixtures/export-v1/* "$verify_dir/"
cd "$verify_dir"
node verify-seal.mjs --manifest manifest.json --bundle bundle.json \
  --receipt receipt.json --sections sections.json --proof manifest.json.ots
```

Use Node 22 or newer. The single bundled module reads local files. It needs no package installation,
app login, database, environment variables or network at verification time. Use the downloaded
`<pollId>.ots` filename for a real poll. The example reports `originalReceiptMatches`, verified
labels and a `pending` timestamp. Its manifest SHA-256 is
`753cc468ecefe2f8cbf567cf13a03d10df97aa58aaa78da979619dddcfdb0822`.

- **Original receipt.** `--bundle` and `--receipt` compare the complete saved leaf set, including
  the original choices, weights and cast times. They check every salted leaf and its path to the
  manifest root. Compare against the copy saved at vote time.
- **Receipt code.** Use `--code-file code.txt` with a bundle to check the salts and inclusion of
  the presented leaves. `codeMatchesCurrentRecord` can also pass for a changed ballot sealed
  using the same secret. With a bundle alone, `includedLeaves` reports inclusion only.
- **Labels.** A committed poll section in the bundle, the section export or a separate `--poll` file
  authenticates the poll and answer text. `labels: unavailable` means the verifier could compare
  the ballot hashes but had no independently committed labels to compare with the receipt.
- **Sections.** Every disclosed section must match its manifest commitment. When the register and
  complete vote list are present, the verifier also recomputes weighted tallies and checks the
  disclosed ballots against the register. An anonymous member can check the tally commitment
  while individual ballots stay private.
- **Timestamp.** The offline verifier checks proof framing and its SHA-256 file digest. It reports
  `pending`, `simulated`, `bitcoinAttestationUnverified` or `notProvided`. An attestation
  requires a separate Bitcoin chain check. A consistent manifest by itself says nothing about
  when it existed.

Exit 0 means the requested local checks passed. Exit 1 reports a failed evidence check on stderr.
Exit 2 reports an invalid invocation or unreadable file. Run `node verify-seal.mjs --help` for the
accepted options.

## Check the Bitcoin timestamp

Install the Python OpenTimestamps client and configure its access to a synced Bitcoin Core node
for independent chain verification. Calendar access is needed to upgrade a pending proof. Work on
a **copy** of the proof because a successful upgrade writes the new attestations to the file and
may create a backup. [OpenTimestamps client instructions](https://github.com/opentimestamps/opentimestamps-client)

```sh
ots --no-cache info manifest.json.ots
ots --no-cache upgrade manifest.json.ots
ots --no-cache verify -f manifest.json manifest.json.ots
ots --no-cache verify -d 753cc468ecefe2f8cbf567cf13a03d10df97aa58aaa78da979619dddcfdb0822 manifest.json.ots
```

`-f` hashes the exact manifest bytes. `-d` takes the already computed 32-byte digest expressed as
64 hex characters. Using `-f` on a text file containing the hex characters hashes different bytes
and fails. A pending result from `upgrade` or `verify` means you can retry after the calendar
publishes and the block receives sufficient confirmations.

On 2026-11-20 the Python client (0.8.0) read the fixture, contacted four calendars and reported
pending on upgrade and both verification forms. It also read the previous disposable poll proof.
Two calendars reported published transactions awaiting six confirmations. Separately, both forms
verified the upstream `hello-world.txt.ots` fixture at Bitcoin block **358391**. The hex-text file
failed in all three cases. For those chain checks the client used `--bitcoin-node` with a local
HTTP bridge to PublicNode's HTTPS Bitcoin RPC. That run trusted PublicNode's chain data.
