# 01 会員とプロフィール

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/members.md](../requirements/members.md)（FR-001〜FR-014・NFR-001）。表は `users`（アカウント）と `profiles`（その会員についての情報）に分かれる（D-015）。

## `GET /api/users/{id}/profile`

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも | だれでも（01b で「ログインした会員だけ」にする） |
| 入力 | パスの `id`（整数） | 同じ |
| 応答（成功） | `200`。会員（`users` の行）の中に `profile`（`profiles` の行）が入った形。`password`・`remember_token` だけは `#[Hidden]` で隠れる | `200`。決めた項目だけを返す（下の例） |
| 応答（失敗） | `404`：その会員がいない（`{"message": "No query results for model [App\\Models\\User] 999"}`）。プロフィールがない会員は、`"profile": null` で `200` | `404`：その会員がいない（`{"message": "会員が見つかりません"}`） |
| 流れる SQL の目安 | 2本（`select * from users where id = ? limit 1` と、`select * from profiles where user_id in (?)`） | 2本以内（NFR-001） |
| curl の例 | `curl http://127.0.0.1:8000/api/users/1/profile` | 同じ |

レガシー版の書き方（Laravel 5 系のころによくある形）：

```php
$user = User::findOrFail($id);
$user->load('profile');   // ここで2本目の SQL が流れ、応答に profile が入る
return $user;
// 初めは $user->profile; と書く案だったが、Larastan に「何もしていない式」と指摘されたので load() にした
```

レガシー版の応答の例（**メールアドレス・確認用の文字・生年月日も返してしまう**。FR-002 を守れていない）：

```json
{
  "id": 1,
  "email": "test@example.com",
  "email_verified_at": "2026-11-11T11:30:00.000000Z",
  "verification_token": null,
  "created_at": "2026-11-11T11:30:00.000000Z",
  "updated_at": "2026-11-11T11:30:00.000000Z",
  "profile": {
    "id": 1,
    "user_id": 1,
    "nickname": "テスト",
    "gender": "male",
    "birthday": "1999-06-09",
    "prefecture": "北海道",
    "height": "150",
    "introduction": "…",
    "image": "/images/avatars/demo-5.svg",
    "created_at": "2026-11-11T11:30:00.000000Z",
    "updated_at": "2026-11-11T11:30:00.000000Z"
  }
}
```

改善版の応答の例（年齢を返し、生年月日・メールアドレス・パスワードは返さない。FR-001〜003）：

```json
{
  "user_id": 1,
  "nickname": "テスト",
  "gender": {"code": 1, "name": "男性"},
  "age": 27,
  "prefecture": {"code": 1, "name": "北海道"},
  "height_cm": 150,
  "bio": "…",
  "avatar_url": "/images/avatars/demo-5.svg"
}
```

- 都道府県・身長・画像がないときは、キーを残して `null`（全体の決まり）
- 年齢は、日本の時間帯（`Asia/Tokyo`）の今日の日付で出す（FR-003）

## `PUT /api/users/{id}/profile`

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも（**他人のプロフィールも書き換えられる**） | だれでも（01b で「自分だけ」にする。他人なら `403`） |
| 入力（JSON） | 何でも受け取り、`profiles` の列に全部入れる（`$request->all()`） | `nickname`（必須・1〜20文字）・`prefecture_code`（なし か 都道府県の表にあるもの）・`height_cm`（なし か 120〜220 の整数）・`bio`（0〜500文字）・`avatar_path`（なし か 文字）。ほかのキーは無視する |
| 応答（成功） | `200`。書き換えたあとの `profiles` の行をそのまま返す | `200`。`GET` と同じ形 |
| 応答（失敗） | 入力の誤りでは失敗しない（おかしな値もそのまま保存する）。ただし、プロフィールがない会員・いない会員は `500`（`null` に書こうとする）、`profiles` にない列の名前（`email` など）を送ると `500` | `404`：その会員がいない。`422`：入力の誤り（`{"message": "…", "errors": {"height_cm": ["…"]}}`） |
| 流れる SQL の目安 | 2本（`select * from profiles where user_id = ? limit 1` と `update`） | 3本以内（会員を読む・プロフィールを書き換える・都道府県があるかを確かめる） |
| curl の例 | `curl -X PUT http://127.0.0.1:8000/api/users/1/profile -H 'Content-Type: application/json' -d '{"nickname":"さくら","height":"160"}'` | `... -d '{"nickname":"さくら","height_cm":160}'` |

レガシー版の書き方：

```php
$profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
$profile->fill($request->all());
$profile->save();
return $profile;
```

レガシー版で起きること（改善する段階で、要件 ID のテストにする）：

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| `{"height": "abc"}` | 保存される | FR-008 |
| 21文字のニックネーム | 保存される | FR-006 |
| `{"nickname": ""}`（空のニックネーム） | 保存される（空の文字は `null` に変わり、`profiles.nickname` は NULL を許すので、ニックネームがなくなる） | FR-006（改善版は `422`） |
| `{"gender": "female", "birthday": "2010-01-01"}` | 書き換わる | FR-010 |
| `{"user_id": 2}` | **プロフィールが会員 2 のものになる**（会員 2 は、プロフィールを2つ持つ） | FR-010・FR-011 |
| 他人の `id` で送る | 書き換わる | 01b で直す |
| `GET` で他人の会員を見る | **確認用の文字（`verification_token`）が見える**。他人のメールアドレスの確認を済ませられる | FR-002・FR-AUTH-005 |
| DB に、同じ会員の2つ目のプロフィールを入れる | 入る（`user_id` に UNIQUE がない） | FR-011 |
| DB に、`user_id = 999`（いない会員）のプロフィールを入れる | 入る（外部キーがない） | FR-011 |
| 会員を消す | **プロフィールが残る**（みなしごの行。確かめ済み） | FR-011 |

## #46 で変えること（パスと ID。状態：**実装済み（レガシー版）**。PR #47 で測った）

D-022。上の表は 01 で作った形のまま残し、ここに差分だけを書く。

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 相手を見る | `GET /api/users/{public_id}` | 同じ |
| 自分を編集する | `PUT /api/users/{public_id}`（だれでも、だれのものでも。UUID を知っていれば書き換えられる問題は残す） | `PATCH /api/me`（ID なし。JWT の本人のもの） |
| 入力 | パスの `public_id`（UUID）。形は確かめない | パスの `public_id`。UUID の形でなければ `404`（ルートの `whereUuid`） |
| 会員の探し方 | `User::where('public_id', $publicId)->firstOrFail()` | 同じ（`public_id` の UNIQUE のインデックスで1行） |
| 応答（成功） | `users` の行に `public_id` が足される。`id` などはこれまでどおり出る（メールアドレス・確認用の文字・生年月日も返したまま） | `"user_id": "019a…"`（値が UUID になる。ほかは同じ） |
| 応答（失敗） | いない UUID は `404`。**UUID の形でない文字（`/api/users/5` など）は `500`**（PostgreSQL が `uuid` に変えられない。`22P02`。SQL の文と接続先も本文に出る） | いない・形が違う、どちらも `404` |
| 流れる SQL の目安 | `GET` は変わらない（`select * from users where public_id = ? limit 1` と、`profiles` の1本。測って2本。いない UUID は1本で `404`）。`PUT` は、UUID から中の `id` を読む1本が増える（同じ値で書き戻すと `update` が流れず2本。値が変われば3本の見込み） | 変わらない |
| curl の例 | `curl http://127.0.0.1:8000/api/users/<public_id>` | 同じ |

`users` と `profiles` に分けたのは DB の都合なので、パスに `/profile` を付けない。検索の `GET /api/users`（04）と、一覧と1件の対になる。
