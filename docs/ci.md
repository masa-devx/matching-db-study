# CI（GitHub Actions）

PR を出したとき・ブランチに push したときに、GitHub の上で、整形の確かめ・静的解析・テストを動かす（D-017）。手元で動かすコマンドは AGENTS.md の「主要コマンド」と同じものにする。

## 動かすもの

| ジョブ | コマンド（`backend/` で） | 落ちる条件 |
| --- | --- | --- |
| 整形の確かめ | `./vendor/bin/pint --test` | 整形されていないファイルがある |
| 静的解析 | `./vendor/bin/phpstan analyse --memory-limit=1G` | PHPStan（Larastan）の指摘がある。レベルはブランチの `phpstan.neon` に従う（[quality-types.md](../agents/rules/quality-types.md)） |
| テスト | `./vendor/bin/pest` | テストが1つでも落ちる |

3つは別々のジョブにして、どれが落ちたかを PR の画面で分かるようにする。

## 動かすとき

| きっかけ | 対象のブランチ |
| --- | --- |
| PR | 行き先が `legacy-repo`・`refactored-repo` のもの |
| push | `legacy-repo`・`refactored-repo`・`legacy/**`・`refactor/**` |

`backend/**`・`compose.yaml`・`.github/workflows/backend.yml` のどれかが変わったときだけ動かす（文書だけの変更では動かさない）。

## 動かす場所

| もの | 決まり |
| --- | --- |
| 置き場所 | `.github/workflows/backend.yml`。**`legacy-repo` に置く**（`main` には `backend/` がないので、`main` に置くと動かせない）。`refactored-repo` には取り込みで入る |
| 実行する機械 | GitHub の Ubuntu |
| PHP | `shivammathur/setup-php` で PHP 8.5（手元の Docker と同じ版）と、`pdo_pgsql`・`intl`・`zip` を入れる。Docker のイメージは作り直さない（遅いため） |
| Composer | `composer install` を、`composer.lock` のとおりに。`vendor/` は、`composer.lock` が変わらなければ、前の結果を使い回す（キャッシュ） |
| DB | テストのジョブだけ、GitHub の上に PostgreSQL 18.6 を立てる。DB の名前は `matching_test`（`phpunit.xml` と同じ）。つなぎ先（ホスト・ポート・ユーザー）は環境変数で渡す |
| 秘密の値 | 使わない。テストに要るアプリの鍵は、CI の中でその場で作る（`php artisan key:generate`）。本物の秘密の値を GitHub の Secrets に入れない |

## マージの決まり

- **CI が通っていない PR は、マージしない**（「確かめが通ったら聞かずにマージ」の確かめに、CI が緑であることを足す）
- CI が落ちたら、原因を直してから push し直す。CI の設定（レベル・対象のファイル）を緩めて通さない
- GitHub のブランチの保護（CI が通らないとマージのボタンが押せない設定）は、使うかを別に決める

## 決まっていないこと

- GitHub のブランチの保護を使うか
- 画面（03b）の CI（Vitest・ESLint）。03b で足す
