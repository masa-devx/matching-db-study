# 用語集

業務の言葉と、画面・API・コード・表での名前の対応。言葉をそろえる正本（2026-11-16 に作った。`product.md` の「用語」から移した）。

## 名前の付け方

- **API とコードは、業務の言葉で名前を付ける。** 表の名前には合わせない（表は変えにくいので、ずれたら下の表の「注意」に書く）
- ツールの名前（Firebase など）は、API とコードの業務の名前に出さない。替えたときに名前が変わらないようにする
- 画面の言葉が業務の言葉と違うときは、下の表の「画面」に書く（画面の言葉は、利用者に分かりやすいほうを選んでよい）
- 管理画面の業務のまとまり（Dashboard・Members のような、業務ごとの分け方）の一覧は、`docs/backend.md` の 2-2 を正とする（ここには並べない）
- ルール・議事録などの文で使う言葉（今の動きを確かめるテスト・分かっている不具合 など）は、`agents/rules/writing.md` を正とする
- 会員の側のコードでは、会員を `User` と呼ぶ（表・Model・URL が `users` なので、それに合わせる。2026-11-19 に人が決めた。`Member` と混ざって、同じものか分からなくなったため）。管理画面のコードは、運営から見た呼び方の `Member` のまま。業務のまとまりの名前（`Members` のフォルダ）は、別に決める
- 新しい言葉を使うときは、先にこの表に1行足す。API の書き方の決まり（URL・JSON のキー・ID）は `agents/rules/api-design.md`（#125 で作る）

## 会員の側

| 言葉 | 意味 | 画面 | API（URL・JSON） | コード（業務のまとまり・クラス） | 表・列 | 注意 |
| --- | --- | --- | --- | --- | --- | --- |
| 会員 | 登録した人 | ― | 自分は `/me`、相手は `/users/{user_id}`。JSON は `user_id` | `Members`・`User`（下の「会員」） | `users` | 下の「会員」 |
| アカウント | 会員がログインに使う登録（下の「アカウント」） | 下の「アカウント」 | `/me`（下の「アカウント」） | `Profile`・`Account`・`User`（下の「アカウント」） | `users` | 下の「アカウント」 |
| プロフィール | 会員の公開する情報（ニックネーム・性別・生年月日・都道府県・身長・自己紹介・プロフィール画像と、#153 で足したプロフィールの6項目） | 自己紹介 など | `profile` | `Profile` | `profiles` | |
| プロフィール画像 | プロフィールに出す画像。デモ用の画像のパスを持つ | ― | `image` | ― | `profiles.image` | 前の `product.md` の `avatar_path` は、実際の列とずれていた |
| 登録 | 会員になること | 登録 | `POST /users`（名前は仮） | `Auth` | `users`・`profiles` | |
| メールアドレスの確認 | 届いたリンクを開いて、本人のメールアドレスだと確かめること | ― | `email-verification` | `Auth`・`EmailVerification` | `users.email_verified_at` | |
| ログイン・ログアウト | API を使える状態になる・やめる | ― | `/auth/login`・`/auth/logout` | `Auth`・`Session` | `users.last_login_at` | |
| トークンの取り替え | 短い期限のトークンを、取り替え用のトークンで新しくすること（D-014） | ― | `/auth/refresh` | `Auth` | ― | 作らない（D-027 でセッションにした） |
| 検索 | 条件に合う相手を探すこと | タブは「検索」、ページの見出しは「さがす」 | `GET /users` | `Members`・`MemberSearch` | `users`・`profiles` | |
| 保存した検索条件 | 会員が、検索の条件に名前を付けて取っておいたもの。1人5件まで（04b） | 条件の画面（`/search/conditions`）の「保存した検索条件」に、名前のボタンで並ぶ。保存は、画面の下の「保存」 | `search-conditions`・`search_condition_id` | `Members`・`SearchCondition` | `search_conditions` | 条件の中身は `conditions`（`jsonb`）。項目は検索の API のクエリと同じ |
| プロフィールの6項目 | 検索に使う、体型・お仕事・年収・タバコ・お酒・結婚歴。書かなくてよい（未回答）（#153） | ホームの「プロフィールを編集」・条件の画面の「プロフィール」 | `body_type`・`job`・`income`・`smoking`・`drinking`・`marital_status` | `Members`・`Profile` | `profiles` の同じ名前の列（今は文字。改善版はコードとマスタの表） | 条件を付けた項目が未回答の会員は、検索に出ない |
| こだわり条件 | 検索の有料の機能。最終ログイン・登録して間もない会員・フリーワード・登録が新しい順（#150） | 条件の画面の「こだわり条件」 | `last_login`・`new_member`・`keyword`・`sort` | `Members`・`MemberSearch` | ― | 男性の無料の会員は使えない。身長は無料 |
| 設定 | 会員が、アカウント・有料会員・安全・案内などをまとめて見る画面（M1。#181） | ホームの右上の歯車。ページの見出しは「設定」 | ―（画面だけ。パスワードを変えるのは `PUT /me/password`） | `Auth`（パスワード） | ― | ヘルプ・利用規約などの案内は `/info/<名前>`。文は学習用の見本 |
| いいね | 相手に好意を送ること。1人の相手に1回 | いいね | `likes` | `Matching`・`Like` | `likes` | |
| 届いたいいね | 相手から自分に送られたいいねのうち、まだ返事（マッチする・スキップ）をしていないもの（M3。#184） | 下のタブの「いいね」。タブに人数のバッジ | `received-likes` | `Matching`・`Like` | `likes`（`to_user_id` が自分） | 無料でも有料でも見られる。送ったいいねの一覧は、設定の「送ったいいね」 |
| マッチする | 届いたいいねに、いいねを送り返すこと。マッチになる（M3） | 「マッチする」 | `POST /me/likes`（いいねを送るのと同じ） | `Matching`・`Like` | `likes`・`user_matches` | 無料の男性の1日10回の数に入れない |
| スキップ | 届いたいいねや検索で、「この人は見送る」と決めること。相手には伝えない（M3。「お見送り」から、この名前に決めた） | 「スキップ」「スキップした相手」「元に戻す」 | `skips`・`user_id` | `Matching`・`Skip` | `skips` | スキップした相手は、届いたいいねにも検索にも出ない。ブロックと違い、相手からは自分が見える |
| 通報 | 会員が、困った相手（または相手の特定のメッセージ）を、理由を付けて運営に伝えること。相手には伝えない（M7。#202） | 「通報」「通報する」「このメッセージを通報しますか？」 | `reports`・`user_id`・`message_id`・`reason` | `Report` | `reports` | 同じ相手を何度でも通報できる。通報と一緒に、ブロックするかを選べる。結果は、通報した会員に知らせない |
| 案件（通報の案件） | 通報された会員ごとに、通報をまとめたもの。対応の状態（まだ・対応中・済み）と、何をしたか（問題なし・注意した・利用を止めた）は、案件に付ける（A7。#203） | 管理画面の「通報」の1行 | `report-cases`・`status`・`action` | `ReportCase` | `report_cases` | まだ済みでない案件は、会員に1つ。済みにしたあとの通報は、新しい案件になる |
| お知らせ（運営からのお知らせ） | 運営が、1人の会員に届ける文。種類は「注意」と「お知らせ」。読んだかどうかが、運営から分かる（A7。#213） | 「運営からのお知らせ」。未読があると、どの画面にも帯。ホームのベル | `notices`・`kind`（`warning`・`info`）・`read_at` | `Notice` | `notices` | 全員に送るお知らせは、まだない。会員は、返事を書けない |
| 強制退会 | 運営が、会員を、戻せない形で使えなくすること。自分での退会（退会）と違い、同じメールアドレスで登録し直せない（A7。#213） | 管理画面の「強制退会にする」。会員のログインでは「強制退会になっています」 | `ban`・`banned_at`・`banned_reason` | ―（`users` の列） | `users` | 利用の停止（戻せる）とは別。`deleted_at` も書くので、ほかの会員からは、退会した会員と同じに見える |
| 停止の履歴 | 会員の利用を止めた・解いた記録（だれが・いつ・理由）。解いても消えない（A1。#211） | 管理画面の会員の詳細の「停止の履歴」 | `suspensions` | ― | `suspensions` | 今の状態は `users.suspended_at` にも持つ（レガシー版は、2か所） |
| 対応のメモ | サポートが、会員ごとに残す、問い合わせと答え・気づいたこと。会員には見せない（A1。#216） | 管理画面の会員の詳細の「対応のメモ」 | `notes`・`body` | ― | `member_notes` | 通報の案件のメモ（案件ごと）とは別。直す・消す仕組みは、まだない |
| 有料の区分 | 管理画面で、会員を有料かどうかで4つに分けたもの（下の「有料の区分」） | 管理画面の会員の一覧・検索窓・詳細・ダッシュボードの印 | `plan`（絞り込み）・`paid_state`（行） | ―（レガシー版は、4か所に決め方がある） | `users.is_paid`・`users.paid_until` | 下の「有料の区分」 |
| 新しいマッチ | マッチしたばかりで、まだ一度も開いていなくて、まだ1通もないトークルームの相手（M3。#187） | メッセージのタブの上の「新しいマッチ」。タブのバッジにも数える | `last_read_at`（トークの一覧の応答） | `Messaging`・`TalkRoom` | `talk_room_members.last_read_at` が NULL で、`messages` に行がない | 今は、画面が判断している（改善版では API が返す） |
| 既読 | 相手がトーク画面を開いて、自分のメッセージを読んだこと。有料の機能（男性の無料の会員には分からない。M6。#190） | 自分の吹き出しの下の「既読」 | `partner_last_read_at`（トークの一覧の応答） | `Messaging`・`TalkRoom` | 相手の `talk_room_members.last_read_at` | 今は、画面が判断している。API は、無料の会員にも日時を返してしまう（改善版で直す） |
| マッチ | お互いにいいねした状態 | ― | `matches`・`match_id` | `Matching`・`UserMatch` | `user_matches` | `match` は PHP の予約語なので、クラスは `UserMatch` |
| ブロック | 相手を自分から見えなくし、相手からも見えなくすること | ― | `blocks` | `Matching`・`Block` | `blocks` | |
| 退会 | 会員をやめること | 退会 | `DELETE /me` | `Profile`・`AccountService::withdraw`（上の「アカウント」の行） | `users.deleted_at` | |
| トークルーム | マッチした2人が話す部屋。マッチしたときに作る | 「メッセージ」（タブ・一覧のページ） | `talk-rooms`・`room_id` | `Messaging`・`TalkRoom` | `talk_rooms`・`talk_room_members` | 画面は部屋の一覧も「メッセージ」と呼ぶ |
| メッセージ | トークルームで送る文 | メッセージ | `messages` | `Messaging`・`Message` | `messages` | |
| 既読・未読 | 相手のメッセージを読んだか | ― | `read`・`unread_count` | `Messaging` | `talk_room_members.last_read_at` | |
| リアルタイムのトークン | 画面がメッセージをすぐ受け取る仕組み（今は Firestore）にログインするためのトークン | ― | `realtime-token`（名前は仮） | `Messaging` | ― | 今の URL は `/api/me/firebase-token` |
| プラン | 有料会員の期間と値段 | プラン | `plans` | `Billing`・`Plan` | `plans` | |
| 購入 | プランを買うこと | 購入 | `purchases` | `Billing`・`Purchase` | `purchases` | |
| 有料会員 | 料金を払っている会員 | ― | 改善版は「できること」で返す（`entitlements`。決め方は API を移すチケットで） | `Billing` | `users.is_paid` | レガシー版の真偽値。プランを増やすとき（07b）に直す |


### 会員

- 意味：登録した人
- API：自分は `/me`、相手は `/users/{user_id}`。JSON は `user_id`
- コード：
  - 業務のまとまりは `Members`
  - クラスは `User`（`UserNotFoundException`・`AuthenticateUser`・テストの `DummyUser`）
- 表・列：`users`
- 注意：
  - 会員の側の API は `users`、管理画面は `members`（下の「管理画面」）
  - 会員の側のコードは `User`、管理画面のコードは `Member`

### アカウント

- 意味：会員がログインに使う登録（`users` の行。だれのものでも）
  - URL の `/me` とコードの `Account` は、そのうち、ログインしている本人のアカウントを指す
  - 本人の情報（メールアドレス・確認済みか・有料会員か）
  - 本人がすること（見る・プロフィールを直す・退会する）
- 画面：―。設定の「アカウント」の見出しの下は、メールアドレスの確認とパスワードだけで、これより狭い。パスワードは `Auth`
- API：`/me`。URL は変えない。`/me` を付けるかの基準は、`docs/cycles/01-backend-foundation/03-how.md` の「`/me` を付けるか」
- コード：
  - 業務のまとまりは `Profile`
  - `Account` は、ログインしている本人に対する操作の名前（Controller・Service・テスト・ルートの名前）に使う
    - `AccountController`・`AccountService`（どちらも、その API を移すときに作る）
    - テストの `Endpoints::account()`・`tests/Feature/Profile/ShowAccountTest.php`
    - 今の URL のルートの名前 `legacy.profile.account.show`
  - データ（Model・例外・ダミーデータ）は `User` のまま（`User`・`UserNotFoundException`・`DummyUser`）
- 表・列：`users`
- 注意：
  - コードの `Account〜Controller`・`AccountService` は、そのうち「ログインしている本人に対する操作」に使う
  - 「アカウントが使える状態か」（`isAccountUsable`）は、どの会員の行にも使う（退会・停止・強制退会のどれでもない）。判定は、業務のまとまり `Auth` に置く（`AuthService`）
  - URL の `/me` と、コードの `Account` は同じもの
  - コードの名前には、`me`・`Me` を使わない（何を指すかが分かりにくいため。2026-11-20 に人が決めた）
  - 管理画面も同じ（管理者本人の名前は、管理画面のログインを移すチケットで決める）
  - 今あるコードの `me()`・`$me` は、その API を移すチケットで直す

### 有料の区分

- 意味：管理画面で、会員を、有料かどうかで4つに分けたもの（A1。#224）
  - 無料
  - 有料（期限の中）
  - もうすぐ切れる（あと7日以内）
  - 期限が過ぎた（有料の印が付いたままで、期限が過ぎている）
- 注意：
  - 会員の側は、`is_paid` だけで有料と決める所があり、期限が過ぎても有料の機能が使える（FR-PAID-005）
  - 管理画面は、期限も見る

## 管理画面

| 言葉 | 意味 | 画面 | API（URL・JSON） | コード（業務のまとまり・クラス） | 表・列 | 注意 |
| --- | --- | --- | --- | --- | --- | --- |
| 管理者 | 管理画面を使う運営の人 | ― | `/me`（管理画面の API。コードの名前に `Me` を使わない。名前は、管理画面のログインを移すチケットで決める） | `Admins`・`Admin` | `admins` | |
| 会員 | 運営から見た会員 | ― | `members`・`member_id` | `Members` | `users` | 会員の側の API の `users` と同じ人。運営から見るときは `members` と呼ぶ |
| アカウント停止 | 運営が、会員のアカウントを、いったん使えなくすること。解けば元に戻る（強制退会は戻せない）。「止めた会員」とは書かない | ― | `suspension` | `Members`・`MemberSuspension` | `users.suspended_at` | |
| 監査ログ | 管理者がだれの何を見た・変えたかの記録 | ― | `audit-logs` | `AuditLogs`・`AuditLog` | `admin_audit_logs` | |
| 売上 | 購入の合計 | ― | `sales` | `Sales` | `purchases` | |
| ダッシュボード | 会員・マッチ・メッセージ・売上の数とグラフ | ダッシュボード | `dashboard` | `Dashboard` | `users`・`user_matches`・`messages`・`purchases` | |
| メッセージ（管理画面） | 運営から見た、すべてのメッセージ | メッセージ | `messages` | `Messages` | `messages` | 会員の側の `Messaging` とは別のまとまり |
| プランの値段の変更 | 運営がプランの値段を変えること | 有料会員・売上 | `plans`・`plan_id` | `Plans`・`PlanPrice` | `plans.price` | 今の URL は連番の id（`PUT /api/plans/{id}`）。新しい URL では `plan_id`（UUID） |

## ID の名前

URL のパスの引数（`{<名詞>_id}`）と JSON のキーに使う名前。ここを正とする（`docs/cycles/01-backend-foundation/03-how.md` の「パスの引数と PATCH」）。中身は UUID（その表の `public_id`。まだない表は、そのリソースを移すチケットで足す）。新しいリソースを足すときは、先にここへ1行足す。

| もの | ID の名前 | 中身 | 注意 |
| --- | --- | --- | --- |
| 会員（会員の側） | `user_id` | `users.public_id` | |
| 会員（管理画面） | `member_id` | `users.public_id` | 同じ人。運営から見るときの呼び方 |
| トークルーム | `room_id` | `talk_rooms.public_id` | リソースの名前は `talk-rooms` だが、ID は短く `room_id`（今の画面と応答が使っている名前） |
| マッチ | `match_id` | `user_matches` の ID（まだ `public_id` がない。足すのはマッチを移すチケット） | |
| プラン | `plan_id` | `plans` の ID（まだ `public_id` がない。足すのはプランを移すチケット） | 今の URL は連番の id |
| 監査ログ | `audit_log_id` | `admin_audit_logs` の ID（まだ `public_id` がない。1件を指す API を足すときに足す） | 1件を指す API は、まだない |
| 保存した検索条件 | `search_condition_id` | `search_conditions.public_id` | 今の URL のルートでは `{publicId}` |

### コードの中の、会員の番号の名前

会員は、番号を2つ持つ：`users.id`（DB の中の番号。外に出さない）と `users.public_id`（UUID。URL・JSON に出す）。PHP の中では、名前に「だれの」と「どちらの番号か」を入れる（2026-11-19 に人が決めた。`user_id` だけでは、表の列（中身は `users.id`）か URL（中身は UUID）かが分からず、読み違えたため）。

| 名前 | 中身 | 使う所 |
| --- | --- | --- |
| `$targetPublicId` | URL で指した会員の `users.public_id` | Controller と Service の引数 |
| `$targetId` | URL で指した会員の `users.id` | Service の中 |
| `login_user_id` | ログインしている人の `users.id` | Middleware が `$request->attributes` に載せるキー |
| `$loginUserId` | 同じ。`login_user_id` から取り出した値 | Controller（HTTP の側） |
| `$viewerId` | その操作で見る人の `users.id`。Controller から `$loginUserId` を受け取る | Service の引数（業務の側。Service は HTTP を知らないので、「ログイン」ではなく操作の中の役で呼ぶ。コマンドから呼ぶときも同じ名前で通じる） |

- 表の列の `user_id`（`profiles.user_id`・`talk_room_members.user_id` など）の中身は `users.id`。URL・JSON の `user_id`（中身は UUID）とは別

