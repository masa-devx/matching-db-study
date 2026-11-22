# 04 検索と一覧

状態：**実装済み（レガシー版）**（PR #49）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/search.md](../requirements/search.md)（FR-SEARCH-001〜011・NFR-SEARCH-001）。表は `users`（`last_login_at`・`public_id`）と `profiles`（[data-model.md](../data-model.md)）。解説：`explanations/04-search.html`（`legacy-repo`）。

| メソッドとパス | 何をする |
| --- | --- |
| `GET /api/users` | 相手を探す（絞り込み・並び・続き） |
| `POST /api/auth/login`（変更） | 最終ログインを書き換える |

検索は「会員の集まりを条件で絞る」ので、一覧のパス `GET /api/users` にクエリを付ける（画面は `/search`）。1人を見る `GET /api/users/{public_id}`（01・#46）と対になる。

レガシー版は、02・03 と同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理を、もう一度コピーする。これで5か所）。入力は確かめず、エラーの扱いは考えない。コントローラは `UserController::index`（登録の `store` と同じコントローラ）。

## `GET /api/users`（相手を探す）

### だれが使えるか

- レガシー版（legacy-repo）：正しい JWT（`Authorization: Bearer`）を持つ人。確認していない会員も使える
- 改善版（refactored-repo）：正しい `access` の Cookie を持ち、メールアドレスを確認した会員

### 入力（クエリ）

- レガシー版
  - `gender`（`male`・`female`）
  - `age_min`・`age_max`
  - `prefecture[]`（都道府県の名前。1つ以上）
  - `height_min`・`height_max`
  - `page`（1から）
  - どれもなくてよく、送られたものだけで絞る。確かめない
- 改善版
  - `gender_code`
  - `age_min`・`age_max`（18〜99。下が上より大きければ誤り）
  - `prefecture_codes[]`（1〜47。1つ以上）
  - `height_min`・`height_max`（120〜220）
  - `cursor`（前の応答の `next_cursor`）
  - 誤りは `422`（FR-SEARCH-009）

### 有料の機能（#150。2026-11-17）

- レガシー版
  - `last_login`（`24h`・`3d`・`7d`）
    - ほかの値は、何も絞らずに通る
    - #162 から、一度もログインしていない会員は、登録した日時で見る：`(last_login_at >= ? or (last_login_at is null and created_at >= ?))`
    - `or` が入るので、インデックスを使いにくい
  - `new_member`（何か入っていれば、登録して7日以内）
  - `keyword`（自己紹介かニックネームに `like '%言葉%'`）
    - **`%` と `_` をそのまま渡すので、`%` だけ送ると全員に当たる。長さも確かめない**
  - `sort=new`（登録が新しい順。同じ時刻の並びが決まらない）
  - 男性で `is_paid` でなければ `403`（**期限は見ない**）
  - 身長（`height_min`・`height_max`）は無料にした
- 改善版
  - `last_login`（3つのどれか。ほかは `422`）
  - `new_member`（真偽値）
  - `keyword`（1〜50文字。`%`・`_`・`\` を打ち消してから `ilike`）
  - `sort`（`login`・`new`）
    - どちらも `public_id` を2つ目の並びにして、カーソルで続きを読む
  - 有料かどうかは、07 の1つの関数（期限を見る）で判断する（FR-SEARCH-012〜016）

### プロフィールの6項目（#153。2026-11-17。無料）

- レガシー版
  - `body_type[]`・`job[]`・`income[]`・`smoking[]`・`drinking[]`・`marital_status[]`（選択肢の名前の文字を、配列で）
  - `whereIn` で絞る
  - **選択肢にない文字でも、そのまま探す（0人で `200`）。配列でなく文字で送ると `500`**
  - 未回答（NULL）の会員は出ない
  - 年収は文字なので大小を比べられない
    - 画面が、選んだ幅（◯◯万円 〜 ◯◯万円。#162）を、当てはまる区分の名前の並びに直してから `income[]` で送る（幅の決まりが画面にある）
- 改善版
  - `body_type_codes[]`・`job_codes[]`・`smoking_codes[]`・`drinking_codes[]`・`marital_status_codes[]`（マスタにあるコード。なければ `422`）
  - `income_min`・`income_max`（万円。300・500・700・1000 のどれか。なくてよい）
    - 下が上より大きければ `422`
    - マスタの `sort_order` で幅を比べる
    - #162 で、「以上」だけの形から変えた
  - 未回答の会員は出ない（FR-SEARCH-017〜019）

### 性別を送らないとき

- レガシー版：自分のプロフィールの性別の反対（`male` なら `female`。それ以外なら `male`）
- 改善版：自分と違う性別（FR-SEARCH-002）

### 除く会員

- レガシー版：自分・もういいねした相手（`whereNotIn` に ID を並べる）・メールアドレスを確認していない会員
- 改善版：同じ（いいねは `not exists`）

### 並び

- レガシー版：`last_login_at` の新しい順だけ
  - **同じ時刻の並びが決まらない**
  - **一度もログインしていない会員（NULL）が先頭に出る**
- 改善版：`last_login_at` の新しい順、同じなら `public_id` の大きい順（FR-SEARCH-006）

### 続き

- レガシー版：`page` で `offset (page - 1) * 20`・`limit 20`
  - 「もうない」は、返った件数が20より少ないかで画面が決める
  - ちょうど20件で終わると、次の空のページを1回読む
- 改善版：21件読んで、21件目があれば `next_cursor` を返す。なければ `null`（FR-SEARCH-007・008）

### 応答（成功）

- レガシー版：`200`。`users` の行の配列（`profile` が中に入る）
  - **メールアドレス・生年月日・中の `id` も返す**
  - 確認用の文字は、legacy-repo では返していた。refactored-repo で `User` の `#[Hidden]` に足し、返さないようにした
- 改善版：`200`（メールアドレス・生年月日は返さない。FR-SEARCH-001）
  - `{"data": [{"user_id": "019a…", "nickname": "香織", "age": 28, "prefecture": {"code": 13, "name": "東京都"}, "height_cm": 160, "avatar_url": "/images/avatars/demo-3.svg"}], "next_cursor": "eyJ…"}`

### 応答（失敗）

- レガシー版
  - `401` `{"message": "ログインしてください"}`：`Authorization` がない
  - `500`：JWT が壊れている
  - **おかしな条件（年齢 17・身長 300・下が上より大きい）は、そのまま絞って `200`**
  - `prefecture` を配列でなく文字で送ると `500`（`TypeError`）
- 改善版
  - `401`：ログインしていない
  - `403`：確認していない
  - `422`：条件の誤り（どの条件かを `errors` で返す）

### 流れる SQL の目安

- レガシー版：**1ページ20人で 23本**
  - 自分のプロフィール・いいねした相手の ID・本体・1人ごとのプロフィール 20本（1＋N）
- 改善版：2本（自分のプロフィール・本体。NFR-SEARCH-001）

### curl の例

- レガシー版：`curl -G http://127.0.0.1:8000/api/users -H 'Authorization: Bearer <JWT>' --data-urlencode 'prefecture[]=東京都' -d age_min=25 -d age_max=35 -d height_min=170 -d page=2`
- 改善版：`curl -G http://127.0.0.1:8000/api/users -b cookies.txt -d 'prefecture_codes[]=13' -d age_min=25 -d cursor=<next_cursor>`

### レガシー版の書き方

解説の「5. 見本」と同じ形：

```php
$me = Profile::where('user_id', $payload->sub)->first();
$gender = $request->input('gender', $me?->gender === 'male' ? 'female' : 'male');
$likedIds = Like::where('from_user_id', $payload->sub)->pluck('to_user_id');   // いいねした相手を全部 PHP に持ってくる

$users = User::whereNotNull('email_verified_at')
    ->where('id', '!=', $payload->sub)
    ->whereNotIn('id', $likedIds)
    ->whereHas('profile', function ($q) use ($request, $gender) {
        $q->where('gender', $gender);
        if ($request->filled('age_min')) {
            $q->where('birthday', '<=', now()->subYears((int) $request->input('age_min'))->format('Y-m-d'));
        }
        // age_max・prefecture[]・height_min・height_max も同じ形（身長は文字で比べる）
    })
    ->orderBy('last_login_at', 'desc')
    ->offset(((int) $request->input('page', 1) - 1) * 20)->limit(20)
    ->get();
foreach ($users as $user) {
    $user->load('profile');   // 1人ずつ読む（N+1）
}
return $users;
```

- 年齢の幅は、生年月日の幅に直して比べる。`age_max = 35` なら「36歳の誕生日より後に生まれた」（`birthday > 今日の36年前`）
- 生年月日も身長も文字の列（01 のまま）なので、文字で比べる。生年月日は `YYYY-MM-DD` の形なら正しく比べられるが、身長は `'99' >= '170'` が真になる
- `whereHas()` は `exists (select * from profiles where users.id = profiles.user_id and …)` になる

## `POST /api/auth/login` で変えること（最終ログイン。FR-SEARCH-011）

### 書き換え

- レガシー版：パスワードが合ったら `$user->last_login_at = now(); $user->save();`
  - `updated_at` も変わる
  - 時刻はアプリのサーバーの時計
- 改善版：`update users set last_login_at = now() where id = ?`
  - `updated_at` は変えない
  - 時刻は DB の時計

### 応答

- レガシー版：変わらない
- 改善版：変わらない

### 流れる SQL の目安

- レガシー版：2本 → 3本（`update` が1本増える）
- 改善版：2本 → 3本

## レガシー版で起きること（#44 で測った。改善する段階で要件 ID のテストにする）

開発用の DB の試しの会員 2万人（`SearchMembersSeeder`）で、女性の会員 23 として探した。性別を送らないので男性を探し、確認済みの男性は 8,935人。

- 25〜35歳・東京都と神奈川県・170cm 以上で探す
  - レガシー版：`200`・20人・SQL 23本・47ms
  - 合う169人に、身長が2桁の会員が1人入る（文字で比べるため）
  - 要件：FR-SEARCH-001・NFR-SEARCH-001
- 応答の中身
  - レガシー版：`email`・`birthday`・中の `id` が出る（`verification_token` は、refactored-repo で隠した）
  - 要件：FR-SEARCH-001
- 自分・いいねした相手（5・6）・未確認の会員
  - レガシー版：どれも出ない
  - 要件：FR-SEARCH-003〜005
- 条件なしの1ページ目
  - レガシー版：**先頭の20人がすべて `last_login_at` が NULL**
  - 一度もログインしていない会員。合う中に433人いて、1〜22ページ目を埋める
  - 要件：FR-SEARCH-006
- 何も変えずに、1ページ目と2ページ目を読む
  - レガシー版：**17人が重なる**
  - NULL どうしの順が決まらず、PostgreSQL は LIMIT だけのとき（top-N heapsort）と OFFSET つきのとき（quicksort）で並べ方を変えるため、ページごとに順が変わる
  - 同じページを2回読むと同じ順
  - 要件：FR-SEARCH-006・008
- 30ページ目を読んだあと、まだ見ていない会員（32ページ目の1人目）がログインしてから31ページ目
  - レガシー版：30ページ目の会員が1人、31ページ目にもう一度出る（重なる）
  - ログインした会員は、もう読んだページ（NULL のすぐ後ろ）に移るので、続きでは見えない
  - 要件：FR-SEARCH-008
- 1ページ目の実行計画（条件なし）
  - レガシー版：`users` と `profiles` を両方 `Seq Scan`（17,950行・9,949行）→ `Hash Semi Join` → 上位20件だけを並べる（top-N heapsort・33kB）
  - 5.7ms
  - 要件：NFR-SEARCH-001
- 250ページ目（4,981〜5,000人目）の実行計画
  - レガシー版：同じく両方を `Seq Scan` → 5,000件を並べて（quicksort・2.6MB）4,980件を捨てる
  - 7.8ms。SQL は 23本のまま
  - 要件：NFR-SEARCH-001
- 条件ありの実行計画
  - レガシー版：`profiles` を `Seq Scan`（19,845行を捨てる）→ `users` を主キーで184回 → 並べる
  - 2.2ms
  - 要件：NFR-SEARCH-001
- 身長 300 以上・年齢 17
  - レガシー版：`200`・20人
  - 出たのは身長 `38`・`82`・`96` などの2桁だけ（`'38' >= '300'` が真）
  - 要件：FR-SEARCH-009
- 年齢 40〜30（下が上より大きい）・都道府県 `48`
  - レガシー版：`200`・0人（誤りと分からない）
  - 要件：FR-SEARCH-009
- `prefecture` を配列でなく文字で送る
  - レガシー版：`500`（`TypeError`。SQL は2本流れたあと）
  - 要件：FR-SEARCH-009
- トークンなし
  - レガシー版：`401`
  - 要件：FR-SEARCH-010
- ログイン（`search00001`）
  - レガシー版：`200`。SQL が 2本 → 3本（`update users set last_login_at = ?, updated_at = ?`）
  - `last_login_at` と一緒に `updated_at` も変わる
  - 要件：FR-SEARCH-011

### 測りかた

- コンテナの中でコントローラを直接呼び、`DB::listen` で SQL と値を拾って `EXPLAIN (ANALYZE, BUFFERS)` を流した（SQL のログには値を書かないため）
- 時間は手元の Docker で1回ずつ測ったもので、キャッシュに載った状態（`shared hit` だけ）
- 重なりを試すために変えた `last_login_at` は元に戻した

## #150 で足した有料の機能を測った結果（レガシー版。2026-11-17）

開発用の DB（会員 2万人）で、curl と `EXPLAIN (ANALYZE, BUFFERS)` で測った。

- 男性の無料の会員が、身長 160〜 で探す
  - 結果：`200`（無料になった）
  - 要件 ID：FR-PAID-009
- 男性の無料の会員が、`last_login=24h`・`new_member=1`・`keyword=カフェ`・`sort=new` のどれかを付ける
  - 結果：どれも `403`
  - 要件 ID：FR-SEARCH-016
- 男性の無料の会員が、`sort=login`（無料の並び）を付ける
  - 結果：`200`
  - 要件 ID：FR-SEARCH-016
- 男性の有料会員・女性が、4つを付ける
  - 結果：`200`。`sort=new` は登録が新しい順に並ぶ
  - 要件 ID：FR-SEARCH-012〜015
- **期限が過ぎた男性**（`is_paid` は true のまま）が、`keyword` を付ける
  - 結果：**`200`**（有料の機能を使える）
  - 要件 ID：FR-PAID-005・FR-SEARCH-016
- **`keyword=%`**
  - 結果：**`200`。全員に当たる**（`%` が、どんな文字にも合う印として働く）
  - 要件 ID：FR-SEARCH-014
- `last_login=abc`（知らない値）
  - 結果：`200`。何も絞らずに通る（誤りにならない）
  - 要件 ID：FR-SEARCH-012
- フリーワードの実行計画
  - 結果：`profiles` を全部読む（Seq Scan。18,360行を捨てる）。`users` も全部読んでから並べる
  - 合わせて 2,751 ページ・6.7 ms（表を詰めたあとに測り直すと 2,467 ページ・6.6 ms）
  - 前後に `%` が付くので、ふつうのインデックスは使えない
  - 要件 ID：NFR-SEARCH-001
- 「登録して間もない会員」の実行計画
  - 結果：`users` を全部読む（Seq Scan。64人を返すのに 19,966行を捨てる。1,865 ページ）
  - `created_at` にインデックスがない
  - 要件 ID：NFR-SEARCH-001
- 流れる SQL の本数
  - 結果：条件を足しても、本数は変わらない
  - 1ページ20人で 25本のまま。有料の確かめの2本は、身長のときと同じ
  - 要件 ID：NFR-SEARCH-001

### フリーワードを速くする案

改善版でフリーワードを速くするには、`pg_trgm`（文字を3つずつに切って探す仕組み）の GIN インデックスを使う案がある。効く場面と効かない場面（日本語の2文字以下の言葉）は、`explanations/04b-saved-searches.html` の4章の「フリーワードを速くする案」に書いた。入れるかは、直す段階で、測ってから決める。

### 測るときの注意

- 前と後を比べるときは、測る前に `VACUUM FULL <表>` と `ANALYZE <表>` を流して、表を詰める
- シーダーを流し直したあとは、消えた行の跡で表が膨らみ、読むページの数が何倍にもなる（同じ SQL でも、数字を比べられなくなる）

### 分かっている不具合

2026-11-17 のレビューで見つけた。今日の差分より前からある。

- アカウント停止された会員が検索に出る（除いているのは退会した会員だけ。FR-ADMIN-006 と違う）。不具合のチケット #158
  - 強制退会された会員は出ない。管理画面の強制退会は、`banned_at` と一緒に退会した日時（`deleted_at`）も入れるため
  - refactored-repo では #269 で直した。`User::accountUsable()` で、退会・アカウント停止・強制退会の会員を除く（FR-WD-013。[06-blocks-withdrawal.md](06-blocks-withdrawal.md) の「#269 で変えたこと」）
- 応答に `users` の行がそのまま入るので、上に書いた項目のほかに、次のものも、ログインした会員なら、だれにでも見える
  - 運営が書いた停止の理由（`suspended_reason`）・止めた日時
  - ほかの会員が有料かどうかと期限（`is_paid`・`paid_until`）
  - 最終ログインと登録の日時（秒まで）
  - 有料の機能にした「最終ログイン」「登録して間もない会員」と同じことを、無料の会員も応答から読み取れる
  - 直すのは、検索を新しい URL に移して、返す項目を決めた形にするとき
- PHP の組み込みのサーバーは、受けた URL をクエリまで含めてログ（`docker compose logs app`）に書くので、フリーワードなどの条件がログに残る（だれの検索かは分からない）

## #153 で足したプロフィールの6項目を測った結果（レガシー版。2026-11-17）

| 入力・場面 | 結果 | 要件 ID |
| --- | --- | --- |
| 年収を2区分で探す | `200`。どちらかの区分の会員だけ。未回答の会員は出ない | FR-SEARCH-017・018 |
| 6項目を全部付けて探す | `200`（1人） | FR-SEARCH-017 |
| 選択肢にない文字（年収＝「1億円」） | **`200`・0人**（誤りにならない） | FR-SEARCH-019 |
| 配列でなく文字で送る（`income=500〜700万円`） | **`500`**（応答に PHP のエラーの文が出る） | FR-SEARCH-019 |
| 実行計画（年収2区分・タバコ・体型） | 下の「実行計画を測り直したこと」 | NFR-SEARCH-001 |
| 流れる SQL の本数 | 条件を足しても変わらない（同じ `exists` の中の `in` が増えるだけ） | NFR-SEARCH-001 |

### 実行計画を測り直したこと（年収2区分・タバコ・体型）

- `profiles` を全部読む（Seq Scan。53人を見つけるのに 19,976行を捨て、**602 ページ**。`profiles` は 5.3 MB）
- **測り直した数字**（#159）
- はじめは 3,986 ページ・33 MB と書いたが、列を足したせいではなかった
- 試しのデータを1列ずつ6本の `update` で入れたので、行が6回書き直され、消えた行の跡が空きとして残って、表が7倍ほどに膨らんでいた
  - PostgreSQL の `update` は、行を上書きせず、新しい行を足して古い行を捨てる
- シーダーを1本の `update` に直し、`VACUUM FULL profiles` で詰めてから測った

### #162（2026-11-17）で確かめたこと

`last_login=7d` と `new_member=1` を付けると 12人が返り、そのうち 10人は、一度もログインしていない会員（登録して7日以内）だった。
