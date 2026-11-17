# どう作るか（設計と議事録）

日付：2026-11-15
出た役：リーダー・人

## テストの考え方（決まった）

### 意味のあるテストの5つの条件

1. 何を確かめるかを1文で言える（名前に入れる。例：「ブロックした相手は、検索の結果に出ない」）
2. それを壊すと落ちる（その動きを作っている実装の行を消して、落ちることを確かめる）
3. 中身を書き換えても落ちない（外から見える振る舞い＝リクエスト・応答・DB だけを見る。あとでファイルを安全に移すため）
4. 落ちたとき、何が壊れたか分かる
5. いつ流しても同じ結果

### API テストの観点

| 観点 | 確かめること |
| --- | --- |
| 成功 | 状態コード・返す項目・返してはいけない項目・DB の変化 |
| 認証 | トークンがない・壊れている・期限切れ |
| 認可 | 他人のもの・役割が足りない |
| 入力 | 必須・型・境界の両側 |
| 業務の決まり | このアプリだけの決まり |
| 副作用 | 書いてよい行だけが変わる・他人の行は変わらない |
| 一覧 | 並び・ページ・空のとき・出してはいけない人 |
| 分かっている不具合 | 今の振る舞いをそのまま確かめ、「分かっている不具合：…」とコメントを残す |

深く書く順：お金 → 他人のデータ → 認証 → 書き込み → 読み取り。

### 置き場

- 5つの条件と観点の表は、チケット③（会員の側の API テストの土台）の中で `agents/rules/testing.md` に「API テストの観点」の節として足す
- これからどの種類のテスト（単体・API・アーキテクチャ・SQL の本数など）を使い、何を守らせるかも、`testing.md` に足して管理していく

## 今のテストの準備（2026-11-15 に見た）

| | 会員の側（`backend/client`） | 管理画面（`backend/admin`） |
| --- | --- | --- |
| テストの DB | PostgreSQL の `matching_test`。違う DB につながると `tests/TestCase.php` が止める | **SQLite のメモリ**（`phpunit.xml`）。D-010（本物の PostgreSQL で確かめる）と合わない |
| 表の作り | 自分のマイグレーションで `RefreshDatabase` | **マイグレーションを持たない**（表の作りは `backend/client` にまとめた）。このままでは表のない DB でテストが走る |
| テストデータ | `UserFactory`・`ProfileFactory` だけ | なし |
| ログインした状態 | 部品なし（JWT はコントローラーごとにコピー） | 部品なし |
| テスト | `HealthTest` だけ | 雛形のまま |

## 管理画面のテストの DB と表の作り方

| 案 | 中身 | 良いところ | 弱いところ |
| --- | --- | --- | --- |
| A（選んだ） | 管理画面のテスト用に別の DB（`matching_admin_test`）を作り、表は `backend/client` のマイグレーションを `--path` で指して作る。違う DB につながったら止める仕組みも会員の側と同じにする | 表の作りの正本が1か所のまま。2つのテストを同時に流してもぶつからない。本物の PostgreSQL | 管理画面が会員の側のマイグレーションの置き場を知っている（パスでつながる） |
| B | 会員の側と同じ `matching_test` を使い、先に会員の側でマイグレーションしておく。管理画面はテストごとに巻き戻すだけ | 準備が少ない | 同時に流すとぶつかる。会員の側を先に流さないと、管理画面のテストが動かない（順番に頼る） |
| C | 管理画面にマイグレーションをコピーする | 管理画面だけで閉じる | 正本が2か所になり、ずれる |

人が「それで OK」と答えたので、A で進める（違えば直す）。DB を作る SQL は `docker/db/init/`、CI は `.github/workflows/admin-backend.yml` に足す。

## 設計書

- 置き場は `docs/backend.md`（`docs/frontend.md` に合わせる）。会員の側と管理画面を1つの文書にし、違うところだけ節を分ける

## アーキテクチャ

比べた資料：`explanations/architecture-styles.html`

> 下の表は**取り消した最初の案**（議事録として残す）。今の決定は、この下の「会員の側の形」「管理画面の形」（どちらも DIP を用いた4層）。

| 場所 | 形 | 理由（人の言葉） |
| --- | --- | --- |
| 会員の側（`backend/client`） | レイヤードアーキテクチャ（3層：プレゼンテーション・ビジネスロジック・データアクセス） | 当時の規模は中くらい。いろいろな現場で取り入れられていて、入ってきた人がすぐ読める |
| 管理画面（`backend/admin`） | モジュール（機能・画面ごとの縦切り） | 機能や画面ごとに何があるかが分かればよい |

- 人はほかのプロジェクトで「interface 層」（入口の層）を取り入れていた。入口（HTTP・コマンド・キュー・Webhook）を `app/Interfaces/` にまとめる案（B）と、Laravel の標準の置き場のままの案（A）を比べた（`explanations/layered-design.html`。決まりを `agents/rules/architecture.md` にまとめたあと、第3版のまま参考として残した）
- 決めた依存の向きは、アーキテクチャのテスト（Pest の `arch()`）で確かめる。このサイクルの範囲に入れる

### 会員の側の形（2026-11-15 に決めた）

参考：DIP（依存性逆転）を使ったレイヤードアーキテクチャ（`Http`・`Application`・`Domain`・`Infrastructure`）。比べた資料は `explanations/architecture-styles.html`・`modular-monolith.html`。決まりと書き方は `agents/rules/architecture.md`、全体の地図は `docs/backend.md`。

```text
app/
├── Http/            # UI 層：Controllers・Requests（入力）・Resources（出力）・Middleware
├── Application/     # UseCases/（1操作1クラス）・Dtos/（入力と出力の型）
├── Domain/          # <業務のまとまり>/<集約>/：エンティティ・値オブジェクト・enum・〜RepositoryInterface・例外。Services/ にドメインサービス
├── Infrastructure/  # Models（Eloquent）・Repositories（interface の実装と詰め替え）・QueryServices（必要なときだけ）・External（Firestore・JWT）
└── Providers/       # interface と実装をつなぐ
```

- 依存の向き：Http → Application → Domain ← Infrastructure（Infrastructure が Domain の interface を実装する）
- ユースケースのフォルダの名前は `UseCases/`
- Application 層は Laravel の機能をはみ出して使わない（`DB::transaction()` も直接は使わない。トランザクションの扱いは下で決める）
- QueryService は必要に応じて（検索・管理画面の集計など）
- 聞き慣れない名前（Ports・Queries・Listeners）は使わない。外のサービスの約束は、使う Domain のフォルダに `〜Interface.php` で置く
- トランザクションは `Application/Transaction/TransactionManagerInterface.php`（実装は `Infrastructure/Transaction/LaravelTransactionManager.php`）、日時は `Domain/Shared/ClockInterface.php`（実装は `Infrastructure/Clock/SystemClock.php`。PHP 標準の `DateTimeImmutable` を返す。見直し（2026-11-15）：`CarbonImmutable::now('UTC')` を返す。型は `DateTimeImmutable` のまま。API テストの `travelTo()` を効かせるため。07-review の M3）を通す
- 方針：今の段階に合う設計にする。機能・会員・ファイルが増えて問題が出たら、そのときに設計をやり直す。やり直しのきっかけ（数字）を決めて振り返りで見る。変えたら `docs/decisions.md` に、きっかけと前と後を1行残す

### 管理画面の形（2026-11-15 に決めた。同じ日に見直した）

- **会員の側と同じ4層の骨組み**（Http・Application・Domain・Infrastructure。層の中は画面の領域ごとのフォルダ。一覧は `docs/backend.md` の 2-2。`frontend/admin/src/domains/` とそろえる）
- 読み取り（一覧・詳細・集計。API の9割）は、Controller から Infrastructure の QueryService を直接呼ぶ。Domain を通さない
- 書き込み（停止・解除・値段の変更）だけ、UseCase と Domain を通す（見直し（2026-11-15）：ログインと見たことの記録も UseCase を通す。一覧は `docs/backend.md` の 2-2）。管理画面の Domain は「運営の権限と監査」：`Admins/`（Admin・AdminRole・Permission）・`Members/MemberSuspension`・`Plans/PlanPrice`・`AuditLogs/`
- Application と Domain では Laravel を使わない（会員の側と同じ。トランザクションと日時は interface 越し）。依存の向き・アーキテクチャのテストも会員の側と同じ
- 見直した理由：書く手間は AI で小さくなるが、読む・レビューする・説明する手間は残る。形を1つにすれば、覚えるのも AI が真似するのもテストも1種類で済む。役割・停止・監査の決まり（12 の 9-2 で問題が出たところ）を、Domain で単体テストできる
- 最初の案（機能ごとのモジュール・Domain なし・Laravel をそのまま使う）は取り消した
- 比べて採らなかった案：読み取りも全部 Domain を通す（詰め替えが大量に出る）・共有の Domain のパッケージ（`packages/`。12 の「管理画面は会員の側のコードを読み込まない」を変えることになる。2つのアプリの決まりがずれて困ったら考える）
- どのアプリがどの表のどの列を書いてよいかを、`docs/backend.md` に表で載せる

## API の URL とルートの設計（2026-11-16）

出た役：リーダー・人。提案 #124（OpenAPI 3.1 を正本にする）の続き。型にしたものは #125 で `agents/rules/api-design.md` に書く。

### 前提

- サービスはもう動いていて、会員が今の URL を使っている、と考えて直す
- 画面はウェブだけ（スマホのアプリはない）。画面を出し直せば、数日で全員が新しい版になる

### 今の URL を壊さずに直す流れ

今の URL（`/api/...`）は、いきなり変えたり消したりしない。直した API は新しい URL に作り、1本ずつ移す。

**新しい URL には `/api` も `/v1` も付けない**（人が決めた）。例：`GET /talk-rooms`。

- `/api` を付けない理由：このサーバーは API しか返さないので、`/api` は何も区別していない
- `/v1` を付けない理由：画面はウェブだけで、画面とサーバーを一緒に出し直せる。URL を分けて古い版を長く残す必要がない
- 今の URL は `/api` で始まり、新しい URL は始まらないので、移している間に2つを同時に動かしても見分けられる

| 順 | すること | 例（トークの一覧） |
| --- | --- | --- |
| 1 | 新しい URL を作る。今の URL はそのまま動かしておく | `GET /talk-rooms` を作る。`GET /api/me/talk-rooms` も動いている |
| 2 | 画面を新しい URL に切り替えて出す | `MessagesPage` が `/talk-rooms` を呼ぶ |
| 3 | 今の URL の応答に「もうすぐ消える」印（`Deprecation`・`Sunset` のヘッダー）を付ける | `Sunset` に消す日を書く |
| 4 | 消す日まで、今の URL が呼ばれていないかをログで見る。呼ばれていなければ消す | 消す日は、画面を出してから2週間（1サイクル）を目安にする（仮。#125 で決める）。今の URL の、今の動きを確かめるテストも一緒に消し、消すチケットに「新しい URL のどのテストが引き継いだか」を書く |

- OpenAPI の仕様書に書くのは、新しい URL だけ。今の URL は、棚卸しの地図（`docs/onboarding/feature-map.md`）を記録の代わりにする
- 今の URL の中身は直さず、変えずに残す。新しい機能も足さない。例外は2つ：消す前の印（`Deprecation`・`Sunset`。今の URL のグループのミドルウェアで付け、コントローラーは触らない）と、下の安全の穴
- **例外：安全の穴は、今の URL のままでもすぐ直す**（他人のトークを読める・他人のプロフィールを書き換えられる など）。今の使い方を壊さないのは、正しい使い方だけ
- 弱いところ：移している間は、同じ機能が2本ずつ動き、テストも2本になる。消し忘れると残り続ける
- 比べて採らなかった案：同じ URL のまま「足すだけ」で育てる（2本持たずに済むが、配列をそのまま返す・`verification_token` を返す、といった今の形を変えられない）

**移したときに、振る舞いが同じことを確かめるテスト**（PR #132 のレビュー M3）

- 新しい URL のテストは、今の URL の、今の動きを確かめるテストをコピーして作る
- 違ってよい点（`data` で包む・状態コード（形の違う ID は 404 など）・出さない項目）は、移すチケットの表に並べる。表にないものは、期待値を変えない
- `architecture.md` の10章の「移すコミットではテストが変わらない」は、同じ URL のまま中を移すときに当てはまる。新しい URL に移すときは、上のコピーのしかたで、振る舞いが同じことを確かめる
- 今の URL の、今の動きを確かめるテストは、今の振る舞いのまま期待値を書く（例：形の違う ID は 500 のまま）

**安全の穴を直すときのテスト**（PR #132 のレビュー M4）

1. 直すのは、ほかの変更と別のコミットにする
2. 直す前に、「分かっている不具合」として今の動きを確かめているテストを要件どおりの期待値に変え、落ちることを先に見せる
3. 書き換えたテストの名前を、PR に並べる

上の2つ（移したときのテスト・穴を直すときのテスト）を、`agents/rules/testing.md` と `agents/rules/architecture.md` の10章（「移すコミットではテストが変わらない」の書き分け）に書き足すのは #104（API テストの土台）で行う

### バージョン（URL には出さない）

バージョンは、設計（OpenAPI の仕様書）の版として持つ。URL には出さない。

| 決めること | 決まり |
| --- | --- |
| 版の置き場 | 仕様書の `info.version`。最初は `1.0.0` |
| 上げ方 | 足すだけの変更（項目・API を足す）は `1.1.0` のように真ん中を上げる。壊す変更（項目を消す・名前を変える・必須にする）は `2.0.0` のように先頭を上げる。壊す変更かどうかは `oasdiff breaking` で機械で見分ける |
| 壊す変更のしかた | URL を分けずに「足す → 画面を切り替える → 古いものを消す」の3回に分けて出す（例：項目の名前を変えるなら、新しい名前の項目を足す → 画面を新しい名前に切り替えて出す → 古い名前の項目を消す） |
| 見直すとき | スマホのアプリなど、古い版が長く残る画面ができたとき。そのときは、URL ではなくヘッダー（例：`API-Version: 2`）で分ける案から考える |

### 応答の形

新しい URL では、応答を必ず `data` で包む（一覧も1件も）。一覧の続きなどは `meta` に入れる。

```json
{ "data": { "room_id": "019a…", "nickname": "…" } }
{ "data": [ … ], "meta": { "next_cursor": "…" } }
```

- 理由：包んでおけば、あとから総数や次のカーソルを、今ある項目を変えずに足せる。Laravel の API Resource も、標準で `data` で包む
- 失敗の形は、下の「API 設計の土台」の B（RFC 9457）

### ルートは `api.php` で管理する

API のルートは、すべて `routes/api.php` から読み込む。`routes/web.php` には API を書かない。

`web.php` と `api.php` の違い（Laravel 13.x の Middleware のページ）：

| | `web.php`（ウェブのページ向け） | `api.php`（API 向け） |
| --- | --- | --- |
| 付くミドルウェア | Cookie の暗号化・セッション・CSRF の確かめ（`PreventRequestForgery`）・エラーをセッションで画面に渡す・ルートモデルバインディング | ルートモデルバインディング（`SubstituteBindings`）だけ |
| 状態 | セッションで「だれか」を覚える | 覚えない。毎回トークンで「だれか」を確かめる |
| URL の頭 | 付かない | 標準で `/api` が付く（`bootstrap/app.php` の `apiPrefix` で変えられる） |

- API は毎回トークンで確かめるので、セッションと CSRF の確かめは要らない。`api.php` に置けば、余計なミドルウェアが付かない
- 気をつけること：改善版はトークンを HttpOnly の Cookie に置く（D-014）。`api.php` には CSRF の確かめも Cookie の暗号化も付かない。Cookie にトークンを置くと、「毎回トークンで確かめるので CSRF は要らない」という前提が崩れる。CORS は応答を読ませない仕組みで、送ること自体は止めない。SameSite も、同じサイトの別のオリジンからの送信は止めない。認証を移すチケットで、次の3つを決める（PR #132 のレビュー S7）
  - 書き込みは JSON の `Content-Type` か独自のヘッダーを必須にするか、CSRF のトークン（Sanctum の SPA の方式）を使うか
  - Cookie の `SameSite`・`Secure`・`HttpOnly` の値
  - CORS で許すオリジンは画面のオリジンだけ（`http://localhost:5173`・管理画面は `http://localhost:5174`）。すべてのオリジンを許す設定と `supports_credentials` を一緒にしない

### ルートのまとめ方

今は、API のルートを**すべて `routes/api.php` の1ファイル**に書く（人が決めた）。ファイルの中を、業務のまとまり（Auth・Members のような、業務ごとの分け方。`docs/backend.md` の2章）ごとの `Route::name('<まとまり>.')->group()` で区切る。**まとまりの名前は URL に入れない**（`/matching/likes` にしない）。URL は画面が使う住所で、まとまりは中の整理の仕方なので、中を分け直しても URL が変わらないようにする。

- ファイルを分けるのは、1ファイルが読みにくくなったとき（目安：300行）。分けるときは `routes/api/<まとまり>.php` にし、`api.php` から読み込む。URL もルートの名前も変わらない
- 弱いところ：1ファイルなので、同じときに2つのチケットが触るとぶつかりやすい

| 決めること | 決まり |
| --- | --- |
| URL の頭 | `bootstrap/app.php` の `apiPrefix` を空にし、今の URL のグループだけに `Route::prefix('api')` を付ける |
| ルートの名前 | `<まとまり>.<リソース>.<操作>`（例：`matching.likes.store`）。まとまりとリソースは小文字で、2語なら `-` でつなぐ（`audit-logs.index`）。今の URL は `legacy.` で始める |
| OpenAPI | `tags` をまとまりの名前にそろえる（`paths` のファイルも、まとまりごとに分ける） |
| ID の形 | 下の「パスの引数と PATCH」のとおり、引数の名前ごとに `Route::pattern` で1か所で縛る。形の違う ID は 404（今は 500） |
| ルートモデルバインディング | 使わない（Controller に Eloquent の Model が入り、`architecture.md` の「Http は Model を使わない」とぶつかる） |
| 管理画面 | 別のアプリのまま、同じ分け方にする。将来ホストを分けるときは `Route::domain()` で書ける |

合わせて直す設定（最初に新しい URL を作るチケットで）：

- エラーを JSON で返す条件（`bootstrap/app.php` の `shouldRenderJsonWhen`）が `api/*` だけなので、API のルートすべてを JSON にする
- CORS の対象のパスが Laravel の標準で `api/*` だけなので、`config/cors.php` を出して新しい URL も対象にする（しないと、画面（:5173）から呼べない）

根拠にした Laravel のページ：13.x の Routing（`withRouting` の `apiPrefix`・`then`・`using`、グループの `prefix`・`name`・`middleware`、`Route::pattern`、Rate Limiting）・Middleware（`web` と `api` のグループ）。

### 名前の決まり（決まった分）

- ツールの名前（Firebase など）を URL に入れない。替えたときに URL が変わらないようにする
- `/me` を付けるかは、下の「`/me` を付けるか（2026-11-16 に決めた）」の基準で決める。他人のものは `/users/{user_id}/...`。管理画面で会員のものを見るときは `/members/{member_id}/...`（例：`/members/{member_id}/likes`）
- 名前は業務の言葉で付け、表の名前に合わせない（`docs/glossary.md`）

### API 設計の土台（2026-11-16 に決めた）

全部の API に効くので、今決めて #125 の `agents/rules/api-design.md` に入れるもの。

| # | 決まり | 理由（今の画面・コードで困っている所） |
| --- | --- | --- |
| A | 一覧は最初から全部ページに分ける。`limit`（既定20・上限100）と `cursor` を受け、`meta.next_cursor` を返す | いいね・マッチ・トークの一覧は全件を返している。あとからページに分けると、壊す変更になる |
| B | 失敗は RFC 9457（`application/problem+json`）の形で返し、機械が読める `code` を付ける（例：`LIKE_DAILY_LIMIT_REACHED`）。`code` の一覧は仕様書に書く。入力の誤り（422）は `errors` に項目ごとの言葉を入れる | `UserPage.tsx`：403 が「上限」か「有料が要る」かを画面が見分けられず、断られてからモーダルを出している |
| D | 中の連番の ID を返さない。画面が要る形で返す（例：メッセージに `is_mine`） | `TalkPage.tsx`：自分のメッセージかを、中の連番の `sender_id` と `/me` の `id` を比べて決めている |
| K | 他人のもの（参加者でないルームなど）には 403 ではなく 404 を返す | 403 だと「そのルームはある」と分かってしまう |
| 用語集 | 名前は業務の言葉で付け、表の名前に合わせない。正本は `docs/glossary.md` | `talk-rooms` と `rooms`、`matches` と `user_matches` のように、名前の決め方がなかった |

B の補足（PR #132 のレビュー S15）：500 の `detail` は決まった文言だけにし、SQL やスタックを出さない。ログイン・確認のメールの再送・登録で、メールアドレスが登録されているかを `code` や文言で見分けさせない。

その API を移すチケットで決めるもの：C（「有料かどうか」ではなく「何ができるか」を返す）・E（一覧があるものには1件の API も作る）・F（いいね・ブロックを `PUT`／`DELETE /me/likes/{user_id}` にする）・G（購入に状態と `Idempotency-Key`）・H（マッチに `match_id`）・I（ついでの処理は「マッチした」などの出来事で起こす）・J（決済の通知など外から呼ばれる URL は別のグループ）・M（429 と `Retry-After` を仕様書に書く）。

参考にした公開の決まり：Google API Improvement Proposals・Microsoft REST API Guidelines・Zalando RESTful API Guidelines・RFC 9457・RFC 8594（`Sunset`）・RFC 9745（`Deprecation`）。

### パスの引数と PATCH（2026-11-16 に決めた）

- パスの引数の名前は `{<名詞>_id}`（`{user_id}`・`{room_id}`・`{match_id}`・`{member_id}`・`{plan_id}`）。JSON のキーと同じ名前にし、入れ子でも見分けられるようにする。中身は UUID で、引数の名前ごとに `Route::pattern` で縛る（ルートごとの `whereUuid()` は使わない。書き漏らさないように）
- ID の名前は、用語集（`docs/glossary.md`）の「ID の名前」の列を正とする（PR #132 のレビュー S10 で決めた。トークルームは `room_id`）。新しいリソースを足すときは、先に用語集に ID の名前を書く
- PATCH は RFC 7396（JSON Merge Patch）の決まりに合わせる：送らなかった項目は変えない・`null` を送った項目は消す。仕様書には、消してよい項目に `nullable` を書く
- PUT は「その状態にする」操作（既読にする など）に使う。2回送っても同じ結果になる

### CRUD ではない操作の書き方（2026-11-16 に決めた）

上から順に当てはめ、最初に当てはまった型にする。

| 順 | 基準 | 型 | 例 |
| --- | --- | --- | --- |
| 1 | 作る・消すと言える状態がある | 状態を名詞にする | `POST`・`DELETE /members/{member_id}/suspension` |
| 2 | 名詞にすると不自然な、一度きりの動作 | 動詞をパスにする | `POST /auth/login` |
| 3 | 理由・監査などの決まりがない、ただの項目 | 項目の更新にする | `PATCH /me`（ニックネームを変える） |
| ― | 使わない | コロンの動詞（`/members/{member_id}:suspend`） | 見慣れない人が多く、Laravel で書けるかも試していない |

### `/me` を付けるか（2026-11-16 に決めた）

ログインした本人はトークンで分かるので、`/me` は「付けないと迷うもの」にだけ付ける。**迷うものには付ける**（人が決めた）。

| 付ける | 付けない |
| --- | --- |
| 自分そのもの（`/me`） | 2人以上で持つもの（マッチ・トークルーム・メッセージ） |
| 自分から相手への向きがあるもの（いいね・ブロック。あとで「受けた」側を足しうる） | 全員に同じもの（プラン） |
| 迷うもの（自分の購入・自分のメールアドレスの確認・自分のためのトークン） | 相手のもの（`/users/{user_id}`）・ログインの前に使うもの（`/auth/...`） |
| | 2人で持つものの中の、自分の状態（既読）。親（トークルーム）の URL にそろえる |

| 今の URL | 新しい URL | `/me` | 理由 |
| --- | --- | --- | --- |
| `GET /api/health` | `GET /health` | ― | |
| `POST /api/users` | `POST /users`（名前は仮） | 付けない | 登録の前で、まだ「自分」がいない |
| `GET /api/email-verifications/{token}` | `GET /users/{user_id}/email-verification/{hash}` | 付けない | メールのリンクで開くので、ログインしていない（下の注） |
| `POST /api/email-verifications` | `POST /me/email-verification` | 付ける | 迷う（自分のメールアドレス） |
| `POST /api/auth/login`・`/logout` | `POST /auth/login`・`/auth/logout` | 付けない | ログインの前後 |
| ―（改善版で足す） | `POST /auth/refresh` | 付けない | |
| `GET /api/me` | `GET /me` | 付ける | 自分そのもの |
| `PUT /api/users/{publicId}` | `PATCH /me` | 付ける | 自分そのもの |
| `DELETE /api/me` | `DELETE /me` | 付ける | 自分そのもの（退会） |
| `GET /api/users` | `GET /users` | 付けない | 相手を探す |
| `GET /api/users/{publicId}` | `GET /users/{user_id}` | 付けない | 相手のもの |
| `POST /api/me/likes` | `POST /me/likes`（`PUT /me/likes/{user_id}` にするかは、移すチケットで決める） | 付ける | 向きがある（送った・受けた） |
| `GET /api/me/likes` | `GET /me/likes` | 付ける | 向きがある |
| `GET /api/me/matches` | `GET /matches` | 付けない | 2人で持つ。向きがない |
| `GET /api/me/talk-rooms` | `GET /talk-rooms` | 付けない | 2人で持つ |
| ―（改善版で足す） | `GET /talk-rooms/{room_id}` | 付けない | 2人で持つ |
| `GET /api/me/talk-rooms/{publicId}/messages` | `GET /talk-rooms/{room_id}/messages` | 付けない | ルームの中のもの |
| `POST /api/me/talk-rooms/{publicId}/messages` | `POST /talk-rooms/{room_id}/messages` | 付けない | ルームの中のもの |
| ―（改善版で足す） | `PUT /talk-rooms/{room_id}/read` | 付けない | 2人で持つものの中の、自分の状態。親の `/talk-rooms/{room_id}` にそろえる |
| `POST /api/me/firebase-token` | `POST /me/realtime-token`（名前は仮） | 付ける | 迷う（自分のためのトークン） |
| `POST /api/me/blocks` | `POST /me/blocks` | 付ける | 向きがある（した・された） |
| `GET /api/me/blocks` | `GET /me/blocks` | 付ける | 向きがある |
| `DELETE /api/me/blocks/{publicId}` | `DELETE /me/blocks/{user_id}` | 付ける | 向きがある |
| `GET /api/plans` | `GET /plans` | 付けない | 全員に同じ |
| `POST /api/me/purchases` | `POST /me/purchases` | 付ける | 迷う（お金の記録。あとで「贈る・贈られる」の向きが出うる） |
| `GET /api/me/purchases` | `GET /me/purchases` | 付ける | 迷う |

- メールの確認の URL の注（PR #132 のレビュー S8）：`{hash}` はメールアドレスのハッシュだけなので、それだけでは、だれでも URL を作れる。`signed` のミドルウェアと、期限つきの URL（`temporarySignedRoute`）を必須にする。確認済みなら、2回目は何もしない。メールのリンクは GET でしか開けないので、「GET で状態を変えない」の例外にする（ほかの API ではまねしない）。`{hash}` は `{<名詞>_id}` の例外
- 弱いところ：`/me` が付くものと付かないものが混ざるので、画面を書く人は上の基準を知っている必要がある。基準と表は #125 の `api-design.md` に入れる
- `/me` を付けないもの（トークルームなど）は、URL から「だれのものか」が分からないので、参加者かの確かめ（決まり K）を必ずコードで書く
- 管理画面は、管理者そのもの（`GET /me`）だけに付ける。ほかは運営から見た全体のもの（`/members` など）なので付けない

### 次に話すこと

管理画面の14本を「今の URL → 新しい URL」の表にする（会員の側の24本は上の表）。

## 決めたこと・決めなかったこと・宿題

- 決めたこと：テストの考え方と置き場（上）。API の URL とルートの設計（上。2026-11-16）
- 決めなかったこと：チケットの Size と順番
- 宿題：人が、`POST /api/me/likes` に観点を当てはめて、確かめるテストを3つ挙げる（練習。急がない）。1回目の答えは「認証まわりやいいねなど」。名前の形（〜のとき、〜になる）にするのが次の一歩
