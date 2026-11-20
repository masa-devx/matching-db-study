# CI（GitHub Actions）

PR を出したとき・ブランチに push したときに、GitHub の上で、整形の確かめ・静的解析・テストを動かす（D-017）。手元で動かすコマンドは AGENTS.md の「主要コマンド」と同じものにする。

## 動かすもの

| ジョブ | コマンド（`backend/client/` で） | 落ちる条件 |
| --- | --- | --- |
| 整形の確かめ | `./vendor/bin/pint --test` | 整形されていないファイルがある |
| 静的解析 | `./vendor/bin/phpstan analyse --memory-limit=1G` | PHPStan（Larastan）の指摘がある |
| テスト | `./vendor/bin/pest` | テストが1つでも落ちる |

静的解析のレベルは、ブランチの `phpstan.neon` に従う（[quality-types.md](../agents/rules/quality-types.md)）。

3つは別々のジョブにして、どれが落ちたかを PR の画面で分かるようにする。

管理画面の API（`backend/admin/`）には、別のワークフロー（`.github/workflows/admin-backend.yml`）がある。

- ジョブは同じ3つ（整形の確かめ・静的解析・テスト。コマンドは `backend/admin/` で流す）
- テストは、#105 で足した
  - テスト用の DB は `matching_admin_test`
  - 表は、会員の側のマイグレーション（`backend/client/database/migrations`）で作る
  - そのため、`backend/admin/**` のほかに、`backend/client/database/migrations/**` が変わったときも動かす
- アーキテクチャのテストは、会員の側のファイル（正本）と同じかを比べる。そのため、`backend/client/tests/Arch/**` が変わったときも動かす（#106）

文書には、別のワークフロー（`.github/workflows/docs.yml`。`refactored-repo` とそこから切ったブランチで動く）がある。

| ジョブ | コマンド（リポジトリのルートで） | 落ちる条件 |
| --- | --- | --- |
| 文書の言葉 | `python3 -I agents/tools/check-words.py` | 使わないと決めた言い方がある |

文書の言葉のジョブについて。

- 使わないと決めた言い方は、[writing.md](../agents/rules/writing.md) にある
- 見るファイルは、`docs/`・`agents/`・`.claude/agents/`・`.github/`・AGENTS.md
- 機械で見るのは、意味が1つに決まる言葉だけ
- 「守る」「入口」「まとまり」のように文脈で決まる言葉は、レビュー役が見る

## 動かすとき

| きっかけ | 対象のブランチ |
| --- | --- |
| PR | 行き先が `legacy-repo`・`refactored-repo` のもの |
| push | 下に書くブランチ |

push で動かすブランチ。

- `legacy-repo`・`refactored-repo`
- `legacy/**`・`refactor/**`・`feature/**`・`fix/**`・`hotfix/**`・`chore/**`（改訂版のブランチ名は docs/process.md の2章）
- `spike/**`・`harness/**` は外す（取り込まない・コードを変えないため）

`backend/**`・`compose.yaml`・`.github/workflows/backend.yml` のどれかが変わったときだけ動かす（文書だけの変更では動かさない）。

## 動かす場所

### 置き場所

- `.github/workflows/backend.yml`
- **`legacy-repo` に置く**（`main` には `backend/client/` がないので、`main` に置くと動かせない）
- `refactored-repo` には取り込みで入る

### 実行する機械

- GitHub の Ubuntu

### PHP

- `shivammathur/setup-php` で PHP 8.5（手元の Docker と同じ版）と、`pdo_pgsql`・`intl`・`zip` を入れる
- Docker のイメージは作り直さない（遅いため）

### Composer

- `composer install` を、`composer.lock` のとおりに
- `vendor/` は、`composer.lock` が変わらなければ、前の結果を使い回す（キャッシュ）

### DB

- テストのジョブだけ、GitHub の上に PostgreSQL 18.6 を立てる
- DB の名前は `matching_test`（`phpunit.xml` と同じ）
- つなぎ先（ホスト・ポート・ユーザー）は環境変数で渡す

### 秘密の値

- 使わない
- テストに要るアプリの鍵は、CI の中でその場で作る（`php artisan key:generate`）
- 本物の秘密の値を GitHub の Secrets に入れない

## マージの決まり

- **CI が通っていない PR は、マージしない**（「確かめが通ったら聞かずにマージ」の確かめに、CI が緑であることを足す）
- CI が落ちたら、原因を直してから push し直す。CI の設定（レベル・対象のファイル）を緩めて通さない
- GitHub のブランチの保護（CI が通らないとマージのボタンが押せない設定）は、使うかを別に決める

## 決まっていないこと

- GitHub のブランチの保護を使うか
- 画面（03b）の CI（Vitest・ESLint）。03b で足す
