# 04 検索と一覧

状態：**実装済み（レガシー版）**（PR #49）

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/search.md](../requirements/search.md)（FR-SEARCH-001〜011・NFR-SEARCH-001）。表は `users`（`last_login_at`・`public_id`）と `profiles`（[data-model.md](../data-model.md)）。解説：`explanations/04-search.html`（`legacy-repo`）。

検索は「会員の集まりを条件で絞る」ので、一覧のパス `GET /api/users` にクエリを付ける（画面は `/search`）。1人を見る `GET /api/users/{public_id}`（01・#46）と対になる。

レガシー版は、02・03 と同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理を、もう一度写す。これで5か所）。入力は確かめず、エラーの扱いは考えない。コントローラは `UserController::index`（登録の `store` と同じコントローラ）。

## `GET /api/users`（相手を探す）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT（`Authorization: Bearer`）を持つ人。確認していない会員も使える | 正しい `access` の Cookie を持ち、メールアドレスを確認した会員 |
| 入力（クエリ） | `gender`（`male`・`female`）・`age_min`・`age_max`・`prefecture[]`（都道府県の名前。1つ以上）・`height_min`・`height_max`・`page`（1から）。どれもなくてよく、送られたものだけで絞る。確かめない | `gender_code`・`age_min`・`age_max`（18〜99。下が上より大きければ誤り）・`prefecture_codes[]`（1〜47。1つ以上）・`height_min`・`height_max`（120〜220）・`cursor`（前の応答の `next_cursor`）。誤りは `422`（FR-SEARCH-009） |
| 性別を送らないとき | 自分のプロフィールの性別の反対（`male` なら `female`。それ以外なら `male`） | 自分と違う性別（FR-SEARCH-002） |
| 除く会員 | 自分・もういいねした相手（`whereNotIn` に ID を並べる）・メールアドレスを確認していない会員 | 同じ（いいねは `not exists`） |
| 並び | `last_login_at` の新しい順だけ（**同じ時刻の並びが決まらない。一度もログインしていない会員（NULL）が先頭に出る**） | `last_login_at` の新しい順、同じなら `public_id` の大きい順（FR-SEARCH-006） |
| 続き | `page` で `offset (page - 1) * 20`・`limit 20`。「もうない」は、返った件数が20より少ないかで画面が決める（ちょうど20件で終わると、次の空のページを1回読む） | 21件読んで、21件目があれば `next_cursor` を返す。なければ `null`（FR-SEARCH-007・008） |
| 応答（成功） | `200`。`users` の行の配列（`profile` が中に入る）。**メールアドレス・確認用の文字・生年月日・中の `id` も返す** | `200` `{"data": [{"user_id": "019a…", "nickname": "香織", "age": 28, "prefecture": {"code": 13, "name": "東京都"}, "height_cm": 160, "avatar_url": "/images/avatars/demo-3.svg"}], "next_cursor": "eyJ…"}`（メールアドレス・生年月日は返さない。FR-SEARCH-001） |
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。`500`：JWT が壊れている。**おかしな条件（年齢 17・身長 300・下が上より大きい）は、そのまま絞って `200`**。`prefecture` を配列でなく文字で送ると `500`（`TypeError`） | `401`：ログインしていない。`403`：確認していない。`422`：条件の誤り（どの条件かを `errors` で返す） |
| 流れる SQL の目安 | **1ページ20人で 23本**（自分のプロフィール・いいねした相手の ID・本体・1人ごとのプロフィール 20本。1＋N） | 2本（自分のプロフィール・本体。NFR-SEARCH-001） |
| curl の例 | `curl -G http://127.0.0.1:8000/api/users -H 'Authorization: Bearer <JWT>' --data-urlencode 'prefecture[]=東京都' -d age_min=25 -d age_max=35 -d height_min=170 -d page=2` | `curl -G http://127.0.0.1:8000/api/users -b cookies.txt -d 'prefecture_codes[]=13' -d age_min=25 -d cursor=<next_cursor>` |

レガシー版の書き方（解説の「5. 見本」と同じ形）：

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

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 書き換え | パスワードが合ったら `$user->last_login_at = now(); $user->save();`（`updated_at` も変わる。時刻はアプリのサーバーの時計） | `update users set last_login_at = now() where id = ?`（`updated_at` は変えない。時刻は DB の時計） |
| 応答 | 変わらない | 変わらない |
| 流れる SQL の目安 | 2本 → 3本（`update` が1本増える） | 2本 → 3本 |

## レガシー版で起きること（#44 で測った。改善する段階で要件 ID のテストにする）

開発用の DB の試しの会員 2万人（`SearchMembersSeeder`）で、女性の会員 23 として探した。性別を送らないので男性を探し、確認済みの男性は 8,935人。

| すること | レガシー版 | 要件 |
| --- | --- | --- |
| 25〜35歳・東京都と神奈川県・170cm 以上で探す | `200`・20人・SQL 23本・47ms。合う169人に、身長が2桁の会員が1人入る（文字で比べるため） | FR-SEARCH-001・NFR-SEARCH-001 |
| 応答の中身 | `email`・`verification_token`・`birthday`・中の `id` が出る | FR-SEARCH-001 |
| 自分・いいねした相手（5・6）・未確認の会員 | どれも出ない | FR-SEARCH-003〜005 |
| 条件なしの1ページ目 | **先頭の20人がすべて `last_login_at` が NULL**（一度もログインしていない会員。合う中に433人いて、1〜22ページ目を埋める） | FR-SEARCH-006 |
| 何も変えずに、1ページ目と2ページ目を読む | **17人が重なる**。NULL どうしの順が決まらず、PostgreSQL は LIMIT だけのとき（top-N heapsort）と OFFSET つきのとき（quicksort）で並べ方を変えるため、ページごとに順が変わる。同じページを2回読むと同じ順 | FR-SEARCH-006・008 |
| 30ページ目を読んだあと、まだ見ていない会員（32ページ目の1人目）がログインしてから31ページ目 | 30ページ目の会員が1人、31ページ目にもう一度出る（重なる）。ログインした会員は、もう読んだページ（NULL のすぐ後ろ）に移るので、続きでは見えない | FR-SEARCH-008 |
| 1ページ目の実行計画（条件なし） | `users` と `profiles` を両方 `Seq Scan`（17,950行・9,949行）→ `Hash Semi Join` → 上位20件だけを並べる（top-N heapsort・33kB）。5.7ms | NFR-SEARCH-001 |
| 250ページ目（4,981〜5,000人目）の実行計画 | 同じく両方を `Seq Scan` → 5,000件を並べて（quicksort・2.6MB）4,980件を捨てる。7.8ms。SQL は 23本のまま | NFR-SEARCH-001 |
| 条件ありの実行計画 | `profiles` を `Seq Scan`（19,845行を捨てる）→ `users` を主キーで184回 → 並べる。2.2ms | NFR-SEARCH-001 |
| 身長 300 以上・年齢 17 | `200`・20人。出たのは身長 `38`・`82`・`96` などの2桁だけ（`'38' >= '300'` が真） | FR-SEARCH-009 |
| 年齢 40〜30（下が上より大きい）・都道府県 `48` | `200`・0人（誤りと分からない） | FR-SEARCH-009 |
| `prefecture` を配列でなく文字で送る | `500`（`TypeError`。SQL は2本流れたあと） | FR-SEARCH-009 |
| トークンなし | `401` | FR-SEARCH-010 |
| ログイン（`search00001`） | `200`。SQL が 2本 → 3本（`update users set last_login_at = ?, updated_at = ?`）。`last_login_at` と一緒に `updated_at` も変わる | FR-SEARCH-011 |

測りかた：コンテナの中でコントローラを直接呼び、`DB::listen` で SQL と値を拾って `EXPLAIN (ANALYZE, BUFFERS)` を流した（SQL のログには値を書かないため）。時間は手元の Docker で1回ずつ測ったもので、キャッシュに載った状態（`shared hit` だけ）。重なりを試すために変えた `last_login_at` は元に戻した。
