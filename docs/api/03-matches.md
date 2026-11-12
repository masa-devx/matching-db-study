# 03 マッチ

状態：**実装済み（レガシー版）**

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/matches.md](../requirements/matches.md)（FR-MATCH-001〜010・NFR-MATCH-001〜003）。表は `user_matches`（[data-model.md](../data-model.md)）。解説：[03-matches.html](../../explanations/03-matches.html)。

マッチは「ログインした本人のもの」なので、`/api/me` の下に置く（決まり「ログインした本人のものは `/me` の下」）。他人のマッチを見るパスは作らない（FR-MATCH-007）。

03 で変えるのは3つ。

| API | 変えること | 設計の置き場 |
| --- | --- | --- |
| `POST /api/me/likes`（いいねを送る） | 相手からのいいねがあればマッチを作り、応答に `matched` を足す | [02-likes.md](02-likes.md) の「03 で変えること」 |
| `GET /api/me/likes`（送った相手の一覧） | 相手ごとに `matched` を足す | [02-likes.md](02-likes.md) の「03 で変えること」 |
| `GET /api/me/matches`（マッチした相手の一覧） | 新しく作る | このファイル |

レガシー版は、02 と同じく、だれが使うかをコントローラの中で JWT を読んで決める（`AuthController::me()` の処理を、もう一度写す。これで4か所）。エラーの扱いは考えない。コントローラは `UserMatchController`（Model の `UserMatch` に名前をそろえる）。

## `GET /api/me/matches`（マッチした相手の一覧）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT（`Authorization: Bearer`）を持つ人（自分の一覧だけ）。確認していない会員も使える | 正しい `access` の Cookie を持ち、メールアドレスを確認した会員（FR-MATCH-008・009） |
| 入力 | なし（件数の上限とページ送りは 04） | 同じ |
| 応答（成功） | `200`。マッチした新しい順の配列。1件は `{"user_id": 5, "nickname": "香織", "birthday": "1998-04-01", "image": "/images/avatars/demo-3.svg", "matched_at": "…"}`（**生年月日をそのまま返す**。プロフィールがない相手は `nickname` などが `null`） | `200`。マッチした新しい順の配列。1件は `{"user_id": 5, "nickname": "香織", "age": 28, "avatar_url": "/images/avatars/demo-3.svg", "matched_at": "2026-11-12T15:00:00+09:00"}`（FR-MATCH-005。年齢は日本の時間帯の今日で出す） |
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。`500`：JWT が壊れている | `401`：ログインしていない。`403`：確認していない |
| 流れる SQL の目安 | **1＋N 本**（`select * from user_matches where user1_id = ? or user2_id = ? order by created_at desc` と、マッチ1件ごとに `select * from profiles where user_id = ? limit 1`） | 1本＋ガード1本（`user_matches` と `profiles` の JOIN。NFR-MATCH-001） |
| curl の例 | `curl http://127.0.0.1:8000/api/me/matches -H 'Authorization: Bearer <JWT>'` | `curl http://127.0.0.1:8000/api/me/matches -b cookies.txt` |

レガシー版の書き方：

```php
// AuthController::me() から写した JWT の処理（6行）
$me = $payload->sub;
$matches = UserMatch::where('user1_id', $me)
    ->orWhere('user2_id', $me)
    ->orderBy('created_at', 'desc')
    ->get();

$result = [];
foreach ($matches as $match) {
    // 組のどちら側に自分がいるかで、相手を選ぶ
    $partnerId = $match->user1_id == $me ? $match->user2_id : $match->user1_id;
    $profile = Profile::where('user_id', $partnerId)->first();   // 1件ごとに1本（N+1）
    $result[] = [
        'user_id' => $partnerId,
        'nickname' => $profile?->nickname,
        'birthday' => $profile?->birthday,   // 年齢ではなく生年月日
        'image' => $profile?->image,
        'matched_at' => $match->created_at,
    ];
}
return response()->json($result);
```

## レガシー版で起きること（#31 で測った。改善する段階で要件 ID のテストにする）

#31（PR #33）で測った結果。「※コードを読んで分かったこと」の行は、まだ試していない。

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| 会員 23 から 5 に送ってあるところに、5 から 23 に送る | 2回目の応答が `matched: true`。`user_matches` に (5, 23) が1行 | FR-MATCH-001 |
| 片方だけ送る（7 から 8） | `matched: false`。マッチはできない。そのあと 8 から 7 に送ると `matched: true`・(8, 7) | FR-MATCH-002 |
| まだいいねしていない100組で、A から B と B から A を同時に送る（ワーカー8つのサーバー） | **66組でマッチが2行**（(A, B) と (B, A)）・34組で1行・0行の組はなし。いいねは200行とも入った | FR-MATCH-003 |
| 同じ100組を、1つずつ処理するサーバー（compose の `app`）で | 100組すべて1行（いつもあとに処理された側が `user1_id`） | FR-MATCH-003 |
| マッチしたあと、同じ相手にもう一度送る | `500`（いいねの UNIQUE の違反）。マッチは増えない | FR-MATCH-004 |
| 自分に送る（9 から 9） | `201`・`matched: true`。自分とのマッチ (9, 9) ができ、9 のマッチの一覧に自分が出る | FR-MATCH-004 |
| いない会員（`999999`）に送る | `201`・`matched: false` | FR-MATCH-004 |
| マッチを 1・10・100件にしてマッチの一覧 | SQL が 2・11・101本（1＋N）。かかった時間は 24ms〜52ms | NFR-MATCH-001 |
| いいねを 1・10・100件にして送った一覧 | SQL が 3・21・201本（1＋2N）。かかった時間は 19ms〜87ms | NFR-MATCH-001 |
| マッチ1万件で `user1_id = ? or user2_id = ?` の実行計画 | `Seq Scan`。2行のために 10378行を捨てた（87ページ・0.334ms） | NFR-MATCH-002 |
| 送るときの「相手からのいいねがあるか」 | いいねが数行なので `Seq Scan`。1万件のときに UNIQUE のインデックスが効くことは 02 で測った | NFR-MATCH-003 |
| マッチの一覧の1件・送った一覧の1件 | 年齢ではなく生年月日が返る | FR-MATCH-005・006 |
| 確認していない会員（33）でマッチの一覧を見る | `200` で見られる | FR-MATCH-009 |
| トークンなし・壊れた JWT | `401`・`500` | FR-MATCH-008 |
| 2行になった組のマッチの一覧 | 同じ相手が2回出る ※コードを読んで分かったこと | FR-MATCH-003・005 |
| 相手を DB で消したあとのマッチの一覧 | 消えた相手の行が `nickname: null` で残る（外部キーがない）※コードを読んで分かったこと | FR-MATCH-010 |
| 送った一覧の印 | 逆向きのいいねから決める。マッチが抜けたり2行になったりしても、印は変わらず、マッチの一覧と食い違う ※コードを読んで分かったこと | FR-MATCH-006 |

compose の `app`（PHP の組み込みサーバー。ワーカーの指定なし）は、リクエストを1つずつ順に処理するので、そのままでは同時の送信が起きない。同時に送る試しは、app のコンテナの中で `PHP_CLI_SERVER_WORKERS=8` をつけたサーバーを 8001 番で一時的に起動して行った（compose の設定は変えていない）。JWT は、コンテナの中でレガシー版と同じ鍵で作り、外に出していない。測ったデータは消した。

## #46 で変えること（ID。状態：**案**）

D-022。上の表は 03 で作った形のまま残し、ここに差分だけを書く。いいねを送る・送った一覧の変更は [02-likes.md](02-likes.md) の「#46 で変えること」。

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 応答（成功） | 1件の `user_id` が、相手の `public_id`（UUID）になる（ユーザー詳細へのリンクに使う） | 同じ |
| 流れる SQL の目安 | **1＋2N 本**の見込み（1件ごとに、相手の `public_id` を読む SQL が1本増える） | 変わらない（`users` も JOIN して `public_id` を一緒に取る） |
