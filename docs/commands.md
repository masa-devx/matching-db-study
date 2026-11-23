# 主要コマンド

実行場所・コマンド・前提・使わないもの（理由）を、操作ごとにまとめる。既存の設定ファイルや README が正本の場合は、該当箇所へリンクする。動くと確かめたコマンドだけを書く。

AI が守る決まり（推測で流さない・許可の一覧に足す基準）は、[AGENTS.md](../AGENTS.md) の「主要コマンド」に書く。

## 道具の版をそろえる

- 実行場所：リポジトリのルート
- コマンド：`mise install`
- 前提：mise
- 使わないもの：nodenv・nvm・Volta（mise に一本化したため）

## 解説を見る

- 実行場所：リポジトリのルート
- コマンド：`python3 -m http.server 8765 -d explanations` → `http://localhost:8765/`
- 前提：python3。Mermaid を CDN から読むので、インターネットにつながっていること
- 使わないもの：
  - `file://` で直接開く（ブラウザによって Mermaid の読み込みが止まるため）
  - claude.ai の Artifact に載せる（2026-11-15 から、解説はリポジトリの HTML で管理する。#111。前に載せる形に変えていた `explanations/tools/to-artifact.py` は使わない）

## Eloquent が発行する SQL を集める

- 実行場所：リポジトリのルート
- コマンド：`cat explanations/tools/collect-sql.tinker 呼び出しの.txt | docker compose exec -T app php artisan tinker | grep '^> *@@\|^@@'`
  - 呼び出しの書き方は、ファイルの先頭に書いてある
  - `$sql` は流す。`$dry` は `DB::pretend()` で流さない
- 前提：app と db が起動している
- 使わないもの
  - 推測で SQL を書く
  - 書き込みを `$sql` で流す（開発用の DB が変わるため）

## レガシー版と改善版の SQL を並べる節を作る

- 実行場所：リポジトリのルート
- コマンド：`python3 -I explanations/tools/compare-block.py explanations/sql/<番号>-<名前>.json explanations/<番号>-<名前>.html`
  - ページの `<!-- compare: … -->` の印の間を書き換える
- 前提：python3
- 使わないもの：並べる HTML を手で書く（エスケープの漏れと形のずれが起きるため）

## セットアップ

- 実行場所：リポジトリのルート
- 前提：Docker
- コマンド（順に流す）
  1. `docker compose build app`
  2. `docker compose up -d --wait`
  3. `docker compose run --rm app composer install`
  4. （初めての PC だけ・人が実行）`cp backend/client/.env.example backend/client/.env` → `docker compose run --rm app php artisan key:generate`
  5. `docker compose run --rm app php artisan migrate`
- 4の秘密の値のファイルは、AI は作らない・読まない
- 使わないもの
  - 手元の PHP・Composer（D-011。版と拡張がそろわないため）
  - `php.new` のスクリプト・Laravel Boost（`backend/client/` に AI 向けの指示が置かれるが、方針と合わないので入れない）

## 起動

- 実行場所：リポジトリのルート
- コマンド：`docker compose up -d --wait`
  - API は `http://127.0.0.1:8000/up`（`200` なら動いている。Laravel にもとからある口で、DB につながるかは見ない）
  - DB につながるかは `docker compose run --rm app php artisan migrate:status`（マイグレーションの一覧が `Ran` で出れば、つながっていて、流してある。接続の設定は出ない。2026-11-22 に確かめた）
  - メールの受信箱は `http://127.0.0.1:58025`
  - 止めるのは `docker compose stop`
- 前提：Docker
- 使わないもの
  - `php artisan serve`（compose の環境変数を子のプロセスに渡さず、`.env` の SQLite につながるため）
  - `docker compose down -v`（DB の中身も消える。作り直すときだけ）

## 画面を起動

- 実行場所：`frontend/client/`
- コマンド：初めてのときは `npm install` → `npm run dev` → `http://localhost:5173/`
- API の送り先は `VITE_API_URL`（既定は `http://localhost:8000`。前の `127.0.0.1` は、セッションの Cookie が届かなくなるので使わない）
  - 変えるときは `.env.example` をコピーして `.env.local` を作る
- 前提：`mise install` 済み・API が起動している
- 使わないもの：`http://127.0.0.1:5173` で開く（`localhost` とは別のオリジンになり、改善版で Cookie が届かなくなるため）

## 画面のテスト・置き場の決まり

- 実行場所：`frontend/client/`（管理画面は `frontend/admin/`）
- コマンド
  - テスト：`npm test`（Vitest。1回流して終わる）。直しながら流し続けるなら `npm run test:watch`
  - 置き場の決まり：`npm run lint:rules`（会員の画面だけ。`architecture-frontend.md` の3章を書いた Biome の規則を全体に流し、改訂版の置き場（`src/app`・`src/shared`・`src/features`・`src/api`）とテストの置き場（`tests`）では `recommended` の規則と `overrides` で足した規則を、警告も誤りとして見る。`quality-frontend.md`）
- 前提：`npm install` 済み
- テストは `tests/` に置く（`integration/<機能>/`・`api/`・`unit/`。`architecture-frontend.md` の7章）。対象は `tests/**/*.test.ts(x)`。画面は jsdom の上で描く（`vite.config.ts` の `test`）
  - 1つのファイルだけ：`npx vitest run tests/api/client.test.ts`
- API は MSW で偽物にする（`tests/support/server.ts`・`tests/support/handlers/`）。本物の API には送らないので、API が止まっていても流せる
- テストの型は `npm run build`（`tsc -b`。`tsconfig.test.json`）で一緒に確かめる
- 使わないもの：全体の lint（`npm run lint`）で置き場の決まりを確かめる（レガシー版の前からの指摘が混ざり、見分けにくいため）

## 画面の E2E

- 実行場所：`frontend/client/`
- コマンド：`npm run test:e2e`（Playwright。`tests/e2e/` の主な流れを、chromium で流す）
  - 1つの流れだけ：`npx playwright test tests/e2e/login.spec.ts`
  - 落ちたときの記録（`test-results/`）を見る：`npx playwright show-trace <test-results の中の trace.zip>`
- 前提
  - 初めてのときは `npm install` → `npx playwright install chromium`
  - リポジトリのルートで `docker compose up -d --wait`（API `http://localhost:8000`・メールの受信箱 `http://127.0.0.1:58025`）
  - 開発用の DB に、検索の試しの会員のシード（`docker compose exec app php artisan db:seed --class=SearchMembersSeeder`）を入れてある
  - 画面（`npm run dev`）は、動いていなければ Playwright が起こす（動いていれば、それを使う）
- 書き込むもの：開発用の DB（`matching_dev`）に、流すたびに新しい会員（`e2e-…@example.test`）と、その会員のいいね・マッチ・メッセージ・購入が残る。メールの受信箱にも、確認のメールが残る
- 使わないもの
  - メンテナンス（`php artisan down`）を流すこと（ほかの流れが全部 503 になる）
  - テスト用の DB（`matching_test`）。API は開発用の DB につながっているため

## 管理画面を起動

- 実行場所：リポジトリのルート（API）・`frontend/admin/`（画面）
- API：`docker compose up -d --wait`（`admin-app`）→ `http://127.0.0.1:8100/api/health`
- 画面：`frontend/admin` で、初めてのときは `npm install` → `npm run dev` → `http://localhost:5174/`
- API の送り先は `VITE_ADMIN_API_URL`（既定は `http://127.0.0.1:8100`）
- 前提：`mise install` 済み
- 使わないもの：管理画面の Laravel で `php artisan migrate` を流す（表の作りは `backend/client/` で流す）

## テスト

- 実行場所：リポジトリのルート
- 全体：`docker compose run --rm app ./vendor/bin/pest`
- 対象別：`docker compose run --rm app ./vendor/bin/pest tests/Feature/HealthTest.php`
- 前提：db が起動している
  - テスト用の DB `matching_test` に流れる（違えば `tests/TestCase.php` が止める）
- 使わないもの
  - SQLite のメモリ DB（D-010）
  - 手元の PHP で `php artisan test`（手元に PHP がない）

## 静的検査・整形

- 実行場所：リポジトリのルート（画面は `frontend/client/`）
- Larastan：`docker compose run --rm app ./vendor/bin/phpstan analyse --memory-limit=1G`
  - レガシー版はレベル 6・改善版は 9（D-016）
- 整形の確かめ：`docker compose run --rm app ./vendor/bin/pint --test`
- 整形する：`docker compose run --rm app ./vendor/bin/pint`
- 画面は `frontend/client/` で流す
  - `npm run lint`（Biome。レガシー版は指摘が残ったまま）
  - `npm run format`（整形する）
- 前提：なし
- 使わないもの：ESLint・Prettier・oxlint（画面は Biome に一本化したため）

## 管理画面のテスト

- 実行場所：リポジトリのルート
- 全体：`docker compose run --rm admin-app ./vendor/bin/pest`
- 対象別：`docker compose run --rm admin-app ./vendor/bin/pest tests/Feature/MemberListTest.php`
- 前提：db が起動している
  - 管理画面のテスト用の DB `matching_admin_test` に流れる（違えば `backend/admin/tests/TestCase.php` が止める）
- **前から DB を作ってある PC では、最初に1回**、次の2つを流す
  - `docker compose exec db psql -U postgres -c "create database matching_admin_test"`
  - `docker compose exec db psql -U postgres -d matching_admin_test -c "create extension if not exists pg_stat_statements"`
  - 新しく作った PC では、`docker/db/init/` が同じことをする
  - 作っていないと、テストが `database "matching_admin_test" does not exist` で落ちる
- 使わないもの
  - 会員の側のテスト用の DB（`matching_test`）を使う（同時に流すと、表の作り直しがぶつかるため）
  - 管理画面にマイグレーションをコピーする（表の作りの正本は、`backend/client/database/migrations` の1か所）

## 管理画面の静的検査・整形

- 実行場所：リポジトリのルート（画面は `frontend/admin`）
- `docker compose run --rm admin-app ./vendor/bin/phpstan analyse --memory-limit=1G`
- `docker compose run --rm admin-app ./vendor/bin/pint --test`
- 画面は `frontend/admin` で `npm run lint`・`npm run build`
- 前提：なし

## 流れた SQL を見る

- 実行場所：リポジトリのルート
- コマンド：`tail -n 20 backend/client/storage/logs/sql-$(date -u +%F).log`（日付は UTC）
- 前提：app が起動していて、`APP_ENV=local`
- 使わないもの：`php artisan db:show`・`docker compose config`（接続の設定や秘密の値をまとめて出すため、AI は使わない）

## 試しのデータを入れる（シーダー）

下のシーダーは、どれもリポジトリのルートで流す。

### 試しの会員を入れる（04）

- コマンド：`docker compose exec app php artisan db:seed --class=SearchMembersSeeder`
  - 会員 2万人。`search00001@example.test`〜・パスワードは `password`
  - 流し直すと入れ直す。約1秒
- 前提：app と db が起動している・`legacy-repo` 系のブランチ
- 使わないもの
  - テスト用の DB に入れる（テストの前提が変わるため）
  - `DatabaseSeeder` から呼ぶ（ふだんのシードでも2万人になるため）

### 試しのメッセージを入れる（05）

- コマンド：`docker compose exec app php artisan db:seed --class=MessagesSeeder`
  - マッチ 1000組・メッセージ 10万件。`search00001` はルーム 100
  - ルームのない前からのマッチにも、ルームを作る
  - 流し直すと入れ直す。約3秒
- 前提：先に「試しの会員を入れる（04）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しのメッセージを Firestore にコピーする（05c）

- コマンド：`docker compose exec app php artisan db:seed --class=FirestoreMessagesSeeder`
  - PostgreSQL のルーム・受信箱・メッセージ 10万件を、Emulator の中身を消してからコピーする。約5秒
  - 中身は `http://localhost:4000/firestore` で見る
- 前提：先に「試しのメッセージを入れる（05）」を流す・`firebase` が起動している
- 使わないもの：本物の Firebase のプロジェクトにつなぐ（`FIREBASE_PROJECT_ID` が `demo-` で始まらなければ、シーダーは止まる）

### 試しのブロックと退会を入れる（06）

- コマンド：`docker compose exec app php artisan db:seed --class=BlocksSeeder`
  - ブロック 3万件・退会した会員 1025人
  - `search00001` について、ブロックした相手・された相手・お互いにブロックした相手・退会したマッチの相手を混ぜる
  - 流し直すと入れ直す。約1秒
- 前提：先に「試しのメッセージを入れる（05）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しの有料会員を入れる（07）

- コマンド：`docker compose exec app php artisan db:seed --class=PaidMembersSeeder`
  - search00301 以降の男性 3000人を、有料にしたことがある会員にする
  - 内訳は、期限の中 1500・もうすぐ切れる 300・期限が過ぎた 1200（`is_paid` は true のまま）
  - 購入 約2万4千件。決まった3人の名前は、流したときに出る
  - `search00001` は無料のまま
  - 流し直すと入れ直す。約2秒
- 前提：先に「試しの会員を入れる（04）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しの保存した検索条件を入れる（04b）

- コマンド：`docker compose exec app php artisan db:seed --class=SearchConditionsSeeder`
  - 試しの会員 1人に 1〜5件・全部で約6万件
  - `search00001` は 4件・`search00002` は 5件（上限）
  - 5件に1件ほど、身長の条件が入る
  - 流し直すと入れ直す。約2秒
- 前提：先に「試しの会員を入れる（04）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しのプロフィールの6項目を入れる（#153）

- コマンド：`docker compose exec app php artisan db:seed --class=ProfileDetailsSeeder`
  - 試しの会員のプロフィールに、体型・お仕事・年収・タバコ・お酒・結婚歴を入れる
  - 項目ごとに、7割ほどが答えた形にする
  - 値は会員の id から決めるので、流し直しても同じ。約0.5秒
- 前提：先に「試しの会員を入れる（04）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）
- `SearchMembersSeeder` を流し直すと6項目が消えるので、そのあとにもう一度流す

### 試しの届いたいいねとスキップを入れる（M3。#184）

- コマンド：`docker compose exec app php artisan db:seed --class=ReceivedLikesSeeder`
  - まだ返事をしていない「届いたいいね」を約2万件
  - 内訳は、`search00001` に 30件・`search00002` に 20件・search00301 以降の 2000人に 5〜15件ずつ
  - スキップを 3万件
  - いいねは、同じ組がもうあれば入れない。約2秒
- 前提：先に「試しの会員を入れる（04）」を流す・`legacy-repo` 系のブランチ
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しの通報を入れる（M7・A7。#201）

- コマンド：`docker compose exec app php artisan db:seed --class=ReportsSeeder`
  - 案件 300：まだ 200・対応中 40・済み 60
  - 通報 約3000件で、3割ほどはメッセージを指す
  - 1つ目の案件は 50人から 50件、2つ目は同じ1人から 10件
  - `search00001` は、通報した側にもされた側にも入れない
  - 流し直すと、`search00001` が通報したもの以外を消して入れ直す。約0.2秒
- 前提：先に「試しのメッセージを入れる（05）」を流す・`migrate` 済み
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ（04 と同じ理由）

### 試しの管理者を入れる（12）

- コマンド：`docker compose exec app php artisan db:seed --class=AdminsSeeder`
  - `owner@admin.example.test`（すべてできる）・`viewer@admin.example.test`（見るだけ）。パスワードは `password`
  - 表の作りは `backend/client` にまとめているので、シーダーもここに置く
  - 流し直すと入れ直す
- 前提：`migrate` 済み
- 使わないもの：テスト用の DB に入れる・`DatabaseSeeder` から呼ぶ

## 会員の側のメンテナンス

手順の正はここ。`backend/client/bootstrap/app.php` のコメントは要点だけなので、直すときはここを先に直す。

- 実行場所：リポジトリのルート
- 前提：会員の認証はセッション（D-027）。メンテナンスに入れると、全員がログアウトする。抜け道は、URL を開いたブラウザだけが通れる

### 1. 入れる

- コマンド：`docker compose exec app php artisan down --with-secret`
  - 抜け道の文字は Laravel に作らせる。自分で決めた文字（`--secret`）は、シェルの履歴に残るので使わない（NFR-MAINT-001）
  - コマンドが、抜け道の URL（`http://localhost:8000/<文字>`）を出す。その出力は、どこにも貼らない
- 起きること
  - 会員の API が、どれも `503`「ただいまメンテナンス中です」になる（FR-MAINT-001）。Laravel の `GET /up` だけは止まらない（Laravel がもとから外している。FR-MAINT-004）
  - 表 `sessions` の行を全部消す（全員をログアウトさせる。FR-MAINT-002）。消した数は、`backend/client/storage/logs/laravel.log` の `maintenance.deleteAllSessions` に出る
  - 管理画面（`admin-app`）は止まらない（別のアプリなので。FR-MAINT-005）
- 「Failed to enter maintenance mode」と出ても、メンテナンスに入っていることがある（Laravel は、メンテナンスに入れてから、セッションを消す）。DB につながらないときに起きる。DB が戻ってから、同じコマンドをもう一度流す（もう一度流すと、セッションを消し直し、抜け道の URL も出る）
- 入れたあと、処理の途中だったリクエストが終わるまで、数秒待ってから作業を始める

### 2. 確かめる

- 今の状態：`backend/client/storage/framework/down` があれば、メンテナンス中（`docker compose exec app php artisan about --only=environment` の `Maintenance Mode` でも見られる）
- 会員の API：`curl -s -H 'Accept: application/json' http://localhost:8000/api/me` が `503`
- 管理画面：`curl -s http://127.0.0.1:8100/api/health` が `200`（FR-MAINT-005 は、この curl で確かめる。2026-11-21 に人が決めた）
- 抜け道：`curl -c <Cookie のファイル> <コマンドが出した URL>` で Cookie を受け取り、`curl -b <Cookie のファイル> -H 'Accept: application/json' http://localhost:8000/api/me` が `503` でなく `401`「ログインしてください」（メンテナンスを通り抜け、ログインの確かめまで届く）
- 抜け道（画面）：コマンドが出した URL を、作業する人のブラウザで開く（Cookie `laravel_maintenance` が付く）。そのあと `http://localhost:5173` を開くと、そのブラウザだけ、ログインの画面と会員の画面が使える
  - 抜け道の URL を開いた行は、`docker compose logs app` に残る（PHP の組み込みのサーバーのアクセスのログ）。ログを貼るときは、その行を消す。解けば、その文字は使えなくなる
- `down` を流し直すと、セッションをまた全部消し、抜け道の文字も変わる（前の Cookie では通れない）

### 3. 作業する

- リリース・マイグレーション・認証の切り替えなど

### 4. 解く

- コマンド：`docker compose exec app php artisan up`
- 解いたことは、`laravel.log` の `maintenance.disabled` に出る（入れたときの行と合わせて、何時から何時まで止まっていたかが分かる）
- 会員の画面を読み込み直して、いつもどおり使えるかを確かめる

### 使わないもの

- 抜け道の文字を、ログ・チケット・PR・コミットに書く（NFR-MAINT-001）
- 本当のメンテナンス中に、テストの置き場をファイルにして `pest` を流す（テストは `phpunit.xml` の `APP_MAINTENANCE_DRIVER=array` でメモリに置く。ファイルにすると、同じフォルダで動いている開発用の API とテストが、互いのメンテナンスを読む）

## DB に入る

- 実行場所：リポジトリのルート
- コマンド：`docker compose exec db psql -U postgres -d matching_dev`（テスト用は `-d matching_test`）
- 前提：db が起動している

## ブランチを切り替えたあと

- 実行場所：リポジトリのルート
- コマンド：`docker compose restart app`
  - 理由：切り替え先に `backend/client/` がないと、動いているサーバーのフォルダが一度消えて、API がエラーを返し続けるため
- `legacy-repo` 系と `refactored-repo` 系を行き来したときは、続けて `docker compose run --rm app composer dump-autoload`
  - 読み込みの一覧 `vendor/composer/` は git に入らず、前のブランチのまま残る
  - `refactored-repo` にだけある `tests/DummyData/` のファイルを指したまま `legacy-repo` に移ると、API が全部 500 になる
- 会員の API がどれも 503 なら、メンテナンスを解き忘れている（`backend/client/storage/framework/down` は git に入らないので、ブランチを切り替えても、再起動しても残る）。`docker compose exec app php artisan up` で解く

## CI

- 実行場所：GitHub（PR と push で自動）
- 設定：`.github/workflows/backend.yml`（会員の側）・`admin-backend.yml`（管理画面）・`frontend.yml`（画面）・`docs.yml`（文書の言葉）
- 中身と決まりは [docs/ci.md](ci.md)
- 結果は `gh pr checks <番号>` で見る
- 使わないもの：CI の設定を緩めて通す（レベルを下げる・対象から外す）

## エディタの補完のファイルを作る

- 実行場所：リポジトリのルート
- コマンド：`docker compose run --rm app php artisan ide-helper:models --nowrite`
  - `backend/client/_ide_helper_models.php` に書き出す。git には入らない
- 前提：db が起動している（列を DB から読む）
- 使わないもの：`--write`（Model のファイルに `@property` を書き込む。長くなり、マイグレーションとずれるため。quality-types.md）

## 文書の言葉を確かめる

- 実行場所：リポジトリのルート
- コマンド：`python3 -I agents/tools/check-words.py`
  - 使わないと決めた言い方が `docs/`・`agents/`・`.claude/agents/`・`.github/`・AGENTS.md に入っていないかを見る
  - CI でも流れる
- 前提：python3
- 使わないもの：見つかった言葉を「」で囲んで通す（古い言い方を説明のために引くときだけ囲む）

## ビルド

- 実行場所：`frontend/client/`
- コマンド：`npm run build`
  - 型の検査と `vite build`。`dist/` に出す。デプロイはしない
- 前提：`npm install` 済み
