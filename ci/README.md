# First Check CI payload

The source payload is stored as deterministic base64 chunks under `ci/source.b64.part00` through `ci/source.b64.part11`. GitHub Actions reconstructs the verified XZ archive, decompresses the ZIP, and builds from that source. No private store-review credentials or signing secrets belong in this public repository.
