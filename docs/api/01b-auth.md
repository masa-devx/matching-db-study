# 01b 認証と認可

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/auth.md](../requirements/auth.md)（FR-AUTH-001〜032・NFR-AUTH-001〜002）。決定：D-014（JWT）・D-015（`users` と `profiles`）。解説：[01b-auth.html](../../explanations/01b-auth.html)。

素朴な版は、ログイン（#16）ができる前に作るので、だれでも使える形にする。登録したあとも、ログインしないまま確認・再送ができる。

## `POST /api/users`（登録）

| 項目 | 素朴な版（legacy-repo） | 直した版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも | だれでも |
| 入力（JSON） | `email`・`password`・`nickname`・`gender`・`birthday`。**確かめない**（`$request->only()` で、決めた名前のものだけを取り出す） | `email`（メールアドレスの形・小文字にそろえて重ならない）・`password`（8〜64文字）・`gender_code`（性別の表にあるもの）・`birthdate`（日付・日本の時間帯の今日で 18歳以上）・`nickname`（1〜20文字）。ほかのキーは無視する |
| 応答（成功） | `201`。作った `users` の行をそのまま返す（`password` だけ隠れる。**確認用の文字 `verification_token` も返る**） | `201` `{"user_id": 21, "email": "a@example.test", "email_verified": false}` |
| 応答（失敗） | 入力の誤りでは失敗しない。ただし、項目がない（`email` などが `null`）・まったく同じメールアドレス（`users.email` の UNIQUE）・256文字以上のニックネーム（`varchar(255)`）は `500` | `422`：入力の誤り・使われているメールアドレス（同時に2つ来て、DB の UNIQUE で断ったときも `422`） |
| 流れる SQL の目安 | 2本（`insert into users`・`insert into profiles`）。トランザクションなし | 4本＋トランザクション（メールアドレスが空いているか・性別があるか・`insert into users`・`insert into profiles`） |
| メール | 2本目の `insert` のあとに、その場で送る | トランザクションのコミットのあとに送る（database.md） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/users -H 'Content-Type: application/json' -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender":"female","birthday":"2000-01-01"}'` | `... -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender_code":2,"birthdate":"2000-01-01"}'` |

素朴な版の書き方：

```php
$user = User::create($request->only(['email', 'password']) + [
    'verification_token' => Str::random(40),   // 平文・期限なし
]);                                             // password は casts の 'hashed' で bcrypt になる
Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);
Mail::to($user->email)->send(new VerifyMail($user));   // ここで失敗しても、会員は残る
return response()->json($user, 201);
```

- 解説（01b-auth.html の「5. 見本」）は `User::create($request->all())` だったが、表を分けた（D-015）ので、`$request->all()` だと `users` にない列（`nickname` など）で `500` になる。`only()` にしたので、「`email_verified_at` を送って確認を飛ばす」問題は起きない。解説はこの形に合わせて直す

素朴な版の応答の例（`email_verified_at` は入れていないので、キーがない。全体の決まり「キーを残す」に合わない）：

```json
{
  "email": "a@example.test",
  "verification_token": "Xb3…（40文字）",
  "updated_at": "2026-11-12T01:00:00.000000Z",
  "created_at": "2026-11-12T01:00:00.000000Z",
  "id": 21
}
```

確認のメール（素朴な版・直した版とも、件名は「メールアドレスの確認」。本文はリンクだけ）：

| | 素朴な版 | 直した版 |
| --- | --- | --- |
| リンク | `http://127.0.0.1:8000/api/email-verifications/{確認用の文字}` | `URL::temporarySignedRoute()` で作る、60分の署名つきのリンク |
| 作り方 | `App\Mail\VerifyMail`（Mailable）と、文字だけの Blade（`resources/views/mail/verify.blade.php`） | 同じ |

## `GET /api/email-verifications/{token}`（メールアドレスの確認）

確認のメールのリンクを、ブラウザで開く。03b までは画面がないので、JSON を返す。

| 項目 | 素朴な版（legacy-repo） | 直した版（refactored-repo） |
| --- | --- | --- |
| パス | `GET /api/email-verifications/{token}` | `GET /api/users/{id}/email-verification/{hash}?expires=…&signature=…`（`{hash}` はメールアドレスの SHA-1。Laravel の標準の形） |
| だれが使えるか | リンクを知っている人（**登録の応答や、01 のプロフィールの `GET` で、他人も確認用の文字を見られる**） | 署名が正しく、期限内のリンクを持つ人 |
| 応答（成功） | `200` `{"message": "メールアドレスを確認しました"}`。開くたびに `email_verified_at` を今の時刻で書き換える | `200` `{"message": "メールアドレスを確認しました"}`。確認済みなら `200` `{"message": "確認済みです"}` で、何も変えない（FR-AUTH-006） |
| 応答（失敗） | `404` `{"message": "確認のリンクが正しくありません"}`：その文字の会員がいない | `403`：署名が違う・期限（60分）が切れた・`{hash}` が合わない。`404`：その会員がいない |
| 流れる SQL の目安 | 2本（`select * from users where verification_token = ? limit 1`・`update users set email_verified_at = ?`）。**`verification_token` にインデックスがないので、表を全部読む** | 1〜2本（`select * from users where id = ?`・まだなら `update`） |
| curl の例 | `curl http://127.0.0.1:8000/api/email-verifications/<メールにある文字>` | メールにあるリンクをそのまま |

素朴な版の書き方：

```php
$user = User::where('verification_token', $token)->first();
if (! $user) {
    return response()->json(['message' => '確認のリンクが正しくありません'], 404);
}
$user->email_verified_at = now();   // 確認用の文字は消さないので、何度でも使える
$user->save();
return ['message' => 'メールアドレスを確認しました'];
```

## `POST /api/email-verifications`（確認のメールの再送）

| 項目 | 素朴な版（legacy-repo） | 直した版（refactored-repo） |
| --- | --- | --- |
| パス | `POST /api/email-verifications` | `POST /api/me/email-verification`（「自分の情報」のパスは #16 で決めるので、そのときにそろえる） |
| だれが使えるか | だれでも（**メールアドレスを知っていれば、他人にも送れる**） | ログインしていて、まだ確認していない本人（FR-AUTH-007・FR-AUTH-021） |
| 入力（JSON） | `email` | なし（だれかは JWT の `sub` で決める） |
| 応答（成功） | `200` `{"message": "確認のメールを送りました"}`。確認済みでも送る。同じ確認用の文字を送り直す | `200` `{"message": "確認のメールを送りました"}`。確認済みなら送らず `200` `{"message": "確認済みです"}` |
| 応答（失敗） | `404` `{"message": "会員が見つかりません"}`：そのメールアドレスの会員がいない（**登録されているかが分かる**） | `401`：ログインしていない。`429`：同じ会員から 1分に2回目 |
| 流れる SQL の目安 | 1本（`select * from users where email = ? limit 1`） | 0〜1本（会員は JWT から読む。確認済みかを見るのに 1本） |
| 回数 | 何回でも | 1分に1回（`throttle`） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/email-verifications -H 'Content-Type: application/json' -d '{"email":"a@example.test"}'` | ― （#16 のあと） |

## 素朴な版で起きること（#15 で測り、直す段階で要件 ID のテストにする）

| 送るもの・すること | 素朴な版 | 要件 |
| --- | --- | --- |
| 生年月日 `2008-11-13`（17歳）で登録 | 登録できる | FR-AUTH-002 |
| `a@example.test` のあとに `A@example.test` で登録 | **別の会員として登録できる** | FR-AUTH-003 |
| `a@example.test` で2回登録 | 2回目は `500`（UNIQUE で断られる。`422` にならない） | FR-AUTH-003 |
| 7文字・65文字のパスワード | 登録できる（65文字のときの bcrypt の動きは、実装のときに測る） | FR-AUTH-004 |
| 項目を送らない・`"birthday": "abc"`・`"gender": "x"` | `email`・`password` がなければ `500`。ほかは、そのまま保存する | FR-AUTH-001 |
| 256文字のニックネーム | `users` だけでき、`profiles` で `500`（トランザクションがないので、**プロフィールのない会員が残り、そのメールアドレスではもう登録できない**） | FR-AUTH-001 |
| Mailpit を止めて登録 | 会員もプロフィールもでき、メールで `500`（送りなおしは、再送でしかできない） | FR-AUTH-001 |
| 登録の応答・他人のプロフィールの `GET` を見る | **`verification_token` が見えるので、メールを受け取らずに確認を済ませられる** | FR-AUTH-005・FR-002 |
| 確認のリンクを、何日たってから・2回開く | どちらも確認できる。2回目は `email_verified_at` が書き換わる | FR-AUTH-006 |
| 確認のリンクを開くとき | `verification_token` で表を全部読む（会員が増えるほど遅い。`EXPLAIN` で `Seq Scan` を見る） | ― |
| 再送を続けて10回 | 10通届く | FR-AUTH-007 |
| ない・あるメールアドレスで再送 | `404` と `200` で、登録されているかが分かる | FR-AUTH-007 |
| DB の `users.verification_token` を見る | 平文で、期限がない | FR-AUTH-006 |
| DB の `users.password` を見る | `$2y$` で始まる（守れている） | FR-AUTH-030 |
