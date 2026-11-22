# API の設計

API の正本。作る前に設計を書き、確かめてもらってから実装する（AGENTS.md の「作業の流れ」）。OpenAPI は使わないので、画面の型（03b から）はここに合わせて手で書く（D-006）。

- このファイルには、全体の決まりと一覧だけを書く。API ごとの設計（入力・応答・失敗・流れる SQL の目安・curl の例）は、一歩ごとのファイル（`<番号>-<名前>.md`。名前は `explanations/` の解説のページと同じ）に書く。新しい一歩の API は、ファイルを1つ足し、下の「一覧」に行を足す
- 状態：**案**（確かめてもらう前）→ **確定**（実装してよい）→ **実装済み**
- レガシー版と改善版で変わるところ（だれが使えるか・返す形など）は、項目ごとの見出しの下に「- レガシー版：…」「- 改善版：…」の箇条書きで分けて書く。直したら、改善版に合わせて書き換える
- ファイルの先頭に、そのファイルの API の短い一覧の表（メソッドとパス・何をする）を置く

## 全体の決まり

### パスの名前

- `/api/` のあとに、複数形の名詞（`/users`・`/likes`）。動詞は使わない
- 例外：認証の `/api/auth/login`・`/api/auth/logout`・`/api/auth/refresh`
  - 広く使われている名前で、作る・消すものの名詞にすると分かりにくいため
- 持ち主の下にあるものは入れ子にする（`/rooms/{public_id}/messages`）
- ログインした本人のものは `/me` の下に置く

### JSON のキー

- `snake_case`（`user_id`・`height_cm`）

### URL で指す ID

- 1つのもの（会員・05 のトークルームなど）は、その表の `public_id`（UUID v7。例 `019a6f2e-3c4d-7b8a-9e10-2f3a4b5c6d7e`）で指す
- 連番の `id` は URL に使わない
- 一覧の応答で相手を指す `user_id` も `public_id`（詳細へのリンクに使うため）
- JWT の `sub` は中の `id` のまま（D-022）

### 成功のステータス

- 読む・変える `200`／作る `201`／消す `204`

### 失敗のステータス

- 入力がおかしい `422`／見つからない `404`／ログインしていない `401`／権限がない `403`／同じものが2つになる `409`
- メンテナンス中 `503`「ただいまメンテナンス中です」（会員の API のどれも。FR-MAINT-001。画面は `client.ts` の1か所で見分ける）

### ログインが要るか

- ログインが要らない API の決まりは、要件の FR-AUTH-024。今の一覧は `backend/client/tests/Endpoints.php` の `routesWithoutLogin()`（ここには書かない）
- 改善版は、ログインが要る API を、ルートの `user.authenticate`（ログインを確かめる Middleware）のグループに入れる。トークンがない・壊れている・期限切れ・退会・アカウント停止・強制退会は `401`「ログインしてください」
- 新しい API がグループに入っていないと、`tests/Feature/Auth/LoginRequiredRoutesTest.php` が落ちる
- アカウント停止された会員だけは、`401` `{"message": "このアカウントは停止されています", "code": "account_suspended"}` を返す（画面が理由を出すため。NFR-AUTH-001）。退会・強制退会は、理由を言わずに `401`「ログインしてください」
- 各ページの「レガシー版で起きること」の「`500`：JWT が壊れている」は、`legacy-repo` の動き。`refactored-repo` では、どれも `401` になった（#257）
- `refactored-repo` では、ログインが要る API は、各ページの「流れる SQL の目安」より多い（`sessions` の select と update、`users` の select 2本：ガードと、アカウントの状態の確かめ。D-027・03-how.md の DB）
- ログアウト（`POST /api/auth/logout`）は、ログインの確かめの外（ログインしていなくても `204`。アカウント停止された会員も、自分のセッションを消せるように）

### エラーの形

- `{"message": "...", "errors": {"<項目>": ["..."]}}`（Laravel の標準の形）
- `errors` は入力の誤り（`422`）のときだけ

### 日付と時刻

- ISO 8601（`2026-11-11T10:00:00+09:00`）。日付だけなら `2026-11-11`

### 値がないとき

- キーは残して `null` を返す（キーを消さない）

### 一覧

- 条件で絞るときは、一覧のパスにクエリを付ける（`GET /api/users?age_min=25`）
- ページ送りは、レガシー版は `?page=`（OFFSET）、改善版はカーソル（`?cursor=` と応答の `next_cursor`。[04](04-search.md)）

## 一覧

| 番号 | メソッドとパス | 中身 | 状態 |
| --- | --- | --- | --- |
| [00](00-health.md) | `GET /api/health` | 動いているかと、DB につながるか | 実装済み |
| [01](01-members.md) | `GET /api/users/{public_id}` | 相手のプロフィール（ユーザー詳細）を見る | 実装済み（レガシー版）。#46 の変更も実装済み（レガシー版） |
| [01](01-members.md) | `PUT /api/users/{public_id}`（改善版は `PATCH /api/me`） | 自分のプロフィールを編集する | 実装済み（レガシー版）。#46 の変更も実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/users` | 登録する | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `GET /api/email-verifications/{token}`（改善版は下の補足） | メールアドレスを確認する（確認のメールのリンク） | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/email-verifications`（改善版は `POST /api/me/email-verification`） | 確認のメールをもう一度送る | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/login` | ログインする | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `GET /api/me` | 自分の情報を見る | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/logout` | ログアウトする | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/auth/refresh`（改善版だけ） | トークンを取り替える | 確定 |
| [01b](01b-auth.md) | `PUT /api/me/password` | パスワードを変える（M1 設定画面。#181） | 実装済み（レガシー版） |
| [01b](01b-auth.md) | `POST /api/password-resets`・`PUT /api/password-resets/{token}` | パスワードを忘れたときの再設定（メールを送る・新しいパスワードを決める。M2。#196） | 実装済み（レガシー版） |
| [02](02-likes.md) | `POST /api/me/likes` | いいねを送る（03 でマッチを作る・`matched` を返す） | 実装済み（レガシー版）。03 の変更も実装済み（レガシー版） |
| [02](02-likes.md) | `GET /api/me/likes` | 送った相手の一覧（03 で `matched` を足す） | 実装済み（レガシー版）。03 の変更も実装済み（レガシー版） |
| [03](03-matches.md) | `GET /api/me/matches` | マッチした相手の一覧 | 実装済み（レガシー版） |
| [04](04-search.md) | `GET /api/users` | 相手を探す（絞り込み・並び・続き） | 実装済み（レガシー版） |
| [04](04-search.md) | `POST /api/auth/login`（変更） | 最終ログインを書き換える | 実装済み（レガシー版） |
| [04b](04b-saved-searches.md) | `GET /api/me/search-conditions` | 保存した検索条件の一覧 | 実装済み（レガシー版） |
| [04b](04b-saved-searches.md) | `POST /api/me/search-conditions` | 検索の条件に名前を付けて保存する（1人5件まで） | 実装済み（レガシー版） |
| [04b](04b-saved-searches.md) | `PUT /api/me/search-conditions/{public_id}` | 保存した検索条件を直す | 実装済み（レガシー版） |
| [04b](04b-saved-searches.md) | `DELETE /api/me/search-conditions/{public_id}` | 保存した検索条件を消す | 実装済み（レガシー版） |
| [05](05-messages.md) | `GET /api/me/talk-rooms` | トークの一覧（相手ごとの最新の1件・未読の数） | 実装済み（レガシー版） |
| [05](05-messages.md) | `GET /api/me/talk-rooms/{public_id}/messages` | トークの履歴（レガシー版は読んだことにするのもこの中） | 実装済み（レガシー版） |
| [05](05-messages.md) | `POST /api/me/talk-rooms/{public_id}/messages` | 送る | 実装済み（レガシー版） |
| [05](05-messages.md) | `PUT /api/me/talk-rooms/{public_id}/read`（改善版だけ） | 読んだことにする | 確定 |
| [02](02-likes.md) | `POST /api/me/likes`（05 の変更） | マッチしたらトークルームと参加者2人を作る | 実装済み（レガシー版。PR #60） |
| [02](02-likes.md) | `GET /api/me/received-likes` | 届いたいいねの一覧（M3。#184） | 実装済み（レガシー版） |
| [05](05-messages.md) | `GET /api/me/badge-counts` | 下のタブのバッジの数（未読・新しいマッチ・届いたいいね。#247） | 実装済み（改善版） |
| [02](02-likes.md) | `POST /api/me/skips`・`GET /api/me/skips`・`DELETE /api/me/skips/{public_id}` | スキップする・スキップした相手の一覧・元に戻す（M3。#184） | 実装済み（レガシー版） |
| [05c](05c-firestore.md) | `POST /api/me/firebase-token` | 画面が Firebase（手元の Emulator）にログインするトークンを出す | 実装済み（レガシー版） |
| [05c](05c-firestore.md) | `POST /api/me/likes`（05c の変更） | マッチしたら、Firestore にもルームと2人の受信箱を作る | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `POST /api/me/blocks` | ブロックする | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `GET /api/me/blocks` | ブロックした相手の一覧 | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `DELETE /api/me/blocks/{public_id}` | 解除する | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `DELETE /api/me` | 退会する | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `GET /api/users`（06 の変更） | ブロックした・された相手と、退会した相手を除く | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `GET /api/me/likes`（06 の変更） | ブロックした・された相手を除く | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `GET /api/me/matches`（06 の変更） | ブロックした・された相手を除く | 実装済み（レガシー版） |
| [06](06-blocks-withdrawal.md) | `GET /api/me/talk-rooms`（06 の変更） | ブロックした・された相手を除く | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `GET /api/plans` | 期間と値段の一覧（男性だけ） | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `POST /api/me/purchases` | 購入する（男性だけ。決済なし） | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `GET /api/me/purchases` | 購入の記録（男性だけ） | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `POST /api/me/talk-rooms/{public_id}/messages`（07 の変更） | 男性の無料の会員を断る（送る） | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `POST /api/me/likes`（07 の変更） | 男性の無料の会員を断る（1日11回目のいいね） | 実装済み（レガシー版） |
| [07](07-paid-members.md) | `GET /api/users`（07 の変更） | 男性の無料の会員を断る（身長の条件） | 実装済み（レガシー版） |
| [12](12-admin.md) | `POST /api/auth/login`・`GET /api/me`（管理画面の API・:8100） | 管理者のログイン・自分 | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/dashboard` | 数・日ごと・月ごとの売上 | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/members`・`GET /api/members/{public_id}` | 会員の一覧と詳細 | 実装済み（レガシー版） |
| [12](12-admin.md) | `POST`・`DELETE /api/members/{public_id}/suspension` | 利用を止める・解く | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/messages`・`GET /api/purchases`・`GET /api/sales/monthly` | メッセージ・購入の一覧と月ごとの売上 | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/plans`・`PUT /api/plans/{id}`・`GET /api/audit-logs` | 値段の変更・監査ログ | 実装済み（レガシー版） |
| [12](12-admin.md) | `POST /api/auth/login`（会員の側。12 の変更） | アカウント停止された会員をログインで断る | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `POST /api/me/reports`（会員の側） | 通報する（M7・A7） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `GET /api/report-cases`（管理画面） | 案件の一覧（M7・A7） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `GET /api/report-cases/{publicId}`（管理画面） | 案件の中身（M7・A7） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `PUT /api/report-cases/{publicId}`（管理画面） | 状態を変える（M7・A7） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `POST /api/members/{publicId}/notices`（管理画面） | 運営からのお知らせ（A7。#213） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `POST /api/members/{publicId}/ban`（管理画面） | 強制退会（A7。#213） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `GET /api/me/notices`（会員の側） | 運営からのお知らせ（A7。#213） | 実装済み（レガシー版） |
| [M7](m7-reports.md) | `POST /api/me/notices/{publicId}/read`（会員の側） | 運営からのお知らせ（A7。#213） | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/talk-rooms/{publicId}`（管理画面） | やり取りを続けて読む（#221） | 実装済み（レガシー版） |
| [12](12-admin.md) | `POST /api/members/{publicId}/notes`（管理画面） | 対応のメモ（#216） | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/members` の絞り込み（管理画面） | 絞り込み（#218） | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/audit-logs` の絞り込み（管理画面） | 絞り込み（#221） | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/members/{publicId}/talk-rooms`・`…/violations`・`…/blocks` | 会員ごとの、やり取り・違反・ブロック（#227） | 実装済み（レガシー版） |
| [12](12-admin.md) | `GET /api/block-ranking`（管理画面） | ブロックの多い会員（#227） | 実装済み（レガシー版） |

一覧の補足：

- 01 の2つのパスは、#46 までは `/api/users/{id}/profile`
- メールアドレスの確認（01b）は、改善版は `GET /api/users/{public_id}/email-verification/{hash}`
- 06 の変更で、退会した相手を除くのは検索（`GET /api/users`）だけ
- #227 の会員ごとの3つ（`…/talk-rooms`・`…/violations`・`…/blocks`）も、管理画面の API
