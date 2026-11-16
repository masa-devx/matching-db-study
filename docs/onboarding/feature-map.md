# 機能の地図

機能ごとに、画面・API・コントローラー・表をつなぐ。読みながら埋める（推測で埋めない。コードとルートで確かめた行だけ書く）。

- 読む表・書く表は、コードから読み取ったもの。流れる SQL（`explanations/tools/collect-sql.tinker`）での確かめは、全部の行を読み終えてからまとめて行う（済んだ行は、その印を付ける）
- 行の番号は `backend/client/app/Http/Controllers/` のファイルの行（2026-11-16 に `refactored-repo` で読んだ）

## 会員の側（`backend/client`・24本）

全体：ルートにミドルウェアはない。ログインしているかは、各コントローラーの中で JWT を読んで確かめる。業務の処理はすべてコントローラーの中にある。

| 機能 | 画面（frontend） | API（メソッドとパス） | コントローラーのメソッド | 読む表 | 書く表 | 主な処理・レガシーの臭い |
| --- | --- | --- | --- | --- | --- | --- |
| 動作の確かめ | ― | `GET /api/health` | `routes/api.php` のクロージャ | `migrations` | ― | DB の名前とマイグレーションの数を返す |
| 登録 | `RegisterPage` | `POST /api/users` | `UserController::store`（L31） | ― | `users`・`profiles` | 会員とプロフィールを作り、確認のメールを送る。入力を確かめない。トランザクションがない（メールが失敗しても行は残る）。応答に `verification_token` が出る |
| メールアドレスの確認 | なし（メールのリンクが API を直接開く） | `GET /api/email-verifications/{token}` | `EmailVerificationController::show`（L20） | `users` | `users.email_verified_at` | 確認用の文字にインデックスがなく、表を全部読む。文字を消さないので何度でも使え、期限もない |
| 確認のメールの再送 | 呼んでいる画面は見つからない | `POST /api/email-verifications` | `EmailVerificationController::store`（L35） | `users` | ―（メールを送る） | 確認済みでも、何回でも送れる。404 で、そのメールアドレスが登録されているかが分かる |
| ログイン | `LoginPage` | `POST /api/auth/login` | `AuthController::login`（L22） | `users`・`profiles`（nickname） | `users.last_login_at` | 30日の JWT を返す。鍵は `APP_KEY` の使い回し。メッセージの違いと返るまでの時間で、メールアドレスが登録されているかが分かる。止めた会員を断るのはログインだけ |
| 自分の情報 | `HomePage`・`SearchPage`・`UserPage`・`TalkPage`・`PlansPage`・`PurchasePage` | `GET /api/me` | `AuthController::me`（L56） | `users` | ― | JWT を読む処理のもと（ほかの API に写された）。壊れた JWT では 500 になる。`users` の行をそのまま返す（`verification_token` も出る） |
| ログアウト | `HomePage` | `POST /api/auth/logout` | `AuthController::logout`（L70） | ― | ― | サーバーは何もしない |
| プロフィールを見る | `HomePage`・`UserPage`・`SearchPage`・`TalkPage`・`MessagesFsPage`・`TalkFsPage` | `GET /api/users/{publicId}` | `ProfileController::show`（L20） | `users`・`profiles` | ― | ログインを確かめない（だれでも見られる）。`users` の行をそのまま返す（メールアドレス・確認用の文字も出る）。UUID の形を確かめず、違う文字は 500 |
| プロフィールを変える | `HomePage` | `PUT /api/users/{publicId}` | `ProfileController::update`（L28） | `users`（id を引く）・`profiles` | `profiles` | ログインも本人かも確かめない（だれでも他人のプロフィールを書き換えられる）。`$request->all()` をそのまま入れる。会員がいなければ null に `fill` して 500 |
| 相手を探す | `SearchPage` | `GET /api/users` | `UserController::index`（L46） | `users`・`profiles`・`likes`・`blocks` | ― | 自分の反対の性別・確認済み・退会していない・いいねしていない・ブロックしていない／されていない会員を、最終ログインの順に20人ずつ（OFFSET）。いいねとブロックの相手を PHP に持ってきて `not in` に並べる。プロフィールを1人ずつ読む（1＋N）。身長・生年月日は文字で比べる。身長の条件は男性の無料の会員には 403（`is_paid` だけを見る） |
| いいねする（マッチ・ルームも作る） | `UserPage` | `POST /api/me/likes` | `LikeController::store`（L33） | `profiles`・`users`・`likes` | `likes`・`user_matches`・`talk_rooms`・`talk_room_members`・Firestore（`rooms`・`users/{uid}/rooms`） | 男性の無料の会員は1日10回まで（数えてから入れる。ロックなし。日付は UTC）。いない会員の UUID は 500、自分にもいいねでき、2回目は UNIQUE の違反で 500。相手からのいいねがあれば、マッチ・ルーム・参加者2人・Firestore の3件を作る。トランザクションがなく、途中で失敗すると半端な行が残る（Firestore につながらないと 500 なのに、PostgreSQL の行は残る）。ブロックした相手にも送れる |
| いいねした相手の一覧 | `LikesPage` | `GET /api/me/likes` | `LikeController::index`（L105） | `blocks`・`likes`・`profiles`・`users` | ― | ブロックした・された相手を除き、新しい順に全件（ページなし）。1件ごとにプロフィール・逆向きのいいね・`public_id` を読む（1＋3N）。「マッチ済み」は `user_matches` ではなく逆向きのいいねで決める（正が2つ）。退会した相手は除かない。生年月日をそのまま返す |
| マッチした相手の一覧 | 呼んでいる画面は見つからない | `GET /api/me/matches` | `UserMatchController::index`（L26） | `blocks`・`user_matches`・`profiles`・`users` | ― | `user1_id`・`user2_id` を OR で探す（インデックスがなく表を全部読む）。全件（ページなし）。1件ごとにプロフィールと `public_id` を読む（1＋2N）。同じ組が2行あれば2回出る。ブロックは PHP で飛ばす。退会した相手は除かない |
| トークの一覧 | `MessagesPage`・`TalkPage`・`components/TabBar` | `GET /api/me/talk-rooms` | `TalkRoomController::index`（L27） | `blocks`・`talk_room_members`・`talk_rooms`・`profiles`・`users`・`messages` | ― | 自分の参加者の行を全部読み、ルームごとに6本読む（1＋6N）。`talk_room_members.user_id` と `messages.talk_room_id` にインデックスがなく、表を全部読む。相手がいないルームでは 500。未読は時刻で比べる。並べるのは PHP。ページなし。ブロックは PHP で飛ばし、退会した相手は除かない。生年月日をそのまま返す |
| トークの履歴 | `TalkPage` | `GET /api/me/talk-rooms/{publicId}/messages` | `MessageController::index`（L26） | `talk_rooms`・`messages` | `talk_room_members.last_read_at` | **参加者かを確かめない**（UUID を知っていれば、だれでも読める）。ないルームは 500。新しい50件ずつ（OFFSET）。`page=0` で 500。GET の中で既読を書く（画面は5秒ごとに呼ぶ）。`messages` の行をそのまま返す（中の連番の `id`・`sender_id` が出る） |
| メッセージを送る | `TalkPage` | `POST /api/me/talk-rooms/{publicId}/messages` | `MessageController::store`（L55） | `profiles`・`users`・`talk_rooms` | `messages` | **参加者かを確かめない**（マッチしていない人も送れる）。男性の無料の会員は 403（`is_paid` だけを見る）。本文を確かめない（空は NOT NULL の違反で 500・長さの上限なし）。ブロックした相手のルームにも送れる |
| Firebase のトークン | `firebase.ts`（`MessagesFsPage`・`TalkFsPage` が使う） | `POST /api/me/firebase-token` | `FirebaseTokenController::store`（L21） | `users` | ― | 署名のない JWT（`alg: none`）を返す。Emulator だけで通り、本物の Firebase では通らない。メールアドレスを確認していない会員も使える |
