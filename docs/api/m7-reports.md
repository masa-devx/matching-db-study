# M7・A7 通報

状態：**実装済み（レガシー版。表 #201・会員の側 #202・管理画面 #203）**
要件：[../requirements/reports.md](../requirements/reports.md)（FR-REPORT-001〜017）

会員の側（`backend/client`）に、通報する API を1本。管理画面の側（`backend/admin`）に、案件を見る・対応する API を3本。表は `reports`（通報）と `report_cases`（案件）の2つで、作り（マイグレーション）は `backend/client` に置く。

| メソッドとパス | 側 | 何をする |
| --- | --- | --- |
| `POST /api/me/reports` | 会員 | 通報する |
| `GET /api/report-cases` | 管理画面 | 案件の一覧 |
| `GET /api/report-cases/{publicId}` | 管理画面 | 案件の中身 |
| `PUT /api/report-cases/{publicId}` | 管理画面 | 状態を変える |

お知らせと強制退会の API（#213）は、下の「#213 で足すこと」にある。

## 表の作り

通報された会員ごとに、まだ済みでない案件は1つ。通報は、その案件に入る。済みの案件しかない会員に通報が来たら、新しい案件を作る（FR-REPORT-017）。

### レガシー版｜改善版

#### 会員・メッセージ・案件を指す列

- レガシー版（legacy-repo）：数の列だけ（外部キーなし）
  - いない会員・ないメッセージを指す行が入る
- 改善版（refactored-repo）：外部キー
  - 通報した会員・通報された会員・案件は `restrict`（通報の残っている会員の行は、消せない。今の退会は行を消さないので困らない）
  - メッセージは `set null` にせず `restrict`（証拠が消えない）

#### まだ済みでない案件は、会員に1つ

- レガシー版：何もない
  - 「あるかを見てから作る」のあいだに別の通報が入ると、2つできる
- 改善版：部分 UNIQUE インデックス：`unique (reported_id) where status <> 'closed'`
  - 2つ目の insert は失敗するので、失敗したら、ある方の案件を読み直す

#### 状態・理由・何をしたか

- レガシー版：文字の列に、決まった文字を入れる約束だけ（`'open'` と `'Open'` と `'未対応'` が混ざって入る）
- 改善版：文字の列＋ CHECK 制約（`status in ('open','in_progress','closed')` など）
  - 済みのときは「何をしたか」が要る、も CHECK：`status <> 'closed' or action is not null`

#### 自分を通報

- レガシー版：入る
- 改善版：CHECK：`reporter_id <> reported_id`

#### インデックス

- レガシー版：主キーだけ
  - 案件の通報を探す・状態で絞る・会員の案件を探す、のどれも表を全部読む
- 改善版
  - `reports (report_case_id, created_at)`
  - `report_cases (status, last_reported_at desc)`
  - 上の部分 UNIQUE（会員で探すのにも使う）

#### 一覧に出す件数・人数・新しい通報の日時

- レガシー版：案件ごとに、そのつど `reports` を数える（1＋2N 本）
  - 人数は、件数と同じ数を出す
- 改善版：一覧の SQL 1本で、`reports` を案件ごとに集める（`count(*)`・`count(distinct reporter_id)`）
  - 新しい通報の日時は、並び替えに使うので、案件の列（`last_reported_at`）に持ち、通報のたびに書き換える

#### 外から見える ID

- レガシー版：案件に `public_id`（UUID）
  - 通報は、数の `id` をそのまま返す
- 改善版：案件も通報も `public_id`

### レガシー版の DDL（マイグレーションが作る形）

```sql
create table report_cases (
    id          bigserial primary key,
    public_id   uuid not null,                -- UNIQUE なし
    reported_id bigint not null,              -- 通報された会員。外部キーもインデックスもなし
    status      varchar(255) not null,        -- 'open'・'in_progress'・'closed' を入れる約束だけ
    action      varchar(255),                 -- 'none'・'warned'・'suspended'。済みのときに入れる約束だけ
    note        text,
    handled_by  bigint,                       -- 対応した管理者（admins.id）。外部キーなし
    closed_at   timestamp(0),
    created_at  timestamp(0),
    updated_at  timestamp(0)
);

create table reports (
    id             bigserial primary key,
    report_case_id bigint not null,           -- 外部キーもインデックスもなし
    reporter_id    bigint not null,           -- 通報した会員
    reported_id    bigint not null,           -- 通報された会員（案件にもある。2か所に持つ）
    message_id     bigint,                    -- 指したメッセージ。なくてよい
    reason         varchar(255) not null,     -- 6つのうちの1つを入れる約束だけ
    detail         text,                      -- 自由な文。長さを見ない
    created_at     timestamp(0),
    updated_at     timestamp(0)
);
```

### 改善版の DDL（案）

```sql
create table report_cases (
    id               bigint generated always as identity primary key,
    public_id        uuid not null unique,
    reported_id      bigint not null references users (id) on delete restrict,
    status           text not null default 'open'
                     check (status in ('open', 'in_progress', 'closed')),
    action           text check (action in ('none', 'warned', 'suspended')),
    note             text check (char_length(note) <= 2000),
    handled_by       bigint references admins (id) on delete restrict,
    last_reported_at timestamptz not null,
    closed_at        timestamptz,
    created_at       timestamptz not null,
    updated_at       timestamptz not null,
    check (status <> 'closed' or (action is not null and closed_at is not null))
);
-- まだ済みでない案件は、会員に1つ（NFR-REPORT-001）。会員で案件を探すのにも使う
create unique index report_cases_open_unique on report_cases (reported_id) where status <> 'closed';
create index report_cases_status_last on report_cases (status, last_reported_at desc);

create table reports (
    id             bigint generated always as identity primary key,
    public_id      uuid not null unique,
    report_case_id bigint not null references report_cases (id) on delete restrict,
    reporter_id    bigint not null references users (id) on delete restrict,
    message_id     bigint references messages (id) on delete restrict,
    reason         text not null check (reason in
                   ('harassment', 'solicitation', 'money', 'inappropriate', 'impersonation', 'other')),
    detail         text check (char_length(detail) <= 1000),
    created_at     timestamptz not null,
    check (reason <> 'other' or char_length(coalesce(detail, '')) > 0)
);
create index reports_case_created on reports (report_case_id, created_at);
create index reports_reporter on reports (reporter_id, created_at);   -- 続けて送る回数を数える（NFR-REPORT-005）
```

改善版では、通報された会員を `reports` に持たない（案件にあるので、2か所に持つと食い違う）。「通報した会員と違うこと」は、表をまたぐので CHECK では書けず、アプリの側で確かめる。

## 会員の側：`POST /api/me/reports`（通報する）

入力：

```json
{ "user_id": "<相手の public_id>", "message_id": 123, "reason": "solicitation", "detail": "…", "block": true }
```

`message_id`・`detail`・`block` は、なくてよい。理由は次の6つ：

- `harassment`（しつこい連絡・迷惑な行い）
- `solicitation`（勧誘・営業）
- `money`（お金の要求・詐欺の疑い）
- `inappropriate`（不適切な写真・プロフィール）
- `impersonation`（なりすまし・年齢や独身でない疑い）
- `other`（その他）

### 応答

- レガシー版：`201` `{"message": "通報しました"}`
- 改善版：`201` `{"id": "<通報の public_id>"}`
  - 案件の ID や状態は返さない（FR-REPORT-008）

### 相手を確かめる

- レガシー版：`public_id` で探し、いなければ `404`。**自分でも通る**
- 改善版：いない `404`・自分 `422`
  - 退会・停止中の相手も通報できる（証拠を残すため）

### メッセージを確かめる

- レガシー版：**確かめない**
  - どの `message_id` でも入る（自分のいないルームのメッセージも、ない番号も）
- 改善版：自分のいるルームで、相手（`user_id` の会員）が送ったものだけ
  - いないルーム `404`・自分のメッセージ `422`（FR-REPORT-003）

### 理由・文を確かめる

- レガシー版：**確かめない**（理由なしは NOT NULL の違反で `500`）
- 改善版：`422`（FR-REPORT-004）

### 案件

- レガシー版：`status <> 'closed'` の案件を探し、なければ作る
  - **ロックなし**（同時に来ると2つできる）
- 改善版：トランザクションの中で、部分 UNIQUE に任せて insert し、失敗したら読み直す

### ブロック

- レガシー版：通報を入れたあとに、`blocks` に入れる
  - **トランザクションなし**
  - もうブロックしていると UNIQUE の違反で `500`（通報は入ったまま）
- 改善版：同じトランザクション。もうブロックしていれば、何もしない

### 回数

- レガシー版：何回でも
- 改善版：同じ相手へは、10分に3回まで（`429`。数は仮）

### 流れる SQL の目安

- レガシー版：4〜6本（自分・相手・案件を探す・案件を作る・通報を入れる・ブロック）
- 改善版：5〜7本＋begin・commit

### レガシー版で起きること（2026-11-17 に curl で測った。測ったあと、入れた行は消した）

- 会員を通報する
  - 結果：`201`。案件 1・通報 1
  - 要件 ID：FR-REPORT-001
- 同じ相手を、もう一度通報する
  - 結果：`201`。案件 1 のまま・通報 2
  - 要件 ID：FR-REPORT-007
- トークンなし・いない会員
  - 結果：`401`・`404`
  - 要件 ID：FR-REPORT-009・005
- **自分を通報する**
  - 結果：**`201`**（自分への案件ができる）
  - 要件 ID：FR-REPORT-005
- **自分のいないルームのメッセージを指す**
  - 結果：**`201`**（管理画面で、関係ない人のやり取りが読める）
  - 要件 ID：FR-REPORT-003
- **ないメッセージ（999999999）を指す**
  - 結果：**`201`**（ないものを指す行が入る）
  - 要件 ID：FR-REPORT-003
- 理由なし
  - 結果：`500`（NOT NULL の違反）
  - 要件 ID：FR-REPORT-004
- **選択肢にない理由と、5000文字の文**
  - 結果：**`201`**（そのまま入る）
  - 要件 ID：FR-REPORT-004
- **「その他」で、文なし**
  - 結果：**`201`**
  - 要件 ID：FR-REPORT-004
- 「ブロックもする」を付けて通報する
  - 結果：`201`。通報 1・ブロック 1
  - 要件 ID：FR-REPORT-006
- **もうブロックしている相手を、「ブロックもする」で通報する**
  - 結果：**`500`。通報は入ったまま**
  - 会員には「通報できませんでした」と出るのに、通報は2件になる
  - 要件 ID：FR-REPORT-006・NFR-REPORT-002
- **続けて 20回、同じ相手を通報する**
  - 結果：**20回とも `201`**
  - 要件 ID：NFR-REPORT-005
- **同時に 10件、まだ案件のない会員を通報する**
  - 結果：**10件とも `201`。案件が 9つできた**
  - 通報 10件が、9つの案件にばらばらに入る
  - 要件 ID：NFR-REPORT-001
- 流れる SQL（案件がある・ブロックなし）
  - 結果：3本（相手を探す・案件を探す・通報を入れる）
  - 案件を探す SQL は、`report_cases` を全部読む（Seq Scan。今は 300行なので 2ページ）
  - 要件 ID：―
- 利用を止められた会員が通報する
  - 結果：確かめていない
  - 会員の側の API は、どれもトークンを読むだけで、止められたかを見ない（前からある問題）
  - 要件 ID：FR-REPORT-009

画面（`ReportDialog`）は、理由を選んだか・「その他」の文・1000文字を確かめる。API は確かめないので、API を直接呼べば通る。

## 管理画面の側

どれも、管理者のトークンが要る（`401`）。`viewer` は読むだけ。

### `GET /api/report-cases`（案件の一覧）

クエリ：`status`（`open`・`in_progress`・`closed`。なければ全部）・`page`。

```json
{ "data": [ { "id": "<案件の public_id>", "status": "open",
              "member": { "id": "<public_id>", "nickname": "…", "state": "active" },
              "report_count": 5, "reporter_count": 3, "last_reported_at": "2026-11-17T10:00:00Z" } ],
  "total": 12 }
```

#### 並び

- レガシー版：案件を作った新しい順（新しい通報が来ても、上に来ない）
- 改善版：新しい通報のある順（`last_reported_at`。FR-REPORT-010）

#### 件数・人数

- レガシー版：案件ごとに数える。**`reporter_count` に、件数と同じ数を入れる**
- 改善版：1本の SQL で集める。人数は `count(distinct reporter_id)`

#### 会員の名前

- レガシー版：案件ごとに、会員とプロフィールを読む
- 改善版：まとめて読む

#### 流れる SQL の目安

- レガシー版：2＋4N 本（20件で 82本）
  - 全部の件数・案件と、案件ごとに 件数・新しい通報の日時・会員・プロフィール
- 改善版：3本（案件と集計・会員・全部の件数）

### `GET /api/report-cases/{publicId}`（案件の中身）

応答：

- 案件（状態・何をしたか・メモ・対応した管理者・済みにした日時）
- 通報された会員（今の状態・これまでの案件の数）
- 通報の一覧（通報した会員の `public_id` とニックネーム・理由・自由な文・日時・指したメッセージの中身と送った日時）

#### 通報の一覧

- レガシー版：全部を一度に返す（1000件でも）
  - 通報ごとに、通報した会員・プロフィール・メッセージを読む（5＋2N〜3N 本）
- 改善版：新しい順に 50件ずつ。まとめて読む（5本ほど）

#### 指したメッセージ

- レガシー版：**通報された会員が送ったものかを見ずに、中身を出す**（関係ない人のやり取りが読める）
- 改善版：入れるときに確かめてあるので、そのまま出す

#### 読んだ記録

- レガシー版：残さない
- 改善版：メッセージの中身を読んだことを、監査ログに残す

### `PUT /api/report-cases/{publicId}`（状態を変える）

入力：`{"status": "in_progress"}`、済みにするときは `{"status": "closed", "action": "warned", "note": "…"}`。

#### 役割

- レガシー版：`owner` だけ（`viewer` は `403`）
  - ここは、今ある止める操作（`SuspensionController`）からコピーする
- 改善版：同じ（middleware で）

#### 値を確かめる

- レガシー版：**確かめない**（`status` に何でも入る。済みで `action` なしも通る）
- 改善版：`422`（FR-REPORT-013）。DB の CHECK でも止まる

#### 状態の進み方

- レガシー版：どこからどこへでも変えられる（済みを「まだ」に戻せる）
- 改善版：まだ → 対応中 → 済み、まだ → 済み、だけ
  - 済みは変えられない（`409`。新しい通報は新しい案件になるため）

#### 同時に2人が変える

- レガシー版：あとの人が上書きする
- 改善版：`updated_at` を条件に入れて update し、0行なら `409`

#### 監査ログ

- レガシー版：入れる（今ある書き方をコピー）
- 改善版：同じトランザクションで入れる（FR-REPORT-012）

### レガシー版で起きること（管理画面の側。2026-11-17 に curl で測った。変えた案件は、元に戻した）

- トークンなしで一覧
  - 結果：`401`
  - 要件 ID：―
- 一覧を「まだ」で絞る（`owner`）・全部（`viewer`）
  - 結果：`200`。200件のうち 20件・全部で 300件
  - 要件 ID：FR-REPORT-010
- 一覧で流れる SQL
  - 結果：**82本**（2＋4×20）。0.05秒（案件 300・通報 3080件）
  - 件数が増えると、通報を数える SQL が毎回 `reports` を全部読むので、遅くなる
  - 要件 ID：NFR-REPORT-003
- 通報を数える SQL の実行計画
  - 結果：`Seq Scan on reports`
  - 50件を数えるのに 3080行を読み、3030行を捨てる（101ページ）
  - 要件 ID：NFR-REPORT-003
- **同じ1人が 10回通報した案件の「通報した人数」**
  - 結果：**一覧では 10**（件数と同じ数を入れている。DB で数えると 1人）
  - 案件の画面は、届いた通報から画面で数えるので 1人と出る（一覧と食い違う）
  - 要件 ID：FR-REPORT-007・010
- 一覧の並び
  - 結果：案件を作った新しい順。古い案件に新しい通報が来ても、上に来ない
  - 要件 ID：FR-REPORT-010
- 案件の中身（通報 50件）
  - 結果：`200`。**105本**（5＋2×50）
  - メッセージを指す通報があると、1件につきもう1本
  - 要件 ID：FR-REPORT-011
- ない案件
  - 結果：`404`
  - 要件 ID：―
- `viewer` が状態を変える
  - 結果：`403`
  - 要件 ID：FR-REPORT-014
- `owner` が「対応中」にする
  - 結果：`200`。対応した管理者が入り、監査ログに1行
  - 要件 ID：FR-REPORT-012
- **何をしたかを付けずに、済みにする**
  - 結果：**`200`**（`action` が空のまま、済みになる）
  - 要件 ID：FR-REPORT-013
- **済みの案件を、「まだ」に戻す**
  - 結果：**`200`**
  - そのあいだに来た通報が作った新しい案件と、あわせて「まだ済みでない案件」が2つになる
  - 要件 ID：FR-REPORT-017・NFR-REPORT-001
- **決まっていない状態（`whatever`）と、何をしたか（`xyz`）**
  - 結果：**`200`**（そのまま入る。どの状態で絞っても、一覧に出なくなる）
  - 要件 ID：FR-REPORT-012
- 指されたメッセージの中身を読んだ記録
  - 結果：残らない（監査ログに入るのは、状態を変えたときだけ）
  - 要件 ID：NFR-REPORT-004

画面（`ReportCaseDetailPage`）は、「何をしたか」を選んだかを確かめ、済みの案件にはボタンを出さない。API は確かめないので、API を直接呼べば通る。

- 会員の側
  - 相手のプロフィールのメニュー（今「ブロックする」がある所）に「通報する」
  - トークでは、相手のメッセージのメニューから「このメッセージを通報する」
  - 通報の画面（モーダル）に、理由の選択肢・自由な文・「この相手をブロックする」のチェック・「結果はお知らせしません」
- 管理画面
  - サイドバーに「通報」
  - 案件の一覧（状態のタブ・件数と人数・新しい通報の日時）→ 案件の中身（通報の一覧・指されたメッセージ・会員の詳細へのリンク・`owner` には「対応中にする」「済みにする」）

## 試しのデータ（シーダー）

`ReportsSeeder`：案件 300（まだ 200・対応中 40・済み 60）・通報 約3000件。1人の会員に 50件重なる案件・同じ人が10回送った案件・メッセージを指す通報（3割）を混ぜる。`search00001` には入れない。

## #213 で足すこと（運営からのお知らせと、強制退会。状態：**実装済み（レガシー版）**）

要件は FR-REPORT-018〜023。表 `notices`（お知らせ）を足し、`users` に `banned_at`・`banned_reason` を足す。

| API | 側 | 何をするか |
| --- | --- | --- |
| `POST /api/members/{publicId}/notices` | 管理画面（`owner`） | 会員にお知らせを送る。`201` |
| `POST /api/members/{publicId}/ban` | 管理画面（`owner`） | 会員を強制退会にする。`200` |
| `GET /api/members/{publicId}`（変更） | 管理画面 | 応答に、お知らせと強制退会の列が増える |
| `GET /api/me/notices` | 会員 | 自分に届いたお知らせ（新しい順）。`200` |
| `POST /api/me/notices/{publicId}/read` | 会員 | 読んだことにする。`200` |
| `POST /api/auth/login`（変更） | 会員 | 強制退会の会員は `403` |

入力と、増える応答：

- `POST /api/members/{publicId}/notices` の入力：`{"kind": "warning", "title": "…", "body": "…", "report_case_id": "<案件の public_id>"}`
  - `report_case_id` はなくてよい
- `POST /api/members/{publicId}/ban` の入力：`{"reason": "…"}`
- `GET /api/members/{publicId}` の応答に、`notices`（送ったお知らせと、読んだ日時）・`banned_at`・`banned_reason` が増える

### レガシー版｜改善版

#### `notices` の外部キー・CHECK

- レガシー版（legacy-repo）：なし。種類（`kind`）に何でも入る
- 改善版（refactored-repo）
  - `user_id`・`sent_by`・`report_case_id` に外部キー（`restrict`）
  - `kind in ('warning', 'info')`・題と本文の長さの CHECK

#### インデックス

- レガシー版：主キーだけ
  - 「私のお知らせ」「私の未読の数」は、表を全部読む
- 改善版：`(user_id, created_at desc)`
  - 未読の数のために、部分インデックス `(user_id) where read_at is null`

#### 読んだ日時

- レガシー版：お知らせの行に `read_at`
  - **持ち主を確かめずに書く**（ID を知っていれば、他人のお知らせを読んだことにできる）
  - もう読んでいても、日時を書き換える
- 改善版：`where user_id = 自分 and read_at is null` を条件に update
  - 他人のものは 0行で `404`。2回目は変えない
  - 全員へのお知らせを作るなら、「読んだ」を別の表（お知らせ × 会員）に分ける

#### 未読の数

- レガシー版：数だけを返す API がない
  - 画面が、画面を移るたびに一覧を全部読んで数える
- 改善版：`GET /api/me/notices/unread-count`（部分インデックスだけで答える）
  - タブのバッジの数と、1本にまとめる

#### 送る内容

- レガシー版：確かめない（題・本文なしは NOT NULL の違反で `500`）
- 改善版：`422`（FR-REPORT-018）

#### 案件から送る

- レガシー版：画面が、お知らせを送る API と、案件を済みにする API を、別々に呼ぶ（片方だけ成功することがある）
- 改善版：案件を済みにする API が、同じトランザクションでお知らせも入れる

#### 強制退会の持ち方

- レガシー版：`users` に `banned_at`・`banned_reason` を足し、`deleted_at` も書く
  - **退会・停止・強制退会を、3つの日時の列で表す**（組み合わせが 8通りでき、どれが正しい状態かを、コードごとに決めている）
  - だれが強制退会にしたかは、監査ログだけ
- 改善版：会員の状態を1つの列（`status`：利用中・停止中・退会・強制退会）と CHECK にする
  - いつ・だれが・なぜ変えたかは、状態の履歴の表（`suspensions` を広げる）に持つ

#### 前に配ったトークン

- レガシー版：**止めない**（強制退会のあとも、30日使える）
- 改善版：会員を読む入口（ミドルウェア）で、状態を見て `403`

#### 同じメールアドレスでの登録

- レガシー版：UNIQUE の違反で `500`
- 改善版：`422`（「このメールアドレスは使えません」）

### レガシー版で起きること（2026-11-18 に curl で測った。変えた会員は戻し、入れた行は消した）

- `owner` が注意を送る → 会員の一覧
  - 結果：`201`。1件・未読 1
  - 要件 ID：FR-REPORT-018・019
- `viewer` が送る・強制退会にする
  - 結果：`403`・`403`
  - 要件 ID：FR-REPORT-018・022
- 題なしで送る
  - 結果：`500`
  - 要件 ID：FR-REPORT-018
- **決まっていない種類（`whatever`）で送る**
  - 結果：**`201`**（会員の画面には「お知らせ」として出る）
  - 要件 ID：FR-REPORT-018
- ほかの会員の一覧
  - 結果：0件（自分のものだけ）
  - 要件 ID：FR-REPORT-019
- **ほかの会員が、そのお知らせを「読んだ」と送る**
  - 結果：**`200`。本人は読んでいないのに、読んだことになる**
  - 帯が消え、運営には読んだ日時が出る
  - 要件 ID：FR-REPORT-020
- ないお知らせ・トークンなし
  - 結果：`404`・`401`
  - 要件 ID：―
- `owner` が強制退会にする
  - 結果：`200`。`banned_at`・`deleted_at` が入り、メールアドレスはそのまま
  - 要件 ID：FR-REPORT-022
- 強制退会の会員がログインする
  - 結果：`403`
  - 要件 ID：FR-REPORT-022
- **強制退会の前のトークンで `GET /api/me`・いいねを送る**
  - 結果：**`200`・`201`**（そのまま使える。いいねが相手に届く）
  - 要件 ID：FR-REPORT-022
- 同じメールアドレスで登録し直す
  - 結果：`500`（登録はできない）
  - 要件 ID：FR-REPORT-022
- **もう強制退会の会員を、もう一度強制退会にする**
  - 結果：**`200`**
  - 日時と理由を上書きする。前の理由は、監査ログにしか残らない
  - 要件 ID：FR-REPORT-022
- 強制退会の会員に、お知らせを送る
  - 結果：`201`（届いても、ログインできないので読めない）
  - 要件 ID：FR-REPORT-018

