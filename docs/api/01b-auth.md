# 01b 認証と認可

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/auth.md](../requirements/auth.md)（FR-AUTH-001〜032・NFR-AUTH-001〜002）。決定：D-014（JWT）・D-015（`users` と `profiles`）。解説：[01b-auth.html](../../explanations/01b-auth.html)。

レガシー版は、ログイン（#16）ができる前に作るので、だれでも使える形にする。登録したあとも、ログインしないまま確認・再送ができる。

## `POST /api/users`（登録）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも | だれでも |
| 入力（JSON） | `email`・`password`・`nickname`・`gender`・`birthday`。**確かめない**（`$request->only()` で、決めた名前のものだけを取り出す） | `email`（メールアドレスの形・小文字にそろえて重ならない）・`password`（8〜64文字、かつ 72バイトまで）・`gender_code`（性別の表にあるもの）・`birthdate`（日付・日本の時間帯の今日で 18歳以上）・`nickname`（1〜20文字）。ほかのキーは無視する |
| 応答（成功） | `201`。作った `users` の行をそのまま返す（`password` だけ隠れる。**確認用の文字 `verification_token` も返る**） | `201` `{"user_id": 21, "email": "a@example.test", "email_verified": false}` |
| 応答（失敗） | 入力の誤りでは失敗しない。ただし、項目がない（`email` などが `null`）・まったく同じメールアドレス（`users.email` の UNIQUE）・256文字以上のニックネーム（`varchar(255)`）は `500` | `422`：入力の誤り・使われているメールアドレス（同時に2つ来て、DB の UNIQUE で断ったときも `422`） |
| 流れる SQL の目安 | 2本（`insert into users`・`insert into profiles`）。トランザクションなし | 4本＋トランザクション（メールアドレスが空いているか・性別があるか・`insert into users`・`insert into profiles`） |
| メール | 2本目の `insert` のあとに、その場で送る | トランザクションのコミットのあとに送る（database.md） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/users -H 'Content-Type: application/json' -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender":"female","birthday":"2000-01-01"}'` | `... -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender_code":2,"birthdate":"2000-01-01"}'` |

レガシー版の書き方：

```php
$user = User::create($request->only(['email', 'password']) + [
    'verification_token' => Str::random(40),   // 平文・期限なし
]);                                             // password は casts の 'hashed' で bcrypt になる
Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);
Mail::to($user->email)->send(new VerifyMail($user));   // ここで失敗しても、会員は残る
return response()->json($user, 201);
```

- 解説（01b-auth.html の「5. 見本」）は `User::create($request->all())` だったが、表を分けた（D-015）ので、`$request->all()` だと `users` にない列（`nickname` など）で `500` になる。`only()` にしたので、「`email_verified_at` を送って確認を飛ばす」問題は起きない。解説はこの形に合わせて直す

レガシー版の応答の例（`email_verified_at` は入れていないので、キーがない。全体の決まり「キーを残す」に合わない）：

```json
{
  "email": "a@example.test",
  "verification_token": "Xb3…（40文字）",
  "updated_at": "2026-11-12T01:00:00.000000Z",
  "created_at": "2026-11-12T01:00:00.000000Z",
  "id": 21
}
```

確認のメール（レガシー版・改善版とも、件名は「メールアドレスの確認」。本文はリンクだけ）：

| | レガシー版 | 改善版 |
| --- | --- | --- |
| リンク | `http://127.0.0.1:8000/api/email-verifications/{確認用の文字}` | `URL::temporarySignedRoute()` で作る、60分の署名つきのリンク |
| 作り方 | `App\Mail\VerifyMail`（Mailable）と、文字だけの Blade（`resources/views/mail/verify.blade.php`） | 同じ。ただし Blade は `{!! $url !!}` にする（`{{ }}` は `&` を `&amp;` に変え、`?expires=…&signature=…` のリンクが壊れるため） |
| リンクのホスト | リクエストの `Host` ヘッダーのまま（`url()`） | 設定の `APP_URL` に固定する（`URL::forceRootUrl()`）か、`trustHosts` で自分のホストだけを受ける。署名つきのリンクも Host で作るので、直さないと署名ごとよそのサイトに渡る |

## `GET /api/email-verifications/{token}`（メールアドレスの確認）

確認のメールのリンクを、ブラウザで開く。03b までは画面がないので、JSON を返す。

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| パス | `GET /api/email-verifications/{token}` | `GET /api/users/{public_id}/email-verification/{hash}?expires=…&signature=…`（`{hash}` はメールアドレスの SHA-1。Laravel の標準の形） |
| だれが使えるか | リンクを知っている人（**登録の応答や、01 のプロフィールの `GET` で、他人も確認用の文字を見られる**） | 署名が正しく、期限内のリンクを持つ人 |
| 応答（成功） | `200` `{"message": "メールアドレスを確認しました"}`。開くたびに `email_verified_at` を今の時刻で書き換える | `200` `{"message": "メールアドレスを確認しました"}`。確認済みなら `200` `{"message": "確認済みです"}` で、何も変えない（FR-AUTH-006） |
| 応答（失敗） | `404` `{"message": "確認のリンクが正しくありません"}`：その文字の会員がいない | `403`：署名が違う・期限（60分）が切れた・`{hash}` が合わない。`404`：その会員がいない |
| 流れる SQL の目安 | 2本（`select * from users where verification_token = ? limit 1`・`update users set email_verified_at = ?`）。**`verification_token` にインデックスがないので、表を全部読む** | 1〜2本（`select * from users where id = ?`・まだなら `update`） |
| curl の例 | `curl http://127.0.0.1:8000/api/email-verifications/<メールにある文字>` | メールにあるリンクをそのまま |

レガシー版の書き方：

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

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| パス | `POST /api/email-verifications` | `POST /api/me/email-verification`（「自分の情報」のパスは #16 で決めるので、そのときにそろえる） |
| だれが使えるか | だれでも（**メールアドレスを知っていれば、他人にも送れる**） | ログインしていて、まだ確認していない本人（FR-AUTH-007・FR-AUTH-021） |
| 入力（JSON） | `email` | なし（だれかは JWT の `sub` で決める） |
| 応答（成功） | `200` `{"message": "確認のメールを送りました"}`。確認済みでも送る。同じ確認用の文字を送り直す | `200` `{"message": "確認のメールを送りました"}`。確認済みなら送らず `200` `{"message": "確認済みです"}` |
| 応答（失敗） | `404` `{"message": "会員が見つかりません"}`：そのメールアドレスの会員がいない（**登録されているかが分かる**） | `401`：ログインしていない。`429`：同じ会員から 1分に2回目 |
| 流れる SQL の目安 | 1本（`select * from users where email = ? limit 1`） | 0〜1本（会員は JWT から読む。確認済みかを見るのに 1本） |
| 回数 | 何回でも | 1分に1回（`throttle`） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/email-verifications -H 'Content-Type: application/json' -d '{"email":"a@example.test"}'` | ― （#16 のあと） |

## レガシー版で起きること（#15 で測り、改善する段階で要件 ID のテストにする）

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| 生年月日 `2008-11-13`（17歳）で登録 | 登録できる | FR-AUTH-002 |
| `a@example.test` のあとに `A@example.test` で登録 | **別の会員として登録できる** | FR-AUTH-003 |
| `a@example.test` で2回登録 | 2回目は `500`（UNIQUE で断られる。`422` にならない） | FR-AUTH-003 |
| 7文字・65文字・80文字のパスワード | 登録できる。80文字は、72文字目までが合えばログインの照合が通る（測った：72文字で通り、71文字では通らない）。半角の65文字は 65バイトなので、後ろは無視されない | FR-AUTH-004 |
| `$2y$04$…` のようなハッシュの形のパスワード | ハッシュにし直さずに、そのまま保存される（Laravel の `'hashed'` の型は、ハッシュの形なら作り直さない） | FR-AUTH-030 |
| 項目を送らない・`"birthday": "abc"`・`"gender": "x"` | `email`・`password` がなければ `500`。ほかは、そのまま保存する | FR-AUTH-001 |
| 256文字のニックネーム | `users` だけでき、`profiles` で `500`（トランザクションがないので、**プロフィールのない会員が残り、そのメールアドレスではもう登録できない**） | FR-AUTH-001 |
| Mailpit を止めて登録 | 会員もプロフィールもでき、メールで `500`（送りなおしは、再送でしかできない） | FR-AUTH-001 |
| `"email": "abc"`（メールアドレスの形でない） | 会員もプロフィールもでき、メールを送るところで `500` | FR-AUTH-001 |
| `500` になったときの応答 | 開発用の設定で詳しいエラーを返すので、**SQL の値（パスワードのハッシュ・確認用の文字）が応答に出る**。平文のパスワードは出ない（測った） | FR-AUTH-032 |
| 失敗した登録のあと | 会員の ID が飛ぶ（失敗した `insert` でも番号が進む） | ― |
| `Host: evil.example` を付けて登録・再送 | **届いたリンクが `http://evil.example/…` になる**（リンクをリクエストの Host で作るため）。他人の受信箱に、よそのサイトへのリンクを送り込める | FR-AUTH-005 |
| 登録の応答・他人のプロフィールの `GET` を見る | **`verification_token` が見えるので、メールを受け取らずに確認を済ませられる** | FR-AUTH-005・FR-002 |
| 確認のリンクを、何日たってから・2回開く | どちらも確認できる。2回目は `email_verified_at` が書き換わる | FR-AUTH-006 |
| 確認のリンクを開くとき | `verification_token` で表を全部読む（測った：`Seq Scan` で 28行を読み、28行を捨てた） | ― |
| 確認のリンクを開いたあとの SQL のログ | `db.summary` の `path` に、**確認用の文字がそのまま残る**（パスに入れたため）。改善する段階で、ログの `path` をルートの形（`api/email-verifications/{token}`）にする | FR-AUTH-032 |
| 再送を続けて10回 | 10通届く | FR-AUTH-007 |
| シードの会員（確認用の文字がない）で再送 | 開けないリンク（`/api/email-verifications`。`405`）が届く | FR-AUTH-007 |
| ない・あるメールアドレスで再送 | `404` と `200` で、登録されているかが分かる | FR-AUTH-007 |
| DB の `users.verification_token` を見る | 平文で、期限がない | FR-AUTH-006 |
| DB の `users.password` を見る | `$2y$` で始まる（守れている） | FR-AUTH-030 |

## JWT の作り方（#16）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| 道具 | `firebase/php-jwt`（v7.2.1）。コントローラの中で `JWT::encode()`・`JWT::decode()` をそのつど書く | 同じ道具で、自分で書いたガード（`Auth::viaRequest()`）とミドルウェアにまとめる |
| 鍵 | **Laravel の `APP_KEY` をそのまま使う**（`config('app.key')`）。暗号化や Cookie の鍵と同じなので、片方だけを取り替えられない | JWT 専用の `JWT_SECRET`（長い乱数）を、秘密の値のファイルで渡す。AI は書かない・読まない |
| 有効期限 | 30日。止める仕組みなし | 15分 |
| 中身（クレーム） | `sub`（会員の ID）・`email`・`nickname`・`iat`・`exp` | `sub`・`iat`・`exp`・`jti`・`iss`・`aud` だけ（個人情報を入れない） |
| 送り方 | ログインの応答の JSON（`{"token": "…"}`）。呼ぶときは `Authorization: Bearer <JWT>` | `access`・`refresh` の HttpOnly の Cookie（requirements/auth.md の「トークンと Cookie」） |

## `POST /api/auth/login`（ログイン）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも。何回でも試せる | だれでも。同じメールアドレスと IP で 1分に5回まで（6回目は `429`。FR-AUTH-012） |
| 入力（JSON） | `email`・`password`。確かめない | `email`（小文字にそろえる）・`password`（どちらも必須。なければ `422`） |
| 応答（成功） | `200` `{"token": "<30日の JWT>"}`。メールアドレスを確認していない会員もログインできる | `200` `{"user_id": 21, "email_verified": false}`。トークンは JSON に入れず、`access`（15分）と `refresh`（30日）の Cookie で渡す。確認していない会員もログインはでき、機能は `403`（FR-AUTH-021） |
| 応答（失敗） | `401` `{"message": "メールアドレスが違います"}`（その会員がいない）・`401` `{"message": "パスワードが違います"}`（パスワードが違う）。**どちらが違うかが分かる**。`password` を送らないと `401`（パスワードが違います）、配列で送ると `500` | `401` `{"message": "メールアドレスかパスワードが違います"}`（どちらでも同じ。FR-AUTH-011）。ないメールアドレスでも、決まったハッシュで照合して、返るまでの時間をそろえる（NFR-AUTH-002） |
| 流れる SQL の目安 | 2本（`select * from users where email = ? limit 1`・`select * from profiles where user_id = ? limit 1`。ニックネームを JWT に入れるため） | 2本（会員を読む・`insert into refresh_tokens`） |
| curl の例 | `curl -X POST http://127.0.0.1:8000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"a@example.test","password":"password"}'` | `... -c cookies.txt`（Cookie を保存する） |

レガシー版の書き方：

```php
$user = User::where('email', $request->input('email'))->first();
if (! $user) {
    return response()->json(['message' => 'メールアドレスが違います'], 401);   // 登録されているかが分かる
}
if (! Hash::check($request->input('password'), $user->password)) {          // ないときは照合を飛ばすので、速く返る
    return response()->json(['message' => 'パスワードが違います'], 401);
}
$token = JWT::encode([
    'sub' => $user->id, 'email' => $user->email, 'nickname' => $user->profile?->nickname,
    'iat' => time(), 'exp' => time() + 60 * 60 * 24 * 30,                    // 30日
], config('app.key'), 'HS256');
return ['token' => $token];
```

## `GET /api/me`（自分の情報を見る）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | 正しい JWT を持つ人 | 正しい `access` の Cookie を持つ人。確認していなくても使える（FR-AUTH-021） |
| 入力 | `Authorization: Bearer <JWT>` | `access` の Cookie |
| 応答（成功） | `200`。`users` の行をそのまま返す（`password` だけ隠れる。**`verification_token` も返る**） | `200` `{"user_id": 21, "email": "a@example.test", "email_verified": true}`（FR-AUTH-017） |
| 応答（失敗） | `401` `{"message": "ログインしてください"}`：`Authorization` がない。**署名が違う・期限が切れた・形がおかしい JWT は `500`**（`JWT::decode()` の例外をつかまえない） | `401`：トークンがない・署名が違う・期限が切れた（どれも同じ形） |
| 流れる SQL の目安 | 1本（`select * from users where id = ? limit 1`。呼ぶたびに DB を見る） | 1本（JWT の確かめには DB を使わない。NFR-AUTH-001。応答を作るために会員を読む） |
| curl の例 | `curl http://127.0.0.1:8000/api/me -H 'Authorization: Bearer <JWT>'` | `curl http://127.0.0.1:8000/api/me -b cookies.txt` |

## `POST /api/auth/logout`（ログアウト）

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| だれが使えるか | だれでも | ログインした会員 |
| 応答（成功） | `200` `{"message": "ログアウトしました"}`。**サーバーは何もしない**（画面でトークンを消すだけ。消さなければ、30日のあいだ使える） | `204`。その端末の取り替え用のトークンを使えなくし、`access` と `refresh` の Cookie を消す（FR-AUTH-016） |
| 流れる SQL の目安 | 0本 | 1本（`update refresh_tokens set revoked_at = ?`） |

## `POST /api/auth/refresh`（取り替え。改善版だけ）

レガシー版にはない（JWT が切れたら、もう一度ログインする）。改善版は、`refresh` の Cookie で新しい `access` と `refresh` を渡し、古い `refresh` を使えなくする。使ったあとの `refresh` がもう一度来たら、その家族をすべて止めて `401`（FR-AUTH-014・015）。表 `refresh_tokens` は、改善する段階で DB の子 Issue として作る。

## レガシー版で起きること（#16 で測り、改善する段階で要件 ID のテストにする）

| 送るもの・すること | レガシー版 | 要件 |
| --- | --- | --- |
| ログインの JWT を base64 で読む | **メールアドレスとニックネームが読める**（署名はあるが、暗号化はしていない） | FR-AUTH-013 |
| ログアウトしたあとに、同じ JWT で `GET /api/me` | `200`（使える） | FR-AUTH-016 |
| ないメールアドレス・違うパスワードでログイン | 言葉が違うので、登録されているかが分かる。返るまでの時間も違う（測った：5回の平均で 0.024秒／0.204秒。bcrypt の照合の分だけ遅い） | FR-AUTH-011・NFR-AUTH-002 |
| 違うパスワードで 20回続けてログイン | 20回とも `401`（止まらない） | FR-AUTH-012 |
| `password` を送らない | `401`「パスワードが違います」（測った。設計のときは `500` と見込んでいた） | FR-AUTH-010 |
| `"password": ["password"]`（配列） | `500`（`password_verify()` の TypeError）。`laravel.log` のスタックトレースに、パスワードのハッシュの先頭15文字が残る | FR-AUTH-010・FR-AUTH-032 |
| `"email": ["sakura@example.test"]`（配列） | 先頭の要素だけが使われ、ログインできる（入力の形を確かめない） | FR-AUTH-010 |
| 署名を書き換えた JWT・`exp` が過ぎた JWT・`abc` で `GET /api/me` | `500`（`401` にならない。`exp` が過ぎたものは、鍵がないと作れないので測っていない） | FR-AUTH-013 |
| `500` のときの `laravel.log` | スタックトレースに `JWT::decode()` の引数として JWT が残る。今は PHP の設定（`zend.exception_string_param_max_len=15`）で先頭15文字（どの JWT でも同じヘッダーの部分）だけ。この設定を上げると、JWT がまるごと残る。鍵は `#[SensitiveParameter]` で伏せられる | FR-AUTH-032 |
| JWT の `sub` の会員がいない | `200 {}`（`User::find()` が `null`）。DB を作り直して ID が振り直されると、古い JWT が別の会員を指す（要確認。試していない） | FR-AUTH-013 |
| メールアドレスを確認していない会員でログイン | ログインでき、01 のプロフィールの API も使える | FR-AUTH-021 |
| `APP_KEY` を知っている人 | 好きな `sub` の JWT を作れる（だれにでもなりすませる。鍵を扱うので、AI は測っていない） | ― |
| `SAKURA@example.test`（#15 で別の会員になったもの）でログイン | 大文字と小文字で別の会員としてログインする | FR-AUTH-003 |
| `GET /api/me` を呼ぶたびに | DB を1本読む | NFR-AUTH-001 |

## #46 で変えること（ID。状態：**実装済み（レガシー版）**。PR #47 で測った）

D-022。上の表は 01b で作った形のまま残し、ここに差分だけを書く。

| 項目 | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| JWT の `sub` | 変えない（中の `id`）。分かるのは自分の番号だけで、それで他人のページは開けない | 同じ |
| `GET /api/me` の応答 | `users` の行に `public_id` が足される（測った。SQL は1本のまま）。/home は、これを使って `PUT /api/users/{public_id}` を呼ぶ | `"user_id": "019a…"`（値が UUID） |
| `POST /api/users` の応答 | `public_id` は出ない見込み（DB の既定の値で入るが、作ったあとに読み直さないため。登録は試していない） | `"user_id": "019a…"`（作ったあとに読み直す） |
| `public_id` を入れるところ | 書かない。DB の既定の値（`uuidv7()`）が入れる | 同じ |
