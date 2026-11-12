# 03 マッチ

状態：**確定**

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

## レガシー版で起きること（#31 で測り、改善する段階で要件 ID のテストにする）

この表は、作る前の見込み。#31 で測って、結果に書き換える。

| 送るもの・すること | 見込み | 要件 |
| --- | --- | --- |
| A から B に送り、B から A に送る | 2回目の応答が `matched: true`。`user_matches` に (B, A) が1行 | FR-MATCH-001 |
| 片方だけ送る | `matched: false`。マッチはできない | FR-MATCH-002 |
| まだいいねしていない組で、A から B と B から A を同時に送る（100組） | 1行の組と、2行（(A, B) と (B, A)）の組ができる。0行の組はできない（トランザクションがなく、1本ずつすぐ確定するため） | FR-MATCH-003 |
| マッチしたあと、同じ相手にもう一度送る | `500`（いいねの UNIQUE の違反）。マッチの処理まで進まないので、マッチは増えない | FR-MATCH-004 |
| 自分に送る | `201`・`matched: true`。自分とのマッチ (A, A) ができる（今入れた自分あてのいいねが、逆向きとして見つかる） | FR-MATCH-004 |
| いない会員（`999999`）に送る | `201`・`matched: false` | FR-MATCH-004 |
| マッチを 1・10・100件にしてマッチの一覧 | SQL が 2・11・101本（1＋N） | NFR-MATCH-001 |
| いいねを 1・10・100件にして送った一覧 | SQL が 3・21・201本（1＋2N） | NFR-MATCH-001 |
| マッチの一覧の SQL の実行計画（`user1_id = ? or user2_id = ?`） | 表を全部読む（`Seq Scan`。インデックスがない） | NFR-MATCH-002 |
| 送るときの「相手からのいいねがあるか」（`from_user_id = ? and to_user_id = ?`） | `Index Scan`（02 の UNIQUE が効く） | NFR-MATCH-003 |
| 2行になった組のマッチの一覧 | 同じ相手が2回出る | FR-MATCH-003・005 |
| 相手を DB で消したあとのマッチの一覧 | 消えた相手の行が `nickname: null` で残る | FR-MATCH-010 |
| 確認していない会員でマッチの一覧を見る | 見られる | FR-MATCH-009 |
| トークンなし・壊れた JWT | `401`・`500` | FR-MATCH-008 |

測るときは、開発用の DB に、会員 23（`sakura@example.test`）とのいいね・マッチを SQL でまとめて入れる（`generate_series` で 100件など）。同時に送るのは、組ごとに `curl` を2つ並べて走らせる。測ったあとは消す。
