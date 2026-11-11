# matching-db-study

マッチングアプリ（会員・いいね・マッチ・メッセージ・有料プラン）を題材に、テーブル設計・JOIN・中間テーブル・インデックス・同時更新を、作って確かめる学習用のリポジトリ。実在のサービスのコード・名前・データは使わない。

**新しい会話では、最初に [agents/background.md](agents/background.md)（背景・決めたこと・まだ決めていないこと・参考にするノート）を読む。**

AI（Claude Code・Codex）が最初に読む地図。`CLAUDE.md` はこのファイルへのリンク。学習用。何が分からないか・何を確かめるかは、決まったらここに書く。

## 技術スタック

版は `mise.toml` とロックファイル（`backend/composer.lock`・`frontend/package-lock.json`）を正とする。「入れたときの最新」と書いたものは、入れたあとにロックファイルの版を書く。

| 種類 | 使うもの | 版 | 選んだ理由（短く） |
| --- | --- | --- | --- |
| 言語・実行環境 | PHP（手元・mise）・Node（手元・mise）・Docker | PHP 8.5・Node 26.13.0 | 手元で動かすとコマンドが速い。DB だけ Docker |
| フレームワーク | Laravel（API）・React＋TypeScript＋Vite（03b から） | 入れたときの最新・React 19 | 仕事で使ってきた形で、Eloquent の裏の SQL を確かめる |
| DB・ORM | PostgreSQL（Docker compose）・Eloquent | 18・Laravel と同じ | 流れた SQL は `DB::listen` でログに出し、`->explain()` で実行計画を見る |
| 状態の管理（画面） | React の Context → Zustand（05b から） | React と同じ・入れたときの最新 | 標準の限界を体験してから移す。TanStack Query・OpenAPI は使わない |
| テスト | Pest（バックエンド。テスト用の PostgreSQL に対して実行）・Vitest（画面） | 入れたときの最新 | SQLite ではロックや UNIQUE の動きが違うため、本物の PostgreSQL で確かめる |
| 静的検査・整形 | Larastan（PHPStan）・Pint・ESLint・Prettier | 入れたときの最新 | 型の抜けと書き方のずれを機械で見つける |
| デプロイ先 | なし（手元だけ） | ― | 学習用 |

ここには結論だけを書く。

## ディレクトリ構成

置き場所の判断基準は [architecture.md](agents/rules/architecture.md) を正とする。ここには、どこに何があるかの索引だけを書く（中身の説明は書かない。コードを読めばわかり、すぐ古くなる）。

| パス | 責務 |
| --- | --- |
| backend/ | Laravel（API）。Laravel の標準の形のまま（`app/Models`・`app/Http/Controllers`・`app/Http/Resources`・`database/migrations`） |
| backend/tests/ | Pest のテスト。`Unit/`（ロジック）・`Feature/`（DB と API をまたぐもの） |
| frontend/ | React（03b から）。テストは `src/**/*.test.tsx` |
| compose.yaml | PostgreSQL（開発用とテスト用） |
| explanations/ | 一歩ごとの解説と図（HTML）。目次は index.html、ひな形は _template.html |
| agents/ | 開発ルール（rules/）・手順（skills/） |
| .claude/ | Claude Code 向けの権限・フック・レビュー役。rules・skills は agents/ へのリンク |
| .agents/ | Codex 向け。skills は agents/skills へのリンク |

## 主要コマンド

実行場所・コマンド・必要な設定をまとめる。既存の設定ファイルや README が正本の場合は、該当箇所へリンクする。動くと確かめたコマンドだけを書く。

| 操作 | 実行場所 | コマンド・参照先 | 前提条件 | 使わないもの（理由） |
| --- | --- | --- | --- | --- |
| 道具の版をそろえる | リポジトリのルート | `mise install` | mise | nodenv・nvm・Volta（mise に一本化したため） |
| 解説を見る | リポジトリのルート | `python3 -m http.server 8765 -d explanations` → ブラウザで `http://localhost:8765/` | python3 | `file://` で直接開く（ブラウザによって Mermaid の読み込みが止まるため） |
| セットアップ | 【記入】 | 【記入】 | 【必要な環境と設定】 | 【記入】 |
| 起動 | 【記入】 | 【記入】 | 【記入】 | 【記入】 |
| テスト | 【記入】 | 【全体・対象別の実行方法】 | 【接続先・データなど】 | 【記入】 |
| 静的検査 | 【記入】 | 【記入】 | 【記入】 | 【例：`npx eslint` を直接使わない（設定と対象がずれるため）】 |
| ビルド | 【記入】 | 【対象外ならその旨】 | 【記入】 | 【記入】 |

> 記入例（テスト）：リポジトリのルート｜`bun test`（全体）・`bun test tests/unit/books`（対象別）｜DB が起動している（`docker compose up -d db`）｜`npx vitest`（設定と版がずれるため）

未記入のコマンドは推測して実行しない。必要な操作について確認する。

よく使う確認のコマンド（テスト・静的検査）が決まったら、`.claude/settings.json` の `permissions.allow` に足す（記入例: `"Bash(bun test:*)"`）。足すのは、何度実行しても何も壊さないコマンドだけにする。

## 開発ルールの適用

### 作業前に読むルール

[agents/README.md](agents/README.md) で対象に合うルールを選ぶ。複数該当したらすべて読む。変更に関係する仕様と既存コードを確認し、変更の範囲を決める。

| 作業 | 読むルール |
| --- | --- |
| 実装・設計の変更 | [architecture.md](agents/rules/architecture.md) |
| 振る舞いの変更・テストの追加 | [testing.md](agents/rules/testing.md) |
| 構造化ログの実装・変更 | [logging.md](agents/rules/logging.md) |
| DB・マイグレーションの作成・変更 | [database.md](agents/rules/database.md) |

レビューは [review](agents/skills/review/SKILL.md) の手順で行う。矛盾する指示や未確定の仕様は、該当箇所を示して確認する。

### 作業の流れ

1. 一歩ずつ進める。新しい一歩に入る前に、[explain-step](agents/skills/explain-step/SKILL.md) で解説と図を作り、「実装して」と言われるまで実装しない
2. 一歩の中は、**素朴に作る → 問題を測る → 今の振る舞いを固定するテストを足す → 直す → もう一度測る** の順に進める。素朴に作る段階ではテストを書かない。直す前に必ずテストを足し、直したあとも通ることを確かめる。00（環境）・03b・05b（画面）は、この形を取らなくてよい
3. 素朴な版を作ったあとと、直したあとの2回、[explain-change](agents/skills/explain-change/SKILL.md) で書いたコードを解説し、その一歩のページに記録する
4. 区切りごとに、[review](agents/skills/review/SKILL.md) の手順で見直す（実装の会話を持たないサブエージェントに、差分と確かめたいことを渡す）
5. コミット・push は、頼まれたときだけ行う

### 依頼の範囲

- 頼まれた範囲だけを変更する。気づいた改善や別の不具合は手を付けず、報告に挙げる
- 業務で分からないことを題材にするときは、実務のコード・プロダクト名・社名・お客さまのデータを持ち込まない。仕組みだけを、自分で作った例で再現する
- 取り消せる細かな判断は妥当な仮定を置いて進め、仕様・データ・本番環境に関わる判断は確認する
- 返事がないことを承認とみなさない
- コミット・push・PR の作成は、頼まれたときだけ行う
- 秘密の値のファイル（`.env` など）を読まない。値をログ・エラー・テストの出力に出さない。見本の `.env.example` は読んでよい

### 応答と報告

- 結論から端的に答える。前置き・繰り返し・求められていない補足を省き、できるだけ短い文章で返す。判断に必要な根拠と未確認の事項は省かない。返事は日本語で書く
- 変更内容、実行した検証と結果、未検証の範囲を報告する。実行していないテストを通過扱いにしない
