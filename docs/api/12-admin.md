# 12 管理画面

状態：**実装済み（レガシー版）**（PR は #90 の PR）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/admin.md](../requirements/admin.md)（FR-ADMIN-001〜012・NFR-ADMIN-001〜004）。表は会員の側と共通（`admins`・`admin_audit_logs`・`users.suspended_at` も含めて、作りは `backend/client` のマイグレーション。[data-model.md](../data-model.md)）。解説：`explanations/12-admin.html`（`legacy-repo`）。

管理画面の API は、会員の側とは別のアプリ（`backend/admin`・Docker の `admin-app`・`http://127.0.0.1:8100`）。パスは会員の側と同じく `/api/…` で始める（例：`http://127.0.0.1:8100/api/members`）。会員の側の API は呼ばず、DB を直接読み書きする。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `POST /api/auth/login` | 管理者のログイン | 作る | 作る |
| `GET /api/me` | 自分（名前・役割） | 作る | 作る |
| `GET /api/dashboard` | 数・直近30日の日ごと・直近12か月の売上 | 作る | 作る |
| `GET /api/members` | 会員の一覧（探す） | 作る | 作る |
| `GET /api/members/{public_id}` | 会員の詳細 | 作る | 作る |
| `POST /api/members/{public_id}/suspension` | 利用を止める（`owner` だけ） | 作る | 作る |
| `DELETE /api/members/{public_id}/suspension` | 止めたのを解く（`owner` だけ） | 作る | 作る |
| `GET /api/messages` | メッセージの一覧 | 作る | 作る |
| `GET /api/purchases` | 購入の一覧 | 作る | 作る |
| `GET /api/sales/monthly` | 月ごとの売上 | 作る | 作る |
| `GET /api/plans`・`PUT /api/plans/{id}` | プランの一覧・値段を変える（`owner` だけ） | 作る | 作る |
| `GET /api/audit-logs` | 監査ログの一覧（`owner` だけ） | 作る | 作る |
| 会員の側（`backend/client`） | 止めた会員を断る | ログインだけで断る（ほかの入口には写さない） | 会員を読む入口（ミドルウェア）で断る |

レガシー版は Fat Controller。だれが使うかは、管理者の JWT を読んで決める処理を、コントローラごとに写す（会員の側の 16か所と同じ形を、管理画面の中にもう一度作る）。役割（`viewer` を断る）と監査ログの書き込みも、コントローラごとに写す（写し忘れを測る）。入力は確かめず、エラーの扱いは考えない。

## 前提：管理画面の鍵（人が作る）

管理者の JWT は、管理画面の `APP_KEY` で署名する（会員の側の鍵とは別。会員の JWT では管理画面の API を使えないようにするため）。`APP_KEY` は秘密の値なので、AI は作らない・読まない。実装の前に、人が次の2つを実行する：

1. `cp backend/admin/.env.example backend/admin/.env`
2. `docker compose run --rm admin-app php artisan key:generate`

DB の接続先などは compose の環境変数が `.env` より優先されるので、`.env.example` の DB の行（sqlite）は直さなくてよい。

## `POST /api/auth/login`（管理者のログイン）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 入力（JSON） | `{"email": "owner@admin.example.test", "password": "password"}`。確かめない | 同じ。必須・形を確かめる |
| 応答（成功） | `200` `{"token": "<JWT>", "admin": {"name": "運営 太郎", "role": "owner"}}`。JWT の中身は `sub`（`admins.id`）・`role`・`exp`（8時間）。管理画面の `APP_KEY` で HS256。`last_login_at` を今にする | Cookie（HttpOnly）。中身に役割を入れない（毎回 DB で見る） |
| 応答（失敗） | `401` `{"message": "メールアドレスかパスワードが違います"}` | 同じ（回数の制限を足す） |
| 流れる SQL の目安 | 2本（管理者・update） | 2本 |

## `GET /api/dashboard`（数とグラフ）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| だれが使えるか | 管理者の JWT を持つ人（`owner`・`viewer`） | 同じ |
| 応答（成功） | `200` `{"cards": {"members": 18975, "registered_today": 0, "matches": 1003, "messages": 100000, "paid_members": 3000, "sales_this_month": 0}, "days": [{"day": "2026-10-16", "registrations": 0, "matches": 0, "messages": 1234}, …30日], "months": [{"month": "2025-12", "sales": 1234560}, …12か月]}` | 同じ形 |
| 数え方 | 会員は退会を除く（`deleted_at is null`）。有料会員は `is_paid = true` を数える（期限を見ないので、期限が過ぎた人も入る。07 と同じ穴）。日ごとは `whereDate(…)` を 30日 × 3種類 = 90本（UTC の日付）。売上は `purchases` と `plans` を JOIN して、**今の値段**で足す（月の区切りも UTC） | `generate_series` と `group by` で種類ごとに1本（日本時間）。有料は期限で数える。売上は買ったときの値段（07 の改善のあと） |
| 流れる SQL の目安 | **約 100本**（カード 6本・日ごと 90本・月ごと 1本。測ると 97本） | 5本前後 |
| 監査ログ | 書かない | 書かない（個人の情報を出さないため） |

## `GET /api/members`（会員の一覧）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 入力（クエリ） | `q`（メールアドレスかニックネームの部分一致）・`status`（`all`・`paid`・`suspended`・`withdrawn`）・`page`（1から。50人ずつ） | `q`・`status`・`cursor` |
| 応答（成功） | `200` `{"total": 18975, "page": 1, "data": [{"user_id": "019a…", "email": "…", "nickname": "…", "is_paid": false, "suspended_at": null, "deleted_at": null, "created_at": "…", "purchases": 3}]}` | `{"data": […], "next_cursor": "…"}`（件数は出さない・要る列だけ） |
| 並び | `created_at` の新しい順・`offset` | `created_at`・`id` の新しい順・カーソル |
| 流れる SQL の目安 | **2＋2N 本**（一覧・件数・1人ごとにプロフィールと購入の数）。50人で 102本。`like '%語%'` は表を全部読む | 1本＋件数なし |
| 監査ログ | 書かない | 書かない |

## `GET /api/members/{public_id}`（会員の詳細）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 応答（成功） | `200`。アカウント（メールアドレス・登録日・最終ログイン・有料・期限・止めた日時と理由・退会）・プロフィール・送ったいいねの数・もらったいいねの数・マッチの数・購入の記録（値段は今のプラン）・ブロックした数・された数 | 同じ（購入は買ったときの値段） |
| 応答（失敗） | `404`：いない会員。`500`：UUID の形でない文字 | `404` |
| 流れる SQL の目安 | 10本前後（数ごとに1本・購入は 1＋N） | 3本前後 |
| 監査ログ | **書く**（`member.view`・対象は会員の `public_id`） | 書く（ミドルウェア） |

## `POST`・`DELETE /api/members/{public_id}/suspension`（止める・解く）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| だれが使えるか | `POST` は `owner` だけ（`viewer` は `403`）。**`DELETE` には役割の確かめを写し忘れる**（`viewer` でも解ける） | どちらも `owner` だけ（ルートのミドルウェア） |
| 入力 | `POST`：`{"reason": "…"}`。確かめない | `reason`：必須 |
| 何をするか | `users.suspended_at` を今に、`suspended_reason` を入れる（`DELETE` は両方を空にする） | 同じ。会員の側の入口がすぐ断る |
| 応答（成功） | `204` | `204` |
| 監査ログ | `POST` は書く（`member.suspend`・理由を `detail`）。**`DELETE` は書き忘れる** | どちらも書く |
| 流れる SQL の目安 | 3〜4本（管理者・会員・update・監査ログ） | 3本＋begin・commit |

## `GET /api/messages`（メッセージの一覧）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 入力（クエリ） | `sender`（送った会員の `public_id`）・`from`・`to`（日付）・`q`（本文の部分一致）・`page`（50件ずつ） | 同じ＋`cursor` |
| 応答（成功） | `200` `{"total": 100000, "page": 1, "data": [{"id": 99999, "body": "…", "created_at": "…", "sender": {"user_id": "…", "nickname": "…"}, "partner": {"user_id": "…", "nickname": "…"}, "room_id": "019a…"}]}` | `{"data": […], "next_cursor": "…"}` |
| 流れる SQL の目安 | **2＋6N 本**（一覧・件数・1件ごとに送った人のプロフィールと `public_id`・ルーム・相手・相手のプロフィールと `public_id`）。50件で 302本。`created_at` に索引がないので、毎回 10万件を並べ替える。後ろのページほど `offset` で読んで捨てる | 1本（JOIN・主キーのカーソル） |
| 監査ログ | **書き忘れる**（本文を見られるのに残らない） | 書く（`message.list`・絞った条件） |

## `GET /api/purchases`・`GET /api/sales/monthly`（購入と売上）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 購入の一覧 | `200` `{"total": 23594, "page": 1, "data": [{"user_id": "…", "nickname": "…", "plan": "3か月", "price": 9800, "bought_at": "…"}]}`。値段は**今の**プラン。**2＋3N 本**（一覧・件数・1件ごとに会員・プロフィール・プラン） | 1本（JOIN）。値段は買ったときのもの |
| 月ごとの売上 | `200` `[{"month": "2025-12", "sales": 1234560}]`。`purchases` と `plans` の JOIN で、今の値段で足す。1本 | 買ったときの値段で足す（07 の改善のあと） |
| 監査ログ | 書かない | 書かない |

## `GET /api/plans`・`PUT /api/plans/{id}`（値段を変える）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| だれが使えるか | `GET` は管理者なら。`PUT` は `owner` だけ（`viewer` は `403`） | 同じ（ミドルウェア） |
| 入力 | `{"price": 4500}`。確かめない（0 や負の数も入る） | `price`：1以上の整数 |
| 応答（成功） | `200`。プランの行 | 同じ |
| 監査ログ | 書く（`plan.price`・前と後の値段を `detail`） | 書く |
| 流れる SQL の目安 | 4本（管理者・プラン・update・監査ログ） | 3本＋begin・commit |

## `GET /api/audit-logs`（監査ログ）

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| だれが使えるか | **役割を確かめ忘れる**（`viewer` でも見られる。要件は `owner` だけ） | `owner` だけ |
| 応答（成功） | `200` `{"total": …, "page": 1, "data": [{"admin": "運営 太郎", "action": "member.view", "target_type": "user", "target_id": "019a…", "detail": null, "created_at": "…"}]}`。新しい順・50件ずつ。1件ごとに管理者を読む（2＋N 本） | 1本（JOIN） |

## 会員の側（`backend/client`）に足すこと

| 入口 | レガシー版 | 改善版 |
| --- | --- | --- |
| `POST /api/auth/login` | `suspended_at` があれば `403` `{"message": "利用を停止しています"}` | 同じ |
| ほかの API（JWT を読む 16か所） | **見ない**（止める前にログインしていた会員は、持っている JWT でそのまま使える） | 会員を読む入口（ミドルウェア）で `403` |

## 失敗の共通（レガシー版）

- `Authorization` がない：`401` `{"message": "ログインしてください"}`
- 管理者の JWT が壊れている・期限切れ・**会員の JWT（鍵が違う）**：`500`（例外をつかまえない。要件は `401`）
- `viewer` が変える操作：`403` `{"message": "権限がありません"}`（写した場所だけ）

## レガシー版で起きること（#90 で測った。改善する段階で要件 ID のテストにする）

開発用の DB（会員 2万人・メッセージ 10万件・購入 23,594件・管理者 2人）に、手元から本物の HTTP を送った。SQL は管理画面のクエリログ（`backend/admin/storage/logs/sql-*.log`）の増えた行で数えた。時間は手元の Docker で1回ずつ。JWT は外に出していない。止めた会員・値段は戻し、試しの監査ログは消した。

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| owner・viewer でログイン・違うパスワード | `200`（SQL 2本）・`200`・`401` | FR-ADMIN-001 |
| **会員の JWT で管理画面の `/api/me`**・トークンなし | **`500`**（鍵が違い、例外をつかまえない）・`401` | FR-ADMIN-001・012 |
| ダッシュボード | `200`・**SQL 97本**・271ms。会員 19,005人（退会を除く）・マッチ 1,001・メッセージ 10万・**有料 3,000人（期限が過ぎた 1,200人も入る）**・今月の売上 6,730,600円 | FR-ADMIN-003・NFR-ADMIN-002 |
| 会員の一覧（1ページ目・200ページ目・語で探す・有料） | どれも **SQL 102本**（2＋2N）・92〜107ms | NFR-ADMIN-001 |
| **会員の一覧の1人の行** | **`password`（ハッシュ）と `verification_token` の列が入っている**（`users` の行をそのまま返す） | FR-ADMIN-004 |
| 会員の詳細（`search00001`） | `200`・SQL 9本。ない会員 `404`・UUID の形でない文字 **`500`** | FR-ADMIN-005 |
| メッセージの一覧（1ページ目・2,000ページ目・本文の語） | どれも **SQL 302本**（2＋6N）・146〜158ms | FR-ADMIN-007・NFR-ADMIN-001 |
| メッセージの 2,000ページ目の実行計画（`order by created_at desc offset 99950`） | 10万行を並べ替え（`external merge  Disk: 8304kB`）・shared hit 2,533・29ms | NFR-ADMIN-001 |
| 購入の一覧・月ごとの売上 | SQL 152本（2＋3N）・1本（75か月ぶん。期間の絞りなし） | FR-ADMIN-008 |
| viewer で止める・値段を変える | `403`・`403` | FR-ADMIN-010 |
| **viewer で解く・監査ログを見る** | **`204`・`200`**（役割の確かめを写し忘れ） | FR-ADMIN-010 |
| owner で止める | `204`・SQL 4本 | FR-ADMIN-006 |
| 止めた会員でログイン・**止める前の JWT で会員の `/api/me/matches`・`/api/me`** | `403`（「利用を停止しています」）・**`200`・`200`** | FR-ADMIN-006 |
| **owner で 1か月を 4,500円に変えたあとの、過去の月の売上** | **2026-09：4,185,020 → 4,283,300 円**（10月・11月も増えた。今の値段で足すため） | FR-ADMIN-009 |
| 監査ログに残った操作 | 会員の詳細（`member.view`）・止める（`member.suspend`）・値段（`plan.price` × 2）。**解く・メッセージの一覧・ダッシュボードは残らない** | FR-ADMIN-011 |
| 監査ログを DB で直接 `delete` | できる（取り消して確かめた） | FR-ADMIN-011 |
