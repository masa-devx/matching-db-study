# API の設計

API の正本。作る前にここに設計を書き、確かめてもらってから実装する（AGENTS.md の「作業の流れ」）。OpenAPI は使わないので、画面の型（03b から）はここに合わせて手で書く（D-006）。

- 状態：**案**（確かめてもらう前）→ **確定**（実装してよい）→ **実装済み**
- 素朴な版と直した版で変わるところ（だれが使えるか・返す形など）は、「直した版で変えること」に書く。直したら、ここを直した版に合わせて書き換える

## 全体の決まり

| 決めること | 決まり |
| --- | --- |
| パスの名前 | `/api/` のあとに、複数形の名詞（`/users`・`/likes`）。動詞は使わない。持ち主の下にあるものは入れ子にする（`/users/{id}/profile`） |
| JSON のキー | `snake_case`（`user_id`・`height_cm`） |
| 成功のステータス | 読む・変える `200`／作る `201`／消す `204` |
| 失敗のステータス | 入力がおかしい `422`／見つからない `404`／ログインしていない `401`／権限がない `403`／同じものが2つになる `409` |
| エラーの形 | `{"message": "...", "errors": {"<項目>": ["..."]}}`（Laravel の標準の形）。`errors` は入力の誤り（`422`）のときだけ |
| 日付と時刻 | ISO 8601（`2026-11-11T10:00:00+09:00`）。日付だけなら `2026-11-11` |
| 値がないとき | キーは残して `null` を返す（キーを消さない） |
| 一覧 | 04 で決める（ページ送りのしかた） |

## 一覧

| 番号 | メソッドとパス | 中身 | 状態 |
| --- | --- | --- | --- |
| 00 | `GET /api/health` | 動いているかと、DB につながるか | 実装済み |
| 01 | `GET /api/users/{id}/profile` | 相手のプロフィールを見る | 確定（素朴な版を作り直し中・#18） |
| 01 | `PUT /api/users/{id}/profile` | プロフィールを編集する | 確定（素朴な版を作り直し中・#18） |

## 00 環境

### `GET /api/health`

| 項目 | 中身 |
| --- | --- |
| だれが使えるか | だれでも |
| 入力 | なし |
| 応答（成功） | `200` `{"status": "ok", "database": "matching_dev", "migrations": 4}` |
| 応答（失敗） | `500`：DB につながらない・マイグレーションの前 |
| 流れる SQL の目安 | 1本 |
| curl の例 | `curl http://127.0.0.1:8000/api/health` |

## 01 会員とプロフィール

要件：[requirements/members.md](requirements/members.md)（FR-001〜FR-014・NFR-001）。表は `users`（アカウント）と `profiles`（その会員についての情報）に分かれる（D-015）。

### `GET /api/users/{id}/profile`

| 項目 | 素朴な版（legacy-repo） | 直した版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも | だれでも（01b で「ログインした会員だけ」にする） |
| 入力 | パスの `id`（整数） | 同じ |
| 応答（成功） | `200`。会員（`users` の行）の中に `profile`（`profiles` の行）が入った形。`password`・`remember_token` だけは `#[Hidden]` で隠れる | `200`。決めた項目だけを返す（下の例） |
| 応答（失敗） | `404`：その会員がいない（`{"message": "No query results for model [App\\Models\\User] 999"}`）。プロフィールがない会員は、`"profile": null` で `200` | `404`：その会員がいない（`{"message": "会員が見つかりません"}`） |
| 流れる SQL の目安 | 2本（`select * from users where id = ? limit 1` と、`select * from profiles where user_id = ?`） | 2本以内（NFR-001） |
| curl の例 | `curl http://127.0.0.1:8000/api/users/1/profile` | 同じ |

素朴な版の書き方（Laravel 5 系のころによくある形）：

```php
$user = User::findOrFail($id);
$user->profile;   // ここで2本目の SQL が流れ、応答に profile が入る
return $user;
```

素朴な版の応答の例（**メールアドレス・確認用の文字・生年月日も返してしまう**。FR-002 を守れていない）：

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

直した版の応答の例（年齢を返し、生年月日・メールアドレス・パスワードは返さない。FR-001〜003）：

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

### `PUT /api/users/{id}/profile`

| 項目 | 素朴な版（legacy-repo） | 直した版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも（**他人のプロフィールも書き換えられる**） | だれでも（01b で「自分だけ」にする。他人なら `403`） |
| 入力（JSON） | 何でも受け取り、`profiles` の列に全部入れる（`$request->all()`） | `nickname`（必須・1〜20文字）・`prefecture_code`（なし か 都道府県の表にあるもの）・`height_cm`（なし か 120〜220 の整数）・`bio`（0〜500文字）・`avatar_path`（なし か 文字）。ほかのキーは無視する |
| 応答（成功） | `200`。書き換えたあとの `profiles` の行をそのまま返す | `200`。`GET` と同じ形 |
| 応答（失敗） | 入力の誤りでは失敗しない（おかしな値もそのまま保存する）。ただし、プロフィールがない会員・いない会員は `500`（`null` に書こうとする）、`profiles` にない列の名前（`email` など）を送ると `500` | `404`：その会員がいない。`422`：入力の誤り（`{"message": "…", "errors": {"height_cm": ["…"]}}`） |
| 流れる SQL の目安 | 2本（`select * from profiles where user_id = ? limit 1` と `update`） | 3本以内（会員を読む・プロフィールを書き換える・都道府県があるかを確かめる） |
| curl の例 | `curl -X PUT http://127.0.0.1:8000/api/users/1/profile -H 'Content-Type: application/json' -d '{"nickname":"さくら","height":"160"}'` | `... -d '{"nickname":"さくら","height_cm":160}'` |

素朴な版の書き方：

```php
$profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
$profile->fill($request->all());
$profile->save();
return $profile;
```

素朴な版で起きること（直す段階で、要件 ID のテストにする）：

| 送るもの・すること | 素朴な版 | 要件 |
| --- | --- | --- |
| `{"height": "abc"}` | 保存される | FR-008 |
| 21文字のニックネーム | 保存される | FR-006 |
| `{"nickname": ""}`（空のニックネーム） | 保存される（空の文字は `null` に変わり、`profiles.nickname` は NULL を許すので、ニックネームがなくなる） | FR-006（直した版は `422`） |
| `{"gender": "female", "birthday": "2010-01-01"}` | 書き換わる | FR-010 |
| `{"user_id": 2}` | **プロフィールが会員 2 のものになる**（会員 2 は、プロフィールを2つ持つ） | FR-010・FR-011 |
| 他人の `id` で送る | 書き換わる | 01b で直す |
| `GET` で他人の会員を見る | **確認用の文字（`verification_token`）が見える**。他人のメールアドレスの確認を済ませられる | FR-002・FR-AUTH-005 |
| DB に、同じ会員の2つ目のプロフィールを入れる | 入る（`user_id` に UNIQUE がない） | FR-011 |
| DB に、`user_id = 999`（いない会員）のプロフィールを入れる | 入る（外部キーがない） | FR-011 |
| 会員を消す | **プロフィールが残る**（みなしごの行。確かめ済み） | FR-011 |
