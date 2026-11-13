# API の設計

API の正本。作る前に設計を書き、確かめてもらってから実装する（AGENTS.md の「作業の流れ」）。OpenAPI は使わないので、画面の型（03b から）はここに合わせて手で書く（D-006）。

- このファイルには、全体の決まりと一覧だけを書く。API ごとの設計（入力・応答・失敗・流れる SQL の目安・curl の例）は、一歩ごとのファイル（`<番号>-<名前>.md`。名前は `explanations/` の解説のページと同じ）に書く。新しい一歩の API は、ファイルを1つ足し、下の「一覧」に行を足す
- 状態：**案**（確かめてもらう前）→ **確定**（実装してよい）→ **実装済み**
- レガシー版と改善版で変わるところ（だれが使えるか・返す形など）は、表の「レガシー版」「改善版」の列に分けて書く。直したら、改善版に合わせて書き換える

## 全体の決まり

| 決めること | 決まり |
| --- | --- |
| パスの名前 | `/api/` のあとに、複数形の名詞（`/users`・`/likes`）。動詞は使わない（例外：認証の `/api/auth/login`・`/api/auth/logout`・`/api/auth/refresh`。広く使われている名前で、作る・消すものの名詞にすると分かりにくいため）。持ち主の下にあるものは入れ子にする（`/rooms/{public_id}/messages`）。ログインした本人のものは `/me` の下に置く |
| JSON のキー | `snake_case`（`user_id`・`height_cm`） |
| URL で指す ID | 1つのもの（会員・05 のトークルームなど）は、その表の `public_id`（UUID v7。例 `019a6f2e-3c4d-7b8a-9e10-2f3a4b5c6d7e`）で指す。連番の `id` は URL に使わない。一覧の応答で相手を指す `user_id` も `public_id`（詳細へのリンクに使うため）。JWT の `sub` は中の `id` のまま（D-022） |
| 成功のステータス | 読む・変える `200`／作る `201`／消す `204` |
| 失敗のステータス | 入力がおかしい `422`／見つからない `404`／ログインしていない `401`／権限がない `403`／同じものが2つになる `409` |
| エラーの形 | `{"message": "...", "errors": {"<項目>": ["..."]}}`（Laravel の標準の形）。`errors` は入力の誤り（`422`）のときだけ |
| 日付と時刻 | ISO 8601（`2026-11-11T10:00:00+09:00`）。日付だけなら `2026-11-11` |
| 値がないとき | キーは残して `null` を返す（キーを消さない） |
| 一覧 | 条件で絞るときは、一覧のパスにクエリを付ける（`GET /api/users?age_min=25`）。ページ送りは、レガシー版は `?page=`（OFFSET）、改善版はカーソル（`?cursor=` と応答の `next_cursor`。[04](04-search.md)） |

## 一覧

| 番号 | メソッドとパス | 中身 | 状態 |
| --- | --- | --- | --- |
| [00](00-health.md) | `GET /api/health` | 動いているかと、DB につながるか | 実装済み |
| [01](01-members.md) | `GET /api/users/{public_id}`（#46 までは `/api/users/{id}/profile`） | 相手のプロフィール（ユーザー詳細）を見る | 実装済み（レガシー版）。#46 の変更も実装済み（レガシー版） |
| [01](01-members.md) | `PUT /api/users/{public_id}`（#46 までは `/api/users/{id}/profile`。改善版は `PATCH /api/me`） | 自分のプロフィールを編集する | 実装済み（レガシー版）。#46 の変更も実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/users` | 登録する | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `GET /api/email-verifications/{token}`（改善版は `GET /api/users/{public_id}/email-verification/{hash}`） | メールアドレスを確認する（確認のメールのリンク） | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/email-verifications`（改善版は `POST /api/me/email-verification`） | 確認のメールをもう一度送る | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/login` | ログインする | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `GET /api/me` | 自分の情報を見る | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/logout` | ログアウトする | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/refresh`（改善版だけ） | トークンを取り替える | 確定 |
| [02](02-likes.md) | `POST /api/me/likes` | いいねを送る（03 でマッチを作る・`matched` を返す） | 実装済み（レガシー版）。03 の変更も実装済み（レガシー版） |
| [02](02-likes.md) | `GET /api/me/likes` | 送った相手の一覧（03 で `matched` を足す） | 実装済み（レガシー版）。03 の変更も実装済み（レガシー版） |
| [03](03-matches.md) | `GET /api/me/matches` | マッチした相手の一覧 | 実装済み（レガシー版） |
| [04](04-search.md) | `GET /api/users` | 相手を探す（絞り込み・並び・続き） | 実装済み（レガシー版） |
| [04](04-search.md) | `POST /api/auth/login`（変更） | 最終ログインを書き換える | 実装済み（レガシー版） |
| [05](05-messages.md) | `GET /api/me/talk-rooms` | トークの一覧（相手ごとの最新の1件・未読の数） | 実装済み（レガシー版） |
| [05](05-messages.md) | `GET /api/me/talk-rooms/{public_id}/messages` | トークの履歴（レガシー版は読んだことにするのもこの中） | 実装済み（レガシー版） |
| [05](05-messages.md) | `POST /api/me/talk-rooms/{public_id}/messages` | 送る | 実装済み（レガシー版） |
| [05](05-messages.md) | `PUT /api/me/talk-rooms/{public_id}/read`（改善版だけ） | 読んだことにする | 確定 |
| [02](02-likes.md) | `POST /api/me/likes`（05 の変更） | マッチしたらトークルームと参加者2人を作る | 実装済み（レガシー版。PR #60） |
