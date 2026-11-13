# 05c Firestore と比べる

状態：**実装済み（レガシー版）**

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/messages.md](../requirements/messages.md)（05 と同じ FR-MSG-001〜014）。Firestore の形は [data-model.md](../data-model.md) の「Firestore（05c）」。解説：`explanations/05c-firestore.html`（`legacy-repo`）。

05c では、メッセージを読む・送るのは画面が Firestore（手元の Emulator）を直接使うので、Laravel の API は2つだけ変える。

| API | 中身 | レガシー版 | 改善版 |
| --- | --- | --- | --- |
| `POST /api/me/firebase-token` | 画面が Firebase にログインするためのカスタムトークンを出す | 作る | 作る |
| `POST /api/me/likes`（変更） | マッチしたら、Firestore にもルームと2人の受信箱を作る | 変える | 変える |

レガシー版は、02〜05 と同じく、だれが使うかをコントローラの中で JWT を読んで決める（これで9か所目）。Firestore への書き込みは、Laravel の `Http` で REST を直接呼ぶ（SDK と grpc の拡張は使わない。解説の「5. 設計の選択肢」）。Emulator だけの管理者 `Authorization: Bearer owner` で書くので、ルールを通らない。

## `POST /api/me/firebase-token`（カスタムトークンを出す）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT（`Authorization: Bearer`）を持つ人。確認していない会員も使える | 正しい `access` の Cookie を持ち、メールアドレスを確認した会員 |
| 入力 | なし | 同じ |
| 応答（成功） | `200` `{"token": "eyJ…", "uid": "019a…"}`。`uid` は会員の `public_id`（Firestore の受信箱のパスと、ルールの `request.auth.uid` に使う） | 同じ |
| トークンの中身 | 署名のない JWT（ヘッダーは `{"alg": "none", "typ": "JWT"}`）。中身は `iss`・`sub`（偽のサービスアカウントの名前）・`aud`（`https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit`）・`iat`・`exp`（`iat` の 3600秒後）・`uid`。**Auth の Emulator は、カスタムトークンの署名と期限を確かめない**ので、これで通る。本物の Firebase では通らない | 環境で分ける。Emulator なら同じ。本番なら、サービスアカウントの鍵（秘密の値）で RS256 の署名をする。鍵は環境変数で渡し、ログ・応答に出さない |
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。`500`：JWT が壊れている | `401`・`403` |
| 流れる SQL の目安 | 1本（会員の `public_id` を読む） | 0本＋ガード1本 |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/me/firebase-token -H 'Authorization: Bearer <JWT>'` | `-b cookies.txt` で同じ |

コントローラは `FirebaseTokenController::store`。トークンの作り方は、`firebase/php-jwt` が `alg: none` を作らないので、ヘッダーと中身を base64url にして `.` でつなぎ、署名の部分を空にする。

## `POST /api/me/likes` で変えること（マッチしたら Firestore にも作る）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| いつ | 05 のトークルームと参加者2人を PostgreSQL に入れたあと、続けて | PostgreSQL のトランザクションがコミットしたあと |
| Firestore に書くもの | ① `rooms/{talk_rooms.public_id}`（`members`）② 送った人の `users/{uid}/rooms/{roomId}`（`partnerUid`・`lastReadAt: null`）③ 相手の受信箱（同じ形）。**3件を別々の HTTP で書く**（REST の `createDocument`） | 3件を1回の `documents:commit` で書く。受信箱には一覧に出すもの（相手の名前と写真・`lastActivityAt`・`unread: 0`）も写す |
| 失敗したとき | 例外のまま `500`。**PostgreSQL のいいね・マッチ・ルームはもう入っている**ので、DB はマッチしたのに、Firestore にはルームがない（または受信箱が片方だけ）になる。画面は `500` を見て送り直し、2回目は いいねの UNIQUE の違反で `500` | Firestore に書けなくても、いいねは `201` で返す。書けなかった分は、あとで書き直す（表に「まだ書いていない」を残して、ジョブが書き直す。outbox） |
| 応答 | 変わらない（`201`・`matched`） | 同じ |
| 流れる SQL と HTTP の目安 | SQL 7本（05 と同じ）＋ Firestore への HTTP 3本（マッチしたときだけ） | SQL は同じ＋ HTTP 1本 |

レガシー版の書き方：

```php
// 05：PostgreSQL にルームと参加者2人を入れたあと（トランザクションなし）
// 05c：Firestore にも、ルームと2人の受信箱を作る（3件を別々に書く。途中で失敗すると残りは書かれない）
$base = 'http://'.getenv('FIRESTORE_EMULATOR_HOST').'/v1/projects/demo-matching/databases/(default)/documents';
Http::withToken('owner')->post("{$base}/rooms?documentId={$room->public_id}", ['fields' => [
    'members' => ['arrayValue' => ['values' => [['stringValue' => $meUid], ['stringValue' => $toUid]]]],
]])->throw();
Http::withToken('owner')->post("{$base}/users/{$meUid}/rooms?documentId={$room->public_id}", ['fields' => [
    'partnerUid' => ['stringValue' => $toUid], 'lastReadAt' => ['nullValue' => null],
]])->throw();
// 相手の受信箱も同じ形で
```

## レガシー版で起きること（#67 で測った）

開発用の DB と、手元の Emulator（試しのデータを写したもの）で、コンテナの中でコントローラを直接呼んで確かめた。JWT・カスタムトークン・ID トークンは外に出していない。試したいいね・マッチ・ルームと Firestore のドキュメントは消した。

| 送るもの・すること | レガシー版 |
| --- | --- |
| `search00001` でカスタムトークンを出す | `200`・SQL 1本。`uid` は `public_id` と同じ。ヘッダーは `{"alg":"none","typ":"JWT"}`・署名の部分は空 |
| そのトークンで Auth の Emulator にログイン（REST の `accounts:signInWithCustomToken`） | `200`。ID トークンが返る |
| その ID トークンで Firestore を読む | 自分の受信箱 `200`・**ほかの会員の受信箱も `200`**（ゆるいルール）・トークンなし `403` |
| お互いにいいね（1回目・2回目） | 1回目 `201`・SQL 3本・HTTP 0本・9ms。2回目 `201`・`matched: true`・**SQL 9本（05 の 7本＋会員の `public_id` とルームの読み直し）・Firestore への HTTP 3本**・39ms |
| 2回目のあとの Firestore | `rooms/{id}`（`members` に2人）と、2人の受信箱（`partnerUid`・`lastReadAt: null`）ができた |
| `firebase` を止めて、お互いにいいね | 2回目は `500`（`ConnectionException`）。**PostgreSQL には、いいね 2・マッチ 1・ルーム 1・参加者 2 が残った**。Firestore には何もない |
| そのあと送り直す | `500`（いいねの UNIQUE の違反）。Firestore のルームは、もう作られない |
