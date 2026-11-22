# 06 ブロックと退会

状態：**実装済み（レガシー版）**（PR は #74 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/blocks.md](../requirements/blocks.md)（FR-BLOCK-001〜015・NFR-BLOCK-001〜002）・[requirements/withdrawal.md](../requirements/withdrawal.md)（FR-WD-001〜014・NFR-WD-001〜002）。表は `blocks`・`users.deleted_at`（[data-model.md](../data-model.md)）。解説：`explanations/06-blocks-withdrawal.html`（`legacy-repo`）。

ブロックは「ログインした本人がしたもの」なので `/api/me/blocks` の下に置き、相手は会員の `public_id`（UUID）で指す。退会は「本人を消す」ので `DELETE /api/me`。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `POST /api/me/blocks` | ブロックする | 作る（`BlockController::store`） | 作る |
| `GET /api/me/blocks` | ブロックした相手の一覧 | 作る（`BlockController::index`） | 作る |
| `DELETE /api/me/blocks/{public_id}` | 解除する | 作る（`BlockController::destroy`） | 作る |
| `DELETE /api/me` | 退会する | 作る（`UserController::destroy`） | 作る |
| 検索・いいね・マッチ・トークの一覧（04・02・03・05） | ブロックした・された相手を除く | 一覧ごとにコピーする（下の「今ある API に足すこと」） | スコープ1か所 |
| 検索・プロフィール・いいね・マッチ・トークの一覧（01・04・02・03・05） | 退会・アカウント停止・強制退会の相手を除く | 検索だけが退会した会員（強制退会を含む）を除く | `User::accountUsable()` の1か所（下の「#269 で変えたこと」） |

レガシー版は、これまでと同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理をコピーする。4つ足して 10〜13か所目）。JWT を読むだけで、会員がいるか・退会したかは見ない。入力も確かめず、エラーの扱いは考えない。

## `POST /api/me/blocks`（ブロックする）

### だれが使えるか

- レガシー版（legacy-repo）：正しい JWT（`Authorization: Bearer`）を持つ人
  - 確認していない会員・退会した会員の JWT でも使える
- 改善版（refactored-repo）：正しい `access` の Cookie を持ち、メールアドレスを確認した、退会していない会員（FR-BLOCK-014・015・FR-WD-004）

### 入力（JSON）

- レガシー版：`{"user_id": "019a…"}`（相手の `public_id`）。確かめない
- 改善版：`user_id`：必須・UUID の形

### 応答（成功）

- レガシー版：`201`。入れた `blocks` の行
  - **`id`・`blocker_id`・`blocked_id` の中の連番がそのまま出る**・日時
- 改善版：1回目 `201`・2回目 `200`。`{"data": {"user_id": "019a…", "blocked_at": "…"}}`

### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `500`：JWT が壊れている・**同じ相手を2回**（UNIQUE の違反）・**いない相手**（`blocked_id` が `null` で NOT NULL の違反）・UUID の形でない文字
  - **自分・退会した相手は `201`**（入ってしまう）
- 改善版
  - `401`・`403`
  - `404`（いない・退会した相手。FR-BLOCK-004）
  - `422`（自分。FR-BLOCK-003）

### 流れる SQL の目安

- レガシー版：2本（相手の `id`・insert）
- 改善版：2本＋ガード1本（退会していない相手・`insert … on conflict do nothing`）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/me/blocks -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"user_id":"<public_id>"}'`
- 改善版：`-b cookies.txt` で同じ

## `GET /api/me/blocks`（ブロックした相手の一覧）

### だれが使えるか

- レガシー版：正しい JWT を持つ人（自分がした分だけ）
- 改善版：`POST` と同じ

### 入力

- レガシー版：なし（件数の上限とページ送りはなし。全部返す）
- 改善版：同じ

### 並び

- レガシー版：`created_at` の新しい順（同じ秒の並びは決まらない）
- 改善版：`created_at`・`id` の新しい順（FR-BLOCK-010）

### 応答（成功）

- レガシー版：`200`。配列
  - 1件は `{"user_id": "019a…", "nickname": "香織", "image": "/images/avatars/demo-3.svg", "blocked_at": "…"}`
  - **退会した相手も出る**
- 改善版：`200` `{"data": [{"user_id": "019a…", "nickname": "香織", "avatar_url": "…", "blocked_at": "…"}]}`
  - 退会した相手は出さない

### 応答（失敗）

- レガシー版：`401`・`500`（JWT が壊れている）
- 改善版：`401`・`403`

### 流れる SQL の目安

- レガシー版：**1＋2N 本**（ブロックの行・1件ごとにプロフィールと `public_id`）
  - `search00001` は 27件で 55本
- 改善版：1本＋ガード1本（`users`・`profiles` と JOIN）

## `DELETE /api/me/blocks/{public_id}`（解除する）

### だれが使えるか

- レガシー版：正しい JWT を持つ人（自分がした分だけ消える）
- 改善版：`POST` と同じ

### 応答（成功）

- レガシー版：`204`。**消すものがなくても `204`**
  - いない相手・ブロックしていない相手・相手がした「自分へのブロック」を指したとき。何も消えない
- 改善版：`204`

### 応答（失敗）

- レガシー版：`401`・`500`（JWT が壊れている・UUID の形でない文字）
- 改善版：`401`・`403`・`404`（自分がしたブロックがない。FR-BLOCK-012）

### 流れる SQL の目安

- レガシー版：2本（相手の `id`・delete）
- 改善版：1本＋ガード1本（`users` と JOIN して delete）

## `DELETE /api/me`（退会する）

### だれが使えるか

- レガシー版：正しい JWT を持つ人
  - **退会した会員の JWT でも、もう一度退会できる**（メールアドレスにもう1回 `#deleted#…` が付く）
- 改善版：正しい `access` の Cookie を持つ、退会していない会員（FR-WD-011）

### 入力（JSON）

- レガシー版：`{"password": "…"}`。確かめない
- 改善版：`password`：必須

### 何をするか

- レガシー版
  - パスワードを確かめる
  - メールアドレスを `<元のメールアドレス>#deleted#<UNIX 時刻>` に書き換え、`deleted_at` を今にする（1本の update）
  - JWT はそのまま
- 改善版
  - `deleted_at` を今にする（`SoftDeletes`）
  - メールアドレスは書き換えない（部分インデックスの UNIQUE）
  - Cookie を消す

### 応答（成功）

- レガシー版：`204`
- 改善版：`204`

### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `422` `{"message": "パスワードが違います"}`：パスワードが違う・ない
  - `500`：JWT が壊れている・**書き換えたメールアドレスが 255文字を超える**（元が 237文字以上）
- 改善版：`401`・`422`（`errors.password`。FR-WD-002）

### 流れる SQL の目安

- レガシー版：2本（会員・update）
- 改善版：1本＋ガード1本（update）

### curl の例

- レガシー版：`curl -X DELETE http://127.0.0.1:8000/api/me -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"password":"password"}'`
- 改善版：`-b cookies.txt` で同じ

### 退会したあと（レガシー版）

- ログイン：メールアドレスが書き換わっているので、`メールアドレスが違います`（`401`）
  - 要件の「同じ文」は守れない（01b のレガシー版から、文で登録の有無が分かる）
- 同じメールアドレスで登録：空いたので `201`（FR-WD-008・010）
- 持っていた JWT：会員を見ないので、どの API もそのまま使える（FR-WD-004）

## 今ある API に足すこと（レガシー版）

ブロックした・された相手の ID を、向きごとに PHP に持ってきて除く（3行を一覧ごとにコピーする。SQL が2本ずつ増える）。

```php
$blocked = Block::where('blocker_id', $me)->pluck('blocked_id');        // 自分がブロックした（UNIQUE の先頭なので索引が効く）
$blockedMe = Block::where('blocked_id', $me)->pluck('blocker_id');      // 自分をブロックした（索引がなく、表を全部読む）
$blockIds = $blocked->merge($blockedMe);
```

| API | 足すこと | 退会した相手 | 流れる SQL の目安 |
| --- | --- | --- | --- |
| `GET /api/users`（検索。04） | `whereNotIn('id', $blockIds)` と `whereNull('deleted_at')` | 除く（ここにだけ書く） | 1＋N に2本足す |
| `GET /api/me/likes`（送ったいいね。02） | `whereNotIn('to_user_id', $blockIds)` | **出る** | 1＋3N に2本足す |
| `GET /api/me/matches`（03） | ループの中で、相手が `$blockIds` にあれば飛ばす（相手のプロフィールを読む前に） | **出る** | 1＋2N（除いた相手の分は減る）に2本足す |
| `GET /api/me/talk-rooms`（05） | ループの中で、相手が分かったところで `$blockIds` にあれば飛ばす | **出る** | 1＋6N（除いた相手の分は、ルームと相手の2本だけ）に2本足す |

足さない（コピーし忘れる）ところ。ここでは、ブロックした・された相手も、退会した相手もそのまま使える：
- `GET /api/users/{public_id}`（プロフィール。ログインが要らない API なので、だれが見ているかが分からない）
- `POST /api/me/likes`（いいねを送る。ブロックした相手ともマッチできる）
- `GET`・`POST /api/me/talk-rooms/{public_id}/messages`（ルームの UUID を知っていれば、ブロックした相手と読み書きできる）
- `GET /api/me`・JWT を読むすべての API（退会した人の JWT が使える）

## レガシー版で起きること（#74 で測った。改善する段階で要件 ID のテストにする）

開発用の DB（会員 2万人・マッチ 1000組・メッセージ 10万件・ブロック 30,054件・退会した会員 1,025人。`BlocksSeeder`）で、手元から本物の HTTP（`127.0.0.1:8000`）を送り、SQL はクエリログ（`sql-*.log`）の増えた行で数えた。会員は `search00001`。JWT は外に出していない。試しに書いたもの（ブロック・メッセージ・いいね・マッチ・試しの会員）は消した。時間は手元の Docker で1回ずつ。

- 検索：ブロックした・された・お互いの相手（マッチしていない相手を、都道府県・年齢・性別で絞った）
  - レガシー版：どれも出ない
  - 要件：FR-BLOCK-005
- 検索：退会した相手・関係のない相手（比べ）
  - レガシー版：出ない・出る
  - 要件：FR-WD-005
- 絞らない検索
  - レガシー版：`200`・20人・SQL 25本（04 の 1＋N に2本足した）・53ms
  - 要件：NFR-BLOCK-001
- 送ったいいね・マッチ・トークの一覧（89件。100 のうち、ブロックした・された・お互いの 11人が消えた）
  - レガシー版：**ブロックした・された相手は出ない。退会した相手（`search00014`）は3つとも出る**
  - SQL 270本・181本・559本。129ms・96ms・704ms
  - 要件：FR-BLOCK-007〜009・FR-WD-006
- ブロックした相手のプロフィール・そのルームの履歴・そのルームに送る
  - レガシー版：**`200`・`200`（50件）・`201`**
  - 要件：FR-BLOCK-006・009
- `search00001` をブロックした人（`search00221`）から、`search00001` にいいね
  - レガシー版：**`201`**
  - 要件：FR-BLOCK-007
- ブロックの一覧（27件）
  - レガシー版：`200`・SQL 55本（1＋2N）・57ms
  - 要件：FR-BLOCK-010
- ブロックする
  - レガシー版：`201`・SQL 2本。応答は `blocks` の行（`id`・`blocker_id`・`blocked_id` の中の連番）
  - 要件：FR-BLOCK-001
- 同じ相手をもう一度
  - レガシー版：**`500`**（`23505` UNIQUE の違反）
  - 要件：FR-BLOCK-002
- 自分・退会した相手
  - レガシー版：**`201`・`201`**（入る。一覧に退会した相手が出る）
  - 要件：FR-BLOCK-003・004
- いない相手・UUID の形でない文字
  - レガシー版：`500`（`23502` NOT NULL の違反）・`500`
  - 要件：FR-BLOCK-004
- 解除する
  - レガシー版：`204`・SQL 2本
  - 要件：FR-BLOCK-011
- 相手（`search00008`）がした「自分へのブロック」を解除・いない相手を解除
  - レガシー版：**`204`（行は残る）・`204`**
  - 要件：FR-BLOCK-012
- トークンなしでブロック・退会
  - レガシー版：`401`・`401`
  - 要件：FR-BLOCK-014・FR-WD-011
- 退会：違うパスワード・正しいパスワード
  - レガシー版：`422`（`パスワードが違います`）・`204`（SQL 2本。メールアドレスは `<元>#deleted#<UNIX 時刻>`）
  - 要件：FR-WD-001・002
- 退会したあと、同じメールアドレスとパスワードでログイン
  - レガシー版：`401`（`メールアドレスが違います`。退会したことは言わないが、01b と同じく「登録がない」と分かる文）
  - 要件：FR-WD-003
- 退会したあと、古い JWT で `/me`・`/me/matches`・検索
  - レガシー版：**`200`・`200`・`200`**
  - 要件：FR-WD-004
- 古い JWT でもう一度退会
  - レガシー版：**`204`**（メールアドレスが `<元>#deleted#…#deleted#…` になる）
  - 要件：FR-WD-004
- 同じメールアドレスで登録し直す・2回退会したあとに登録し直す
  - レガシー版：`201`・`201`（同じメールアドレスから始まる行が3行）
  - 要件：FR-WD-008・010
- 253文字のメールアドレスで登録して退会
  - レガシー版：**`500`**（`22001`。書き換えると 255文字を超える）
  - 要件：FR-WD-001
- シーダーで退会にした会員（メールアドレスは書き換えていない）でログイン
  - レガシー版：**`200`**（ログインは `deleted_at` を見ない。退会の API を通さずに `deleted_at` だけが入った行は、ログインできる）
  - 要件：FR-WD-003
- `blocks where blocked_id = ?`（私をブロックした人）の実行計画
  - レガシー版：`Seq Scan`・27行のために 30,027行を捨てる・shared hit 752・2.0ms。検索・いいね・マッチ・トークの一覧のたびに流れる
  - 要件：NFR-BLOCK-002
- `blocks where blocker_id = ?`（私がブロックした人）
  - レガシー版：`Index Only Scan`（UNIQUE の索引）・shared hit 9・0.05ms
  - 要件：NFR-BLOCK-002

## #269 で変えたこと（退会・アカウント停止・強制退会の相手を除く。refactored-repo）

状態：**実装済み（refactored-repo）**。要件は FR-WD-005・006・013・014・NFR-WD-002。

- 除く条件は、`User` の Model のスコープ `accountUsable()` の1か所に置いた
  - 条件：`deleted_at`・`suspended_at`・`banned_at` がどれも `null`
  - `User::accountStatus()` が「使える（`Usable`）」になる行と同じ条件を、SQL で書いたもの。2つがそろうことは `tests/Feature/AccountUsableTest.php` で確かめる
  - 管理画面の強制退会は、`banned_at` と一緒に `deleted_at` も入れる（`backend/admin` の `NoticeController`）。そのため、強制退会された会員は、前から検索には出ていなかった
- 古い Controller は、Controller → Service → Model に移していない。スコープを呼ぶ行だけを足した
- 行（いいね・マッチ・トークルーム・メッセージ）は消さない。アカウント停止が解かれたら、また出る

### API ごとの今の動き

- `GET /api/users`（検索。`UserController::index`）
  - 会員の一覧の SQL に `accountUsable()` を足した（前は `whereNull('deleted_at')` だけで、アカウント停止された会員が出ていた）
  - SQL の本数は増えない。実行計画も、前と同じ（下の「測ったこと」）
- `GET /api/users/{public_id}`（プロフィール。`ProfileService::showProfile`）・`PUT /api/users/{public_id}`（書き換え。`ProfileService::updateProfile`）
  - 会員を探す SQL に `accountUsable()` を足した。除く会員は `404`「会員が見つかりません」（いない会員と同じ）
  - 前は、退会・アカウント停止・強制退会の会員も `200` で見られ、書き換えもできた（FR-WD-005 の分かっている不具合も、一緒に直った）
  - 本人が自分を直す使い方は変わらない（ログインを確かめる Middleware が、使える会員だけを通すため）
- `GET /api/me/likes`（送ったいいね。`LikeController::index`）・`GET /api/me/received-likes`（届いたいいね。`ReceivedLikeController::index`）
  - いいねの一覧の SQL に、相手の会員が `accountUsable()` であること（`exists` の相関サブクエリ）を足した
  - 送ったいいねは `whereHas('toUser', …)`、届いたいいねは `whereHas('fromUser', …)`
  - SQL の本数は増えない。除いた相手の分だけ、1件ごとの SQL が減る
- `GET /api/me/matches`（マッチ。`UserMatchController::index`）・`GET /api/me/talk-rooms`（トーク。`TalkRoomController::index`）
  - 相手は PHP のループの中で決まるので、相手の `public_id` を読む1件ごとの SQL に `accountUsable()` を足した。読めなければ、その相手を飛ばす
  - その SQL を、プロフィールを読む前に動かした。SQL の本数は増えず、除いた相手の分だけ減る
  - 分かっている不具合：1件ごとに SQL を流す形（1＋N）は、そのまま

### 除いていない所（このチケットの範囲の外。続きは #288）

コードを読んで確かめた（API テストでは確かめていない）。どれも、続きのチケット #288 で、要件を決めてから直す。

- `GET`・`POST /api/me/talk-rooms/{public_id}/messages`（ルームの履歴と送る）：ルームの番号を知っていれば、相手がアカウント停止でも読み書きできる（FR-WD-006 の後半。要確認）
- `POST /api/me/likes`（いいね）・`POST /api/me/blocks`（ブロック）・`POST /api/me/skips`（スキップ）・`POST /api/me/reports`（通報）：相手がアカウント停止でも通る（FR-WD-007 と同じ決まりを当てはめるかは、まだ決めていない）
- `GET /api/me/blocks`・`GET /api/me/skips`（ブロック・スキップの一覧）：相手がアカウント停止でも出る
- Firestore の受信箱とメッセージ（05c）：Laravel の外なので、出たまま
- 画面の `UserPage.tsx`（プロフィールの 404 を受け止めない）・`TalkPage.tsx`（開いている間に相手が除かれると、ブロックが 500 なのに「ブロックしました」と出る）

### 測ったこと（2026-11-22）

- SQL の本数（API テスト。使える相手1人と、退会・アカウント停止・強制退会の相手を1人ずつ置く）
  - 前の本数は、#269 の前のコード（`origin/refactored-repo` の Controller と Service）に戻したコピーで、同じテストを流して測った
  - 強制退会の会員は、管理画面と同じく `deleted_at` も入れて作った（はじめに測った「前は11本」は、`deleted_at` のない、本物にはない形で測っていたので、測り直した）

| API | 前 | 後 | 前に多かった分 |
| --- | --- | --- | --- |
| 検索（`SearchTest.php`） | 10本 | 9本 | アカウント停止の1人のプロフィール |
| 送ったいいね（`ListSentLikesTest.php`） | 17本 | 8本 | 3人 × 3本（プロフィール・マッチ済みか・`public_id`） |
| 届いたいいね（`ListReceivedLikesTest.php`） | 15本 | 9本 | 3人 × 2本（プロフィール・`public_id`） |
| マッチ（`ListMatchesTest.php`） | 13本 | 10本 | 3人のプロフィール |
| トーク（`ListTalkRoomsTest.php`） | 29本 | 20本 | 3つのルーム × 3本（プロフィール・最新の1件・未読の数） |

- 後の本数の内訳は、それぞれのテストのコメントに書いた。除く相手の分は、相手を確かめる所で止まり、その先の SQL が流れない
- 実行計画（開発用の DB。会員 20,030人・退会 1,025人・アカウント停止と強制退会は 0人。`search00001` で、女性を絞らずに 20人）
  - 前と後で同じ形：`users` を全部読む（Seq Scan）・`profiles` を Hash Semi Join・shared hit 2,467・8〜9ms
  - 後は、Seq Scan の Filter に `suspended_at IS NULL`・`banned_at IS NULL` が足されただけ。読むページの数は変わらない
  - 索引は、前も後も使っていない。除く会員はふつう少なく、条件で絞れる行が少ないので、今は索引を足していない（会員が増えたときの検索の速さは、検索を移すチケットで測る）

