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

- 5つの条件と観点の表は、#104（会員の側の API テストの土台）で `agents/rules/testing.md` の「API テストの観点」の節に書き足した。これからは `testing.md` を正とし、上の表は決めたときの記録として残す（直さない）
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

| 案 | 中身（短く） | 選んだか |
| --- | --- | --- |
| A | 別の DB（`matching_admin_test`）を作る | 選んだ |
| B | 会員の側と同じ `matching_test` を使う | ― |
| C | 管理画面にマイグレーションをコピーする | ― |

### 案 A：管理画面のテスト用に別の DB を作る（選んだ）

- 中身
  - 管理画面のテスト用に、別の DB（`matching_admin_test`）を作る
  - 表は、`backend/client` のマイグレーションを `--path` で指して作る
  - 違う DB につながったら止める仕組みも、会員の側と同じにする
- 良いところ
  - 表の作りの正本が1か所のまま
  - 2つのテストを同時に流してもぶつからない
  - 本物の PostgreSQL
- 弱いところ：管理画面が、会員の側のマイグレーションの置き場を知っている（パスでつながる）

### 案 B：会員の側と同じ DB を使う

- 中身
  - 会員の側と同じ `matching_test` を使い、先に会員の側でマイグレーションしておく
  - 管理画面は、テストごとに巻き戻すだけ
- 良いところ：準備が少ない
- 弱いところ
  - 同時に流すとぶつかる
  - 会員の側を先に流さないと、管理画面のテストが動かない（順番に頼る）

### 案 C：管理画面にマイグレーションをコピーする

- 良いところ：管理画面だけで閉じる
- 弱いところ：正本が2か所になり、ずれる

人が「それで OK」と答えたので、A で進める（違えば直す）。DB を作る SQL は `docker/db/init/`、CI は `.github/workflows/admin-backend.yml` に足す。

## 設計書

- 置き場は `docs/backend.md`（`docs/frontend.md` に合わせる）。会員の側と管理画面を1つの文書にし、違うところだけ節を分ける

## アーキテクチャ

比べた資料：`explanations/architecture-styles.html`

> **2026-11-18 に見直した（#236・D-025）**：形を「Controller → Service → Model」に変えた。下の「会員の側の形」「管理画面の形」（どちらも DIP を用いた4層）は、そのときまでの決定として残す。今の決まりは `agents/rules/architecture-backend.md`、見直した理由は `05-problems.md` の #236。
>
> 下の表は**取り消した最初の案**（議事録として残す）。

| 場所 | 形 | 理由（人の言葉） |
| --- | --- | --- |
| 会員の側（`backend/client`） | レイヤードアーキテクチャ（3層：プレゼンテーション・ビジネスロジック・データアクセス） | 当時の規模は中くらい。いろいろな現場で取り入れられていて、入ってきた人がすぐ読める |
| 管理画面（`backend/admin`） | モジュール（機能・画面ごとの縦切り） | 機能や画面ごとに何があるかが分かればよい |

- 人はほかのプロジェクトで「interface 層」（入口の層）を取り入れていた。入口（HTTP・コマンド・キュー・Webhook）を `app/Interfaces/` にまとめる案（B）と、Laravel の標準の置き場のままの案（A）を比べた（`explanations/layered-design.html`。決まりを `agents/rules/architecture-backend.md` にまとめたあと、第3版のまま参考として残した）
- 決めた依存の向きは、アーキテクチャのテスト（Pest の `arch()`）で確かめる。このサイクルの範囲に入れる

### 会員の側の形（2026-11-15 に決めた）

参考：DIP（依存性逆転）を使ったレイヤードアーキテクチャ（`Http`・`Application`・`Domain`・`Infrastructure`）。比べた資料は `explanations/architecture-styles.html`・`modular-monolith.html`。決まりと書き方は `agents/rules/architecture-backend.md`、全体の地図は `docs/backend.md`。

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

順番（例はトークの一覧）：

1. 新しい URL を作る。今の URL はそのまま動かしておく
   - 例：`GET /talk-rooms` を作る。`GET /api/me/talk-rooms` も動いている
2. 画面を新しい URL に切り替えて出す
   - 例：`MessagesPage` が `/talk-rooms` を呼ぶ
3. 今の URL の応答に「もうすぐ消える」印（`Deprecation`・`Sunset` のヘッダー）を付ける
   - 例：`Sunset` に消す日を書く
4. 消す日まで、今の URL が呼ばれていないかをログで見る。呼ばれていなければ消す
   - 消す日は、画面を出してから2週間（1サイクル）を目安にする（仮。#125 で決める）
   - 今の URL に対する、今の動きを確かめるテストも一緒に消す
   - 消すチケットに「新しい URL のどのテストが引き継いだか」を書く

- OpenAPI の仕様書に書くのは、新しい URL だけ。今の URL は、棚卸しの地図（`docs/onboarding/feature-map.md`）を記録の代わりにする
- 今の URL の中身は直さず、変えずに残す。新しい機能も足さない。例外は2つ：消す前の印（`Deprecation`・`Sunset`。今の URL のグループのミドルウェアで付け、コントローラーは触らない）と、下の安全の穴
- **例外：安全の穴は、今の URL のままでもすぐ直す**（他人のトークを読める・他人のプロフィールを書き換えられる など）。今の使い方を壊さないのは、正しい使い方だけ
- 弱いところ：移している間は、同じ機能が2本ずつ動き、テストも2本になる。消し忘れると残り続ける
- 比べて採らなかった案：同じ URL のまま「足すだけ」で育てる（2本持たずに済むが、配列をそのまま返す・`verification_token` を返す、といった今の形を変えられない）

**移したときに、振る舞いが同じことを確かめるテスト**（PR #132 のレビュー M3）

- 新しい URL のテストは、今の URL に対する、今の動きを確かめるテストをコピーして作る
- 違ってよい点（`data` で包む・状態コード（形の違う ID は 404 など）・出さない項目）は、移すチケットの表に並べる。表にないものは、期待値を変えない
- `architecture-backend.md` の10章の「移すコミットではテストが変わらない」は、同じ URL のまま中を移すときに当てはまる。新しい URL に移すときは、上のとおり、今の動きを確かめるテストをコピーして、振る舞いが同じことを確かめる
- 今の URL に対する、今の動きを確かめるテストは、今の振る舞いのまま期待値を書く（例：形の違う ID は 500 のまま）

**安全の穴を直すときのテスト**（PR #132 のレビュー M4）

1. 直すのは、ほかの変更と別のコミットにする
2. 直す前に、「分かっている不具合」として今の動きを確かめているテストを要件どおりの期待値に変え、落ちることを先に見せる
3. 書き換えたテストの名前を、PR に並べる

上の2つ（移したときのテスト・穴を直すときのテスト）は、#104（API テストの土台）で、`agents/rules/testing.md` と `agents/rules/architecture-backend.md` の10章（「移すコミットではテストが変わらない」の書き分け）に書き足した。これからは `testing.md` を正とし、上の文は決めたときの記録として残す（直さない）

### バージョン（URL には出さない）

バージョンは、設計（OpenAPI の仕様書）の版として持つ。URL には出さない。

#### 版の置き場

- 仕様書の `info.version`。最初は `1.0.0`

#### 上げ方

- 足すだけの変更（項目・API を足す）は、`1.1.0` のように真ん中を上げる
- 壊す変更（項目を消す・名前を変える・必須にする）は、`2.0.0` のように先頭を上げる
- 壊す変更かどうかは、`oasdiff breaking` で機械で見分ける

#### 壊す変更のしかた

- URL を分けずに「足す → 画面を切り替える → 古いものを消す」の3回に分けて出す
- 例：項目の名前を変えるなら、新しい名前の項目を足す → 画面を新しい名前に切り替えて出す → 古い名前の項目を消す

#### 見直すとき

- スマホのアプリなど、古い版が長く残る画面ができたとき
- そのときは、URL ではなくヘッダー（例：`API-Version: 2`）で分ける案から考える

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
| 付くミドルウェア | 5つ（下の箇条書き） | ルートモデルバインディング（`SubstituteBindings`）だけ |
| 状態 | セッションで「だれか」を覚える | 覚えない。毎回トークンで「だれか」を確かめる |
| URL の頭 | 付かない | 標準で `/api` が付く（下の注） |

- `web.php` に付くミドルウェア：Cookie の暗号化・セッション・CSRF の確かめ（`PreventRequestForgery`）・エラーをセッションで画面に渡す・ルートモデルバインディング
- `api.php` の URL の頭の `/api` は、`bootstrap/app.php` の `apiPrefix` で変えられる

- API は毎回トークンで確かめるので、セッションと CSRF の確かめは要らない。`api.php` に置けば、余計なミドルウェアが付かない
- 気をつけること：改善版はトークンを HttpOnly の Cookie に置く（D-014）。`api.php` には CSRF の確かめも Cookie の暗号化も付かない。Cookie にトークンを置くと、「毎回トークンで確かめるので CSRF は要らない」という前提が崩れる。CORS は応答を読ませない仕組みで、送ること自体は止めない。SameSite も、同じサイトの別のオリジンからの送信は止めない。認証を移すチケットで、次の3つを決める（PR #132 のレビュー S7）。2026-11-20 に決めた：下の「認証をセッションに移す」
  - 書き込みは JSON の `Content-Type` か独自のヘッダーを必須にするか、CSRF のトークン（Sanctum の SPA の方式）を使うか
  - Cookie の `SameSite`・`Secure`・`HttpOnly` の値
  - CORS で許すオリジンは画面のオリジンだけ（`http://localhost:5173`・管理画面は `http://localhost:5174`）。すべてのオリジンを許す設定と `supports_credentials` を一緒にしない
- #259 で決まった形：会員の API は `api.php` のまま置く。`bootstrap/app.php` の `statefulApi()` で、画面のオリジンからのリクエストにだけ、Cookie の暗号化・セッション・CSRF の確かめ（Sanctum）が付く。CORS は `config/cors.php` で画面のオリジンだけを許し、`supports_credentials` を true にした

### ルートのまとめ方

今は、API のルートを**すべて `routes/api.php` の1ファイル**に書く（人が決めた）。ファイルの中を、業務のまとまり（Auth・Members のような、業務ごとの分け方。`docs/backend.md` の2章）ごとの `Route::name('<まとまり>.')->group()` で区切る。**まとまりの名前は URL に入れない**（`/matching/likes` にしない）。URL は画面が使う住所で、まとまりは中の整理の仕方なので、中を分け直しても URL が変わらないようにする。

- ファイルを分けるのは、1ファイルが読みにくくなったとき（目安：300行）。分けるときは `routes/api/<まとまり>.php` にし、`api.php` から読み込む。URL もルートの名前も変わらない
- 弱いところ：1ファイルなので、同じときに2つのチケットが触るとぶつかりやすい

#### URL の頭

- `bootstrap/app.php` の `apiPrefix` を空にする
- 今の URL のグループだけに、`Route::prefix('api')` を付ける

#### ルートの名前

- 形は `<まとまり>.<リソース>.<操作>`（例：`matching.likes.store`）
- まとまりとリソースは小文字で、2語なら `-` でつなぐ（`audit-logs.index`）
- 今の URL は `legacy.` で始める

#### OpenAPI

- `tags` をまとまりの名前にそろえる（`paths` のファイルも、まとまりごとに分ける）

#### ID の形

- 下の「パスの引数と PATCH」のとおり、引数の名前ごとに `Route::pattern` で1か所で縛る
- 形の違う ID は 404（今は 500）

#### ルートモデルバインディング

- 使わない
- 理由：Controller に Eloquent の Model が入り、`architecture-backend.md` の「Http は Model を使わない」とぶつかる

#### 管理画面

- 別のアプリのまま、同じ分け方にする
- 将来ホストを分けるときは、`Route::domain()` で書ける

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

理由は、今の画面・コードで困っている所。

#### A：一覧は最初から全部ページに分ける

- 決まり
  - 一覧は、最初から全部ページに分ける
  - `limit`（既定20・上限100）と `cursor` を受け、`meta.next_cursor` を返す
- 理由
  - いいね・マッチ・トークの一覧は、全件を返している
  - あとからページに分けると、壊す変更になる

#### B：失敗は RFC 9457 の形で返す

- 決まり
  - 失敗は RFC 9457（`application/problem+json`）の形で返し、機械が読める `code` を付ける（例：`LIKE_DAILY_LIMIT_REACHED`）
  - `code` の一覧は、仕様書に書く
  - 入力の誤り（422）は、`errors` に項目ごとの言葉を入れる
- 理由：`UserPage.tsx` で、403 が「上限」か「有料が要る」かを画面が見分けられず、断られてからモーダルを出している
- 補足（PR #132 のレビュー S15）
  - 500 の `detail` は決まった文言だけにし、SQL やスタックを出さない
  - ログイン・確認のメールの再送・登録で、メールアドレスが登録されているかを `code` や文言で見分けさせない

#### D：中の連番の ID を返さない

- 決まり：中の連番の ID を返さない。画面が要る形で返す（例：メッセージに `is_mine`）
- 理由：`TalkPage.tsx` で、自分のメッセージかを、中の連番の `sender_id` と `/me` の `id` を比べて決めている

#### K：他人のものには 404 を返す

- 決まり：他人のもの（参加者でないルームなど）には、403 ではなく 404 を返す
- 理由：403 だと「そのルームはある」と分かってしまう

#### 用語集

- 決まり：名前は業務の言葉で付け、表の名前に合わせない。正本は `docs/glossary.md`
- 理由：`talk-rooms` と `rooms`、`matches` と `user_matches` のように、名前の決め方がなかった

#### その API を移すチケットで決めるもの

- C：「有料かどうか」ではなく「何ができるか」を返す
- E：一覧があるものには、1件の API も作る
- F：いいね・ブロックを `PUT`／`DELETE /me/likes/{user_id}` にする
- G：購入に状態と `Idempotency-Key`
- H：マッチに `match_id`
- I：ついでの処理は、「マッチした」などの出来事で起こす
- J：決済の通知など、外から呼ばれる URL は別のグループ
- M：429 と `Retry-After` を仕様書に書く

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
| ―（改善版で足す） | ―（作らない。D-027 でセッションにした） | ― | |
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

## 認証をセッションに移す（#246。2026-11-20）

D-027。仕組みの解説は [explanations/auth-session.html](../../../explanations/auth-session.html)、計画は [explanations/auth-session-plan.html](../../../explanations/auth-session-plan.html)。メンテナンスの要件は [docs/requirements/maintenance.md](../../requirements/maintenance.md)。

### 比べた案

| 案 | 良いところ | 弱いところ | 手間 |
| --- | --- | --- | --- |
| A：D-014 のまま（JWT 15分と取り替え用のトークン） | 表の設計・使い回しの見つけ方を学べる | アカウント停止された会員を毎回 DB で確かめるので、JWT の強み（DB を見ない）が使えない。自分で作る部分が多い | 大 |
| B：Sanctum の SPA 認証（セッション） | Laravel の標準。行を消せば止まる。会員の台帳とパスワードが自分の DB に残り、移しやすい | ネイティブアプリには、あとで API トークンを足す | 中 |
| C：Firebase Authentication | パスワードを自分で持たない。SNS・SMS でのログインが早く用意できる | Google に縛られる。画面の SDK がトークンを JavaScript から読める所に置くので、#246 の目的（XSS で持ち出させない）と合わない | 中 |
| D：自分で一から書く | 仕組みを細かく学べる | 書き損じが、そのまま会員のなりすましになる。現場の形と違う | 大 |

選ぶ案と理由：B（人が決めた。2026-11-20）。学び方は、Sanctum の中（`vendor/laravel/sanctum`・`SessionGuard`・`PreventRequestForgery`）を読み、テストで壊して確かめる。

### 決めたこと（2026-11-20 に人が決めた）

#### 切れる時間

- 操作がないまま24時間（`SESSION_LIFETIME=1440`）。リクエストのたびに延びる
- 取り替え用のトークンも、「ログインしたままにする」も使わない

#### CSRF

- Sanctum の CSRF のトークン（`XSRF-TOKEN` の Cookie と `X-XSRF-TOKEN` のヘッダー）を使う
- 前の宿題（「`api.php` で管理する」の節の3つ）の答え
  - 書き込みは CSRF のトークン
  - Cookie は `HttpOnly`・`SameSite=Lax`・本番だけ `Secure`
  - CORS は画面のオリジンだけ

#### 移すあいだ

- 一度に切り替える
- セッションと JWT の両方を受ける時期を作らない（XSS で持ち出される穴を残さない）

#### 取り替え用のトークン

- 今は考えない。表 `refresh_tokens` は作らない

#### 画面

- 別のチケットにせず、バックエンドを直すチケットの中で一緒に直す
- 画面のフォルダも、そのとき `architecture-frontend.md` のとおりに移す
- 画面ごとのチケット（#115〜#122・#248・#249）と、管理画面のチケット（#123・#250〜#253）は閉じた（#112 の本文）

#### メンテナンス

- 会員の側だけを、開発者がコマンド（`php artisan down --with-secret`・`up`）で止める
- 管理画面は止めない。ボタンも作らない
- 入れたときに、`sessions` を全部消す（強制ログアウト）
- 確かめる開発者は、抜け道の URL を一度開く（Laravel の標準）
- お知らせ（予告）は入れない
- 切り替えのリリースで使う

### DB

- 新しい表・列はない。表 `sessions`（Laravel の最初のマイグレーション）を使う。`id` が主キー、`user_id` と `last_activity` にインデックスがある
- **1回のリクエストで流れる SQL（本番。`StartSession`・`DatabaseSessionHandler` を読んだ）**
  - ログインしているリクエスト：`sessions` の select 1本・`users` の select 2本（ガードの `id()` が中で `user()` を呼んで1本・`AuthService` がアカウントの状態を見るのに1本）。そのあと Service が自分の会員を読めば、もう1本（`GET /api/me` は3本。`tests/Feature/Auth/SessionTest.php` で数えている）・`sessions` の行全体の update 1本（`payload`・`user_id`・`ip_address`・`user_agent`・`last_activity`。中身が変わらなくても毎回。Controller のあと、応答を返す前）
  - 50回に1回ほど（掃除のくじ。設定の `session.lottery` は 2/100）、Controller の前に、期限を過ぎた行を消す `delete from sessions where last_activity <= ?` が流れる
  - Cookie のないリクエスト：select と insert（会員のいない行ができる）
  - 読むだけの API（検索・一覧）も、毎回1本の書き込みになる。select も主の DB に流れるので、あとで読み取り用の複製を足しても、セッションの分は逃がせない
- **会員のいない行（`user_id` が空）**ができる道：ログインの前の `/sanctum/csrf-cookie`・ログアウトのあと・Cookie なしで来るリクエスト。ログインでは `regenerate(true)` で前の行を消す（消さないと、ゲストの行が残る）
- **行の数の見積もり**：24時間のうちに使われた、ログインしている端末の数＋ログインせずに来た端末の数＋くじを待っている期限切れの行。会員の総数ではなく、1日に使う端末の数で決まる。どれも今は数がないので、切り替えの前と後に `select count(*), count(user_id) from sessions` を測る
- **10倍になったときに見る数字**：`select n_tup_upd, n_tup_hot_upd, n_dead_tup, last_autovacuum from pg_stat_user_tables where relname = 'sessions'`。`last_activity` にインデックスがあるので、update は HOT（インデックスを書き直さない更新）にならない。書き込みが目立ってきたら、`SESSION_DRIVER` を別の置き場（Redis など）に替える。そのときは NFR-AUTH-001 の「表 `sessions`」の書き方も変える
- **`sessions.user_id` に外部キーを付けない理由**：番号は使い回さないので、会員の行が消えてもガードが会員を見つけられず 401 になる。外部キーを付けると、Laravel は insert の失敗を受け止めて update に切り替える（`performInsert`）ので、違反が表に出ないまま保存されなくなる。今は、`users` を物理的に消すのは試しのデータ（シーダー）だけ。本番で消す処理を作るときに、その処理で `delete from sessions where user_id = ?` も流す
- **セッションを消す処理**（2026-11-21 に人が決め直した。`05-problems.md` の #259 の2つ目）
  - パスワードの変更（FR-AUTH-033）：今の端末の番号を除いて、その会員の行を消す（`delete from sessions where user_id = ? and id <> ?`）
    - 前は `Auth::logoutOtherDevices()` と Sanctum の `AuthenticateSession` にしていた。行が残らず、消えたことをテストで確かめられるので変えた
    - 弱いところ：管理画面など、ほかの所でパスワードを変えたときは効かない
  - パスワードの再設定（FR-AUTH-035）・退会：その会員の行を全部消す（`delete from sessions where user_id = ?`）
  - メンテナンス（FR-MAINT-002）：表の行を全部消す
  - 置き場：3つの API を新しい形（Controller → Service）に移してから足す。行を消すのは Service（DB の操作）。今の端末の番号は、Controller が文字として Service に渡す
- `last_activity` は `integer`（UNIX の秒）なので、2038-01-19 にあふれる。Laravel の標準の形で、今は直さない
- `users` を2回読むのを1回にするには、ガードの会員を Service に渡す。そうすると、Middleware が Model を、Service が Http の型を知ることになるので、層の決まり（architecture-backend.md の2章）を優先して、2回のままにした（PR #280 のレビューの M4。2026-11-21 に人が決めた）。主キーで読むので、1本は 1ms に満たない（10倍のときに見る数字は下のとおり）
- テストは `SESSION_DRIVER=array`（`phpunit.xml:45`）なので、`sessions` の SQL は流れない。Cookie で続くか・切れるかを見るテストは、`DummyAuth::loginFromScreen()` が置き場を DB にする。セッションを消すテスト（FR-AUTH-033・035・退会・FR-MAINT-002）だけ、そのテストの中でセッションの置き場を DB にし、行が消えた・残ったを `assertDatabaseHas`・`assertDatabaseMissing` で確かめる。SQL の本数を確かめるテストは、本番と本数が違うことをコメントに書く

### API

URL は今のまま（`/api/...`）。新しい URL に移すのは、サイクル 02。エラーの形は `docs/api/README.md` のとおり（日本語の `message`）。

| API | 今 | 変えたあと（短く） |
| --- | --- | --- |
| `GET /sanctum/csrf-cookie` | ― | `204` |
| `POST /api/auth/login` | `200` `{"token": "<JWT>"}` | `200`（`GET /api/me` と同じ形） |
| `POST /api/auth/logout` | `200`（サーバーは何もしない） | `204` |
| `GET /api/me` | JWT を読む | セッションの会員を返す |
| ログインが要るほかの API | 各 Controller が JWT を読む | `401` |
| 書き込みの API | CSRF の確かめなし | `419` |
| メンテナンス中の会員の API | ― | `503` |
| `POST /auth/refresh` | ― | 作らない（D-027） |

#### `GET /sanctum/csrf-cookie`（Sanctum が足す）

- `204`。Cookie `XSRF-TOKEN` を返す
- 画面の `client.ts` は、書き込みの前に Cookie がなければ1回呼ぶ

#### `POST /api/auth/login`

- 今：`200` `{"token": "<JWT>"}`
- 変えたあと
  - `200`。応答は `GET /api/me` と同じ形
  - セッションの Cookie を付け、JSON にトークンは入れない
  - アカウント停止・強制退会の会員は、今と同じ `403`。画面が見分けるための `code`（`account_suspended`・`account_banned`）を足した。確かめは、ログインの状態を作る前（使えるかは `User::accountStatus()` の1か所で決める。退会した会員は、いない会員と同じ `401`）

#### `POST /api/auth/logout`

- 今：`200`（サーバーは何もしない）
- 変えたあと
  - `204`。セッションを消し、CSRF のトークンも作り直す（FR-AUTH-016）
  - ログインの確かめ（`user.authenticate`）の外に置く。アカウント停止された会員も、自分のセッションを消せるように（PR #280 のレビューの A1）
  - 画面は応答の本文を読まない。`204`・`401`・`419` のあとでだけ、ログインの画面へ移る

#### ログインが要るほかの API

- 今：各 Controller が JWT を読む。ない・壊れている JWT は 401・500
- 変えたあと
  - `AuthenticateUser` が確かめる
  - ログインしていない・退会・強制退会は `401`「ログインしてください」。アカウント停止は `401` と `code: account_suspended`

#### 書き込みの API

- 今：CSRF の確かめなし
- 変えたあと
  - `X-XSRF-TOKEN` がなければ `419`「画面を読み込み直してください」（文は `lang/ja/errors.php`）
  - 24時間で切れたあとの書き込みも、401 ではなく 419 になる（Sanctum は、ログインより先に CSRF を確かめる）

#### メンテナンス中の会員の API

- `503`「ただいまメンテナンス中です」。リダイレクトはしない（画面は `client.ts` で 503 を見分け、`app/` が1か所でメンテナンスの画面を出す）
- 抜け道は通す。`GET /api/health` も、ほかの API と同じに止める（FR-MAINT-004。2026-11-21 に変えた）

#### `POST /auth/refresh`

- 「`/me` を付けるか」の表で「改善版で足す」としていたもの
- 作らない（D-027）

#### 詳しい入力と応答・curl で確かめるとき

- 詳しい入力と応答は、それぞれのチケットで `docs/api/01b-auth.md` の「改善版」の列に書く
- curl で確かめるときは、`Origin: http://localhost:5173`（か `Referer`）を付けないと、Sanctum がセッションを使わない
- Cookie を保存したファイルは作業用のフォルダに置き、PR に貼らずに消す

### ディレクトリとクラス

| ファイル | 新しく作るか |
| --- | --- |
| `app/Http/Middleware/AuthenticateUser.php` | 新しい |
| `app/Http/Controllers/Controller.php` | ― |
| `User` の Model | ― |
| `app/Services/Auth/AuthService.php` | 新しい |
| `app/Http/Controllers/Auth/AuthController.php` | 新しい（古いものから移す） |
| `bootstrap/app.php` | ― |
| `app/Listeners/` | 新しい |
| 設定の `cors.php` | 新しい |
| 設定の `sanctum.php` | ― |
| 設定の `database.php` | ― |
| 環境変数の見本 | ― |
| `lang/ja/errors.php` | ― |
| `frontend/client/src/shared/api/client.ts` | 新しい |
| `frontend/client/src/app/RequireAuth.tsx`・`shared/session/SessionProvider.tsx` | 新しい |
| メンテナンスの画面 | 新しい |
| `tests/DummyData/DummyAuth.php` | ― |

#### `app/Http/Middleware/AuthenticateUser.php`（新しい）

- 責務
  - ガードが見つけたログインしている会員を受け取り、使えるかを Service に聞く
  - だめなら `AuthenticationException` を投げるだけ（応答は作らない）
  - よければ `login_user_id` を載せる
- 置き場の理由：ログインしている会員を読むのは Middleware だけ（`architecture-backend.md` の4章）

#### `app/Http/Controllers/Controller.php`

- 責務
  - `loginUserId(Request): int`。値がなければ `AuthenticationException` を投げる
  - どの Controller も、これを呼ぶだけにする
- 置き場の理由
  - 読み方を1か所にする
  - Middleware を付け忘れたとき、黙って「会員 0 番」として動かない

#### `User` の Model

- 責務
  - 会員が使えるか（退会・停止・強制退会）を、行の値だけで答える（`isAccountUsable()`。今ある `scopeActive` と同じ条件）
  - ログインと `AuthenticateUser` の両方から使う
- 置き場の理由
  - 行の値だけで決まる事実は、Model に1つだけ置く
  - 2か所に書くと、止め方を足したときにずれる

#### `app/Services/Auth/AuthService.php`（新しい）

- 名前は、`docs/backend.md` の移行の地図の名前
- 責務
  - `login(email, password): User`：照合（失敗と成功で時間をそろえる。NFR-AUTH-002）・アカウント停止された会員の業務の例外・`last_login_at`
  - `isUserAccountUsable(int $userId): bool`
- 置き場の理由：業務の決まりは Service。`Auth::` と `session()` は使わない（2章）

#### `app/Http/Controllers/Auth/AuthController.php`（新しい）

- 古い `AuthController` から移す
- 責務
  - `login`：Service が返した会員で、`Auth::guard('web')->login()` と `regenerate(true)`
  - `logout`：`logout`・`invalidate`・`regenerateToken`
- 置き場の理由
  - セッションを触ってよいのは、Controller と Middleware（HTTP の側）
  - `architecture-backend.md` の2章の表に書き足す

#### `bootstrap/app.php`

- 責務
  - `statefulApi()`・Middleware の別名
  - `AuthenticationException` を 401、CSRF の失敗を 419、メンテナンスを 503 にし、どれも日本語の文にする `render`
  - 401・419 のときに、`auth.rejected` のログを1行出す
  - メンテナンスで health を通す（`preventRequestsDuringMaintenance(except: ...)`）
- 置き場の理由：例外を応答に変えるのは1か所（7章）

#### `app/Listeners/`（新しい。メンテナンスに入れたとき）

- 責務：出来事 `MaintenanceModeEnabled` を受けて、`sessions` を全部消す
- 置き場の理由：Laravel の標準のコマンドをそのまま使い、足りない所だけを出来事で足す

#### 設定の `cors.php`（新しい）

- Laravel の `config:publish cors` で出す
- 責務
  - 許すオリジンは画面だけ（`FRONTEND_URL`）
  - `supports_credentials` は true
  - 対象は `api/*` と `sanctum/csrf-cookie`
- 置き場の理由：Laravel の標準の置き場

#### 設定の `sanctum.php`

- 責務：`stateful` の既定に、`FRONTEND_URL` のホストとポートを入れる
- 置き場の理由
  - CORS・メールのリンクと同じ1つの値にする
  - 環境変数を書き忘れても動く

#### 設定の `database.php`

- 責務：`pgsql` に `mask_bindings_in_exception_messages` を true で足す
- 置き場の理由：SQL の例外の文に、セッションの番号・メールアドレスが入らないようにする（FR-AUTH-032）

#### 環境変数の見本（`backend/client` と `frontend/client` の見本のファイル）

- 責務
  - `SESSION_LIFETIME` を 120 から 1440 に
  - `VITE_API_URL` を `http://localhost:8000` に
- 置き場の理由：見本だけ。本物の秘密の値のファイルは、人が書き換える

#### `lang/ja/errors.php`

- 責務：`unauthenticated`（ログインしてください）・`csrf`（画面を読み込み直してください）・`maintenance`（ただいまメンテナンス中です）
- 置き場の理由：エラーの文の置き場（7章）

#### `frontend/client/src/shared/api/client.ts`（新しい）

- 責務
  - どの `fetch` もここを通す
  - 送り先の既定は `http://localhost:8000`。切り替えのあとは `credentials: 'include'` と `X-XSRF-TOKEN`
  - 401・419 はログインの画面へ、503 はメンテナンスの画面へ
- 置き場の理由：API を呼ぶ所を1か所にする（`architecture-frontend.md`）

#### `frontend/client/src/app/RequireAuth.tsx`・`shared/session/SessionProvider.tsx`（新しい。#257 の 2-2 で、決まりの1章のとおり `features/auth/session` から置き場を変えた）

- 責務：起動のときに `GET /api/me` を1回読み、ログインしているかを決める（`sessionStorage` を見ない）
- 置き場の理由：ログインの守りを1か所にする（`architecture-frontend.md`）

#### メンテナンスの画面（新しい）

- 置き場は、`architecture-frontend.md` に合わせて、作るチケットで決める
- 責務：「ただいまメンテナンス中です」。ログインの画面には移さない
- 置き場の理由：FR-MAINT-006

#### `tests/DummyData/DummyAuth.php`

- 責務：`actingAs()` を、Laravel の `actingAs($user, 'web')` で作る形にする
- 置き場の理由：テストのログインの形を1か所で変える

### チケットの分け方と順番

先に「読む所を1か所にする」を、API と画面の両方で JWT のまま済ませる。そのあと、メンテナンスを用意し、メンテナンスの中で中身だけを替える。

| 順 | チケット | Size | 依存 |
| --- | --- | --- | --- |
| 1 | #243 ログインを確かめる Middleware（JWT のまま） | 中 | ― |
| 2 | トークンを読む所を、API と画面で1か所にする（JWT のまま） | 大 | 1 |
| 3 | 会員の側のメンテナンス（新） | 中 | 2 |
| 4 | セッションに切り替える（新） | 大 | 3 |
| 5 | JWT を消す（新） | 小 | 4 |

チケットごとの中身（バックエンド・画面・直す文書）は、次の見出しに書く。

#### 1：#243 ログインを確かめる Middleware（JWT のまま）

- バックエンド
  - `AuthenticateUser`・`User::isAccountUsable()`・`AuthService::isUserAccountUsable()`・`loginUserId()`
  - 401 を `bootstrap/app.php` で日本語に
  - プロフィールの API に付ける（FR-AUTH-020）
  - `IdentifyUser` は、使う所がなくなるので消す
- 画面：401 を受けたら、ログインの画面に移す（プロフィールの画面から）
- 直す文書：`architecture-backend.md` の4章の見本

#### 2：トークンを読む所を、API と画面で1か所にする（JWT のまま）

- バックエンド
  - 残りの15の Controller の、JWT を読むコピーを消し、`loginUserId()` を呼ぶ
  - 「ログインが要らないルート（health・登録・ログイン・メールの確認・パスワードの再設定）を引いた残り」が、ログインなしで 401 になるテスト
- 画面
  - 全部の `fetch` を `client.ts` に通す
  - 送り先を `localhost`
  - ログインの判定を `GET /api/me` にする（`RequireAuth`・`session`）
  - 画面のフォルダも移す
- 直す文書：`architecture-frontend.md` の4章・`AGENTS.md` の送り先・画面の見本のファイル・`frontend/client/README.md`

#### 3：会員の側のメンテナンス（新）

- バックエンド：503 と日本語の文・health を通す・出来事で `sessions` を全部消す
- 画面：503 を受けたら、メンテナンスの画面を出す
- 直す文書：`docs/commands.md` にメンテナンスを足す

#### 4：セッションに切り替える（新）

- バックエンド
  - Sanctum の設定・CORS
  - `Auth/AuthController` と `AuthService::login()` に移す
  - ログアウト・`AuthenticateUser` の中身
  - CSRF と 419
  - 例外の文の値を隠す・`auth.rejected`
  - パスワードの変更と再設定で、セッションを消す
- 画面
  - `client.ts` に `credentials` と `X-XSRF-TOKEN`
  - 419 の扱い
  - ログインとログアウトの画面・登録と再設定の画面（CSRF）
- 直す文書：`architecture-backend.md` の2章・8章・`testing.md`・D-021・この節の「`api.php` で管理する」・`docs/api` の curl の例・`auth.md` の curl の手順

#### 5：JWT を消す（新）

- バックエンド：`firebase/php-jwt`・`DummyAuth` の JWT
- 画面：`sessionStorage` の残り
- 直す文書：―

#### 補足

- どのチケットも、最初のコミットで今の動きを確かめるテストを足す
- 4 は、3 のメンテナンスを使って出す（下の「リリースの順番」）
- CSRF（FR-AUTH-018）は、テストの中では Laravel が確かめを飛ばす（`PreventRequestForgery.php:99` の `runningUnitTests()`）。4 のチケットで、確かめを飛ばさない形のテストを作るか、curl で確かめるかを決める
- 4 で、ログインとログアウトのテストには `Origin` を付ける（付けないと、Sanctum がセッションを使わない）

### ログ・エラー通知・監視

- ログに、パスワード・セッションの番号・CSRF のトークン・抜け道の秘密の文字を出さない（FR-AUTH-032・NFR-MAINT-001）
  - SQL のログ（`QueryLogger`）は値を書かない
  - SQL の例外の文も、`mask_bindings_in_exception_messages` で値を隠す。わざと失敗する SQL を流し、文に値が入らないことをテストで確かめる
  - 分かっている不具合：隠せるのは Laravel が渡した値だけ。PostgreSQL が返す文そのもの（一意の制約の違反の `Key (email)=(…)` など）には値が入る。FR-AUTH-032 の範囲の外とした（PR #280 のレビューの A6。2026-11-21 に人が決めた）
- 401・419 は、Laravel がもとからログに出さない（`Handler.php` の `$internalDontReport`）。数えるために、`bootstrap/app.php` の `render` で1行だけ出す
  - 名前：`auth.rejected`
  - 中身（#259 の今）：`reason`（`unauthenticated`・`account_suspended`・`csrf`）・`status`（401・419）・`path`（ルートの形。`api/users/{user_id}` のように、URL の中の番号や再設定の文字を書かない）
  - Cookie の値・セッションの番号は書かない
  - 増えたかは `grep auth.rejected` の件数で見る。`reason` で、ログインしていない（Cookie が届いていない・24時間で切れた）・アカウント停止された会員・CSRF を分けられる
  - 分かっている不具合：設計で決めた、`unauthenticated` を細かく分ける理由（Cookie がない・セッションがない・使えない会員）・`origin`・`requestId`・`userId` は、まだ書かない。`requestId` を `QueryLogger` の外でも使える所（`app/Support/Logging/`）に移すときに、運用の土台のエピックで足す
- ログの `userId` は、中の番号（`users.id`）のまま。ログは外に出さないため
- エラーの通知の仕組みは、まだない。運用の土台のエピックで作る。セッションにすると、表 `sessions` で失敗したときに、ログインしていない画面まで止まる（止まる範囲が広がる）

### リリースの順番（4 のチケット）

0. DB のバックアップを取る
1. 人が、本物の秘密の値のファイルを書き換える（`SESSION_LIFETIME` を 1440 に・画面の `VITE_API_URL` を `http://localhost:8000` に）。古いコードには効かないので、取り込む前でよい
2. `php artisan down --with-secret` でメンテナンスに入れる（全員のセッションが消える）。出た抜け道の URL を、確かめるブラウザで開く
3. 取り込み、`docker compose restart app`・画面の `npm run dev` を起こし直す
4. 値を1つずつ確かめる：`php artisan config:show session.lifetime`・`session.driver`・`sanctum.stateful`・`app.frontend_url`（まとめて出すと鍵の値も出るので、キーを1つずつ指定する）
5. 抜け道のブラウザで確かめる：ログイン・`sessions` に行ができる・`sessionStorage` にトークンがない・書き込みで CSRF・ログアウトで 401・アカウント停止された会員で 401・抜け道のないブラウザは 503。health は `Origin` がなくセッションを通らないので、これだけでは確かめにならない
6. 戻し方を1回試し、もう一度出す
7. `php artisan up` でメンテナンスを解く。会員はログインし直す

### 戻し方

- マイグレーションはない。チケットごとに PR を戻す
- 5 を出したあとは、4 だけを戻せない。戻すときは 5 → 4 の順。5 を戻したら `composer install`（`firebase/php-jwt` を戻す）
- 4 を戻すときは、メンテナンスに入れてから戻す。API と画面を一緒に戻す（同じ PR に入れる）。片方だけだと、だれもログインできない
- 4 を戻すと、会員はもう一度ログインする（JWT を持っていないため）。メンテナンスで `sessionStorage` の古い JWT も使えなくなっている（入れる前のタブの JWT は、期限まで使える。戻すときは、画面の起動のときに `sessionStorage` を消す処理を残す）
- 環境変数は戻さなくてよい（古いコードは `SESSION_LIFETIME` を見ない）
- `sessions` の行は、戻すと自動では消えない（掃除のくじは、セッションを使うリクエストでしか引かれない）。人が `delete from sessions` を流すか、残すかを決める
- 手順：戻すコミットのブランチ → `docker compose restart app` → 5 を戻したら `composer install` → 画面を起こし直す → ログインし直す

### レビュー（design-reviewer・db-reviewer・ops-reviewer）の指摘と扱い

2026-11-20 に3人に見てもらった。指摘は、コードで起きるかを確かめてからまとめた。

| # | 印 | 何を | 扱い |
| --- | --- | --- | --- |
| M1 | must | 切り替えると画面が止まる | 直した |
| M2 | must | ログインの処理の置き場 | 直した |
| M3 | must | パスワードの変更で変えた端末も消える | 直した |
| M4 | must | SQL の例外の文に値が入る | 直した |
| S1 | should | 401・419 の作る所と形 | 直した |
| S2 | should | 「使える会員か」が2か所 | 直した |
| S3 | should | 会員の番号を16か所で読む | 直した |
| S4 | should | ルートのテストが付け忘れを見つけない | 直した |
| S5 | should | 直す文書がどのチケットにもない | 直した |
| S6 | should | SQL の本数の書き方が実際と違う | 直した |
| S7 | should | 10倍のときに見る数字がない | 直した |
| S8 | should | 会員のいない行・行の数の見積もり | 直した |
| S9 | should | array のセッションでは消すテストが確かめない | 直した |
| S10 | should | 401・419 を数える手段がない | 直した |
| S11 | should | 環境変数の書き忘れに気づけない | 直した |
| S12 | should | 戻し方の順番・`sessions` の行 | 直した |
| S13 | should | リリースの順番・health の確かめ | 直した |
| A1 | ask | `IdentifyUser` をいつ消すか | 答えた |
| A2 | ask | 会員を2回読まないか | 答えた |
| A3 | ask | ログインの応答の中身・ログアウトの 204 | 答えた |
| A4 | ask | `users` を物理的に消す処理はあるか | 答えた |
| A5 | ask | ログの `userId` | 答えた |
| A6 | ask | 管理画面と Cookie の名前を分けるか | 答えた |
| N1〜N6 | nits | 細かい誤り6つ | 直した |

#### M1（must）：切り替えると画面が止まる

- 指摘
  - 画面の準備がないまま切り替えると、画面が止まる
  - ログインの判定が `sessionStorage`・登録と再設定が 419・送り先が `127.0.0.1`・401 や 419 でログインの画面に移す処理がない
- 扱い
  - 直した：画面は各チケットで一緒に直す（人が決めた）
  - 2 で `client.ts`・送り先・ログインの判定、4 で CSRF と 419
  - 切り替えはメンテナンスの中で行う

#### M2（must）：ログインの処理の置き場

- 指摘
  - ログインの処理の置き場が決まっていない
  - `Auth::attempt()` を先に呼ぶと、アカウント停止された会員の確かめより前にログインの状態ができる
- 扱い
  - 直した：`AuthService::login()` が照合とアカウント停止された会員の確かめ、Controller がセッション
  - `architecture-backend.md` の2章に書き足す（4）

#### M3（must）：パスワードの変更で変えた端末も消える

- 指摘
  - パスワードの変更で全部消すと、変えた端末もログアウトされる
  - 受け持つチケットがない
- 扱い
  - 直した：`logoutOtherDevices()` と `AuthenticateSession`
  - 再設定・退会は全部消す
  - 4 で受け持つ

#### M4（must）：SQL の例外の文に値が入る

- 指摘：SQL の例外の文に、セッションの番号やメールアドレスが入る
- 扱い：直した：`mask_bindings_in_exception_messages` とテスト（4）

#### S1（should）：401・419 の作る所と形

- 指摘
  - 401・419 の作る所と形
  - 24時間で切れたあとは 419 になる
- 扱い
  - 直した：`bootstrap/app.php` で日本語の文
  - 画面は 419 もログインの画面へ

#### S2（should）：「使える会員か」が2か所

- 指摘
  - 「使える会員か」が2か所
  - Service の名前がずれる
- 扱い
  - 直した：`User::isAccountUsable()` の1か所
  - Service は `Auth/AuthService`

#### S3（should）：会員の番号を16か所で読む

- 指摘
  - ログインした会員の番号を16か所で読む
  - 付け忘れで「会員 0 番」
- 扱い：直した：基底の Controller の `loginUserId()`

#### S4（should）：ルートのテストが付け忘れを見つけない

- 指摘：ルートのテストが付け忘れを見つけない
- 扱い：直した：「ログインが要らないルートを引いた残り」で作る

#### S5（should）：直す文書がどのチケットにもない

- 指摘：直す文書がどのチケットにもない
- 扱い：直した：チケットの表に「直す文書」の列

#### S6（should）：SQL の本数の書き方が実際と違う

- 指摘：SQL の本数の書き方が実際と違う（行全体の update・応答の前・くじ）
- 扱い：直した：DB の節

#### S7（should）：10倍のときに見る数字がない

- 指摘：10倍のときに見る数字がない
- 扱い：直した：`pg_stat_user_tables` の SQL と、置き場を替える目安

#### S8（should）：会員のいない行・行の数の見積もり

- 指摘：会員のいない行・行の数の見積もり
- 扱い
  - 直した：`regenerate(true)`・数え方・測る SQL
  - `/sanctum/csrf-cookie` とログインに回数の上限を付けるかは、4 で決める

#### S9（should）：array のセッションでは消すテストが確かめない

- 指摘：テストの array のセッションでは、消すテストが何も確かめない
- 扱い：直した：そのテストだけ DB に置く

#### S10（should）：401・419 を数える手段がない

- 指摘：401・419 を数える手段がない
- 扱い：直した：`auth.rejected`

#### S11（should）：環境変数の書き忘れに気づけない

- 指摘：環境変数の書き忘れに気づけない
- 扱い：直した：`stateful` の既定を `FRONTEND_URL` から作る・`config:show` で1つずつ確かめる

#### S12（should）：戻し方の順番・`sessions` の行

- 指摘：戻し方の順番・`sessions` の行が自動で消えない
- 扱い：直した：戻し方の節

#### S13（should）：リリースの順番・health の確かめ

- 指摘：リリースの順番と、health では確かめにならないこと
- 扱い：直した：リリースの順番の節（メンテナンスの中で確かめる）

#### A1（ask）：`IdentifyUser` をいつ消すか

- 指摘：`IdentifyUser` をいつ消すか
- 扱い：1 で消す（使う所がなくなる）

#### A2（ask）：会員を2回読まないか

- 指摘：会員を2回読まないか
- 扱い：ガードが読んだ会員を判定に渡す

#### A3（ask）：ログインの応答の中身・ログアウトの 204

- 指摘：ログインの応答の中身・ログアウトの 204
- 扱い
  - ログインは `GET /api/me` と同じ形
  - 画面はログアウトの本文を読まない

#### A4（ask）：`users` を物理的に消す処理はあるか

- 指摘：`users` を物理的に消す処理はあるか
- 扱い
  - 今は試しのデータだけ
  - 外部キーを付けない理由を DB の節に書いた

#### A5（ask）：ログの `userId`

- 指摘：ログの `userId`
- 扱い：中の番号のまま

#### A6（ask）：管理画面と Cookie の名前を分けるか

- 指摘：管理画面と Cookie の名前を分けるか
- 扱い：管理画面の認証を決めるときに分ける（メモ）

#### N1〜N6（nits）：細かい誤り6つ

- 指摘
  - 数の誤り（16 → 15）
  - 計画のページの誤り
  - 「トークン（セッション）」の言い方
  - 2038年
  - 見本にもうある `APP_URL`
  - `SESSION_DOMAIN` のずれ
- 扱い：直した（2038年は、知っていることとして DB の節に書いた）

## 決めたこと・決めなかったこと・宿題

- 決めたこと：テストの考え方と置き場（上）。API の URL とルートの設計（上。2026-11-16）
- 決めなかったこと：チケットの Size と順番
- 宿題：人が、`POST /api/me/likes` に観点を当てはめて、確かめるテストを3つ挙げる（練習。急がない）。1回目の答えは「認証まわりやいいねなど」。名前の形（〜のとき、〜になる）にするのが次の一歩
