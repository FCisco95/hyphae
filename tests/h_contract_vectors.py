"""Reproduce the H-CONTRACT v1 hashes with the Python standard library only (B10).

The JSON hashes are recomputed from each vector's payload, so they are not "whatever JavaScript
does". Run from the repo root: python tests/h_contract_vectors.py
"""

import hashlib
import json
import pathlib
import sys
from decimal import Decimal

ROOT = pathlib.Path(__file__).resolve().parent.parent
VECTORS = ROOT / "packages" / "core" / "src" / "test-vectors" / "h-contract-v1.json"


def es_number(x):
    """ECMAScript Number::toString, which RFC 8785 uses for numbers."""
    if isinstance(x, bool):
        raise TypeError("booleans are not numbers")
    if isinstance(x, int):
        return str(x)
    if x != x or x in (float("inf"), float("-inf")):
        raise ValueError("numbers must be finite")
    if x == 0:
        return "0"
    if x.is_integer() and abs(x) < 1e21:
        return str(int(x))
    shortest = repr(x)
    if 1e-6 <= abs(x) < 1e21:
        return format(Decimal(shortest), "f")
    mantissa, exponent = shortest.split("e")
    sign = "-" if exponent.startswith("-") else "+"
    return f"{mantissa}e{sign}{exponent.lstrip('+-').lstrip('0')}"


def jcs(value):
    if value is None or isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        return es_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(jcs(v) for v in value) + "]"
    if isinstance(value, dict):
        # Sorted by UTF-16 code unit, as RFC 8785 requires.
        keys = sorted(value, key=lambda k: k.encode("utf-16-be"))
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + jcs(value[k]) for k in keys) + "}"
    raise TypeError(type(value))


def c14n(value):
    """hyphae-c14n/1: the JCS subset with no numbers and keys in [a-z0-9_]."""

    def check(v):
        if isinstance(v, bool) or v is None or isinstance(v, str):
            return
        if isinstance(v, (int, float)):
            raise TypeError("hyphae-c14n/1 has no numbers")
        if isinstance(v, list):
            for x in v:
                check(x)
            return
        for k, x in v.items():
            if not k or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789_" for c in k):
                raise ValueError(f"key {k!r}")
            check(x)

    check(value)
    out = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert out == jcs(value), "for this profile json.dumps must equal JCS"
    return out


def tagged(tag, canonical):
    return hashlib.sha256(tag.encode() + b"\x00" + canonical.encode("utf-8")).hexdigest()


def main():
    v = json.loads(VECTORS.read_text(encoding="utf-8"))
    c = v["commitments"]
    checked = 0

    for case in c["config"]:
        assert jcs(case["payload"]) == case["jcs"], case["name"]
        assert tagged("hyphae/config/v1", case["jcs"]) == case["hash"], case["name"]
        checked += 1

    for section, tag in (
        ("evidence", "hyphae/evidence/v1"),
        ("decisions", "hyphae/decision/v1"),
        ("member_epoch", "hyphae/member-epoch/v1"),
    ):
        for name, case in c[section].items():
            assert c14n(case["payload"]) == case["c14n"], name
            assert tagged(tag, case["c14n"]) == case["hash"], name
            checked += 1

    audit = c["epoch_audit"]
    assert c14n(audit["payload"]) == audit["c14n"]
    assert tagged("hyphae/epoch-audit/v1", audit["c14n"]) == audit["hash"]
    checked += 1

    # The decision chain binds each revision to its predecessor's hash.
    d = c["decisions"]
    assert d["effort_upgrade_revision_2"]["payload"]["predecessor_hash"] == d["model_revision_1"]["hash"]
    assert d["late_correction_revision_3"]["payload"]["predecessor_hash"] == d["effort_upgrade_revision_2"]["hash"]

    for leaf in v["merkle"]["leaves"]:
        encoded = (
            b"\x00"
            + bytes.fromhex(leaf["wallet"])
            + int(leaf["epoch_index"]).to_bytes(8, "little")
            + int(leaf["score"]).to_bytes(8, "little")
            + int(leaf["amount"]).to_bytes(8, "little")
            + bytes.fromhex(leaf["evidence_hash"])
        )
        assert encoded.hex() == leaf["encoded"], leaf["name"]
        assert hashlib.sha256(encoded).hexdigest() == leaf["hash"], leaf["name"]
        checked += 1

    print(f"h-contract-v1: {checked} hashes reproduced with the Python standard library")
    return 0


if __name__ == "__main__":
    sys.exit(main())
