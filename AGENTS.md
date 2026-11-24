# matching-db-study

マッチングアプリ（会員・いいね・マッチ・メッセージ・有料プラン）を題材に、テーブル設計・JOIN・中間テーブル・インデックス・同時更新を、作って確かめる学習用のリポジトリ。実在のサービスのコード・名前・データは使わない。

**新しい会話では、最初に [agents/background.md](agents/background.md)（背景・決めたこと・まだ決めていないこと・参考にするノート）を読む。**

AI（Claude Code・Codex）が最初に読む地図。`CLAUDE.md` はこのファイルへのリンク。学習用。何が分からないか・何を確かめるかは、決まったらここに書く。

## 技術スタック

版は `mise.toml` とロックファイル（`backend/client/composer.lock`・`frontend/client/package-lock.json`）を正とする。「入れたときの最新」と書いたものは、入れたあとにロックファイルの版を書く。

ここには結論だけを書く。

- **言語・実行環境**
  - 使うもの：PHP（Docker の `app`）・Node（手元・mise。03b から）・Docker
  - 版：PHP 8.5・Node 26.13.0
  - 理由：PHP と DB を Docker にそろえ、だれの PC でも同じ版で動かす（D-011）
- **フレームワーク**
  - 使うもの：Laravel（API）・React＋TypeScript＋Vite＋React Router（03b から）
  - 版：Laravel は入れたときの最新。React 19.3.1・TypeScript 7.0.2・Vite 8.3.8・React Router 8.5.1
  - 理由：仕事で使ってきた形で、Eloquent の裏の SQL を確かめる
- **DB・ORM**
  - 使うもの：PostgreSQL（Docker compose）・Eloquent
  - 版：18・Laravel と同じ
  - 理由：流れた SQL は `DB::listen` でログに出し、`->explain()` で実行計画を見る
- **NoSQL（05c から）**
  - 使うもの：Firebase Emulator（Firestore と Auth。Docker の `firebase`）・Firebase JS SDK（画面）
  - 版：firebase-tools 15.34.2・Node 24.22.2・JDK 21・firebase 13.1.0
  - 理由：ドキュメント DB を RDB と比べる
  - 手元だけで動かし、クラウドのアカウントは作らない（D-008。プロジェクトは `demo-matching`）
- **管理画面（12 から）**
  - 使うもの：`backend/admin`（Laravel。Docker の `admin-app`）・`frontend/admin`（React・Vite・Mantine）
  - 版：Laravel は会員の側と同じ 13 系・Mantine（`@mantine/core`・`@mantine/charts`）9.7.4・recharts 3.10.1
  - 理由：会員の側と干渉しないよう、別のアプリにする。表は共通（同じ DB）
  - よくある管理画面の形（サイドバー・表・グラフ）を、部品のライブラリでそろえる（12 の解説）
- **状態の管理（画面）**
  - 使うもの：React の Context → Zustand（#294 で入れ、下のタブの数を store にした。ほかの状態は、画面を移すチケットで移す）
  - 版：React と同じ・Zustand 5.1.0
  - 理由：標準の限界を体験してから移す。TanStack Query・OpenAPI は使わない
- **画面から API を呼ぶ**
  - 使うもの：axios（D-029。通信は既定の XMLHttpRequest）
  - 版：1.21.1
  - 理由：interceptors で 401・419・503 を1か所で扱う
- **テスト**
  - 使うもの：Pest（バックエンド。テスト用の PostgreSQL に対して実行）・Vitest（画面）・MSW（画面の結合テストの偽の応答）
  - 版：Pest・Vitest は入れたときの最新。MSW 3.0.7（#290。D-029）
  - 画面の E2E（Playwright）は、まだ入れない。入れるのは #299
  - 理由：SQLite ではロックや UNIQUE の動きが違うため、本物の PostgreSQL で確かめる
- **静的検査・整形**
  - 使うもの：Larastan（PHPStan）・Pint（API）・Biome（画面。lint と整形を1つで受け持つ）
  - 版：Larastan・Pint は入れたときの最新。Biome 2.6.7
  - 理由：型の抜けと書き方のずれを機械で見つける
- **デプロイ先**：なし（手元だけ）。学習用

## ディレクトリ構成

置き場所の判断基準は、バックエンドは [architecture-backend.md](agents/rules/architecture-backend.md)、画面は [architecture-frontend.md](agents/rules/architecture-frontend.md) を正とする。ここには、どこに何があるかの索引だけを書く（中身の説明は書かない。コードを読めばわかり、すぐ古くなる）。

- `backend/`・`frontend/`：層（API と画面）で分け、その中を使う人で分ける
  - `client`（会員）・`admin`（管理画面。12）
  - #93 で `backend/`・`frontend/`・`admin/` から移した
- `backend/client/`：Laravel（API）
  - 今はレガシー版の形（`app/Models`・`app/Http/Controllers`・`database/migrations`）
  - 改訂版の置き場は [architecture-backend.md](agents/rules/architecture-backend.md) の3章（Controller → Service → Model）。画面・機能ごとに移す
- `backend/client/tests/`：Pest のテスト。種類と置き場は [testing.md](agents/rules/testing.md)
  - `Unit/`：ロジック
  - `Feature/`：DB と API をまたぐもの。中は業務のまとまり（`Profile/`・`Matching/` など）で分ける
  - `Arch/`：層の依存の向き
  - `DummyData/`：テストのダミーデータ（会員・いいね・トークンを作るクラス）
  - `Endpoints.php`：テストで呼ぶ API の URL を作るクラス。URL の文字はここにだけ書く
- `frontend/client/`：React（03b から）
  - 改訂版の置き場の地図は [docs/frontend.md](docs/frontend.md)、決まりは [architecture-frontend.md](agents/rules/architecture-frontend.md)
  - テストは `tests/`：`integration/<機能>/`（結合）・`api/`（`src/api/client.ts`）・`unit/`（単体）・`support/`（MSW の偽物）
- `backend/admin/`：管理画面（12）の API（Laravel）
  - 会員の側のコードは読み込まない
  - 表は会員の側と共通。表の作り（マイグレーション）は、管理画面の表も含めて `backend/client/` にまとめる
- `frontend/admin/`：管理画面（12）の画面（React・Mantine）
  - 改訂版の置き場は [docs/frontend.md](docs/frontend.md) の「管理画面（`frontend/admin`）への当てはめ」
- `compose.yaml`：PHP（`app`）・管理画面の PHP（`admin-app`。12）・PostgreSQL（開発用とテスト用）・Mailpit・Firebase Emulator（`firebase`。05c）
- `docker/`：コンテナの作り方（`php/Dockerfile`・`firebase/Dockerfile`）と、DB を最初に作る SQL（`db/init/`）
- `firebase/`：Firebase Emulator の設定
  - 設定は `firebase.json`、セキュリティルールは `firestore.rules`、インデックスは `firestore.indexes.json`
  - 止めたときのデータは `firebase/.emulator-data/`（git に入れない）
- `docs/`：何を作るか（product.md・requirements/）と、なぜそうしたか（decisions.md）。コマンドの中身（commands.md）
  - 言葉の対応は用語集（glossary.md）。目次は docs/README.md
- `explanations/`：一歩ごとの解説と図（HTML）。目次は index.html、ひな形は _template.html
- `agents/`：開発ルール（rules/）・手順（skills/）
- `.claude/`：Claude Code 向けの権限・フック・レビュー役。rules・skills は agents/ へのリンク
- `.agents/`：Codex 向け。skills は agents/skills へのリンク

## 主要コマンド

コマンドの中身（実行場所・前提・使わないもの）は [docs/commands.md](docs/commands.md) に、操作ごとに書く。動くと確かめたコマンドだけを書く。

- 書いていないコマンドは、推測して流さない。必要な操作について確認する
- よく使う確認のコマンド（テスト・静的検査）が決まったら、`.claude/settings.json` の `permissions.allow` に足す（記入例: `"Bash(bun test:*)"`）。足すのは、何度実行しても何も壊さないコマンドだけにする
- ブランチを切り替えたら、docs/commands.md の「ブランチを切り替えたあと」を流す

よく使うもの（フォルダを書いていないものは、リポジトリのルートで流す）：

- 起動：`docker compose up -d --wait`
- テスト：`docker compose run --rm app ./vendor/bin/pest`
- 静的検査：`docker compose run --rm app ./vendor/bin/phpstan analyse --memory-limit=1G`
- 整形の確かめ：`docker compose run --rm app ./vendor/bin/pint --test`
- 管理画面のテスト：`docker compose run --rm admin-app ./vendor/bin/pest`
- 文書の言葉の確かめ：`python3 -I agents/tools/check-words.py`
- 画面のテスト：`frontend/client` で `npm test`（管理画面は `frontend/admin`）
- 会員の側のメンテナンス：入れる・解く・抜け道は docs/commands.md の「会員の側のメンテナンス」

## 開発ルールの適用

### 作業前に読むルール

[agents/README.md](agents/README.md) で対象に合うルールを選ぶ。複数該当したらすべて読む。変更に関係する仕様と既存コードを確認し、変更の範囲を決める。

| 作業 | 読むルール |
| --- | --- |
| バックエンドの実装・設計の変更 | [architecture-backend.md](agents/rules/architecture-backend.md) |
| 画面の実装・設計の変更 | [architecture-frontend.md](agents/rules/architecture-frontend.md) |
| 振る舞いの変更・テストの追加 | [testing.md](agents/rules/testing.md)・[testing-style.md](agents/rules/testing-style.md)（書き方） |
| 構造化ログの実装・変更 | [logging.md](agents/rules/logging.md) |
| PHP のコードを書く・変える | [quality-types.md](agents/rules/quality-types.md)・[quality-php.md](agents/rules/quality-php.md) |
| 画面のコードを書く・変える | [quality-frontend.md](agents/rules/quality-frontend.md) |
| DB・マイグレーションの作成・変更 | [database.md](agents/rules/database.md) |
| ルール・スキル・チケット・議事録・PR の文を書く | [writing.md](agents/rules/writing.md) |

レビューは [review](agents/skills/review/SKILL.md) の手順で行う。矛盾する指示や未確定の仕様は、該当箇所を示して確認する。

### 作業の流れ

**このブランチ（`refactored-repo` とそこから切ったブランチ）では、[docs/process.md](docs/process.md) の開発サイクルで進める。**

- 次のことは、すべて process.md を正とする
  - 役（ビジネス側・PM・プロジェクトリーダー・実装の AI・レビュー役・人）
  - チケットの種類とボード（Project「matching-db-study 改訂版」）
  - 段階（なぜ → 何を → どう → チケット → 実装 → コードの解説 → PR レビュー → 理解度チェック → リリース → 振り返り）
  - 割り込みの出来事・人からの提案
- スキルは `pm`・`tech-lead`・`ticket`・`implement`・`code-walkthrough`・`pr-review`・`release`・`incident`・`proposal`（[agents/skills/README.md](agents/skills/README.md)）
- 実装は AI が受け持ち、人がメソッドとディレクトリの設計を説明できるまで解説する
- マイルストーンは使わず、ボードの Cycle で区切る
- このブランチで AGENTS.md・スキル・サブエージェントを直してよい（main を取り込んでぶつかったら、このブランチの書き方を優先する）

下の1〜5は、レガシー版（`legacy-repo`）の進め方。改訂版では使わない。

1. 一歩（機能）ごとに、[issue-plan](agents/skills/issue-plan/SKILL.md) で親 Issue と子 Issue を作る
   - 子 Issue は、DB・テーブル設計／バックエンド API／フロントエンド
   - マイルストーンと Project「matching-db-study」につなぐ
   - 表はその機能に必要なものだけ作る
   - 入る前に要件（[docs/requirements/](docs/requirements/)）を質問しながら決め、[explain-step](agents/skills/explain-step/SKILL.md) で解説と図を作る
   - 「実装して」と言われるまで実装しない
2. 最初の範囲（[background.md](agents/background.md) の「最初の範囲」）は、`legacy-repo` で**レガシーコードとして作り切る**（Fat Controller・テストなし）
   - 子 Issue 1つにブランチ1つ（`legacy/<子 Issue の番号>-<名前>`）と PR 1つ（`legacy-repo` へ）
   - 順番は DB → API → フロント
   - **API の子 Issue では、先に [docs/api/](docs/api/README.md) のその一歩のファイルに設計（入力・応答・失敗・流れる SQL の目安）を書き、確かめてもらってから実装する**
   - PR の行き先が既定のブランチでないので、マージのあとに子 Issue を手で閉じる。子がすべて閉じたら親を閉じる
   - 機能ができたら [explain-change](agents/skills/explain-change/SKILL.md) で 9-1・9-2（レガシー版と、測った問題）を記録する
3. 作り切ったら、測った問題ごとに、改善の親 Issue と子 Issue を issue-plan で立て、`refactored-repo` で直す
   - 親 Issue には、`.github/ISSUE_TEMPLATE/parent.md` の「改善のときだけ」を書く
   - 子 Issue の最初は、必ず「今の動きを確かめるテスト」
   - ブランチは `refactor/<子 Issue の番号>-<名前>`
   - **今の動きを確かめるテストを足す（要件 ID に対応させる）→ 直す → もう一度測る** の順に進める
   - explain-change で 9-3・9-4 を記録し、[docs/decisions.md](docs/decisions.md) に1行足す
   - 00（環境）・05b は、レガシー版と改善版に分けなくてよい（画面も 03b からレガシー版と改善版に分ける。[docs/frontend.md](docs/frontend.md)）
4. 区切りごとに、[review](agents/skills/review/SKILL.md) の手順で見直す（実装の会話を持たないサブエージェントに、差分と確かめたいことを渡す）
5. コミット・push・Issue・PR の作成は、頼まれたときだけ行う。コミットの前には、下の「コミットの前に」で止まる

### コミットの前に（2026-11-18 から）

コミットの前に、人が差分を見て判断する。AI は、ファイルを書き換えたら、そこで止まる。

1. 見せるもの
   - 変えたファイルごとの表（ファイル・何を・なぜ）
   - `git diff --stat`
   - 全文の見方：`! git diff`（VS Code のソース管理でも見られる）。新しいファイルは、`git add -N <ファイル>` で `git diff` に出るようにしてから止まる
   - 確かめた結果（テスト・静的検査）と、確かめていないこと
2. 人が OK と言うまで、`git add`（`-N` を除く）・`git commit`・`git push`・PR の作成・取り込みをしない
3. OK は、そのとき見せた差分にだけ当てはまる。そのあとに変えたもの（レビューの直し・解説の追記を含む）は、また見せる
4. 機械でも止める：`.claude/settings.json` の `permissions.ask` で、`git commit` と `git push` は毎回、許可の確認が出る

改善の段階（`refactored-repo`）では、チケットを実装する前に、人が直す課題を理解する（`understand-problem`。docs/process.md の4章）

### 依頼の範囲

- 頼まれた範囲だけを変更する。気づいた改善や別の不具合は手を付けず、報告に挙げる
- 業務で分からないことを題材にするときは、実務のコード・プロダクト名・社名・お客さまのデータを持ち込まない。仕組みだけを、自分で作った例で再現する
- 取り消せる細かな判断は妥当な仮定を置いて進め、仕様・データ・本番環境に関わる判断は確認する
- 返事がないことを承認とみなさない
- コミット・push・Issue・PR の作成は、頼まれたときだけ行う
- 秘密の値のファイル（`.env` など）を読まない。値をログ・エラー・テストの出力に出さない。見本の `.env.example` は読んでよい

### 応答と報告

- 結論から端的に答える。前置き・繰り返し・求められていない補足を省き、できるだけ短い文章で返す。判断に必要な根拠と未確認の事項は省かない。返事は日本語で書く
- 変更内容、実行した検証と結果、未検証の範囲を報告する。実行していないテストを通過扱いにしない
- 返事・チケット・PR・議事録・ルールの文は、[writing.md](agents/rules/writing.md) の書き方と言葉で書く。たとえや、このリポジトリだけで通じる言い方を新しく作らない。新しい言葉が要るときは、先に `writing.md` の表（業務の言葉なら `docs/glossary.md`）に足す
