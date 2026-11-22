# 02 いいね

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/likes.md](../requirements/likes.md)（FR-LIKE-001〜009・NFR-LIKE-001〜002）。表は `likes`（[data-model.md](../data-model.md)）。解説：[02-likes.html](../../explanations/02-likes.html)。

| メソッドとパス | 何をする |
| --- | --- |
| `POST /api/me/likes` | いいねを送る（03 でマッチを作る・`matched` を返す） |
| `GET /api/me/likes` | 送った相手の一覧（03 で `matched` を足す） |
| `GET /api/me/received-likes` | 届いたいいねの一覧（M3。#184） |
| `POST /api/me/skips` | スキップする（M3。#184） |
| `GET /api/me/skips` | スキップした相手の一覧（M3。#184） |
| `DELETE /api/me/skips/{public_id}` | スキップを元に戻す（M3。#184） |

いいねは「ログインした本人のもの」なので、`/api/me` の下に置く（決まり「ログインした本人のものは `/me` の下」）。他人の一覧を見るパスは作らない（FR-LIKE-006）。

レガシー版は、だれが送るかを 01b の `GET /api/me` と同じ書き方で決める（JWT を読む処理を、コントローラごとにコピーする）。エラーの扱いは考えない（違反や例外は `500` のまま。改善版で直す）。

## `POST /api/me/likes`（いいねを送る）

### だれが使えるか

- レガシー版（legacy-repo）：正しい JWT（`Authorization: Bearer`）を持つ人。確認していない会員も使える
- 改善版（refactored-repo）：正しい `access` の Cookie を持ち、メールアドレスを確認した会員（FR-LIKE-007・008）

### 入力（JSON）

- レガシー版：`user_id`（相手の会員の ID）。確かめない
- 改善版：`user_id`（必須・整数・自分でない）

### 応答（成功）

- レガシー版：`201`。作った `likes` の行をそのまま返す
  - `{"from_user_id": 23, "to_user_id": 5, "updated_at": "…", "created_at": "…", "id": 1}`
- 改善版：`201` `{"user_id": 5, "liked_at": "2026-11-12T13:00:00+09:00"}`

### 応答（失敗）

- レガシー版
  - `401` `{"message": "ログインしてください"}`：`Authorization` がない
  - **`500`**：JWT が壊れている・同じ相手に2回目（UNIQUE の違反 `23505`）・`user_id` がない（NOT NULL）・`user_id` が `"abc"`
  - 自分あて・いない会員は **`201` で入る**
- 改善版
  - `401`：ログインしていない
  - `403`：確認していない
  - `422`：`user_id` がない・整数でない・自分
  - `404`：その会員がいない
  - `409` `{"message": "もういいねしています"}`：同じ相手に2回目（同時に来ても1つだけ `201`）

### 流れる SQL の目安

- レガシー版：1本（`insert into likes … returning id`）
- 改善版：3本以内（自分を読む・相手がいるか・`insert … on conflict do nothing`）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/me/likes -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"user_id":5}'`
- 改善版：`... -b cookies.txt -d '{"user_id":5}'`

### レガシー版の書き方

```php
// 01b の me() からコピーした処理（トークンがなければ 401、壊れていれば 500）
$token = $request->bearerToken();
if (! $token) {
    return response()->json(['message' => 'ログインしてください'], 401);
}
$payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

$like = Like::create([
    'from_user_id' => $payload->sub,
    'to_user_id' => $request->input('user_id'),   // 自分でも・いない会員でも入る。2回目は UNIQUE の違反で 500
]);
return response()->json($like, 201);
```

## `GET /api/me/likes`（送った相手の一覧）

### だれが使えるか

- レガシー版：正しい JWT を持つ人（自分の一覧だけ）
- 改善版：正しい `access` の Cookie を持ち、確認した会員

### 入力

- レガシー版：なし（件数の上限とページ送りは 04）
- 改善版：同じ

### 応答（成功）

- レガシー版：`200`。新しい順の配列
  - 1件は `{"user_id": 5, "nickname": "ゆう", "birthday": "1998-04-01", "image": "/images/avatars/demo-3.svg", "liked_at": "…"}`
  - **生年月日をそのまま返す**
  - プロフィールがない相手は `nickname` などが `null`
- 改善版：`200`。新しい順の配列
  - 1件は `{"user_id": 5, "nickname": "ゆう", "age": 28, "avatar_url": "/images/avatars/demo-3.svg", "liked_at": "2026-11-12T13:00:00+09:00"}`
  - FR-LIKE-005。年齢は日本の時間帯の今日で出す
  - 退会・アカウント停止・強制退会の相手は出さない（FR-WD-006・014）。refactored-repo では #269 で、今の URL のまま除いた（[06-blocks-withdrawal.md](06-blocks-withdrawal.md) の「#269 で変えたこと」）

### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `500`：JWT が壊れている
- 改善版：`401`・`403`

### 流れる SQL の目安

- レガシー版：**1＋N 本**
  - `select * from likes where from_user_id = ? order by created_at desc` と、いいね1件ごとに `select * from profiles where user_id = ? limit 1`
- 改善版：3本以内（自分を読む・`likes`・`profiles` を `where user_id in (…)` でまとめて。NFR-LIKE-001）

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/me/likes -H 'Authorization: Bearer <JWT>'`
- 改善版：`curl http://127.0.0.1:8000/api/me/likes -b cookies.txt`

### レガシー版の書き方

```php
// ここでも、01b の me() から JWT の処理をコピーする（store() と同じ6行）
$likes = Like::where('from_user_id', $payload->sub)->orderBy('created_at', 'desc')->get();
$result = [];
foreach ($likes as $like) {
    $profile = Profile::where('user_id', $like->to_user_id)->first();   // 1件ごとに1本（N+1）
    $result[] = [
        'user_id' => $like->to_user_id,
        'nickname' => $profile?->nickname,
        'birthday' => $profile?->birthday,   // 年齢ではなく生年月日
        'image' => $profile?->image,
        'liked_at' => $like->created_at,
    ];
}
return response()->json($result);
```

## レガシー版で起きること（#26 で測り、改善する段階で要件 ID のテストにする）

「※コードを読んで分かったこと」の印があるものは、まだ試していない。改善する段階のテストで確かめる。

- 同じ相手に2回
  - レガシー版：2回目は `500`（UNIQUE の違反。行は1つのまま）
  - 要件：FR-LIKE-003
- 同じいいねを10本同時に
  - レガシー版：`201` が1つ・`500` が9つ（行は1つ）
  - 要件：FR-LIKE-003
- 自分に送る
  - レガシー版：`201` で入る
  - 要件：FR-LIKE-002
- いない会員（`999999`）に送る
  - レガシー版：`201` で入る
  - 要件：FR-LIKE-004
- `user_id` を送らない・`"abc"`
  - レガシー版：`500`
  - 要件：FR-LIKE-001
- 確認していない会員で送る・一覧を見る
  - レガシー版：どちらもできる
  - 要件：FR-LIKE-008
- トークンなし・壊れた JWT
  - レガシー版：`401`・`500`
  - 要件：FR-LIKE-007
- いいねを 1・10・100件にして一覧
  - レガシー版：SQL が 2・11・101本になる（1＋N）。かかった時間は 4.7ms〜22ms
  - 要件：NFR-LIKE-001
- 一覧の1件
  - レガシー版：年齢ではなく生年月日が返る
  - 要件：FR-LIKE-005
- 一覧の SQL の実行計画（`from_user_id = ? order by created_at desc`）
  - レガシー版：UNIQUE のインデックスで絞り（`Bitmap Heap Scan`）、日時で並べ替える（`Sort`）
  - 要件：NFR-LIKE-002
- 「B はだれからもらったか」（`to_user_id = ?`）
  - レガシー版：表を全部読む（`Seq Scan`。102行を読んで捨てた。03・07 で使う）
  - 要件：NFR-LIKE-002
- 同じ秒に送ったいいねの一覧
  - レガシー版：並びが決まらない（`created_at` が同じで、ほかに並べる列がない）
  - 要件：FR-LIKE-005
- 断られた送信のあと
  - レガシー版：いいねの ID が飛ぶ（`500` になった分も、連番が進む）
  - 要件：―
- 相手（会員とプロフィール）を消したあとの一覧（※コードを読んで分かったこと）
  - レガシー版：消えた相手の行が `nickname: null` で残る（正しくは、一覧に出ない）
  - 外部キーがないため
  - 会員だけを消したときは、プロフィールが残り、ニックネームも出る
  - 要件：FR-LIKE-009
- 相手にプロフィールが2つある（※コードを読んで分かったこと）
  - レガシー版：一覧に出るプロフィールが決まらない
  - `first()` に並びがない。01 の「1人に2つ」が残っている
  - 要件：FR-LIKE-005
- 送る側の会員を消したあと、その JWT で送る（※コードを読んで分かったこと）
  - レガシー版：まだ送れる（`sub` の会員がいるかを確かめず、外部キーもない）
  - 要件：FR-LIKE-009
- `user_id` を `"5"`（文字列）で送る（※コードを読んで分かったこと）
  - レガシー版：応答の `to_user_id` が `"5"` のまま返る（行を読み直さず、入力の形で返す）
  - 要件：FR-LIKE-001
- `user_id` をクエリ文字列（`?user_id=5`）で送る（※コードを読んで分かったこと）
  - レガシー版：受け付ける（`input()` は本文とクエリ文字列の両方を読む）
  - 要件：FR-LIKE-001

測るときは、開発用の DB に、会員 23（`sakura@example.test`）からのいいねを SQL でまとめて入れる（`generate_series` で 100件など）。測ったあとは消す。

## 03 で変えること（状態：**実装済み（レガシー版）**。測った結果は [03-matches.md](03-matches.md)）

03 マッチ（[03-matches.md](03-matches.md)・[requirements/matches.md](../requirements/matches.md)）で、送る・送った一覧の2つを変える。上は 02 で作った形のまま残し、ここに差分だけを書く。

### `POST /api/me/likes`（いいねを送る）

#### 応答（成功）

- レガシー版：`201`。02 の応答（入れた `likes` の行）に `"matched": true` か `false` を足す
  - `{"from_user_id": 5, "to_user_id": 23, …, "id": 9, "matched": true}`
- 改善版：`201` `{"user_id": 23, "liked_at": "2026-11-12T15:00:00+09:00", "matched": true}`（FR-MATCH-001・002）

#### マッチの作り方

- レガシー版：いいねを入れたあと、相手から自分へのいいねを読み、あれば `user_matches` に (自分, 相手) を入れる。トランザクションなし
- 改善版：トランザクションの中で、次の順に進める（FR-MATCH-003）
  - 2人の `users` の行を ID の小さい順に `for update` で押さえる
  - いいね → 相手からのいいねを読む
  - あれば `user_matches` に (小さい ID, 大きい ID) を `on conflict do nothing` で入れる

#### 応答（失敗）

- レガシー版：02 と同じ。いいねで `500` になったときは、マッチの処理まで進まない
- 改善版：02 と同じ。`404`・`409`・`422` のときは、マッチも作らない（ロールバック。FR-MATCH-004）

#### 流れる SQL の目安

- レガシー版：マッチしないとき2本・するとき3本
  - `insert into likes` → `select * from likes where from_user_id = ? and to_user_id = ? limit 1` → `insert into user_matches`
- 改善版：4本＋ガード1本。02 の目安「3本以内」から増える
  - `select id from users where id in (?, ?) order by id for update`
  - `insert into likes … on conflict do nothing`
  - `select exists(…)`
  - `insert into user_matches … on conflict do nothing`

#### レガシー版の書き方

02 の `Like::create` のすぐあとに足す：

```php
$reverse = Like::where('from_user_id', $request->input('user_id'))
    ->where('to_user_id', $payload->sub)
    ->first();
$matched = false;
if ($reverse) {
    // user1_id に送り返した人、user2_id に先に送っていた人（向きがそろわない）
    UserMatch::create(['user1_id' => $payload->sub, 'user2_id' => $request->input('user_id')]);
    $matched = true;
}
return response()->json(array_merge($like->toArray(), ['matched' => $matched]), 201);
```

### `GET /api/me/likes`（送った相手の一覧）

#### 応答（成功）

- レガシー版：1件に `"matched": true` か `false` を足す
  - 相手から自分へのいいねがあれば真（`user_matches` は見ない）
- 改善版：1件に `"matched"` を足す
  - `user_matches` に組があれば真（FR-MATCH-006。印の正は `user_matches`）

#### 流れる SQL の目安

- レガシー版：**1＋2N 本**
  - 02 の 1＋N に、いいね1件ごとの `select exists(select * from likes where from_user_id = ? and to_user_id = ?)` が足される
- 改善版：1本＋ガード1本
  - `likes` に `profiles` を INNER JOIN、`user_matches` を `least`・`greatest` で LEFT JOIN
  - 02 の改善版の `with()`（3本）から JOIN に変える

#### レガシー版の書き方

02 のループの中に足す：

```php
$matched = Like::where('from_user_id', $like->to_user_id)
    ->where('to_user_id', $payload->sub)
    ->exists();   // いいね1件ごとに、もう1本
$result[] = [
    // …02 と同じ…
    'matched' => $matched,
];
```

## #46 で変えること（ID。状態：**実装済み（レガシー版）**。PR #47 で測った）

D-022。上は 02・03 で作った形のまま残し、ここに差分だけを書く。

- 測った結果（上の「レガシー版で起きること」）は、#46 のあとに測り直す
- 送る側は、これまでどおり JWT の `sub`（中の `id`）で決める

### `POST /api/me/likes`（いいねを送る）

#### 入力（JSON）

- レガシー版：`{"user_id": "019a…"}`（相手の `public_id`）。確かめない
- 改善版：`user_id`（必須・UUID の形・自分でない）

#### 中の動き

- レガシー版：`User::where('public_id', $request->input('user_id'))->value('id')` で相手の中の `id` を読んでから、02・03 の処理をする
- 改善版：相手を `public_id` で読み、中の `id` で `for update`・`insert` する

#### 応答（成功）

- レガシー版：`201`。これまでどおり `likes` の行（`from_user_id`・`to_user_id` は中の `id`）と `"matched"`
- 改善版：`201` `{"user_id": "019a…", "liked_at": "…", "matched": true}`

#### 応答（失敗）

- レガシー版
  - **いない UUID は `500`**。中の `id` が `null` になり、`to_user_id` の NOT NULL に当たる（`23502`）
  - 02 では `201` で入っていた。断られても、いいねの ID は1つ進む
  - **UUID の形でない文字（数字の `7`・`"abc"`）も `500`**（`22P02`）
  - 自分あては `201` のまま
- 改善版
  - `422`：形が違う・自分
  - `404`：いない

#### 流れる SQL の目安

- レガシー版：1本増える（相手の `id` を読む）。マッチしないとき3本（測った）・するとき4本（見込み）
- 改善版：変わらない（相手を読む SQL を `for update` と一緒にする）

#### curl の例

- レガシー版：`... -d '{"user_id":"<相手の public_id>"}'`
- 改善版：同じ

### `GET /api/me/likes`（送った相手の一覧）

#### 応答（成功）

- レガシー版：1件の `user_id` が、相手の `public_id`（UUID）になる（ユーザー詳細へのリンクに使う）
- 改善版：同じ

#### 流れる SQL の目安

- レガシー版：**1＋3N 本**（1件ごとに、相手の `public_id` を読む SQL が1本増える。2件で7本を測った）
- 改善版：変わらない（`users` も JOIN して `public_id` を一緒に取る）

## #184 で足すこと（届いたいいねと、スキップ。状態：**実装済み（レガシー版）**）

M3（いいねとマッチに気づく）。要件は FR-LIKE-010〜013・FR-SEARCH-020。表は `skips`（[data-model.md](../data-model.md)）。

届いたいいねは「自分あてのもの」、スキップは「自分がしたもの」なので、どちらも `/api/me/` の下に置く。マッチする（送り返す）のは、今ある `POST /api/me/likes` を使う。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `GET /api/me/received-likes` | 届いたいいねの一覧（まだ返事をしていない相手） | 作る（`ReceivedLikeController::index`） | 作る |
| `POST /api/me/skips` | 相手をスキップする | 作る（`SkipController::store`） | 作る |
| `GET /api/me/skips` | スキップした相手の一覧 | 作る（`index`） | 作る |
| `DELETE /api/me/skips/{public_id}` | スキップを元に戻す | 作る（`destroy`） | 作る |
| `POST /api/me/likes`（02） | 送り返すいいねを、1日10回の数に入れない | 下の見出し | 下の見出し |
| `GET /api/users`（04） | スキップした相手を除く | 下の見出し | 下の見出し |

### `POST /api/me/likes`（02）で変えること

- 中身：送り返すいいねを、1日10回の数に入れない
- レガシー版：上限の確かめの前に、相手からのいいねがあるかを読む（2本増える）
- 改善版：いいねを送る Service（`LikeService`）の中で判断する

### `GET /api/users`（04）で変えること

- 中身：スキップした相手を除く
- レガシー版：`whereNotIn('id', $skipIds)`（スキップした相手の ID を PHP に持ってくる。1本増える）
- 改善版：`not exists`（本数は増えない）

### `GET /api/me/received-likes`

#### だれが使えるか

- レガシー版：正しい JWT を持つ人（無料でも有料でも。自分あての分だけ）
- 改善版：正しい `access` の Cookie を持ち、確認した会員

#### 応答（成功）

- レガシー版：`200`。新しい順の配列
  - 1件は `{"user_id": "019a…", "nickname": "…", "birthday": "1998-04-01", "prefecture": "東京都", "image": "…", "liked_at": "…"}`（生年月日をそのまま返す）
  - **全部を1回で返す**（ページ送りなし）
  - 退会した・止められた相手も出る
- 改善版：`200`（20件ずつ）
  - `{"data": [{"user_id": "019a…", "nickname": "…", "age": 28, "prefecture": {"code": 13, "name": "東京都"}, "avatar_url": "…", "liked_at": "…"}], "meta": {"next_cursor": null}}`

#### 除く相手

- レガシー版：もう送り返した相手・ブロックした／された相手・スキップした相手
  - それぞれの ID を PHP に持ってきて `whereNotIn` に並べる（4本）
- 改善版：同じ相手に加えて、退会・アカウント停止・強制退会の相手（FR-WD-006・014）
  - `not exists` で1本の中に書く
  - refactored-repo では #269 で、今の URL のまま、退会・アカウント停止・強制退会の相手を除いた（`whereHas('fromUser', …)` と `User::accountUsable()`。ほかの相手は、今のまま PHP に ID を持ってくる）

#### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `500`：JWT が壊れている
- 改善版：`401`・`403`

#### 流れる SQL の目安

- レガシー版：**5＋2N 本**。20件で 46本
  - 除く ID を読む4本・いいね1本・1件ごとにプロフィールと `public_id`
- 改善版：1本＋ガード1本

### `POST /api/me/skips`・`GET /api/me/skips`・`DELETE /api/me/skips/{public_id}`

#### スキップする（入力）

- レガシー版：`{"user_id": "<相手の public_id>"}`。確かめない
- 改善版：`user_id`：必須・UUID・いる会員・自分でない

#### スキップする（何をするか）

- レガシー版：1行入れる
  - **同じ相手を2回スキップすると、2行できる**（UNIQUE がない）
  - 自分もスキップできる
- 改善版：`(skipper_id, skipped_id)` の UNIQUE に当て、もうあれば何もしない（`insert … on conflict do nothing`）
  - 自分は `422`

#### スキップする（応答）

- レガシー版
  - `201`。`skips` の行をそのまま返す（中の連番の `id`・`skipper_id`・`skipped_id` が出る）
  - `500`：いない相手（NOT NULL の違反）・形の違う ID
- 改善版
  - `201`（新しく入れた）か `200`（もうあった）
  - `404`：いない会員
  - `422`：自分・入力の誤り

#### 一覧

- レガシー版：`200`。新しい順の配列（`user_id`・`nickname`・`birthday`・`prefecture`・`image`・`skipped_at`）
  - 1件ごとに2本（1＋2N）
  - 2回スキップした相手は、2回出る
- 改善版：`200` `{"data": […]}`。1本＋ガード1本

#### 元に戻す

- レガシー版：自分がスキップした行を消す（2行あれば2行とも）
  - `204`（消えた行がなくても `204`）
  - 形の違う ID は `500`
- 改善版：`204`。スキップしていなければ `404`

#### 相手に伝わるか

- レガシー版：伝わらない（スキップされた側が、それを知る API はない）
- 改善版：同じ

### レガシー版で起きること（2026-11-17 に curl で測った。測ったあと、作った行を消した）

- 届いたいいねが8件ある会員が、一覧を見る
  - 結果：`200`・8件・新しい順
  - 要件 ID：FR-LIKE-010
- スキップする
  - 結果：`201`。届いたいいねが7件になり、スキップした相手が1件になる
  - 要件 ID：FR-LIKE-012
- **同じ相手を、もう一度スキップする**
  - 結果：**`201`。スキップした相手の一覧に、同じ人が2回出る**
  - 要件 ID：FR-LIKE-012
- 元に戻す
  - 結果：`204`。届いたいいねが8件に戻る（2行とも消える）
  - 要件 ID：FR-LIKE-013
- いない相手・形の違う ID をスキップする
  - 結果：どちらも `500`
  - 要件 ID：FR-LIKE-012
- 検索の1人目をスキップする
  - 結果：検索に出なくなる。元に戻すと、また出る
  - 要件 ID：FR-SEARCH-020
- 今日もう10回いいねした無料の男性が、届いていない相手にいいねする
  - 結果：`403`（今までどおり）
  - 要件 ID：FR-PAID-008
- 同じ会員が、届いている相手に送り返す
  - 結果：`201`・`matched: true`。届いたいいねが1件減る
  - 要件 ID：FR-LIKE-011
- 流れる SQL（届いたいいね20件の会員）
  - 結果：**46本**
  - 要件 ID：NFR-LIKE-001
- 届いたいいねの実行計画
  - 結果：`likes` を全部読む（Seq Scan）
  - 21件を返すのに 21,906行を捨てる。`to_user_id` にインデックスがない
  - 要件 ID：NFR-LIKE-001
- スキップした相手を読む実行計画
  - 結果：`skips` を全部読む（Seq Scan。30,000行を捨てる。インデックスがない）
  - 要件 ID：NFR-LIKE-001

### 画面の側で分かったこと

- タブのバッジは、画面を移ったときにだけ数え直す（スキップ・マッチの直後は、古い数のまま）
- 数だけを返す API がないので、届いたいいねの一覧を全部読んで件数を数えている（画面を移るたびに 5＋2N 本）

## #187 で足すこと（マッチからトークへ直接行く・新しいマッチに気づく。状態：**実装済み（レガシー版）**）

M3 の残り。要件は FR-UI-069〜073。表は変えない（今ある `talk_rooms`・`talk_room_members.last_read_at` を使う）。

| API | 足すもの |
| --- | --- |
| `POST /api/me/likes`（いいねを送る） | マッチしたときの応答に `room_id` |
| `GET /api/me/likes`（送ったいいねの一覧） | 1件に `room_id` |
| `GET /api/users/{public_id}`（プロフィールを見る） | `room_id`（見ている人とマッチしていれば） |
| `GET /api/me/talk-rooms`（トークの一覧） | 1件に `last_read_at` |

### `POST /api/me/likes`（いいねを送る）に `room_id` を足す

- 足すもの：マッチしたときの応答に `room_id`（トークルームの ID。マッチしなければ `null`）
- レガシー版：マッチのときに作ったルームの `public_id` を、応答に足す（SQL は増えない）
- 改善版：`{"data": {"matched": true, "room_id": "019a…"}}`

### `GET /api/me/likes`（送ったいいねの一覧）に `room_id` を足す

- 足すもの：1件に `room_id`（マッチ済みなら。そうでなければ `null`）
- レガシー版：マッチ済みの1件ごとに3本増える
  - 自分のルームを全部読む・相手のいるルームを探す・`public_id` を読む
- 改善版：いいね・マッチ・ルームを JOIN して、1本の中で読む

### `GET /api/users/{public_id}`（プロフィールを見る）に `room_id` を足す

- 足すもの：`room_id`（見ている人とマッチしていれば）
- レガシー版：**この API は、もともとトークンを見ない**
  - トークンがあるときだけ JWT を読み、同じ探し方（3本）をコピーした
  - トークンなしは `null`
- 改善版：ログインが要る API にする。マッチしているか・いいね済みかを、1本の中で読む

### `GET /api/me/talk-rooms`（トークの一覧）に `last_read_at` を足す

- 足すもの：1件に `last_read_at`（自分が最後に開いた日時。まだなら `null`）
- レガシー版：今読んでいる参加者の行の列を、応答に足す（SQL は増えない）
- 改善版：`{"is_new": true}`（新しいマッチかどうかを、API が判断して返す）

### 新しいマッチの決め方

- 新しいマッチは、**画面が**「`last_message` がなく、`last_read_at` もない」ルームを新しいマッチと決めている（レガシー版）
- 決まりが画面にあるので、タブのバッジ（`TabBar.tsx`）とメッセージの一覧（`MessagesPage.tsx`）の2か所に、同じ判断を書いた

### レガシー版で測ったこと（2026-11-17。測ったあと、作った行を消した）

| 場面 | 結果 |
| --- | --- |
| プロフィールを見る（トークンあり・マッチした相手） | SQL 6本（トークンなしは 3本）。`room_id` が入る |
| プロフィールを見る（トークンなし） | `room_id` は `null` |
| 送ったいいねの一覧（2件・マッチ済み1件） | SQL 13本 |
| 相手が「マッチする」を押したあと、こちらがメッセージのタブを開く | 下の箇条書き |

相手が「マッチする」を押したあと、こちらがメッセージのタブを開くと：

- 「新しいマッチ」に相手が出る。タブのバッジ 1
- 開いて戻ると、やり取りの一覧に移り、バッジが消える

### 残っていること

- 新しいマッチは、メッセージのタブか、どこかの画面に移ったときにだけ分かる
  - 開いたままの画面には出ない。届いた瞬間に知らせる仕組みは、対象外の「通知」
- 相手が先にメッセージを送ってきたルームは、「新しいマッチ」ではなく、未読のあるやり取りとして一覧に出る
