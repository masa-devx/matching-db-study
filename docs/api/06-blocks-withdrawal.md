# 06 ブロックと退会

状態：**実装済み（レガシー版）**（PR は #74 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/blocks.md](../requirements/blocks.md)（FR-BLOCK-001〜015・NFR-BLOCK-001〜002）・[requirements/withdrawal.md](../requirements/withdrawal.md)（FR-WD-001〜011・NFR-WD-001〜002）。表は `blocks`・`users.deleted_at`（[data-model.md](../data-model.md)）。解説：`explanations/06-blocks-withdrawal.html`（`legacy-repo`）。

ブロックは「ログインした本人がしたもの」なので `/api/me/blocks` の下に置き、相手は会員の `public_id`（UUID）で指す。退会は「本人を消す」ので `DELETE /api/me`。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `POST /api/me/blocks` | ブロックする | 作る（`BlockController::store`） | 作る |
| `GET /api/me/blocks` | ブロックした相手の一覧 | 作る（`BlockController::index`） | 作る |
| `DELETE /api/me/blocks/{public_id}` | 解除する | 作る（`BlockController::destroy`） | 作る |
| `DELETE /api/me` | 退会する | 作る（`UserController::destroy`） | 作る |
| 検索・いいね・マッチ・トークの一覧（04・02・03・05） | ブロックした・された相手を除く | 一覧ごとに写す（下の「今ある API に足すこと」） | スコープ1か所 |

レガシー版は、これまでと同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理を写す。4つ足して 10〜13か所目）。JWT を読むだけで、会員がいるか・退会したかは見ない。入力も確かめず、エラーの扱いは考えない。

## `POST /api/me/blocks`（ブロックする）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT（`Authorization: Bearer`）を持つ人。確認していない会員・退会した会員の JWT でも使える | 正しい `access` の Cookie を持ち、メールアドレスを確認した、退会していない会員（FR-BLOCK-014・015・FR-WD-004） |
| 入力（JSON） | `{"user_id": "019a…"}`（相手の `public_id`）。確かめない | `user_id`：必須・UUID の形 |
| 応答（成功） | `201`。入れた `blocks` の行（**`id`・`blocker_id`・`blocked_id` の中の連番がそのまま出る**・日時） | 1回目 `201`・2回目 `200`。`{"data": {"user_id": "019a…", "blocked_at": "…"}}` |
| 応答（失敗） | `401`：`Authorization` がない。`500`：JWT が壊れている・**同じ相手を2回**（UNIQUE の違反）・**いない相手**（`blocked_id` が `null` で NOT NULL の違反）・UUID の形でない文字。**自分・退会した相手は `201`**（入ってしまう） | `401`・`403`・`404`（いない・退会した相手。FR-BLOCK-004）・`422`（自分。FR-BLOCK-003） |
| 流れる SQL の目安 | 2本（相手の `id`・insert） | 2本＋ガード1本（退会していない相手・`insert … on conflict do nothing`） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/me/blocks -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"user_id":"<public_id>"}'` | `-b cookies.txt` で同じ |

## `GET /api/me/blocks`（ブロックした相手の一覧）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人（自分がした分だけ） | `POST` と同じ |
| 入力 | なし（件数の上限とページ送りはなし。全部返す） | 同じ |
| 並び | `created_at` の新しい順（同じ秒の並びは決まらない） | `created_at`・`id` の新しい順（FR-BLOCK-010） |
| 応答（成功） | `200`。配列。1件は `{"user_id": "019a…", "nickname": "香織", "image": "/images/avatars/demo-3.svg", "blocked_at": "…"}`。**退会した相手も出る** | `200` `{"data": [{"user_id": "019a…", "nickname": "香織", "avatar_url": "…", "blocked_at": "…"}]}`（退会した相手は出さない） |
| 応答（失敗） | `401`・`500`（JWT が壊れている） | `401`・`403` |
| 流れる SQL の目安 | **1＋2N 本**（ブロックの行・1件ごとにプロフィールと `public_id`）。`search00001` は 27件で 55本 | 1本＋ガード1本（`users`・`profiles` と JOIN） |

## `DELETE /api/me/blocks/{public_id}`（解除する）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人（自分がした分だけ消える） | `POST` と同じ |
| 応答（成功） | `204`。**消すものがなくても `204`**（いない相手・ブロックしていない相手・相手がした「自分へのブロック」を指したとき。何も消えない） | `204` |
| 応答（失敗） | `401`・`500`（JWT が壊れている・UUID の形でない文字） | `401`・`403`・`404`（自分がしたブロックがない。FR-BLOCK-012） |
| 流れる SQL の目安 | 2本（相手の `id`・delete） | 1本＋ガード1本（`users` と JOIN して delete） |

## `DELETE /api/me`（退会する）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人。**退会した会員の JWT でも、もう一度退会できる**（メールアドレスにもう1回 `#deleted#…` が付く） | 正しい `access` の Cookie を持つ、退会していない会員（FR-WD-011） |
| 入力（JSON） | `{"password": "…"}`。確かめない | `password`：必須 |
| 何をするか | パスワードを確かめ、メールアドレスを `<元のメールアドレス>#deleted#<UNIX 時刻>` に書き換え、`deleted_at` を今にする（1本の update）。JWT はそのまま | `deleted_at` を今にする（`SoftDeletes`）。メールアドレスは書き換えない（部分インデックスの UNIQUE）。Cookie を消す |
| 応答（成功） | `204` | `204` |
| 応答（失敗） | `401`：`Authorization` がない。`422` `{"message": "パスワードが違います"}`：パスワードが違う・ない。`500`：JWT が壊れている・**書き換えたメールアドレスが 255文字を超える**（元が 237文字以上） | `401`・`422`（`errors.password`。FR-WD-002） |
| 流れる SQL の目安 | 2本（会員・update） | 1本＋ガード1本（update） |
| curl の例 | `curl -X DELETE http://127.0.0.1:8000/api/me -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"password":"password"}'` | `-b cookies.txt` で同じ |

退会したあと（レガシー版）：
- ログイン：メールアドレスが書き換わっているので、`メールアドレスが違います`（`401`）。要件の「同じ文」は守れない（01b のレガシー版から、文で登録の有無が分かる）
- 同じメールアドレスで登録：空いたので `201`（FR-WD-008・010）
- 持っていた JWT：会員を見ないので、どの API もそのまま使える（FR-WD-004）

## 今ある API に足すこと（レガシー版）

ブロックした・された相手の ID を、向きごとに PHP に持ってきて除く（3行を一覧ごとに写す。SQL が2本ずつ増える）。

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

足さない（写し忘れる）ところ。ここでは、ブロックした・された相手も、退会した相手もそのまま使える：
- `GET /api/users/{public_id}`（プロフィール。ログインが要らない API なので、だれが見ているかが分からない）
- `POST /api/me/likes`（いいねを送る。ブロックした相手ともマッチできる）
- `GET`・`POST /api/me/talk-rooms/{public_id}/messages`（ルームの UUID を知っていれば、ブロックした相手と読み書きできる）
- `GET /api/me`・JWT を読むすべての API（退会した人の JWT が使える）

## レガシー版で起きること（#74 で測った。改善する段階で要件 ID のテストにする）

開発用の DB（会員 2万人・マッチ 1000組・メッセージ 10万件・ブロック 30,054件・退会した会員 1,025人。`BlocksSeeder`）で、手元から本物の HTTP（`127.0.0.1:8000`）を送り、SQL はクエリログ（`sql-*.log`）の増えた行で数えた。会員は `search00001`。JWT は外に出していない。試しに書いたもの（ブロック・メッセージ・いいね・マッチ・試しの会員）は消した。時間は手元の Docker で1回ずつ。

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| 検索：ブロックした・された・お互いの相手（マッチしていない相手を、都道府県・年齢・性別で絞った） | どれも出ない | FR-BLOCK-005 |
| 検索：退会した相手・関係のない相手（比べ） | 出ない・出る | FR-WD-005 |
| 絞らない検索 | `200`・20人・SQL 25本（04 の 1＋N に2本足した）・53ms | NFR-BLOCK-001 |
| 送ったいいね・マッチ・トークの一覧（89件。100 のうち、ブロックした・された・お互いの 11人が消えた） | **ブロックした・された相手は出ない。退会した相手（`search00014`）は3つとも出る**。SQL 270本・181本・559本。129ms・96ms・704ms | FR-BLOCK-007〜009・FR-WD-006 |
| ブロックした相手のプロフィール・そのルームの履歴・そのルームに送る | **`200`・`200`（50件）・`201`** | FR-BLOCK-006・009 |
| `search00001` をブロックした人（`search00221`）から、`search00001` にいいね | **`201`** | FR-BLOCK-007 |
| ブロックの一覧（27件） | `200`・SQL 55本（1＋2N）・57ms | FR-BLOCK-010 |
| ブロックする | `201`・SQL 2本。応答は `blocks` の行（`id`・`blocker_id`・`blocked_id` の中の連番） | FR-BLOCK-001 |
| 同じ相手をもう一度 | **`500`**（`23505` UNIQUE の違反） | FR-BLOCK-002 |
| 自分・退会した相手 | **`201`・`201`**（入る。一覧に退会した相手が出る） | FR-BLOCK-003・004 |
| いない相手・UUID の形でない文字 | `500`（`23502` NOT NULL の違反）・`500` | FR-BLOCK-004 |
| 解除する | `204`・SQL 2本 | FR-BLOCK-011 |
| 相手（`search00008`）がした「自分へのブロック」を解除・いない相手を解除 | **`204`（行は残る）・`204`** | FR-BLOCK-012 |
| トークンなしでブロック・退会 | `401`・`401` | FR-BLOCK-014・FR-WD-011 |
| 退会：違うパスワード・正しいパスワード | `422`（`パスワードが違います`）・`204`（SQL 2本。メールアドレスは `<元>#deleted#<UNIX 時刻>`） | FR-WD-001・002 |
| 退会したあと、同じメールアドレスとパスワードでログイン | `401`（`メールアドレスが違います`。退会したことは言わないが、01b と同じく「登録がない」と分かる文） | FR-WD-003 |
| 退会したあと、古い JWT で `/me`・`/me/matches`・検索 | **`200`・`200`・`200`** | FR-WD-004 |
| 古い JWT でもう一度退会 | **`204`**（メールアドレスが `<元>#deleted#…#deleted#…` になる） | FR-WD-004 |
| 同じメールアドレスで登録し直す・2回退会したあとに登録し直す | `201`・`201`（同じメールアドレスから始まる行が3行） | FR-WD-008・010 |
| 253文字のメールアドレスで登録して退会 | **`500`**（`22001`。書き換えると 255文字を超える） | FR-WD-001 |
| シーダーで退会にした会員（メールアドレスは書き換えていない）でログイン | **`200`**（ログインは `deleted_at` を見ない。退会の API を通さずに `deleted_at` だけが入った行は、ログインできる） | FR-WD-003 |
| `blocks where blocked_id = ?`（私をブロックした人）の実行計画 | `Seq Scan`・27行のために 30,027行を捨てる・shared hit 752・2.0ms。検索・いいね・マッチ・トークの一覧のたびに流れる | NFR-BLOCK-002 |
| `blocks where blocker_id = ?`（私がブロックした人） | `Index Only Scan`（UNIQUE の索引）・shared hit 9・0.05ms | NFR-BLOCK-002 |
