# 05 メッセージ

状態：**実装済み（レガシー版）**（PR は #58 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/messages.md](../requirements/messages.md)（FR-MSG-001〜014・NFR-MSG-001〜003）。表は `talk_rooms`・`talk_room_members`・`messages`（[data-model.md](../data-model.md)・D-023）。解説：`explanations/05-messages.html`（`legacy-repo`）。

トークルームは「ログインした本人が参加しているもの」なので、`/api/me/talk-rooms` の下に置く。1つのルームは `public_id`（UUID）で指し、メッセージはその下に入れ子にする（決まり「持ち主の下にあるものは入れ子にする」）。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `GET /api/me/talk-rooms` | トークの一覧（相手ごとの最新の1件・未読の数） | 作る | 作る |
| `GET /api/me/talk-rooms/{public_id}/messages` | トークの履歴（新しい50件・古い続き・新しいものだけ） | 作る（読んだことにするのも、この中） | 作る（書き込まない） |
| `POST /api/me/talk-rooms/{public_id}/messages` | 送る | 作る | 作る |
| `PUT /api/me/talk-rooms/{public_id}/read` | 読んだことにする | 作らない | 作る |

レガシー版は、02〜04 と同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理を、メソッドごとに写す。これで6〜8か所目）。入力も、ルームの持ち主かも確かめず、エラーの扱いは考えない。コントローラは、一覧が `TalkRoomController::index`、履歴と送るが `MessageController::index`・`store`。

03 の `GET /api/me/matches` は残す（画面のメッセージのタブは、05 から `GET /api/me/talk-rooms` を使う）。

## `GET /api/me/talk-rooms`（トークの一覧）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT（`Authorization: Bearer`）を持つ人（自分の一覧だけ）。確認していない会員も使える | 正しい `access` の Cookie を持ち、メールアドレスを確認した会員（FR-MSG-012・013） |
| 入力 | なし（件数の上限とページ送りはなし。全部返す） | 同じ |
| 並び | PHP で並べる（最新のメッセージの日時、なければルームを作った日時の新しい順。`usort`） | SQL で並べる（同じ順。FR-MSG-008） |
| 応答（成功） | `200`。配列。1件は `{"room_id": "019a…", "user_id": "019a…", "nickname": "香織", "birthday": "1998-04-01", "image": "/images/avatars/demo-3.svg", "last_message": {"body": "こんにちは", "created_at": "…"}, "unread_count": 3, "created_at": "…"}`（**生年月日をそのまま返す**。やり取りがなければ `last_message` は `null`） | `200` `{"data": [{"room_id": "019a…", "user_id": "019a…", "nickname": "香織", "age": 28, "avatar_url": "/images/avatars/demo-3.svg", "last_message": {"body": "こんにちは", "sent_at": "2026-11-13T10:00:00+09:00"}, "unread_count": 3}]}` |
| 未読の数 | 相手のメッセージのうち、`created_at > last_read_at`。**まだ開いていない（`last_read_at` が `null`）ルームが1つでもあると、Laravel が「`> null`」を SQL にせず例外を投げ、一覧の全体が `500`**（設計のときは「0 になる」と見込んでいたが、測って違った）。新しくマッチしたルームはいつも `null` で、画面が使えなくなるので、レガシー版の中で「`null` なら相手のものを全部数える」とだけ直した（時刻で比べる問題は残す） | 相手のメッセージのうち、`id > last_read_message_id`（`null` なら 0 から数える。FR-MSG-009） |
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。`500`：JWT が壊れている。**相手がいないルーム（相手を消した・参加者の行が抜けた）が1つでもあると、`$partner->user_id` が `null` を読んで一覧全体が `500` の見込み** | `401`：ログインしていない。`403`：確認していない |
| 流れる SQL の目安 | **1＋6N 本**（自分の参加者の行。ルームごとに、ルーム・相手の参加者の行・プロフィール・`public_id`・最新の1件・未読の数）。ルーム 100 で 601本。最新の1件と未読の数は、`messages` にインデックスがないので毎回表を全部読む | 1本＋ガード1本（JOIN・`LEFT JOIN LATERAL`・相関サブクエリ。NFR-MSG-001） |
| curl の例 | `curl http://127.0.0.1:8000/api/me/talk-rooms -H 'Authorization: Bearer <JWT>'` | `curl http://127.0.0.1:8000/api/me/talk-rooms -b cookies.txt` |

レガシー版の書き方：

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

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人なら**だれでも**（ルームの参加者かを確かめない。UUID を知っていれば他人のトークを読める） | ルームの参加者で、メールアドレスを確認した会員（FR-MSG-003・012・013） |
| 入力（クエリ） | `page`（1から。なければ 1）。確かめない | `before`（メッセージの `public_id`。これより古い50件）・`after`（これより新しいもの。5秒ごとに使う）。どちらもなければ新しい50件。両方は `422` |
| 並び | `created_at` の新しい順（**同じ秒の並びが決まらない**）。画面が逆にして、古い順に見せる | `id` の新しい順（`after` のときは古い順）。画面は古い順に見せる |
| 続き | `offset (page - 1) * 50`・`limit 50`。「もうない」は、返った件数が50より少ないかで画面が決める | 51件読んで、51件目があれば `has_more: true`（FR-MSG-005・006） |
| 読んだことにする | **この GET の中で**、自分の参加者の行の `last_read_at` を今にする（5秒ごとに呼ばれるので、そのたびに書き込む） | しない（`PUT …/read` に分ける） |
| 応答（成功） | `200`。`messages` の行の配列。1件は `{"id": 1234, "talk_room_id": 7, "sender_id": 23, "body": "こんにちは", "created_at": "…", "updated_at": "…"}`（**中の連番の ID がそのまま出る**。自分のものかは、画面が `GET /api/me` の `id` と比べる） | `200` `{"data": [{"message_id": "019a…", "is_mine": true, "body": "こんにちは", "sent_at": "2026-11-13T10:00:00+09:00"}], "has_more": true}` |
| 応答（失敗） | `401`：`Authorization` がない。`500`：JWT が壊れている・**ないルーム**（`$room` が `null`）・UUID の形でない文字（PostgreSQL の uuid の型エラー）。`page=0` は `200`（Laravel の `offset()` が負の数を 0 にするので、1ページ目と同じ） | `401`・`403`・`404`（ないルームと、参加していないルームを同じにする）・`422`（`before` と `after` の両方・ない `public_id`） |
| 流れる SQL の目安 | **3本**（ルーム・メッセージ（表を全部読んで並べ替える）・参加者の行の書き換え） | 2本＋ガード1本（参加者と JOIN してルームを探す・`(talk_room_id, id)` のインデックスで 51件。NFR-MSG-002・003） |
| curl の例 | `curl 'http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages?page=2' -H 'Authorization: Bearer <JWT>'` | `curl 'http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages?before=<message_id>' -b cookies.txt` |

## `POST /api/me/talk-rooms/{public_id}/messages`（送る）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人なら**だれでも**（参加者かを確かめない。マッチしていない人も送れる） | ルームの参加者で、メールアドレスを確認した会員（FR-MSG-002・003） |
| 入力（JSON） | `{"body": "こんにちは"}`。確かめない | `body`：必須・前後の空白を除いて 1〜1000文字（FR-MSG-004。DB の CHECK でも守る） |
| 応答（成功） | `201`。入れた `messages` の行（`id`・`talk_room_id`・`sender_id`・`body`・日時）。**1万文字でも入る** | `201` `{"data": {"message_id": "019a…", "is_mine": true, "body": "こんにちは", "sent_at": "…"}}` |
| 応答（失敗） | `401`・`500`（JWT が壊れている・ないルーム・**`body` がない・空・空白だけ**。Laravel が空の文字を `null` に変えるので、`body` の NOT NULL で `500`） | `401`・`403`・`404`・`422`（どこが違うかを `errors.body` で返す） |
| 流れる SQL の目安 | 2本（ルーム・insert） | 2本＋ガード1本（参加者と JOIN してルームを探す・insert） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/me/talk-rooms/<public_id>/messages -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"body":"こんにちは"}'` | `-b cookies.txt` で同じ |

## `PUT /api/me/talk-rooms/{public_id}/read`（読んだことにする。改善版だけ）

| 項目 | 改善版（refactored-repo） |
| --- | --- |
| だれが使えるか | ルームの参加者で、メールアドレスを確認した会員 |
| 入力 | なし（今の最新のメッセージまで読んだことにする） |
| 応答 | `204`。失敗は `401`・`403`・`404` |
| 流れる SQL の目安 | 2本＋ガード1本（ルームを探す・自分の参加者の行の `last_read_message_id` を `greatest(今の値, ルームの max(id))` に書き換える。FR-MSG-010） |

## レガシー版で起きること（#58 で測った。改善する段階で要件 ID のテストにする）

開発用の DB（試しの会員 2万人・マッチ 1000組・メッセージ 10万件）で、コンテナの中でコントローラを直接呼び、`DB::listen` で SQL を数え、`EXPLAIN (ANALYZE, BUFFERS)` を流した。本文の扱いは、ミドルウェアを通すために、コンテナの中から本物の HTTP（`127.0.0.1:8000`）で確かめた。会員は `search00001`（ルーム 100。1つ目は 2万件）。JWT はコンテナの中で作り、外に出していない。書き込んだものは消すかトランザクションで取り消し、最後にシーダーを流し直した。時間は手元の Docker で1回ずつ。

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| `search00001` でトークの一覧（直す前） | **`500`**（`InvalidArgumentException: Illegal operator and value combination`）。100 のうち 29 のルームをまだ開いておらず、`where('created_at', '>', null)` で例外になる。6本目の SQL で止まる | FR-MSG-008・009 |
| 同じ一覧（`null` のときだけ直したあと） | `200`・100件・**SQL 601本**・693ms。まだ開いていない 29 のルームの未読の数は、どれも正しい。やり取りのない 50件は最後に並ぶ。1件に生年月日がそのまま出る | FR-MSG-008・009・NFR-MSG-001 |
| ルームを 1・10・100 にして一覧 | SQL が 7・61・601本（1＋6N）。8ms・70ms・656ms | NFR-MSG-001 |
| 自分のルーム `talk_room_members where user_id = ?` の実行計画 | `Seq Scan`。100行のために 1902行を捨てる（UNIQUE は `talk_room_id` が先なので使えない） | NFR-MSG-001 |
| 最新の1件・未読の数（2万件のルーム）の実行計画 | どちらも `Seq Scan on messages`・shared hit 2529（表の全部）。未読は 4564行のために 95436行を捨てる。2.8〜3.4ms を、一覧ではルームの数だけ繰り返す | NFR-MSG-002 |
| 履歴の 1ページ目・20ページ目（2万件のルーム）・1ページ目（少ないルーム）の実行計画 | どれも `Seq Scan`・shared hit 2529。並べ替えは 1ページ目 38kB → 20ページ目 314kB（1000行を並べて 950行を捨てる）。少ないルームでも表の全部を読む | NFR-MSG-002 |
| 履歴の1ページ目 | `200`・50件・SQL 3本（select・select・**update**）・8ms。1件は `id`・`talk_room_id`・`sender_id`（中の連番）・`body`・日時 | FR-MSG-005 |
| 履歴を開いたあとの `last_read_at` | `null` → 今の時刻（GET で書き込む） | FR-MSG-010 |
| 2万件のルームで、同じ秒に2件以上あるところ | 754か所（`created_at` だけの並びでは順が決まらない） | FR-MSG-005・006 |
| `page=0` | `200`・50件（1ページ目と同じ） | FR-MSG-005 |
| ないルーム | `500`（`Attempt to read property "id" on null`） | FR-MSG-002・003 |
| UUID の形でないルーム（`not-a-uuid`） | `500`（`invalid input syntax for type uuid`） | FR-MSG-003 |
| 参加していない会員（`search19000`）で、2万件のルームを読む・送る | **読む `200`・50件。送る `201`**（参加者かを確かめない） | FR-MSG-002・003 |
| 本文：ふつう・前後に空白・1000文字・1001文字・1万文字（HTTP） | どれも `201`。前後の空白は削られる（`TrimStrings`）。1万文字も入る | FR-MSG-004 |
| 本文：なし・空・空白だけ（HTTP） | `500`（`body` の NOT NULL の違反。空と空白だけは、Laravel が `null` に変える） | FR-MSG-004 |
| トークンなしで一覧・履歴・送る | `401`・`401`・`401` | FR-MSG-012 |
| メールアドレスを確認していない会員で一覧 | `200` | FR-MSG-013 |
| 相手を DB で消したあと（トランザクションの中）の一覧 | **`500`**（`Attempt to read property "user_id" on null`。参加者の行が CASCADE で消え、相手が見つからない） | FR-MSG-014 |
| 2万件のルームの相手（送ったメッセージ 9871件）を DB で消す（取り消す） | 4.4ms のうち、`messages_sender_id_foreign` の CASCADE が 4.2ms（`sender_id` にインデックスがなく、表を全部読む） | FR-MSG-014 |
| 03 で2行になった組 | 開発用の DB には 0組（同じ相手が2回出るかは、まだ試していない） | FR-MSG-008 |
