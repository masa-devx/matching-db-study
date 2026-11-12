# matching-db-study

マッチングアプリ（会員・いいね・マッチ・メッセージ・有料プラン）を題材に、テーブル設計・JOIN・中間テーブル・インデックス・同時更新を、作って確かめる学習用のリポジトリ。実在のサービスのコード・名前・データは使わない。

**新しい会話では、最初に [agents/background.md](agents/background.md)（背景・決めたこと・まだ決めていないこと・参考にするノート）を読む。**

AI（Claude Code・Codex）が最初に読む地図。`CLAUDE.md` はこのファイルへのリンク。学習用。何が分からないか・何を確かめるかは、決まったらここに書く。

## 技術スタック

版は `mise.toml` とロックファイル（`backend/composer.lock`・`frontend/package-lock.json`）を正とする。「入れたときの最新」と書いたものは、入れたあとにロックファイルの版を書く。

| 種類 | 使うもの | 版 | 選んだ理由（短く） |
| --- | --- | --- | --- |
| 言語・実行環境 | PHP（Docker の `app`）・Node（手元・mise。03b から）・Docker | PHP 8.5・Node 26.13.0 | PHP と DB を Docker にそろえ、だれの PC でも同じ版で動かす（D-011） |
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
| compose.yaml | PHP（`app`）・PostgreSQL（開発用とテスト用）・Mailpit |
| docker/ | コンテナの作り方（`php/Dockerfile`）と、DB を最初に作る SQL（`db/init/`） |
| docs/ | 何を作るか（product.md・requirements/）と、なぜそうしたか（decisions.md）。目次は docs/README.md |
| explanations/ | 一歩ごとの解説と図（HTML）。目次は index.html、ひな形は _template.html |
| agents/ | 開発ルール（rules/）・手順（skills/） |
| .claude/ | Claude Code 向けの権限・フック・レビュー役。rules・skills は agents/ へのリンク |
| .agents/ | Codex 向け。skills は agents/skills へのリンク |

## 主要コマンド

実行場所・コマンド・必要な設定をまとめる。既存の設定ファイルや README が正本の場合は、該当箇所へリンクする。動くと確かめたコマンドだけを書く。

| 操作 | 実行場所 | コマンド・参照先 | 前提条件 | 使わないもの（理由） |
| --- | --- | --- | --- | --- |
| 道具の版をそろえる | リポジトリのルート | `mise install` | mise | nodenv・nvm・Volta（mise に一本化したため） |
| 解説を見る | claude.ai | AI が Artifact に載せたリンク（一覧は `agents/notes.local.md`）。手元で見るなら、リポジトリのルートで `python3 -m http.server 8765 -d explanations` → `http://localhost:8765/` | claude.ai のアカウント | `file://` で直接開く（ブラウザによって Mermaid の読み込みが止まるため） |
| 解説を Artifact に載せる形に写す | リポジトリのルート | `python3 -I explanations/tools/to-artifact.py <元の HTML> <会話の作業用フォルダ>/artifacts/<ファイル名>` | python3 | 元の HTML をそのまま載せる（骨組みのタグと Mermaid の script が二重になるため） |
| セットアップ | リポジトリのルート | ① `docker compose build app` ② `docker compose up -d --wait` ③ `docker compose run --rm app composer install` ④（初めての PC だけ・人が実行）`cp backend/.env.example backend/.env` → `docker compose run --rm app php artisan key:generate` ⑤ `docker compose run --rm app php artisan migrate` | Docker。④の秘密の値のファイルは、AI は作らない・読まない | 手元の PHP・Composer（D-011。版と拡張がそろわないため）。`php.new` のスクリプト・Laravel Boost（`backend/` に AI 向けの指示が置かれるが、方針と合わないので入れない） |
| 起動 | リポジトリのルート | `docker compose up -d --wait` → API は `http://127.0.0.1:8000/api/health`、メールの受信箱は `http://127.0.0.1:58025`。止めるのは `docker compose stop` | Docker | `php artisan serve`（compose の環境変数を子のプロセスに渡さず、`.env` の SQLite につながるため）。`docker compose down -v`（DB の中身も消える。作り直すときだけ） |
| テスト | リポジトリのルート | `docker compose run --rm app ./vendor/bin/pest`（全体）・`docker compose run --rm app ./vendor/bin/pest tests/Feature/HealthTest.php`（対象別） | db が起動している。テスト用の DB `matching_test` に流れる（違えば `tests/TestCase.php` が止める） | SQLite のメモリ DB（D-010）。手元の PHP で `php artisan test`（手元に PHP がない） |
| 静的検査・整形 | リポジトリのルート | `docker compose run --rm app ./vendor/bin/phpstan analyse --memory-limit=1G`（Larastan・レベル 5）・`docker compose run --rm app ./vendor/bin/pint --test`（整形の確かめ）・`docker compose run --rm app ./vendor/bin/pint`（整形する） | なし | ― |
| 流れた SQL を見る | リポジトリのルート | `tail -n 20 backend/storage/logs/sql-$(date -u +%F).log`（日付は UTC） | app が起動していて、`APP_ENV=local` | `php artisan db:show`・`docker compose config`（接続の設定や秘密の値をまとめて出すため、AI は使わない） |
| DB に入る | リポジトリのルート | `docker compose exec db psql -U postgres -d matching_dev`（テスト用は `-d matching_test`） | db が起動している | ― |
| ブランチを切り替えたあと | リポジトリのルート | `docker compose restart app` | ― | 切り替え先に `backend/` がないと、動いているサーバーのフォルダが一度消えて、API がエラーを返し続けるため |
| CI | GitHub（PR と push で自動） | `.github/workflows/backend.yml`（`legacy-repo` にある）。中身と決まりは [docs/ci.md](docs/ci.md)。結果は `gh pr checks <番号>` で見る | ― | CI の設定を緩めて通す（レベルを下げる・対象から外す） |
| エディタの補完のファイルを作る | リポジトリのルート | `docker compose run --rm app php artisan ide-helper:models --nowrite`（`backend/_ide_helper_models.php` に書き出す。git には入らない） | db が起動している（列を DB から読む） | `--write`（Model のファイルに `@property` を書き込む。長くなり、マイグレーションとずれるため。quality-types.md） |
| ビルド | ― | 対象外（デプロイしない。画面は 03b で決める） | ― | ― |

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
| PHP のコードを書く・変える | [quality-types.md](agents/rules/quality-types.md) |
| DB・マイグレーションの作成・変更 | [database.md](agents/rules/database.md) |

レビューは [review](agents/skills/review/SKILL.md) の手順で行う。矛盾する指示や未確定の仕様は、該当箇所を示して確認する。

### 作業の流れ

1. 一歩（機能）ごとに、[issue-plan](agents/skills/issue-plan/SKILL.md) で親 Issue と子 Issue（DB・テーブル設計／バックエンド API／フロントエンド）を作り、マイルストーンと Project「matching-db-study」につなぐ。表はその機能に必要なものだけ作る。入る前に要件（[docs/requirements/](docs/requirements/)）を質問しながら決め、[explain-step](agents/skills/explain-step/SKILL.md) で解説と図を作る。「実装して」と言われるまで実装しない
2. 最初の範囲（[background.md](agents/background.md) の「最初の範囲」）は、`legacy-repo` で**レガシーコードとして作り切る**（Fat Controller・テストなし）。子 Issue 1つにブランチ1つ（`legacy/<子 Issue の番号>-<名前>`）と PR 1つ（`legacy-repo` へ）。順番は DB → API → フロント。**API の子 Issue では、先に [docs/api/](docs/api/README.md) のその一歩のファイルに設計（入力・応答・失敗・流れる SQL の目安）を書き、確かめてもらってから実装する**。PR の行き先が既定のブランチでないので、マージのあとに子 Issue を手で閉じ、子がすべて閉じたら親を閉じる。機能ができたら [explain-change](agents/skills/explain-change/SKILL.md) で 9-1・9-2（レガシー版と、測った問題）を記録する
3. 作り切ったら、測った問題ごとに改善の親 Issue（`.github/ISSUE_TEMPLATE/parent.md` の「改善のときだけ」を書く）と子 Issue（最初は必ず「固定するテスト」）を issue-plan で立て、`refactored-repo` で直す。ブランチは `refactor/<子 Issue の番号>-<名前>`。**今の振る舞いを固定するテストを足す（要件 ID に対応させる）→ 直す → もう一度測る** の順に進め、explain-change で 9-3・9-4 を記録し、[docs/decisions.md](docs/decisions.md) に1行足す。00（環境）・05b は、レガシー版と直した版に分けなくてよい（画面も 03b からレガシー版と直した版に分ける。[docs/frontend.md](docs/frontend.md)）
4. 区切りごとに、[review](agents/skills/review/SKILL.md) の手順で見直す（実装の会話を持たないサブエージェントに、差分と確かめたいことを渡す）
5. コミット・push・Issue・PR の作成は、頼まれたときだけ行う

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
