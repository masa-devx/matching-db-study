# 04 検索と一覧

状態：**案**

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
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。`500`：JWT が壊れている。**おかしな条件（年齢 17・身長 300・下が上より大きい）は、そのまま絞って `200`**。`prefecture` を配列でなく文字で送ると `500` の見込み | `401`：ログインしていない。`403`：確認していない。`422`：条件の誤り（どの条件かを `errors` で返す） |
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

## レガシー版で起きる見込み（#44 で測り、ここに書き直す）

| すること | 見込み | 要件 |
| --- | --- | --- |
| 自分と違う性別・25〜35歳・東京都と神奈川県・170cm 以上で探す | 合う会員だけが返る（ただし身長が2桁の会員も出る） | FR-SEARCH-001 |
| 一度もログインしていない会員がいる | 1ページ目の先頭に出る（`desc` で NULL が先） | FR-SEARCH-006 |
| 同じ時刻にログインした会員がいる | 呼ぶたびに並びが変わることがある | FR-SEARCH-006 |
| 1ページ目を読んだあと、まだ見ていない会員がログインしてから2ページ目 | 1ページ目の最後の人が2ページ目にも出る（重なる） | FR-SEARCH-008 |
| 年齢 17・身長 300・下が上より大きい | `200`（0人か、そのまま絞った結果） | FR-SEARCH-009 |
| 1ページ目と 250ページ目（5,000件目のあたり） | SQL は 23本のまま。本体の SQL は、深いほど読んで捨てる行が増える（`EXPLAIN (ANALYZE, BUFFERS)` で測る） | NFR-SEARCH-001 |
| 応答の中身 | メールアドレス・確認用の文字・生年月日が出る | FR-SEARCH-001 |
