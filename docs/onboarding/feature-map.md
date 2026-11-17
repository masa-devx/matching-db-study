# 機能の地図

機能ごとに、画面・API・コントローラー・表をつなぐ。読みながら埋める（推測で埋めない。コードとルートで確かめた行だけ書く）。

- 読む表・書く表は、コードから読み取り、2026-11-16 に流れる SQL で確かめた（2026-11-16 にあった 38本すべて）。2026-11-17 に 04b（保存した検索条件）の4本が増えて 42本になった。この4本は、curl で実際に呼んで確かめた（`docs/api/04b-saved-searches.md` の「レガシー版で起きること」）。書き込みの API も、トランザクションの中で本当に流してから取り消した（メールと Firestore は偽物に差し替えた）。確かめた結果と SQL の本数は、末尾の「SQL で確かめた結果」
- 行の番号は、会員の側は `backend/client/app/Http/Controllers/` のファイルの行（2026-11-16 に `refactored-repo` で読んだ）。移すとずれるので、テストの材料に使うときはメソッドの名前を正にする
- **形の違う ID（`abc` など。UUID でない文字）は、どの API でも 500** になる。`public_id` は uuid の列なので、比べると PostgreSQL がエラー（22P02）を返す。下の表で「いない会員は 500」「いない相手でも 204」と書いたのは、形の正しい UUID のとき
- 要件 ID と、返る状態コードの一覧は、ここには書かない。その API を移すチケットで、その API の分だけ書く（PR #132 のレビュー S14）

## 会員の側（`backend/client`・28本）

全体：ルートにミドルウェアはない。ログインしているかは、各コントローラーの中で JWT を読んで確かめる。業務の処理はすべてコントローラーの中にある。

| 機能 | 画面（frontend） | API（メソッドとパス） | コントローラーのメソッド | 読む表 | 書く表 | 主な処理・レガシーの臭い |
| --- | --- | --- | --- | --- | --- | --- |
| 動作の確かめ | ― | `GET /api/health` | `routes/api.php` のクロージャ | `migrations` | ― | DB の名前とマイグレーションの数を返す |
| 登録 | `RegisterPage` | `POST /api/users` | `UserController::store`（L31） | ― | `users`・`profiles` | 会員とプロフィールを作り、確認のメールを送る。入力を確かめない。トランザクションがない（メールが失敗しても行は残る）。応答に `verification_token` が出る |
| メールアドレスの確認 | なし（メールのリンクが API を直接開く） | `GET /api/email-verifications/{token}` | `EmailVerificationController::show`（L20） | `users` | `users.email_verified_at` | 確認用の文字にインデックスがなく、表を全部読む。文字を消さないので何度でも使え、期限もない |
| 確認のメールの再送 | 呼んでいる画面は見つからない | `POST /api/email-verifications` | `EmailVerificationController::store`（L35） | `users` | ―（メールを送る） | 確認済みでも、何回でも送れる。404 で、そのメールアドレスが登録されているかが分かる |
| ログイン | `LoginPage` | `POST /api/auth/login` | `AuthController::login`（L22） | `users`・`profiles`（nickname） | `users.last_login_at` | 30日の JWT を返す。鍵は `APP_KEY` の使い回し。メッセージの違いと返るまでの時間で、メールアドレスが登録されているかが分かる。止めた会員を断るのはログインだけ |
| 自分の情報 | `HomePage`・`SearchConditionsPage`・`UserPage`・`TalkPage`・`PlansPage`・`PurchasePage` | `GET /api/me` | `AuthController::me`（L56） | `users` | ― | JWT を読む処理のもと（ほかの API にコピーされた）。壊れた JWT では 500 になる。`users` の行をそのまま返す（`verification_token` も出る） |
| ログアウト | `HomePage` | `POST /api/auth/logout` | `AuthController::logout`（L70） | ― | ― | サーバーは何もしない |
| プロフィールを見る | `HomePage`・`UserPage`・`SearchConditionsPage`・`TalkPage`・`MessagesFsPage`・`TalkFsPage` | `GET /api/users/{publicId}` | `ProfileController::show`（L20） | `users`・`profiles` | ― | ログインを確かめない（だれでも見られる）。`users` の行をそのまま返す（メールアドレス・確認用の文字も出る）。UUID の形を確かめず、違う文字は 500 |
| プロフィールを変える | `HomePage` | `PUT /api/users/{publicId}` | `ProfileController::update`（L28） | `users`（id を引く）・`profiles` | `profiles` | ログインも本人かも確かめない（だれでも他人のプロフィールを書き換えられる）。`$request->all()` をそのまま入れ、`Profile` は `$guarded = []` なので、送った項目がすべて入る。そのため、プロフィールの持ち主（`user_id`）を付け替えられ、性別も変えられる（性別で分けている決まり（購入は男性だけ・無料の男性への制限）を自分で外せる）。会員がいなければ null に `fill` して 500 |
| 相手を探す | `SearchPage` | `GET /api/users` | `UserController::index`（L46） | `users`・`profiles`・`likes`・`blocks` | ― | 自分の反対の性別・確認済み・退会していない・いいねしていない・ブロックしていない／されていない会員を、最終ログインの順に20人ずつ（OFFSET）。いいねとブロックの相手を PHP に持ってきて `not in` に並べる。プロフィールを1人ずつ読む（1＋N）。身長・生年月日は文字で比べる。身長の条件は男性の無料の会員には 403（`is_paid` だけを見る） |
| いいねする（マッチ・ルームも作る） | `UserPage` | `POST /api/me/likes` | `LikeController::store`（L33） | `profiles`・`users`・`likes`・`talk_rooms`（作ったルームを読み直す） | `likes`・`user_matches`・`talk_rooms`・`talk_room_members`・Firestore（`rooms`・`users/{uid}/rooms`） | 男性の無料の会員は1日10回まで（数えてから入れる。ロックなし。日付は UTC）。いない会員の UUID は 500、自分にもいいねでき、2回目は UNIQUE の違反で 500。相手からのいいねがあれば、マッチ・ルーム・参加者2人・Firestore の3件を作る。トランザクションがなく、途中で失敗すると半端な行が残る（Firestore につながらないと 500 なのに、PostgreSQL の行は残る）。ブロックした相手にも、ブロックされた相手にも送れる（`blocks` を読まない）。**自分にいいねすると、今入れた行が逆向きのいいねとして見つかり、自分とのマッチ・参加者が自分2人のルームができる**（Firestore では同じ受信箱に2回書くので、2回目で失敗して 500 になる見込み。Emulator では確かめていない） |
| いいねした相手の一覧 | `LikesPage` | `GET /api/me/likes` | `LikeController::index`（L105） | `blocks`・`likes`・`profiles`・`users` | ― | ブロックした・された相手を除き、新しい順に全件（ページなし）。1件ごとにプロフィール・逆向きのいいね・`public_id` を読む（1＋3N）。「マッチ済み」は `user_matches` ではなく逆向きのいいねで決める（正が2つ）。退会した相手は除かない。生年月日をそのまま返す |
| マッチした相手の一覧 | 呼んでいる画面は見つからない | `GET /api/me/matches` | `UserMatchController::index`（L26） | `blocks`・`user_matches`・`profiles`・`users` | ― | `user1_id`・`user2_id` を OR で探す（インデックスがなく表を全部読む）。全件（ページなし）。1件ごとにプロフィールと `public_id` を読む（1＋2N）。同じ組が2行あれば2回出る。ブロックは PHP で飛ばす。退会した相手は除かない |
| トークの一覧 | `MessagesPage`・`TalkPage`・`components/TabBar` | `GET /api/me/talk-rooms` | `TalkRoomController::index`（L27） | `blocks`・`talk_room_members`・`talk_rooms`・`profiles`・`users`・`messages` | ― | 自分の参加者の行を全部読み、ルームごとに6本読む（1＋6N）。`talk_room_members.user_id` と `messages.talk_room_id` にインデックスがなく、表を全部読む。相手がいないルームでは 500。未読は時刻で比べる。並べるのは PHP。ページなし。ブロックは PHP で飛ばし、退会した相手は除かない。生年月日をそのまま返す |
| トークの履歴 | `TalkPage` | `GET /api/me/talk-rooms/{publicId}/messages` | `MessageController::index`（L26） | `talk_rooms`・`messages` | `talk_room_members.last_read_at` | **参加者かを確かめない**（UUID を知っていれば、だれでも読める）。ないルームは 500。新しい50件ずつ（OFFSET）。`page` を確かめない（0・負の数・文字は、Laravel の `offset()` が0に丸めるので1ページ目になる。コードのコメントの「`page=0` で 500」は誤り）。GET の中で既読を書く（画面は5秒ごとに呼ぶ）。`messages` の行をそのまま返す（中の連番の `id`・`sender_id` が出る） |
| メッセージを送る | `TalkPage` | `POST /api/me/talk-rooms/{publicId}/messages` | `MessageController::store`（L55） | `profiles`・`users`・`talk_rooms` | `messages` | **参加者かを確かめない**（マッチしていない人も送れる）。男性の無料の会員は 403（`is_paid` だけを見る）。本文を確かめない（空は NOT NULL の違反で 500・長さの上限なし）。ないルームは `$room->id` を読んで 500。ブロックした相手のルームにも送れる |
| Firebase のトークン | `firebase.ts`（`MessagesFsPage`・`TalkFsPage` が使う） | `POST /api/me/firebase-token` | `FirebaseTokenController::store`（L21） | `users` | ― | 署名のない JWT（`alg: none`）を返す。Emulator だけで通り、本物の Firebase では通らない。メールアドレスを確認していない会員も使える |
| ブロックする | `UserPage`・`TalkPage` | `POST /api/me/blocks` | `BlockController::store`（L24） | `users` | `blocks` | いない会員の UUID は 500。自分もブロックでき、2回目は UNIQUE の違反で 500。退会したかは見ない。`blocks` の行をそのまま返す（中の連番の `id` が出る） |
| ブロックした相手の一覧 | `BlocksPage` | `GET /api/me/blocks` | `BlockController::index`（L43） | `blocks`・`profiles`・`users` | ― | 新しい順に全件（ページなし）。1件ごとにプロフィールと `public_id` を読む（1＋2N）。退会した相手もそのまま出る |
| ブロックを解く | `BlocksPage` | `DELETE /api/me/blocks/{publicId}` | `BlockController::destroy`（L70） | `users` | `blocks` | 自分がした分だけを消す。消すものがなくても（いない相手・ブロックしていない相手）204 |
| 退会 | `HomePage` | `DELETE /api/me` | `UserController::destroy`（L121） | `users` | `users.email`・`users.deleted_at` | パスワードを確かめ、メールアドレスを書き換えて空ける（元のメールアドレスは残らない。元が長いと 255文字を超えて 500）。持っていた JWT は止めない（30日のあいだ使える） |
| プランの一覧 | `PlansPage`・`PurchasePage` | `GET /api/plans` | `PlanController::index`（L21） | `profiles`・`plans` | ― | 男性だけ（女性は 403）。性別はプロフィールの今の値で決める（編集で書き換えられる）。`plans` の行をそのまま返す |
| 購入する | `PurchasePage` | `POST /api/me/purchases` | `PurchaseController::store`（L24） | `profiles`・`plans`・`users` | `purchases`・`users.is_paid`・`users.paid_until` | **お金**。決済はせず、押したらすぐ有料。男性だけ。ないプランは 500。トランザクションがない（購入の記録と有料の状態がずれうる）。記録はプランを指すだけで、買ったときの値段を残さない。期限が過ぎていても古い期限から足す。`addMonths()` で月末があふれる |
| 購入の記録 | `PlansPage` | `GET /api/me/purchases` | `PurchaseController::index`（L55） | `profiles`・`purchases`・`plans` | ― | 男性だけ。全件（ページなし）。1件ごとにプランを読む（1＋N）。値段と期間は「今の」プランのもの（管理画面で値段を変えると、前の記録の値段も変わる） |
| 保存した検索条件の一覧 | `SearchConditionsPage` | `GET /api/me/search-conditions` | `SearchConditionController::index`（L27） | `search_conditions` | ― | 04b。自分の分を保存した順に。`user_id` にインデックスがなく、表を全部読む。行をそのまま返す（中の `id`・`user_id` も出る）。「使えるか」は返さず、画面が有料かどうかをもう一度判断する |
| 検索条件を保存する | `SearchConditionsPage` | `POST /api/me/search-conditions` | `SearchConditionController::store`（L43） | `search_conditions`・（身長があれば）`profiles`・`users` | `search_conditions` | 04b。1人5件まで。**数えてから入れるだけ**（ロックもトランザクションもない。同時に10本送ると 11件になった）。条件も名前も確かめない（年齢 17・配列・文字だけも入る。名前なしは 500）。有料かどうかの確かめは検索からコピー（`is_paid` だけ。期限切れの会員が身長を保存できる） |
| 保存した検索条件を直す | `SearchConditionsPage` | `PUT /api/me/search-conditions/{publicId}` | `SearchConditionController::update`（L81） | `search_conditions` | `search_conditions` | 04b。**安全の穴**：持ち主を確かめない（他人の条件を直せる）。送られた項目を全部入れるので、`user_id` を送ると他人の条件を自分のものにできる。有料かどうかの確かめがない（無料の男性が身長を足せる）。ない ID は 500 |
| 保存した検索条件を消す | `SearchConditionsPage` | `DELETE /api/me/search-conditions/{publicId}` | `SearchConditionController::destroy`（L99） | ― | `search_conditions` | 04b。**安全の穴**：持ち主を確かめない（他人の条件を消せる）。ない ID でも 204 |

## 管理画面（`backend/admin`・14本）

全体：会員の側と同じく、ルートにミドルウェアはなく、各コントローラーの中で管理者の JWT を読む。表は `DB::table()` で直接読む（Model を使わない・会員の側のコードを読み込まない）。画面は `frontend/admin/src/`。行の番号は `backend/admin/app/Http/Controllers/` のファイルの行。

| 機能 | 画面（frontend/admin） | API（メソッドとパス） | コントローラーのメソッド | 読む表 | 書く表 | 主な処理・レガシーの臭い |
| --- | --- | --- | --- | --- | --- | --- |
| 動作の確かめ | ― | `GET /api/health` | `routes/api.php` のクロージャ | `migrations` | ― | アプリの名前（`admin`）・DB の名前・マイグレーションの数を返す |
| ログイン | `LoginPage` | `POST /api/auth/login` | `AuthController::login`（L21） | `admins` | `admins.last_login_at` | 8時間の JWT に役割を入れる（役割を変えても期限まで前の役割のまま）。止める仕組みはない。何回でも試せる |
| 自分 | 呼んでいる画面は見つからない | `GET /api/me` | `AuthController::me`（L40） | `admins` | ― | JWT を読む処理のもと（ほかの API にコピーされた）。壊れた JWT・会員の JWT は 500 |
| ダッシュボード | `domains/dashboard/DashboardPage` | `GET /api/dashboard` | `DashboardController::index`（L20） | `users`・`user_matches`・`messages`・`purchases`・`plans` | ― | 開くたびに全部を数える。日ごとの数は 30日 × 3種類を1本ずつ（数のカード6本・日ごと90本・月ごと1本で、97本）。`whereDate` で索引が使えない。日付は UTC。有料会員は `is_paid` だけで数える（期限が過ぎた人も入る）。売上は今のプランの値段で足す |
| 会員の一覧 | `domains/members/MembersPage` | `GET /api/members` | `MemberController::index`（L20） | `users`・`profiles`・`purchases` | ― | メールアドレスかニックネームの部分一致（前にも `%` が付き、索引が使えない）。50人ずつ（OFFSET）・毎回の件数・1人ごとに2本（2＋2N）。**`users` の行をそのまま返す（パスワードのハッシュ・確認用の文字も出る）** |
| 会員の詳細 | `domains/members/MemberDetailPage` | `GET /api/members/{publicId}` | `MemberController::show`（L63） | `users`・`purchases`・`plans`・`profiles`・`likes`・`user_matches`・`blocks` | `admin_audit_logs` | 見たことを監査ログに書く（`member.view`）。購入の値段は今のプランのもの（1件ごとに1本） |
| 停止する | `domains/members/MemberDetailPage` | `POST /api/members/{publicId}/suspension` | `SuspensionController::store`（L20） | `admins`・`users` | `users.suspended_at`・`suspended_reason`・`admin_audit_logs` | owner だけ。理由を確かめない。トランザクションがない（停止と監査ログがずれうる）。断るのは会員の側のログインだけ（持っている JWT は使える） |
| 停止を解く | `domains/members/MemberDetailPage` | `DELETE /api/members/{publicId}/suspension` | `SuspensionController::destroy`（L57） | ― | `users.suspended_at`・`suspended_reason` | **役割の確かめと監査ログをコピーし忘れている**（止めるほうのコードをコピーして作った）（見るだけの人でも解け、記録も残らない）。いない会員でも 204 |
| メッセージの一覧 | `domains/messages/MessagesPage` | `GET /api/messages` | `MessageController::index`（L19） | `messages`・`users`・`profiles`・`talk_rooms`・`talk_room_members` | ― | 10万件を並べ替えて OFFSET で50件・毎回の件数・1件ごとに6本（2＋6N）。本文の部分一致。**本文を見られるのに、監査ログを書き忘れている**。中の連番の `id` を返す |
| 購入の一覧 | `domains/sales/SalesPage` | `GET /api/purchases` | `SalesController::purchases`（L19） | `purchases`・`plans`・`users`・`profiles` | ― | 50件ずつ・1件ごとに3本（2＋3N）。値段は今のプランのもの |
| 月ごとの売上 | `domains/sales/SalesPage` | `GET /api/sales/monthly` | `SalesController::monthly`（L47） | `purchases`・`plans` | ― | 今のプランの値段で足す（値段を変えると、過去の月の売上も変わる）。全期間 |
| プランの一覧 | `domains/sales/SalesPage` | `GET /api/plans` | `PlanController::index`（L19） | `plans` | ― | `plans` の行をそのまま返す |
| 値段を変える | `domains/sales/SalesPage` | `PUT /api/plans/{id}` | `PlanController::update`（L31） | `admins`・`plans` | `plans.price`・`admin_audit_logs` | **お金**。owner だけ。値段を確かめない（0 や負の数も入る）。ないプランでも監査ログを書く。中の連番の id を URL に使う（ほかは `public_id`）。トランザクションがない |
| 監査ログの一覧 | `domains/audit-logs/AuditLogsPage` | `GET /api/audit-logs` | `AuditLogController::index`（L19） | `admin_audit_logs`・`admins` | ― | **API の設計（`docs/api/12-admin.md`）では owner だけだが、役割の確かめをコピーし忘れている**（見るだけの人も見られる。要件 `docs/requirements/admin.md` には書いていない）。50件ずつ・1件ごとに管理者の名前を読む（2＋N） |

## SQL で確かめた結果（2026-11-16）

`docker compose exec -T app php artisan tinker`（管理画面は `admin-app`）で、ルートを通して1本ずつ呼び、流れた SQL を数えた。会員は `search00001`（男性・無料。マッチ・ルームが多い）。プランと購入は有料の男性、メッセージを送るのは女性の会員で流した。

- 地図の「読む表・書く表」と違ったのは2か所：いいね（マッチする）が `talk_rooms` を読む（上の表に足した）・購入で `users.is_paid` はもう `true` の会員だと書き換わらない（変わった列だけを書くため）
- 実際に流して、問題をそのまま確かめられたもの：見るだけの管理者でも停止を解ける（204・監査ログなし）／見るだけの管理者でも監査ログを見られる（200）／男性の無料の会員はメッセージを送れない（403）

| API | 状態 | SQL の本数 | 本数が増える理由 |
| --- | --- | --- | --- |
| `GET /api/users`（検索） | 200 | 25 | 前に4本（自分のプロフィール・いいね・ブロック2本）＋会員の一覧1本＋1人ずつプロフィール（N=20）。4＋(1＋N) |
| `POST /api/me/likes`（マッチしない・する） | 201 | 6・12 | マッチすると、マッチ・ルーム・参加者2人を足す |
| `GET /api/me/likes` | 200 | 270 | 前に3本（ブロック2本・いいね）＋1件ごとに3本（N=89）。3＋3N |
| `GET /api/me/matches` | 200 | 181 | 前に3本（ブロック2本・マッチ）＋1件ごとに2本（N=89。ブロックした相手のマッチは飛ばす）。3＋2N |
| `GET /api/me/talk-rooms` | 200 | 559 | 前に3本＋ルームごとに2本（100）＋ブロックしていないルームごとに4本（89）。3＋2×100＋4×89 |
| `GET /api/me/blocks` | 200 | 55 | 前に1本＋1件ごとに2本（N=27）。1＋2N |
| `GET /api/me/purchases` | 200 | 12 | 前に2本（自分のプロフィール・購入）＋1件ごとにプラン1本（N=10。有料の男性で測った）。2＋N |
| 管理画面 `GET /api/dashboard` | 200 | 97 | 数のカード6本＋日ごとの数（30日 × 3種類＝90本）＋月ごとの売上1本。6＋90＋1 |
| 管理画面 `GET /api/members` | 200 | 102 | 1人ごとに2本（2＋2N） |
| 管理画面 `GET /api/messages` | 200 | 302 | 1件ごとに6本（2＋6N） |
| 管理画面 `GET /api/purchases` | 200 | 152 | 1件ごとに3本（2＋3N） |

ほかの API は1〜9本。

- 本数は、ログインの確かめ（JWT を読むだけで、SQL は流れない）を含む。購入の無料・有料のように、会員の条件で本数が変わる API がある（いいねは、無料の男性だと今日の数を数える1本が増える）
- テストでは、開発用のデータの本数をそのまま期待値にするのではなく、N=1 と N=3 で本数を比べて「N で増えないか」を確かめる（テスト用の DB には開発用のデータを入れないため）
