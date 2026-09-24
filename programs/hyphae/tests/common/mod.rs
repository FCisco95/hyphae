#![allow(dead_code)]

use serde_json::Value;

// The shared H-CONTRACT vectors (B10), written by packages/core/src/h-contract-vectors.test.ts.
pub fn vectors() -> Value {
    serde_json::from_str(include_str!(
        "../../../../packages/core/src/test-vectors/h-contract-v1.json"
    ))
    .expect("vector file parses")
}

pub fn hex(s: &str) -> Vec<u8> {
    assert!(s.len() % 2 == 0, "odd hex length");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex"))
        .collect()
}

pub fn hex32(v: &Value) -> [u8; 32] {
    hex(v.as_str().expect("hex string"))
        .try_into()
        .expect("32 bytes")
}

pub fn dec(v: &Value) -> u64 {
    v.as_str().expect("decimal string").parse().expect("u64")
}
