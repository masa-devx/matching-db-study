# M7・A7 通報

状態：**設計（確かめ待ち。実装はまだ）**
要件：[../requirements/reports.md](../requirements/reports.md)（FR-REPORT-001〜017）

会員の側（`backend/client`）に、通報する API を1本。管理画面の側（`backend/admin`）に、案件を見る・対応する API を3本。表は `reports`（通報）と `report_cases`（案件）の2つで、作り（マイグレーション）は `backend/client` に置く。

## 表の作り

通報された会員ごとに、まだ済みでない案件は1つ。通報は、その案件に入る。済みの案件しかない会員に通報が来たら、新しい案件を作る（FR-REPORT-017）。

### レガシー版｜改善版

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 会員・メッセージ・案件を指す列 | 数の列だけ（外部キーなし）。いない会員・ないメッセージを指す行が入る | 外部キー。通報した会員・通報された会員・案件は `restrict`（通報の残っている会員の行は、消せない。今の退会は行を消さないので困らない）。メッセージは `set null` にせず `restrict`（証拠が消えない） |
| まだ済みでない案件は、会員に1つ | 何もない。「あるかを見てから作る」のあいだに別の通報が入ると、2つできる | 部分 UNIQUE インデックス：`unique (reported_id) where status <> 'closed'`。2つ目の insert は失敗するので、失敗したら、ある方の案件を読み直す |
| 状態・理由・何をしたか | 文字の列に、決まった文字を入れる約束だけ（`'open'` と `'Open'` と `'未対応'` が混ざって入る） | 文字の列＋ CHECK 制約（`status in ('open','in_progress','closed')` など）。済みのときは「何をしたか」が要る、も CHECK：`status <> 'closed' or action is not null` |
| 自分を通報 | 入る | CHECK：`reporter_id <> reported_id` |
| インデックス | 主キーだけ。案件の通報を探す・状態で絞る・会員の案件を探す、のどれも表を全部読む | `reports (report_case_id, created_at)`・`report_cases (status, last_reported_at desc)`・上の部分 UNIQUE（会員で探すのにも使う） |
| 一覧に出す件数・人数・新しい通報の日時 | 案件ごとに、そのつど `reports` を数える（1＋2N 本）。人数は、件数と同じ数を出す | 一覧の SQL 1本で、`reports` を案件ごとに集める（`count(*)`・`count(distinct reporter_id)`）。新しい通報の日時は、並び替えに使うので、案件の列（`last_reported_at`）に持ち、通報のたびに書き換える |
| 外から見える ID | 案件に `public_id`（UUID）。通報は、数の `id` をそのまま返す | 案件も通報も `public_id` |

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

`message_id`・`detail`・`block` は、なくてよい。理由は `harassment`（しつこい連絡・迷惑な行い）・`solicitation`（勧誘・営業）・`money`（お金の要求・詐欺の疑い）・`inappropriate`（不適切な写真・プロフィール）・`impersonation`（なりすまし・年齢や独身でない疑い）・`other`（その他）。

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 応答 | `201` `{"message": "通報しました"}` | `201` `{"id": "<通報の public_id>"}`。案件の ID や状態は返さない（FR-REPORT-008） |
| 相手を確かめる | `public_id` で探し、いなければ `404`。**自分でも通る** | いない `404`・自分 `422`。退会・停止中の相手も通報できる（証拠を残すため） |
| メッセージを確かめる | **確かめない**。どの `message_id` でも入る（自分のいないルームのメッセージも、ない番号も） | 自分のいるルームで、相手（`user_id` の会員）が送ったものだけ。いないルーム `404`・自分のメッセージ `422`（FR-REPORT-003） |
| 理由・文を確かめる | **確かめない**（理由なしは NOT NULL の違反で `500`） | `422`（FR-REPORT-004） |
| 案件 | `status <> 'closed'` の案件を探し、なければ作る。**ロックなし**（同時に来ると2つできる） | トランザクションの中で、部分 UNIQUE に任せて insert し、失敗したら読み直す |
| ブロック | 通報を入れたあとに、`blocks` に入れる。**トランザクションなし**。もうブロックしていると UNIQUE の違反で `500`（通報は入ったまま） | 同じトランザクション。もうブロックしていれば、何もしない |
| 回数 | 何回でも | 同じ相手へは、10分に3回まで（`429`。数は仮） |
| 流れる SQL の目安 | 4〜6本（自分・相手・案件を探す・案件を作る・通報を入れる・ブロック） | 5〜7本＋begin・commit |

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

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 並び | 案件を作った新しい順（新しい通報が来ても、上に来ない） | 新しい通報のある順（`last_reported_at`。FR-REPORT-010） |
| 件数・人数 | 案件ごとに数える。**`reporter_count` に、件数と同じ数を入れる** | 1本の SQL で集める。人数は `count(distinct reporter_id)` |
| 会員の名前 | 案件ごとに、会員とプロフィールを読む | まとめて読む |
| 流れる SQL の目安 | 1＋4N 本（20件で 81本） | 3本（案件と集計・会員・全部の件数） |

### `GET /api/report-cases/{publicId}`（案件の中身）

応答：案件（状態・何をしたか・メモ・対応した管理者・済みにした日時）と、通報された会員（今の状態・これまでの案件の数）と、通報の一覧（通報した会員の `public_id` とニックネーム・理由・自由な文・日時・指したメッセージの中身と送った日時）。

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 通報の一覧 | 全部を一度に返す（1000件でも）。通報ごとに、通報した会員・プロフィール・メッセージを読む（1＋3N 本） | 新しい順に 50件ずつ。まとめて読む（5本ほど） |
| 指したメッセージ | **通報された会員が送ったものかを見ずに、中身を出す**（関係ない人のやり取りが読める） | 入れるときに確かめてあるので、そのまま出す |
| 読んだ記録 | 残さない | メッセージの中身を読んだことを、監査ログに残す |

### `PUT /api/report-cases/{publicId}`（状態を変える）

入力：`{"status": "in_progress"}`、済みにするときは `{"status": "closed", "action": "warned", "note": "…"}`。

| 項目 | レガシー版 | 改善版 |
| --- | --- | --- |
| 役割 | `owner` だけ（`viewer` は `403`）。ここは、今ある止める操作（`SuspensionController`）からコピーする | 同じ（middleware で） |
| 値を確かめる | **確かめない**（`status` に何でも入る。済みで `action` なしも通る） | `422`（FR-REPORT-013）。DB の CHECK でも止まる |
| 状態の進み方 | どこからどこへでも変えられる（済みを「まだ」に戻せる） | まだ → 対応中 → 済み、まだ → 済み、だけ。済みは変えられない（`409`。新しい通報は新しい案件になるため） |
| 同時に2人が変える | あとの人が上書きする | `updated_at` を条件に入れて update し、0行なら `409` |
| 監査ログ | 入れる（今ある書き方をコピー） | 同じトランザクションで入れる（FR-REPORT-012） |

## 画面

- 会員の側：相手のプロフィールのメニュー（今「ブロックする」がある所）に「通報する」。トークでは、相手のメッセージのメニューから「このメッセージを通報する」。通報の画面（モーダル）に、理由の選択肢・自由な文・「この相手をブロックする」のチェック・「結果はお知らせしません」
- 管理画面：サイドバーに「通報」。案件の一覧（状態のタブ・件数と人数・新しい通報の日時）→ 案件の中身（通報の一覧・指されたメッセージ・会員の詳細へのリンク・`owner` には「対応中にする」「済みにする」）

## 試しのデータ（シーダー）

`ReportsSeeder`：案件 300（まだ 200・対応中 40・済み 60）・通報 約3000件。1人の会員に 50件重なる案件・同じ人が10回送った案件・メッセージを指す通報（3割）を混ぜる。`search00001` には入れない。
