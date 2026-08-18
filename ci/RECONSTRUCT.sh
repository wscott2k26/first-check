#!/usr/bin/env bash
set -euo pipefail
cat ci/source.b64.part* | base64 --decode > first-check-mobile-ci-source.zip.xz
printf '%s  %s\n' '6da1e975a7203397e858917f1066aadf8195d18ae6e2db78c62ceb1cfe063809' 'first-check-mobile-ci-source.zip.xz' | sha256sum -c -
xz --decompress --keep first-check-mobile-ci-source.zip.xz
printf '%s  %s\n' '66d9fc0b76f3ec7b61db7e733129fa5f89fb0ba506f08cf35f3d7732baefc65d' 'first-check-mobile-ci-source.zip' | sha256sum -c -
rm -rf build-src
mkdir build-src
unzip -q first-check-mobile-ci-source.zip -d build-src
