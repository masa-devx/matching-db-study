# 01b 認証と認可

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

要件：[requirements/auth.md](../requirements/auth.md)（FR-AUTH-001〜032・NFR-AUTH-001〜002）。決定：D-014（JWT）・D-015（`users` と `profiles`）。解説：[01b-auth.html](../../explanations/01b-auth.html)。

| メソッドとパス | 何をする |
| --- | --- |
| `POST /api/users` | 登録する |
| `GET /api/email-verifications/{token}` | メールアドレスを確認する（確認のメールのリンク） |
| `POST /api/email-verifications` | 確認のメールをもう一度送る |
| `POST /api/auth/login` | ログインする |
| `GET /api/me` | 自分の情報を見る |
| `POST /api/auth/logout` | ログアウトする |
| `POST /api/auth/refresh`（改善版だけ） | トークンを取り替える |
| `PUT /api/me/password` | パスワードを変える（M1 設定画面。#181） |
| `POST /api/password-resets` | パスワードの再設定のメールを送る（M2。#196） |
| `PUT /api/password-resets/{token}` | 新しいパスワードを決める（M2。#196） |

レガシー版は、ログイン（#16）ができる前に作るので、だれでも使える形にする。登録したあとも、ログインしないまま確認・再送ができる。

## `POST /api/users`（登録）

### だれが使えるか

- レガシー版（legacy-repo）：だれでも
- 改善版（refactored-repo）：だれでも

### 入力（JSON）

- レガシー版：`email`・`password`・`nickname`・`gender`・`birthday`
  - **確かめない**（`$request->only()` で、決めた名前のものだけを取り出す）
- 改善版
  - `email`（メールアドレスの形・小文字にそろえて重ならない）
  - `password`（8〜64文字、かつ 72バイトまで）
  - `gender_code`（性別の表にあるもの）
  - `birthdate`（日付・日本の時間帯の今日で 18歳以上）
  - `nickname`（1〜20文字）
  - ほかのキーは無視する

### 応答（成功）

- レガシー版：`201`。作った `users` の行をそのまま返す
  - `password` と、確認用の文字 `verification_token` は隠れる
  - 確認用の文字は、legacy-repo では返していた。refactored-repo で `User` の `#[Hidden]` に足し、返さないようにした
- 改善版：`201` `{"user_id": 21, "email": "a@example.test", "email_verified": false}`

### 応答（失敗）

- レガシー版：入力の誤りでは失敗しない。ただし、次のときは `500`
  - 項目がない（`email` などが `null`）
  - まったく同じメールアドレス（`users.email` の UNIQUE）
  - 256文字以上のニックネーム（`varchar(255)`）
- 改善版：`422`：入力の誤り・使われているメールアドレス
  - 同時に2つ来て、DB の UNIQUE で断ったときも `422`

### 流れる SQL の目安

- レガシー版：2本（`insert into users`・`insert into profiles`）。トランザクションなし
- 改善版：4本＋トランザクション
  - メールアドレスが空いているか・性別があるか・`insert into users`・`insert into profiles`

### メール

- レガシー版：2本目の `insert` のあとに、その場で送る
- 改善版：トランザクションのコミットのあとに送る（database.md）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/users -H 'Content-Type: application/json' -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender":"female","birthday":"2000-01-01"}'`
- 改善版：`... -d '{"email":"a@example.test","password":"password","nickname":"さくら","gender_code":2,"birthdate":"2000-01-01"}'`

### レガシー版の書き方

```php
$user = User::create($request->only(['email', 'password']) + [
    'verification_token' => Str::random(40),   // 平文・期限なし
]);                                             // password は casts の 'hashed' で bcrypt になる
Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);
Mail::to($user->email)->send(new VerifyMail($user));   // ここで失敗しても、会員は残る
return response()->json($user, 201);
```

- 解説（01b-auth.html の「5. 見本」）は `User::create($request->all())` だった
  - 表を分けた（D-015）ので、`$request->all()` だと `users` にない列（`nickname` など）で `500` になる
  - `only()` にしたので、「`email_verified_at` を送って確認を飛ばす」問題は起きない
  - 解説はこの形に合わせて直す

### レガシー版の応答の例

- `email_verified_at` は入れていないので、キーがない。全体の決まり「キーを残す」に合わない
- 確認用の文字は、legacy-repo では返していた。refactored-repo で `User` の `#[Hidden]` に足し、返さないようにした

```json
{
  "email": "a@example.test",
  "updated_at": "2026-11-12T01:00:00.000000Z",
  "created_at": "2026-11-12T01:00:00.000000Z",
  "id": 21
}
```

### 確認のメール

レガシー版・改善版とも、件名は「メールアドレスの確認」。本文はリンクだけ。

#### リンク

- レガシー版：`http://127.0.0.1:8000/api/email-verifications/{確認用の文字}`
- 改善版：`URL::temporarySignedRoute()` で作る、60分の署名つきのリンク

#### 作り方

- レガシー版：`App\Mail\VerifyMail`（Mailable）と、文字だけの Blade（`resources/views/mail/verify.blade.php`）
- 改善版：同じ。ただし Blade は `{!! $url !!}` にする
  - `{{ }}` は `&` を `&amp;` に変え、`?expires=…&signature=…` のリンクが壊れるため

#### リンクのホスト

- レガシー版：リクエストの `Host` ヘッダーのまま（`url()`）
- 改善版：設定の `APP_URL` に固定する（`URL::forceRootUrl()`）か、`trustHosts` で自分のホストだけを受ける
  - 署名つきのリンクも Host で作るので、直さないと署名ごとよそのサイトに渡る

## `GET /api/email-verifications/{token}`（メールアドレスの確認）

確認のメールのリンクを、ブラウザで開く。03b までは画面がないので、JSON を返す。

### パス

- レガシー版：`GET /api/email-verifications/{token}`
- 改善版：`GET /api/users/{public_id}/email-verification/{hash}?expires=…&signature=…`
  - `{hash}` はメールアドレスの SHA-1。Laravel の標準の形

### だれが使えるか

- レガシー版：確認のメールを受け取った人
  - legacy-repo では、登録の応答や 01 のプロフィールの `GET` で、他人も確認用の文字を見られた
  - refactored-repo で応答から隠した
- 改善版：署名が正しく、期限内のリンクを持つ人

### 応答（成功）

- レガシー版：`200` `{"message": "メールアドレスを確認しました"}`
  - 開くたびに `email_verified_at` を今の時刻で書き換える
- 改善版：`200` `{"message": "メールアドレスを確認しました"}`
  - 確認済みなら `200` `{"message": "確認済みです"}` で、何も変えない（FR-AUTH-006）

### 応答（失敗）

- レガシー版：`404` `{"message": "確認のリンクが正しくありません"}`：その文字の会員がいない
- 改善版
  - `403`：署名が違う・期限（60分）が切れた・`{hash}` が合わない
  - `404`：その会員がいない

### 流れる SQL の目安

- レガシー版：2本（`select * from users where verification_token = ? limit 1`・`update users set email_verified_at = ?`）
  - **`verification_token` にインデックスがないので、表を全部読む**
- 改善版：1〜2本（`select * from users where id = ?`・まだなら `update`）

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/email-verifications/<メールにある文字>`
- 改善版：メールにあるリンクをそのまま

### レガシー版の書き方

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

### パス

- レガシー版：`POST /api/email-verifications`
- 改善版：`POST /api/me/email-verification`
  - 「自分の情報」のパスは #16 で決めるので、そのときにそろえる

### だれが使えるか

- レガシー版：だれでも（**メールアドレスを知っていれば、他人にも送れる**）
- 改善版：ログインしていて、まだ確認していない本人（FR-AUTH-007・FR-AUTH-021）

### 入力（JSON）

- レガシー版：`email`
- 改善版：なし（だれかは JWT の `sub` で決める）

### 応答（成功）

- レガシー版：`200` `{"message": "確認のメールを送りました"}`
  - 確認済みでも送る
  - 同じ確認用の文字を送り直す
- 改善版：`200` `{"message": "確認のメールを送りました"}`
  - 確認済みなら送らず `200` `{"message": "確認済みです"}`

### 応答（失敗）

- レガシー版：`404` `{"message": "会員が見つかりません"}`：そのメールアドレスの会員がいない
  - **登録されているかが分かる**
- 改善版
  - `401`：ログインしていない
  - `429`：同じ会員から 1分に2回目

### 流れる SQL の目安

- レガシー版：1本（`select * from users where email = ? limit 1`）
- 改善版：0〜1本（会員は JWT から読む。確認済みかを見るのに 1本）

### 回数

- レガシー版：何回でも
- 改善版：1分に1回（`throttle`）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/email-verifications -H 'Content-Type: application/json' -d '{"email":"a@example.test"}'`
- 改善版：― （#16 のあと）

## レガシー版で起きること（#15 で測り、改善する段階で要件 ID のテストにする）

- 生年月日 `2008-11-13`（17歳）で登録
  - レガシー版：登録できる
  - 要件：FR-AUTH-002
- `a@example.test` のあとに `A@example.test` で登録
  - レガシー版：**別の会員として登録できる**
  - 要件：FR-AUTH-003
- `a@example.test` で2回登録
  - レガシー版：2回目は `500`（UNIQUE で断られる。`422` にならない）
  - 要件：FR-AUTH-003
- 7文字・65文字・80文字のパスワード
  - レガシー版：登録できる
  - 80文字は、72文字目までが合えばログインの照合が通る（測った：72文字で通り、71文字では通らない）
  - 半角の65文字は 65バイトなので、後ろは無視されない
  - 要件：FR-AUTH-004
- `$2y$04$…` のようなハッシュの形のパスワード
  - レガシー版：ハッシュにし直さずに、そのまま保存される
  - Laravel の `'hashed'` の型は、ハッシュの形なら作り直さない
  - 要件：FR-AUTH-030
- 項目を送らない・`"birthday": "abc"`・`"gender": "x"`
  - レガシー版：`email`・`password` がなければ `500`。ほかは、そのまま保存する
  - 要件：FR-AUTH-001
- 256文字のニックネーム
  - レガシー版：`users` だけでき、`profiles` で `500`
  - トランザクションがないので、**プロフィールのない会員が残り、そのメールアドレスではもう登録できない**
  - 要件：FR-AUTH-001
- Mailpit を止めて登録
  - レガシー版：会員もプロフィールもでき、メールで `500`（送りなおしは、再送でしかできない）
  - 要件：FR-AUTH-001
- `"email": "abc"`（メールアドレスの形でない）
  - レガシー版：会員もプロフィールもでき、メールを送るところで `500`
  - 要件：FR-AUTH-001
- `500` になったときの応答
  - レガシー版：開発用の設定で詳しいエラーを返すので、**SQL の値（パスワードのハッシュ・確認用の文字）が応答に出る**
  - 平文のパスワードは出ない（測った）
  - 要件：FR-AUTH-032
- 失敗した登録のあと
  - レガシー版：会員の ID が飛ぶ（失敗した `insert` でも番号が進む）
  - 要件：―
- `Host: evil.example` を付けて登録・再送
  - レガシー版：**届いたリンクが `http://evil.example/…` になる**（リンクをリクエストの Host で作るため）
  - 他人の受信箱に、よそのサイトへのリンクを送り込める
  - 要件：FR-AUTH-005
- 登録の応答・他人のプロフィールの `GET` を見る
  - **直した**（refactored-repo）
  - legacy-repo では `verification_token` が見え、メールを受け取らずに確認を済ませられた
  - 今は、登録・自分の情報・相手のプロフィールの応答に出ない（`User` の `#[Hidden]`）
  - 要件：FR-AUTH-005・FR-002
- 確認のリンクを、何日たってから・2回開く
  - レガシー版：どちらも確認できる。2回目は `email_verified_at` が書き換わる
  - 要件：FR-AUTH-006
- 確認のリンクを開くとき
  - レガシー版：`verification_token` で表を全部読む（測った：`Seq Scan` で 28行を読み、28行を捨てた）
  - 要件：―
- 確認のリンクを開いたあとの SQL のログ
  - レガシー版：`db.summary` の `path` に、**確認用の文字がそのまま残る**（パスに入れたため）
  - 改善する段階で、ログの `path` をルートの形（`api/email-verifications/{token}`）にする
  - 要件：FR-AUTH-032
- 再送を続けて10回
  - レガシー版：10通届く
  - 要件：FR-AUTH-007
- シードの会員（確認用の文字がない）で再送
  - レガシー版：開けないリンク（`/api/email-verifications`。`405`）が届く
  - 要件：FR-AUTH-007
- ない・あるメールアドレスで再送
  - レガシー版：`404` と `200` で、登録されているかが分かる
  - 要件：FR-AUTH-007
- DB の `users.verification_token` を見る
  - レガシー版：平文で、期限がない
  - 要件：FR-AUTH-006
- DB の `users.password` を見る
  - レガシー版：`$2y$` で始まる（守れている）
  - 要件：FR-AUTH-030

## JWT の作り方（#16）

### 道具

- レガシー版：`firebase/php-jwt`（v7.2.1）
  - コントローラの中で `JWT::encode()`・`JWT::decode()` をそのつど書く
- 改善版：同じ道具で、自分で書いたガード（`Auth::viaRequest()`）とミドルウェアにまとめる

### 鍵

- レガシー版：**Laravel の `APP_KEY` をそのまま使う**（`config('app.key')`）
  - 暗号化や Cookie の鍵と同じなので、片方だけを取り替えられない
- 改善版：JWT 専用の `JWT_SECRET`（長い乱数）を、秘密の値のファイルで渡す
  - AI は書かない・読まない

### 有効期限

- レガシー版：30日。止める仕組みなし
- 改善版：15分

### 中身（クレーム）

- レガシー版：`sub`（会員の ID）・`email`・`nickname`・`iat`・`exp`
- 改善版：`sub`・`iat`・`exp`・`jti`・`iss`・`aud` だけ（個人情報を入れない）

### 送り方

- レガシー版：ログインの応答の JSON（`{"token": "…"}`）。呼ぶときは `Authorization: Bearer <JWT>`
- 改善版（#259・D-027）：トークンは使わない。Laravel Sanctum のセッションの HttpOnly の Cookie。取り替え用のトークン（`refresh`）は作らない
- 改善版を curl で確かめるとき（`Origin` を付けないと、Sanctum はセッションを使わず 401 になる）
  - `curl -c jar -b jar -H 'Origin: http://localhost:5173' http://localhost:8000/sanctum/csrf-cookie` で、CSRF の Cookie（`XSRF-TOKEN`）をもらう
  - ログイン：`curl -c jar -b jar -H 'Origin: http://localhost:5173' -H 'Accept: application/json' -H 'Content-Type: application/json' -H 'X-XSRF-TOKEN: <jar の XSRF-TOKEN の値を URL のデコードしたもの>' -d '{"email":"…","password":"…"}' http://localhost:8000/api/auth/login`
  - 自分の情報：`curl -b jar -H 'Origin: http://localhost:5173' -H 'Accept: application/json' http://localhost:8000/api/me`
  - 書き込み（ログアウトなど）は、ログインと同じく `X-XSRF-TOKEN` を付ける。付けないと `419`「画面を読み込み直してください」

## `POST /api/auth/login`（ログイン）

### だれが使えるか

- レガシー版：だれでも。何回でも試せる
- 改善版：だれでも。同じメールアドレスと IP で 1分に5回まで（6回目は `429`。FR-AUTH-012）

### 入力（JSON）

- レガシー版：`email`・`password`。確かめない
- 改善版：`email`（小文字にそろえる）・`password`（どちらも必須。なければ `422`）

### 応答（成功）

- レガシー版：`200` `{"token": "<30日の JWT>"}`
  - メールアドレスを確認していない会員もログインできる
- 改善版：`200` `{"user_id": 21, "email_verified": false}`
  - トークンは JSON に入れず、`access`（15分）と `refresh`（30日）の Cookie で渡す
  - 確認していない会員もログインはでき、機能は `403`（FR-AUTH-021）

### 応答（失敗）

- レガシー版
  - `401` `{"message": "メールアドレスが違います"}`（その会員がいない）
  - `401` `{"message": "パスワードが違います"}`（パスワードが違う）
  - **どちらが違うかが分かる**
  - `password` を送らないと `401`（パスワードが違います）、配列で送ると `500`
- 改善版：`401` `{"message": "メールアドレスかパスワードが違います"}`（どちらでも同じ。FR-AUTH-011）
  - ないメールアドレスでも、決まったハッシュで照合して、返るまでの時間をそろえる（NFR-AUTH-002）

### 流れる SQL の目安

- レガシー版：2本（`select * from users where email = ? limit 1`・`select * from profiles where user_id = ? limit 1`）
  - ニックネームを JWT に入れるため
- 改善版：2本（会員を読む・`insert into refresh_tokens`）

### curl の例

- レガシー版：`curl -X POST http://127.0.0.1:8000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"a@example.test","password":"password"}'`
- 改善版：`... -c cookies.txt`（Cookie を保存する）

### レガシー版の書き方

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

### だれが使えるか

- レガシー版：正しい JWT を持つ人
- 改善版：正しい `access` の Cookie を持つ人。確認していなくても使える（FR-AUTH-021）

### 入力

- レガシー版：`Authorization: Bearer <JWT>`
- 改善版：`access` の Cookie

### 応答（成功）

- レガシー版：`200`。`users` の行をそのまま返す
  - `password` と `verification_token` は隠れる
  - 確認用の文字は、legacy-repo では返していた。refactored-repo で `User` の `#[Hidden]` に足し、返さないようにした
- 改善版：`200` `{"user_id": 21, "email": "a@example.test", "email_verified": true}`（FR-AUTH-017）

### 応答（失敗）

- レガシー版
  - `401` `{"message": "ログインしてください"}`：`Authorization` がない
  - **署名が違う・期限が切れた・形がおかしい JWT は `500`**（`JWT::decode()` の例外をつかまえない）
- 改善版：`401`：トークンがない・署名が違う・期限が切れた（どれも同じ形）

### 流れる SQL の目安

- レガシー版：1本（`select * from users where id = ? limit 1`。呼ぶたびに DB を見る）
- 改善版：1本（JWT の確かめには DB を使わない。NFR-AUTH-001。応答を作るために会員を読む）

### curl の例

- レガシー版：`curl http://127.0.0.1:8000/api/me -H 'Authorization: Bearer <JWT>'`
- 改善版：`curl http://127.0.0.1:8000/api/me -b cookies.txt`

## `POST /api/auth/logout`（ログアウト）

### だれが使えるか

- レガシー版：だれでも
- 改善版：ログインした会員

### 応答（成功）

- レガシー版：`200` `{"message": "ログアウトしました"}`
  - **サーバーは何もしない**
  - 画面でトークンを消すだけ。消さなければ、30日のあいだ使える
- 改善版：`204`
  - その端末の取り替え用のトークンを使えなくし、`access` と `refresh` の Cookie を消す（FR-AUTH-016）

### 流れる SQL の目安

- レガシー版：0本
- 改善版：1本（`update refresh_tokens set revoked_at = ?`）

## `POST /api/auth/refresh`（取り替え。改善版だけ）

- レガシー版にはない（JWT が切れたら、もう一度ログインする）
- 改善版は、`refresh` の Cookie で新しい `access` と `refresh` を渡し、古い `refresh` を使えなくする
- 使ったあとの `refresh` がもう一度来たら、その家族をすべて止めて `401`（FR-AUTH-014・015）
- 表 `refresh_tokens` は、改善する段階で DB の子 Issue として作る

## レガシー版で起きること（#16 で測り、改善する段階で要件 ID のテストにする）

- ログインの JWT を base64 で読む
  - レガシー版：**メールアドレスとニックネームが読める**（署名はあるが、暗号化はしていない）
  - 要件：FR-AUTH-013
- ログアウトしたあとに、同じ JWT で `GET /api/me`
  - レガシー版：`200`（使える）
  - 要件：FR-AUTH-016
- ないメールアドレス・違うパスワードでログイン
  - レガシー版：言葉が違うので、登録されているかが分かる
  - 返るまでの時間も違う（測った：5回の平均で 0.024秒／0.204秒。bcrypt の照合の分だけ遅い）
  - 要件：FR-AUTH-011・NFR-AUTH-002
- 違うパスワードで 20回続けてログイン
  - レガシー版：20回とも `401`（止まらない）
  - 要件：FR-AUTH-012
- `password` を送らない
  - レガシー版：`401`「パスワードが違います」（測った。設計のときは `500` と見込んでいた）
  - 要件：FR-AUTH-010
- `"password": ["password"]`（配列）
  - レガシー版：`500`（`password_verify()` の TypeError）
  - `laravel.log` のスタックトレースに、パスワードのハッシュの先頭15文字が残る
  - 要件：FR-AUTH-010・FR-AUTH-032
- `"email": ["sakura@example.test"]`（配列）
  - レガシー版：先頭の要素だけが使われ、ログインできる（入力の形を確かめない）
  - 要件：FR-AUTH-010
- 署名を書き換えた JWT・`exp` が過ぎた JWT・`abc` で `GET /api/me`
  - レガシー版：`500`（`401` にならない）
  - `exp` が過ぎたものは、#104 で API テストにしたが、#237（PR #240）で消した。その API を移すチケットで書き直す
  - プロフィールの API（`GET`・`PUT /api/users/{user_id}`）は、#243 で 401 にした。`tests/Feature/Profile/ShowTest.php`・`UpdateTest.php` で確かめている
  - 要件：FR-AUTH-013
- `500` のときの `laravel.log`
  - レガシー版：スタックトレースに `JWT::decode()` の引数として JWT が残る
  - 今は PHP の設定（`zend.exception_string_param_max_len=15`）で先頭15文字（どの JWT でも同じヘッダーの部分）だけ
  - この設定を上げると、JWT がまるごと残る
  - 鍵は `#[SensitiveParameter]` で伏せられる
  - 要件：FR-AUTH-032
- JWT の `sub` の会員がいない
  - レガシー版：`200 {}`（`User::find()` が `null`）
  - DB を作り直して ID が振り直されると、古い JWT が別の会員を指す（要確認。試していない）
  - 要件：FR-AUTH-013
- メールアドレスを確認していない会員でログイン
  - レガシー版：ログインでき、01 のプロフィールの API も使える
  - 要件：FR-AUTH-021
- `APP_KEY` を知っている人
  - レガシー版：好きな `sub` の JWT を作れる（だれにでもなりすませる。鍵を扱うので、AI は測っていない）
  - 要件：―
- `SAKURA@example.test`（#15 で別の会員になったもの）でログイン
  - レガシー版：大文字と小文字で別の会員としてログインする
  - 要件：FR-AUTH-003
- `GET /api/me` を呼ぶたびに
  - レガシー版：DB を1本読む
  - 要件：NFR-AUTH-001

## #46 で変えること（ID。状態：**実装済み（レガシー版）**。PR #47 で測った）

D-022。上は 01b で作った形のまま残し、ここに差分だけを書く。

### JWT の `sub`

- レガシー版：変えない（中の `id`）
  - 分かるのは自分の番号だけで、それで他人のページは開けない
- 改善版：同じ

### `GET /api/me` の応答

- レガシー版：`users` の行に `public_id` が足される（測った。SQL は1本のまま）
  - /home は、これを使って `PUT /api/users/{public_id}` を呼ぶ
- 改善版：`"user_id": "019a…"`（値が UUID）

### `POST /api/users` の応答

- レガシー版：`public_id` は出ない見込み
  - DB の既定の値で入るが、作ったあとに読み直さないため
  - 登録は試していない
- 改善版：`"user_id": "019a…"`（作ったあとに読み直す）

### `public_id` を入れるところ

- レガシー版：書かない。DB の既定の値（`uuidv7()`）が入れる
- 改善版：同じ

## #181 で足すこと（パスワードを変える。状態：**実装済み（レガシー版）**）

設定の画面（M1）から呼ぶ。要件は FR-AUTH-033。

### `PUT /api/me/password`

#### だれが使えるか

- レガシー版：正しい JWT を持つ人
- 改善版：正しい `access` の Cookie を持つ会員

#### 入力（JSON）

- レガシー版：`{"current_password": "…", "password": "…"}`
  - **新しいパスワードを確かめない**（1文字でも通る）
- 改善版：`current_password`（必須）・`password`（必須・8〜64文字・72バイトまで）
  - FR-AUTH-004 と同じ決まりを、登録と同じ所から使う

#### 何をするか

- レガシー版：今のパスワードを照らし合わせ、合えば新しいパスワードを bcrypt にして保存する
  - **前に配った JWT は止めない**（30日のあいだ、前のトークンで使い続けられる）
  - 試す回数の上限もない
- 改善版：今のパスワードを照らし合わせ、合えば保存する
  - 取り替え用のトークン（`refresh_tokens`）を、今の端末のもの以外すべて止める
  - 続けて間違えたら、しばらく止める（ログインと同じ仕組み）

#### 応答（成功）

- レガシー版：`200` `{"message": "パスワードを変えました"}`
- 改善版：`204`

#### 応答（失敗）

- レガシー版
  - `401`：`Authorization` がない
  - `422`：今のパスワードが違う `{"message": "今のパスワードがちがいます"}`
  - `500`：JWT が壊れている・**新しいパスワードがない**（NOT NULL の違反）
- 改善版
  - `401`
  - `422`（今のパスワードが違う・新しいパスワードの決まりに合わない）
  - `429`（続けて間違えた）

#### 流れる SQL の目安

- レガシー版：2本（会員を読む・update）
- 改善版：3本＋begin・commit（会員を読む・update・ほかの端末の取り替え用のトークンを止める）

#### curl の例

- レガシー版：`curl -X PUT http://127.0.0.1:8000/api/me/password -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' -d '{"current_password":"…","password":"…"}'`
- 改善版：`-b cookies.txt` で同じ

### レガシー版で起きること（2026-11-17 に curl で測った。測ったあと、パスワードを元に戻した）

| 入力・場面 | 結果 | 要件 ID |
| --- | --- | --- |
| 正しく変える | `200`。前のパスワードでは `401`、新しいパスワードでログインできる | FR-AUTH-033 |
| 今のパスワードが違う | `422`（要件どおり） | FR-AUTH-033 |
| **変えたあと、前のトークンで `GET /api/me`** | **`200`**（前のトークンが使えるまま。パスワードを盗まれて変えても、相手は30日のあいだ使い続けられる） | FR-AUTH-033 |
| **新しいパスワードを1文字（`a`）にする** | **`200`。1文字でログインできる**（登録の決まり 8〜64文字と違ってしまう） | FR-AUTH-004・033 |
| 新しいパスワードを送らない | `500`（NOT NULL の違反） | FR-AUTH-033 |
| 今のパスワードを何回も間違える | 何回でも `422` が返るだけ（止める仕組みがない） | FR-AUTH-033 |

### 確認のメールをもう一度送る API

- 確認のメールをもう一度送る（`POST /api/email-verifications`。FR-AUTH-007）は、前からある API を、設定の画面から呼ぶようにしただけで、変えていない
- ログインしていなくても、メールアドレスを送れば呼べる。確認済みでも送る

## #193 で変えること（M2：確認のメールのリンク先。状態：**実装済み（レガシー版）**）

API は変えていない。変えたのは、確認のメールに書くリンクだけ。

### メールのリンク

- 前：`http://127.0.0.1:8000/api/email-verifications/<確認用の文字>`（API を直接開く。JSON が出る）
- #193 から（レガシー版）：`http://localhost:5173/verify/<確認用の文字>`（画面を開く。画面が API を呼ぶ）
  - 画面の URL は、設定 `app.frontend_url`（環境変数 `FRONTEND_URL`。既定は `http://localhost:5173`）
- 改善版（refactored-repo）：同じく画面を開く
  - 確認用の文字は、ハッシュにして保存し、60分で切れ、1回しか使えない（FR-AUTH-006）

### 確認の API を呼ぶ人

- 前：メールのリンクを開いたブラウザ
- #193 から：画面（`VerifyPage.tsx`）。ログインしていなくても呼べる
- 改善版：同じ（`GET` ではなく `POST` にする）
  - メールを先読みする仕組みが、リンクを勝手に開いて確認済みにしてしまうのを防ぐ

### もう一度送る（`POST /api/email-verifications`）

- 前：呼ぶ画面がなかった
- #193 から：設定（#181）・登録が終わった画面・未確認の会員への帯、の3か所から呼ぶ
  - 送り方を、3か所にコピーした
- 改善版：ログインした本人だけが呼べる。1分に1回まで（FR-AUTH-007）

### 確かめたこと（2026-11-17）

- 登録すると、受信箱（Mailpit）に届いたメールのリンクが `http://localhost:5173/verify/<40文字>` になっている
- リンクを開くと「メールアドレスを確認しました」と出て、未確認の会員への帯が消える
- 正しくない文字では「確認のリンクが正しくありません」と出る

### 残っている、分かっている不具合

前からある。この PR では直していない。

- 確認用の文字が平文のまま URL に入る・期限がない・何度でも使える
- `GET` で状態が変わる
- もう一度送る API は、ログインしていなくても、他人のメールアドレスを送れば呼べる（登録されているかどうかも分かる）
- 登録の画面の確かめ（パスワードの長さ・18歳以上・利用規約への同意）は画面だけで、API を直接呼べば通る
- 利用規約に同意した記録は、サーバーに残らない

## #196 で足すこと（M2：パスワードを忘れたときの再設定。状態：**実装済み（レガシー版）**）

要件は FR-AUTH-034・035。表は、Laravel が最初から用意している `password_reset_tokens`（`email` が主キー・`token`・`created_at`）を使う。ログインしていない人が使う。

### `POST /api/password-resets`（メールを送る）

- レガシー版：入力 `{"email": "…"}`
  - 会員がいれば、再設定用の文字（40文字）を作って保存し、メールを送る。`200`
  - **いなければ `404`**（登録されているかが分かる）
  - **何回でも送れる**
- 改善版：いてもいなくても、同じ `202` を返す（いるときだけ送る）
  - 同じメールアドレスへは、1分に1回まで（`429`）
  - FR-AUTH-034

### `PUT /api/password-resets/{token}`（新しいパスワードを決める）

- レガシー版：入力 `{"password": "…"}`
  - 文字が合えば、その会員のパスワードを変える。`200`。合わなければ `404`
  - **期限を見ない・使ったあとも消さない**（同じリンクで、何度でも変えられる）
  - **新しいパスワードを確かめない**
  - 前に配った JWT は止めない
- 改善版：`POST /password-resets/{token}`
  - 60分で切れ、1回使ったら消す（`403`）
  - 新しいパスワードは登録と同じ決まり（`422`）
  - 取り替え用のトークンを、すべて止める
  - FR-AUTH-035

### 再設定用の文字の保存

- レガシー版：**平文のまま**（DB を読めた人は、だれのパスワードでも変えられる）
  - `token` にインデックスがない
- 改善版：SHA-256 のハッシュにして保存する（メールには平文を入れ、DB にはハッシュだけ）
  - ハッシュの列に UNIQUE

### メールのリンク

- レガシー版：`http://localhost:5173/reset-password/<再設定用の文字>`（画面を開く。`app.frontend_url`）
- 改善版：同じ

### 流れる SQL の目安

- レガシー版
  - 送る：3本（会員を読む・あるかを見る・入れるか書き換える）
  - 決める：3本（文字で探す・会員を読む・update）
- 改善版
  - 送る：2本＋ガード
  - 決める：3本＋begin・commit

### レガシー版で起きること（2026-11-17 に curl で測った。測ったあと、パスワードを元に戻し、行を消した）

| 入力・場面 | 結果 | 要件 ID |
| --- | --- | --- |
| メールを送る → 届いたリンクから、新しいパスワードを決める | `200`。前のパスワードでは `401`、新しいパスワードでログインできる | FR-AUTH-034・035 |
| **同じリンクを、もう一度使う** | **`200`。また変えられる**（消していない） | FR-AUTH-035 |
| **30日前に作ったことにして、使う** | **`200`**（期限を見ない） | FR-AUTH-035 |
| 変えたあと、前のトークンで `GET /api/me` | **`200`**（前のトークンが使えるまま） | FR-AUTH-035 |
| 新しいパスワードを1文字にする | **`200`。1文字でログインできる** | FR-AUTH-004・035 |
| 新しいパスワードを送らない | `500`（NOT NULL の違反） | FR-AUTH-035 |
| **登録のないメールアドレスを送る** | **`404`**（登録されているかが、だれにでも分かる） | FR-AUTH-034 |
| **続けて8回、同じメールアドレスに送らせる** | **8回とも `200`**（8通届く。止める仕組みがない） | FR-AUTH-034 |
| DB の `password_reset_tokens.token` | 40文字の英数字が、平文のまま入っている | FR-AUTH-035 |
