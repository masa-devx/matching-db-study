# 05c：Firebase Emulator（手元の Firestore と Auth）。本物の Firebase にはつながない（プロジェクトは demo-matching。D-008）
# Firestore の Emulator は Java で動くので、Node（firebase-tools）と JDK 21 を入れる。手元に Java は入れない
FROM node:24.22.2-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# 版を固定する（出てから2週間以上たったもの）
RUN npm install -g firebase-tools@15.34.2 && npm cache clean --force

# Emulator の本体（jar）は、最初に起動したときに取ってくるので、イメージを作るときに取っておく
RUN firebase setup:emulators:firestore && firebase setup:emulators:ui

WORKDIR /app/firebase
