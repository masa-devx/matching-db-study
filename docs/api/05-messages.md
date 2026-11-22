# 05 メッセージ

状態：**実装済み（レガシー版）**（PR は #58 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/messages.md](../requirements/messages.md)（FR-MSG-001〜014・NFR-MSG-001〜004）。表は `talk_rooms`・`talk_room_members`・`messages`（[data-model.md](../data-model.md)・D-023）。解説：`explanations/05-messages.html`（`legacy-repo`）。

トークルームは「ログインした本人が参加しているもの」なので、`/api/me/talk-rooms` の下に置く。1つのルームは `public_id`（UUID）で指し、メッセージはその下に入れ子にする（決まり「持ち主の下にあるものは入れ子にする」）。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `GET /api/me/talk-rooms` | トークの一覧（相手ごとの最新の1件・未読の数） | 作る | 作る |
| `GET /api/me/talk-rooms/{public_id}/messages` | トークの履歴（新しい50件・古い続き・新しいものだけ） | 作る（読んだことにするのも、この中） | 作る（書き込まない） |
| `POST /api/me/talk-rooms/{public_id}/messages` | 送る | 作る | 作る |
| `PUT /api/me/talk-rooms/{public_id}/read` | 読んだことにする | 作らない | 作る |
| `GET /api/me/badge-counts` | 下のタブのバッジの数（未読・新しいマッチ・届いたいいね。#247） | ― | 作った（下の「#247 で足すこと」） |

レガシー版の作り：

- 02〜04 と同じく、だれが使うかをコントローラの中で JWT を読んで決める
  - `AuthController::me()` の処理を、メソッドごとにコピーする（これで6〜8か所目）
- 入力も、ルームの持ち主かも確かめず、エラーの扱いは考えない
- コントローラは、一覧が `TalkRoomController::index`、履歴と送るが `MessageController::index`・`store`

03 の `GET /api/me/matches` は残す（画面のメッセージのタブは、05 から `GET /api/me/talk-rooms` を使う）。

## `GET /api/me/talk-rooms`（トークの一覧）

### だれが使えるか

- レガシー版（legacy-repo）：正しい JWT（`Authorization: Bearer`）を持つ人（自分の一覧だけ）
  - 確認していない会員も使える
- 改善版（refactored-repo）：正しい `access` の Cookie を持ち、メールアドレスを確認した会員（FR-MSG-012・013）

### 入力

- レガシー版：なし（件数の上限とページ送りはなし。全部返す）
- 改善版：同じ

### 並び

- レガシー版：PHP で並べる（`usort`）
  - 最新のメッセージの日時、なければルームを作った日時の新しい順
- 改善版：SQL で並べる（同じ順。FR-MSG-008）

### 応答（成功）

- レガシー版：`200`。配列
  - 1件は `{"room_id": "019a…", "user_id": "019a…", "nickname": "香織", "birthday": "1998-04-01", "image": "/images/avatars/demo-3.svg", "last_message": {"body": "こんにちは", "created_at": "…"}, "unread_count": 3, "created_at": "…"}`
  - **生年月日をそのまま返す**
  - やり取りがなければ `last_message` は `null`
- 改善版：`200` `{"data": [{"room_id": "019a…", "user_id": "019a…", "nickname": "香織", "age": 28, "avatar_url": "/images/avatars/demo-3.svg", "last_message": {"body": "こんにちは", "sent_at": "2026-11-13T10:00:00+09:00"}, "unread_count": 3}]}`

### 未読の数

- レガシー版：相手のメッセージのうち、`created_at > last_read_at`
  - **まだ開いていない（`last_read_at` が `null`）ルームが1つでもあると、Laravel が「`> null`」を SQL にせず例外を投げ、一覧の全体が `500`**
  - 設計のときは「0 になる」と見込んでいたが、測って違った
  - 新しくマッチしたルームはいつも `null` で、画面が使えなくなる。そこで、レガシー版の中で「`null` なら相手のものを全部数える」とだけ直した（時刻で比べる問題は残す）
- 改善版：相手のメッセージのうち、`id > last_read_message_id`（`null` なら 0 から数える。FR-MSG-009）

### 応答（失敗）

- レガシー版
  - `401` `{"message": "ログインしてください"}`：`Authorization` がない
  - `500`：JWT が壊れている
  - **相手がいないルーム（相手を消した・参加者の行が抜けた）が1つでもあると、`$partner->user_id` が `null` を読んで一覧全体が `500` の見込み**
- 改善版
  - `401`：ログインしていない
  - `403`：確認していない

### 流れる SQL の目安

- レガシー版：**1＋6N 本**
  - 自分の参加者の行が1本
  - ルームごとに、ルーム・相手の参加者の行・プロフィール・`public_id`・最新の1件・未読の数の6本
  - ルーム 100 で 601本
  - 最新の1件と未読の数は、`messages` にインデックスがないので毎回表を全部読む
- 改善版：1本＋ガード1本（JOIN・`LEFT JOIN LATERAL`・相関サブクエリ。NFR-MSG-001）

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/me/talk-rooms -H 'Authorization: Bearer <JWT>'`
- 改善版：`curl http://127.0.0.1:8000/api/me/talk-rooms -b cookies.txt`

### レガシー版の書き方

```php
$members = TalkRoomMember::where('user_id', $me)->get();   // user_id のインデックスがなく、表を全部読む
$result = [];
foreach ($members as $member) {
    $room = TalkRoom::where('id', $member->talk_room_id)->first();
    $partner = TalkRoomMember::where('talk_room_id', $room->id)->where('user_id', '!=', $me)->first();
    $profile = Profile::where('user_id', $partner->user_id)->first();   // 相手がいなければ 500
    $publicId = User::where('id', $partner->user_id)->value('public_id');
    $last = Message::where('talk_room_id', $room->id)->orderBy('created_at', 'desc')->first();   // 表を全部読む
    $unread = Message::where('talk_room_id', $room->id)->where('sender_id', '!=', $me)
        ->where('created_at', '>', $member->last_read_at)->count();                           // 表を全部読む
    $result[] = [/* 上の応答の形 */];
}
usort($result, fn ($a, $b) => ($b['last_message']['created_at'] ?? $b['created_at']) <=> ($a['last_message']['created_at'] ?? $a['created_at']));
return response()->json($result);
```

## `GET /api/me/talk-rooms/{public_id}/messages`（トークの履歴）

### だれが使えるか

- レガシー版：正しい JWT を持つ人なら**だれでも**
  - ルームの参加者かを確かめない
  - UUID を知っていれば他人のトークを読める
- 改善版：ルームの参加者で、メールアドレスを確認した会員（FR-MSG-003・012・013）

### 入力（クエリ）

- レガシー版：`page`（1から。なければ 1）。確かめない
- 改善版
  - `before`（メッセージの `public_id`。これより古い50件）
  - `after`（これより新しいもの。5秒ごとに使う）
  - どちらもなければ新しい50件。両方は `422`

### 並び

- レガシー版：`created_at` の新しい順（**同じ秒の並びが決まらない**）
  - 画面が逆にして、古い順に見せる
- 改善版：`id` の新しい順（`after` のときは古い順）
  - 画面は古い順に見せる

### 続き

- レガシー版：`offset (page - 1) * 50`・`limit 50`
  - 「もうない」は、返った件数が50より少ないかで画面が決める
- 改善版：51件読んで、51件目があれば `has_more: true`（FR-MSG-005・006）

### 読んだことにする

- レガシー版：**この GET の中で**、自分の参加者の行の `last_read_at` を今にする
  - 5秒ごとに呼ばれるので、そのたびに書き込む
- 改善版：しない（`PUT …/read` に分ける）

### 応答（成功）

- レガシー版：`200`。`messages` の行の配列
  - 1件は `{"id": 1234, "talk_room_id": 7, "sender_id": 23, "body": "こんにちは", "created_at": "…", "updated_at": "…"}`
  - **中の連番の ID がそのまま出る**
  - 自分のものかは、画面が `GET /api/me` の `id` と比べる
- 改善版：`200` `{"data": [{"message_id": "019a…", "is_mine": true, "body": "こんにちは", "sent_at": "2026-11-13T10:00:00+09:00"}], "has_more": true}`

### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `500`：JWT が壊れている・**ないルーム**（`$room` が `null`）・UUID の形でない文字（PostgreSQL の uuid の型エラー）
  - `page=0` は `200`（Laravel の `offset()` が負の数を 0 にするので、1ページ目と同じ）
- 改善版
  - `401`・`403`
  - `404`（ないルームと、参加していないルームを同じにする）
  - `422`（`before` と `after` の両方・ない `public_id`）

### 流れる SQL の目安

- レガシー版：**3本**（ルーム・メッセージ（表を全部読んで並べ替える）・参加者の行の書き換え）
- 改善版：2本＋ガード1本（NFR-MSG-002・003）
  - 参加者と JOIN してルームを探す
  - `(talk_room_id, id)` のインデックスで 51件

### curl の例

- レガシー版：`curl 'http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages?page=2' -H 'Authorization: Bearer <JWT>'`
- 改善版：`curl 'http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages?before=<message_id>' -b cookies.txt`

## `POST /api/me/talk-rooms/{public_id}/messages`（送る）

### だれが使えるか

- レガシー版：正しい JWT を持つ人なら**だれでも**
  - 参加者かを確かめない。マッチしていない人も送れる
- 改善版：ルームの参加者で、メールアドレスを確認した会員（FR-MSG-002・003）

### 入力（JSON）

- レガシー版：`{"body": "こんにちは"}`。確かめない
- 改善版：`body`：必須・前後の空白を除いて 1〜1000文字（FR-MSG-004。DB の CHECK でも守る）

### 応答（成功）

- レガシー版：`201`。入れた `messages` の行（`id`・`talk_room_id`・`sender_id`・`body`・日時）
  - **1万文字でも入る**
- 改善版：`201` `{"data": {"message_id": "019a…", "is_mine": true, "body": "こんにちは", "sent_at": "…"}}`

### 応答（失敗）

- レガシー版：`401`・`500`
  - `500` になるのは、JWT が壊れている・ないルーム・**`body` がない・空・空白だけ**
  - Laravel が空の文字を `null` に変えるので、`body` の NOT NULL で `500`
- 改善版：`401`・`403`・`404`・`422`（どこが違うかを `errors.body` で返す）

### 流れる SQL の目安

- レガシー版：2本（ルーム・insert）
- 改善版：2本＋ガード1本（参加者と JOIN してルームを探す・insert）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"body":"こんにちは"}'`
- 改善版：`-b cookies.txt` で同じ

## `PUT /api/me/talk-rooms/{public_id}/read`（読んだことにする。改善版だけ）

### だれが使えるか

- 改善版（refactored-repo）：ルームの参加者で、メールアドレスを確認した会員

### 入力

- 改善版：なし（今の最新のメッセージまで読んだことにする）

### 応答

- 改善版：`204`。失敗は `401`・`403`・`404`

### 流れる SQL の目安

- 改善版：2本＋ガード1本（FR-MSG-010）
  - ルームを探す
  - 自分の参加者の行の `last_read_message_id` を `greatest(今の値, ルームの max(id))` に書き換える

## レガシー版で起きること（#58 で測った。改善する段階で要件 ID のテストにする）

### 測り方

- 開発用の DB（試しの会員 2万人・マッチ 1000組・メッセージ 10万件）で、コンテナの中でコントローラを直接呼んだ
  - `DB::listen` で SQL を数え、`EXPLAIN (ANALYZE, BUFFERS)` を流した
- 本文の扱いは、ミドルウェアを通すために、コンテナの中から本物の HTTP（`127.0.0.1:8000`）で確かめた
- 会員は `search00001`（ルーム 100。1つ目は 2万件）
- JWT はコンテナの中で作り、外に出していない
- 書き込んだものは消すかトランザクションで取り消し、最後にシーダーを流し直した
- 時間は手元の Docker で1回ずつ

### 測った結果

- `search00001` でトークの一覧（直す前）
  - レガシー版：**`500`**（`InvalidArgumentException: Illegal operator and value combination`）
  - 100 のうち 29 のルームをまだ開いておらず、`where('created_at', '>', null)` で例外になる
  - 6本目の SQL で止まる
  - 要件：FR-MSG-008・009
- 同じ一覧（`null` のときだけ直したあと）
  - レガシー版：`200`・100件・**SQL 601本**・693ms
  - まだ開いていない 29 のルームの未読の数は、どれも正しい
  - やり取りのない 50件は最後に並ぶ
  - 1件に生年月日がそのまま出る
  - 要件：FR-MSG-008・009・NFR-MSG-001
- ルームを 1・10・100 にして一覧
  - レガシー版：SQL が 7・61・601本（1＋6N）。8ms・70ms・656ms
  - 要件：NFR-MSG-001
- 自分のルーム `talk_room_members where user_id = ?` の実行計画
  - レガシー版：`Seq Scan`。100行のために 1902行を捨てる
  - UNIQUE は `talk_room_id` が先なので使えない
  - 要件：NFR-MSG-001
- 最新の1件・未読の数（2万件のルーム）の実行計画
  - レガシー版：どちらも `Seq Scan on messages`・shared hit 2529（表の全部）
  - 未読は 4564行のために 95436行を捨てる
  - 2.8〜3.4ms を、一覧ではルームの数だけ繰り返す
  - 要件：NFR-MSG-002
- 履歴の 1ページ目・20ページ目（2万件のルーム）・1ページ目（少ないルーム）の実行計画
  - レガシー版：どれも `Seq Scan`・shared hit 2529
  - 並べ替えは 1ページ目 38kB → 20ページ目 314kB（1000行を並べて 950行を捨てる）
  - 少ないルームでも表の全部を読む
  - 要件：NFR-MSG-002
- 履歴の1ページ目
  - レガシー版：`200`・50件・SQL 3本（select・select・**update**）・8ms
  - 1件は `id`・`talk_room_id`・`sender_id`（中の連番）・`body`・日時
  - 要件：FR-MSG-005
- 履歴を開いたあとの `last_read_at`
  - レガシー版：`null` → 今の時刻（GET で書き込む）
  - 要件：FR-MSG-010
- 2万件のルームで、同じ秒に2件以上あるところ
  - レガシー版：754か所（`created_at` だけの並びでは順が決まらない）
  - 要件：FR-MSG-005・006
- `page=0`
  - レガシー版：`200`・50件（1ページ目と同じ）
  - 要件：FR-MSG-005
- ないルーム
  - レガシー版：`500`（`Attempt to read property "id" on null`）
  - 要件：FR-MSG-002・003
- UUID の形でないルーム（`not-a-uuid`）
  - レガシー版：`500`（`invalid input syntax for type uuid`）
  - 要件：FR-MSG-003
- 参加していない会員（`search19000`）で、2万件のルームを読む・送る
  - レガシー版：**読む `200`・50件。送る `201`**（参加者かを確かめない）
  - 要件：FR-MSG-002・003
- 本文：ふつう・前後に空白・1000文字・1001文字・1万文字（HTTP）
  - レガシー版：どれも `201`
  - 前後の空白は削られる（`TrimStrings`）
  - 1万文字も入る
  - 要件：FR-MSG-004
- 本文：なし・空・空白だけ（HTTP）
  - レガシー版：`500`（`body` の NOT NULL の違反）
  - 空と空白だけは、Laravel が `null` に変える
  - 要件：FR-MSG-004
- トークンなしで一覧・履歴・送る
  - レガシー版：`401`・`401`・`401`
  - 要件：FR-MSG-012
- メールアドレスを確認していない会員で一覧
  - レガシー版：`200`
  - 要件：FR-MSG-013
- 相手を DB で消したあと（トランザクションの中）の一覧
  - レガシー版：**`500`**（`Attempt to read property "user_id" on null`）
  - 参加者の行が CASCADE で消え、相手が見つからない
  - 要件：FR-MSG-014
- 2万件のルームの相手（送ったメッセージ 9871件）を DB で消す（取り消す）
  - レガシー版：4.4ms のうち、`messages_sender_id_foreign` の CASCADE が 4.2ms
  - `sender_id` にインデックスがなく、表を全部読む
  - 要件：FR-MSG-014
- 03 で2行になった組
  - レガシー版：開発用の DB には 0組（同じ相手が2回出るかは、まだ試していない）
  - 要件：FR-MSG-008

## #190 で足すこと（M6：一覧の「あなた：」と、既読。状態：**実装済み（レガシー版）**）

要件は FR-MSG-015・016・FR-PAID-018。表は変えない（今ある `talk_room_members.last_read_at` を使う）。メッセージを送る・読む API は変えていない。

### `GET /api/me/talk-rooms`（トークの一覧）に足す項目

#### `last_message.mine`

- レガシー版（legacy-repo）：最後の1件を送ったのが自分か
  - 今読んでいる行の `sender_id` と比べるだけ。SQL は増えない
- 改善版（refactored-repo）：`{"last_message": {"body": "…", "sent_at": "…", "is_mine": true}}`

#### `partner_last_read_at`

- レガシー版：相手が、このトークを最後に開いた日時
  - **だれにでも返す**（男性の無料の会員にも）
  - 既読を出すか出さないかは、画面が決める（`TalkPage.tsx`）
- 改善版：有料の機能を使える会員にだけ返す（07 の1つの関数で判断する）
  - 使えない会員の応答には、項目そのものを入れない

#### 既読の決め方

- レガシー版：**画面が**決める
  - 相手の `partner_last_read_at` より前の自分のメッセージのうち、いちばん新しいものに「既読」を出す
  - トーク画面は、既読のために、5秒ごとにトークの一覧を全部読み直す（ルームごとに6本の SQL）
- 改善版：トークの履歴の API（`GET /talk-rooms/{room_id}/messages`）の応答に、`read_until`（相手が読んだ所）を入れる
  - 一覧を読み直さない

#### 「読んだ」の記録

- レガシー版：今までどおり、履歴を読む `GET` の中で `last_read_at` を書く
  - 画面は5秒ごとに呼ぶので、そのたびに書く
- 改善版：`PUT /talk-rooms/{room_id}/read`（読んだことにする。上の節）

### レガシー版で起きること（2026-11-17 に測った。測ったあと、送ったメッセージを消した）

- 有料の男性が送り、相手がトークを開く
  - 結果：5秒ほどで、自分の最後のメッセージに「既読」が出る
  - 要件 ID：FR-MSG-015
- **男性の無料の会員が、トークの一覧の API を呼ぶ**
  - 結果：**`200`。2件とも、相手の `partner_last_read_at` が入っている**
  - 画面は出さないが、API を直接呼べば、無料でも既読が分かる
  - 要件 ID：FR-PAID-018
- 流れる SQL（無料の男性・ルーム2件）
  - 結果：16本（4＋6×2）
  - トーク画面を開いているあいだ、5秒ごとに流れる（履歴の読み直しとは別に）
  - 要件 ID：NFR-MSG-001
- 改行の入ったメッセージを送る
  - 結果：改行が入ったまま保存され、画面にも改行して出る
  - 要件 ID：FR-MSG-004
- 1001文字
  - 結果：画面が止める（API は、今までどおり止めない）
  - 要件 ID：FR-MSG-004

### 画面の側で分かったこと

- 「新しいマッチ」と同じく、既読の決まりも画面にある
- メッセージの一覧は、開いているあいだ10秒ごとに一覧の API を呼ぶ
  - ルームが100ある会員は、10秒ごとに 600本を超える SQL が流れる

## #247 で足すこと（下のタブの数。状態：**実装済み（改善版）**）

下のタブ（`TabBar`）は、メッセージのタブに「未読の合計＋新しいマッチ」、いいねのタブに「届いたいいねの人数」のバッジを出す（FR-UI-032・FR-UI-064・FR-UI-073）。前は、その数のために、画面が変わるたび・30秒ごとに、トークの一覧と届いたいいねの一覧を全部読んでいた（#112 の P14）。数だけを返す API を足し、タブはそれだけを読む。

- 1本で3つの数を返す。タブは1回の呼び出しで済み、ポーリングも1本になるため
- 置き場は改訂版の形（`Messaging/BadgeCountController@show` → `Messaging/MessageService`・`Matching/LikeService` → Model のスコープ）
- 名前：URL の名詞は「バッジの数」（`badge-counts`）。ログインした本人あての数なので `/me` の下に置く（`docs/cycles/01-backend-foundation/03-how.md` の「`/me` を付けるか」の「迷うもの」）

### `GET /api/me/badge-counts`

#### だれが使えるか

- ログインしていて、メールアドレスを確認した会員（ルートの `user.authenticate` と `user.verified`。FR-MSG-012・FR-MSG-013）

#### 入力

- なし

#### 応答（成功）

- `200` `{"unread_messages": 3, "new_matches": 1, "received_likes": 2}`
- `unread_messages`：相手から届いて、まだ読んでいないメッセージの合計。トークの一覧の `unread_count` の合計と同じ（自分が送ったものと、最後に開いた時刻より前のものは数えない。FR-MSG-009）
- `new_matches`：新しいマッチ（まだ一度も開いていなくて、まだ1通もないルーム）の数。トークの一覧で `last_message` と `last_read_at` がどちらも `null` のルームの数と同じ（FR-UI-073）
- `received_likes`：届いたいいね（まだ返事をしていないもの）の数。届いたいいねの一覧の件数と同じ（FR-UI-064）
- メッセージのタブのバッジは `unread_messages + new_matches`（前の画面の数え方と同じ）。足すのは画面

#### 数える条件

- 数は、今の2つの一覧（`GET /api/me/talk-rooms`・`GET /api/me/received-likes`）で数えたものと同じにする。`tests/Feature/Messaging/ShowBadgeCountsTest.php` が、一覧から数えたものと比べる
- トークルームの条件は `TalkRoomMember::scopeListedFor()` の1か所（未読と新しいマッチの2つが使う）
  - ブロックした・された相手のルームは除く（FR-BLOCK-009）
- 届いたいいねの条件は `Like::scopeReceivedBy()` の1か所
  - 送り返した相手・ブロックした／された相手・スキップした相手は除く（FR-LIKE-010・FR-BLOCK-007・FR-LIKE-012）
- ブロックの向きを問わない条件は `Block::scopeBetween()`（上の2つが使う）
- 分かっている不具合：退会した相手は、どちらの数にも入る（要件は FR-WD-006 で、一覧に出さない）。今の2つの一覧が除かないので、同じにした。除くときは、上の2つのスコープと、2つの一覧の両方を直す
- 一覧の API はまだ古いコントローラー（`TalkRoomController`・`ReceivedLikeController`）のままで、同じ条件をコントローラーの中にも書いている。一覧を移すときに、上のスコープを使う形にする

#### 応答（失敗）

- `401` `{"message": "ログインしてください"}`：ログインしていない・退会・強制退会
- `401` `{"message": "このアカウントは停止されています", "code": "account_suspended"}`：アカウント停止された会員
- `403` `{"message": "この機能は使えません", "code": "email_unverified"}`：メールアドレスを確認していない
- `503`：メンテナンス中（README の決まり）

#### 流れる SQL の目安

- 3本（未読の合計・新しいマッチ・届いたいいね。どれも `count(*)` の1本）。相手の数が増えても変わらない（NFR-MSG-004）
- ほかに、ログインの確かめの分（`users` の select 2本と、`sessions` の select と update。README の「ログインが要るか」）
- テストで数えた本数（セッションの置き場は array なので、`sessions` の分は出ない）
  - 前：トークの一覧 5＋6×ルームの数、届いたいいねの一覧 7＋2×いいねの数。ルームといいねが5つずつで 35＋17＝52本
  - 後：5本（ルームといいねが2・3・5・10のどれでも同じ）
- インデックスは足していない。`messages.talk_room_id`・`likes.to_user_id` にはインデックスがなく、どちらの数も表を全部読む（一覧と同じ。インデックスは、一覧を直すチケットで足す）

#### curl の例

- `curl http://localhost:8000/api/me/badge-counts -b cookies.txt -H 'Accept: application/json' -H 'Origin: http://localhost:5173'`

