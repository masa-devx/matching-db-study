# 01 会員とプロフィール

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/members.md](../requirements/members.md)（FR-001〜FR-014・NFR-001）。表は `users`（アカウント）と `profiles`（その会員についての情報）に分かれる（D-015）。

| メソッドとパス | 何をする |
| --- | --- |
| `GET /api/users/{id}/profile`（#46 から `/api/users/{public_id}`） | 相手のプロフィールを見る |
| `PUT /api/users/{id}/profile`（#46 から `/api/users/{public_id}`） | 自分のプロフィールを編集する |

## `GET /api/users/{id}/profile`

### だれが使えるか

- レガシー版（legacy-repo）：だれでも
- 改善版（refactored-repo）：ログインした会員だけ
  - トークンがない・壊れている・期限切れ・退会・停止・強制退会は `401` `{"message": "ログインしてください"}`（FR-AUTH-020・NFR-AUTH-001）
  - refactored-repo では #243 で、この形にした

### 入力

- レガシー版：パスの `id`（整数）
- 改善版：同じ

### 応答（成功）

- レガシー版：`200`
  - 会員（`users` の行）の中に `profile`（`profiles` の行）が入った形
  - `password`・`remember_token` だけは `#[Hidden]` で隠れる
- 改善版：`200`。決めた項目だけを返す（下の例）

### 応答（失敗）

- レガシー版
  - `404`：その会員がいない（`{"message": "No query results for model [App\\Models\\User] 999"}`）
  - プロフィールがない会員は、`"profile": null` で `200`
- 改善版：`404`：その会員がいない（`{"message": "会員が見つかりません"}`）

### 流れる SQL の目安

- レガシー版：2本（`select * from users where id = ? limit 1` と、`select * from profiles where user_id in (?)`）
- 改善版：2本以内（NFR-001）

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/users/1/profile`
- 改善版：同じ

### レガシー版の書き方

Laravel 5 系のころによくある形：

```php
$user = User::findOrFail($id);
$user->load('profile');   // ここで2本目の SQL が流れ、応答に profile が入る
return $user;
// 初めは $user->profile; と書く案だったが、Larastan に「何もしていない式」と指摘されたので load() にした
```

### 応答の例

レガシー版の応答の例：

- **メールアドレス・生年月日も返してしまう**。FR-002 を守れていない
- 確認用の文字は、legacy-repo では返していた。refactored-repo で `User` の `#[Hidden]` に足し、返さないようにした

```json
{
  "id": 1,
  "email": "test@example.com",
  "email_verified_at": "2026-11-11T11:30:00.000000Z",
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

### だれが使えるか

- レガシー版：だれでも（**他人のプロフィールも書き換えられる**）
- 改善版：自分だけ（ログインしていなければ `401`。他人なら `403`）
  - refactored-repo では #243 で、ログインしていなければ `401` にした
  - 他人のものを書き換えられる穴は、#244 の1 で直す

### 入力（JSON）

- レガシー版：何でも受け取り、`profiles` の列に全部入れる（`$request->all()`）
- 改善版
  - `nickname`（必須・1〜20文字）
  - `prefecture_code`（なし か 都道府県の表にあるもの）
  - `height_cm`（なし か 120〜220 の整数）
  - `bio`（0〜500文字）
  - `avatar_path`（なし か 文字）
  - ほかのキーは無視する

### 応答（成功）

- レガシー版：`200`。書き換えたあとの `profiles` の行をそのまま返す
- 改善版：`200`。`GET` と同じ形

### 応答（失敗）

- レガシー版
  - 入力の誤りでは失敗しない（おかしな値もそのまま保存する）
  - ただし、プロフィールがない会員・いない会員は `500`（`null` に書こうとする）
  - `profiles` にない列の名前（`email` など）を送ると `500`
- 改善版
  - `404`：その会員がいない
  - `422`：入力の誤り（`{"message": "…", "errors": {"height_cm": ["…"]}}`）

### 流れる SQL の目安

- レガシー版：2本（`select * from profiles where user_id = ? limit 1` と `update`）
- 改善版：3本以内（会員を読む・プロフィールを書き換える・都道府県があるかを確かめる）

### curl の例

- レガシー版：`curl -X PUT http://127.0.0.1:8000/api/users/1/profile -H 'Content-Type: application/json' -d '{"nickname":"さくら","height":"160"}'`
- 改善版：`... -d '{"nickname":"さくら","height_cm":160}'`

### レガシー版の書き方

```php
$profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
$profile->fill($request->all());
$profile->save();
return $profile;
```

### レガシー版で起きること

改善する段階で、要件 ID のテストにする。

- `{"height": "abc"}`
  - レガシー版：保存される
  - 要件：FR-008
- 21文字のニックネーム
  - レガシー版：保存される
  - 要件：FR-006
- `{"nickname": ""}`（空のニックネーム）
  - レガシー版：保存される
  - 空の文字は `null` に変わり、`profiles.nickname` は NULL を許すので、ニックネームがなくなる
  - 要件：FR-006（改善版は `422`）
- `{"gender": "female", "birthday": "2010-01-01"}`
  - レガシー版：書き換わる
  - 要件：FR-010
- `{"user_id": 2}`
  - レガシー版：**プロフィールが会員 2 のものになる**（会員 2 は、プロフィールを2つ持つ）
  - 要件：FR-010・FR-011
- 他人の `id` で送る
  - レガシー版：書き換わる
  - 要件：01b で直す
- `GET` で他人の会員を見る
  - **直した**（refactored-repo）
  - legacy-repo では確認用の文字（`verification_token`）が見え、他人のメールアドレスの確認を済ませられた
  - 今は応答に出ない（`User` の `#[Hidden]`）
  - 要件：FR-002・FR-AUTH-005
- DB に、同じ会員の2つ目のプロフィールを入れる
  - レガシー版：入る（`user_id` に UNIQUE がない）
  - 要件：FR-011
- DB に、`user_id = 999`（いない会員）のプロフィールを入れる
  - レガシー版：入る（外部キーがない）
  - 要件：FR-011
- 会員を消す
  - レガシー版：**プロフィールが残る**（みなしごの行。確かめ済み）
  - 要件：FR-011

## #46 で変えること（パスと ID。状態：**実装済み（レガシー版）**。PR #47 で測った）

D-022。上は 01 で作った形のまま残し、ここに差分だけを書く。

### 相手を見る

- レガシー版：`GET /api/users/{public_id}`
- 改善版：同じ

### 自分を編集する

- レガシー版：`PUT /api/users/{public_id}`
  - だれでも、だれのものでも書き換えられる
  - UUID を知っていれば書き換えられる問題は残す
- 改善版：`PATCH /api/me`（ID なし。JWT の本人のもの）

### 入力

- レガシー版：パスの `public_id`（UUID）。形は確かめない
- 改善版：パスの `public_id`。UUID の形でなければ `404`（ルートの `whereUuid`）

### 会員の探し方

- レガシー版：`User::where('public_id', $publicId)->firstOrFail()`
- 改善版：同じ（`public_id` の UNIQUE のインデックスで1行）

### 応答（成功）

- レガシー版：`users` の行に `public_id` が足される
  - `id` などはこれまでどおり出る（メールアドレス・生年月日も返したまま）
  - 確認用の文字は、refactored-repo で隠した
- 改善版：`"user_id": "019a…"`（値が UUID になる。ほかは同じ）

### 応答（失敗）

- レガシー版
  - いない UUID は `404`
  - **UUID の形でない文字（`/api/users/5` など）は `500`**
  - PostgreSQL が `uuid` に変えられない（`22P02`）。SQL の文と接続先も本文に出る
- 改善版：いない・形が違う、どちらも `404`

### 流れる SQL の目安

- レガシー版
  - `GET` は変わらない：`select * from users where public_id = ? limit 1` と、`profiles` の1本。測って2本。いない UUID は1本で `404`
  - `PUT` は、UUID から中の `id` を読む1本が増える。同じ値で書き戻すと `update` が流れず2本。値が変われば3本の見込み
- 改善版：変わらない

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/users/<public_id>`
- 改善版：同じ

### パスに `/profile` を付けない理由

`users` と `profiles` に分けたのは DB の都合なので、パスに `/profile` を付けない。検索の `GET /api/users`（04）と、一覧と1件の対になる。

## #153 で変えること（検索に使う6項目。状態：**実装済み（レガシー版）**）

### `GET`・`PUT` の応答

- レガシー版：`profiles` の行に、`body_type`・`job`・`income`・`smoking`・`drinking`・`marital_status` が増える
  - 値は選択肢の名前の文字。未回答は `null`
- 改善版：`body_type`・`job`・`income`・`smoking`・`drinking`・`marital_status` を、`{"code": 3, "name": "普通"}` の形で返す（未回答は `null`）

### `PUT` の入力

- レガシー版：画面が6項目を文字で送る
  - API は確かめない（`$request->all()` のまま。選択肢にない文字も保存される）
- 改善版：`*_code`（なし か マスタの表にあるコード）。なければ `422`（FR-015）

### 選択肢の一覧

- レガシー版：画面に書いてある（ホーム・条件の画面・試しのデータの3か所に同じ一覧）
- 改善版：`GET /profile-options`（マスタの表から返す。画面は一覧を持たない）
