# バックエンドの地図（改訂版）

会員の側（`backend/client`）と管理画面（`backend/admin`）の、全体の地図。エンジニアリーダーとメンバーのエンジニアが、どこに何があり、どこへ移していくかを掴むために読む。

- 状態：第2版（2026-11-18。#236 で、4層から Controller → Service → Model に変えた）。今のコードはレガシー版のまま（Fat Controller）。下の形へは、画面・機能ごとに少しずつ移す
- **層・依存の向き・ディレクトリ・名前・書き方（サンプルコード）・エラー・トランザクション・アーキテクチャのテストの決まりは [agents/rules/architecture-backend.md](../agents/rules/architecture-backend.md) を正とする**。ここには書かない
- なぜこの形にしたか：[decisions.md](decisions.md) の D-025・[cycles/01-backend-foundation/05-problems.md](cycles/01-backend-foundation/05-problems.md) の #236・最初の形を決めた経緯は [cycles/01-backend-foundation/03-how.md](cycles/01-backend-foundation/03-how.md)。比べたほかの形：[architecture-styles.html](../explanations/architecture-styles.html)・[modular-monolith.html](../explanations/modular-monolith.html)

## 1. 形（ひとこと）

**Controller → Service → Model**（2026-11-18 に人が決めた。#236・D-025）。会員の側と管理画面で、同じ形にする。Controller は受け取って返すだけ、業務のロジックと手順は Service、DB とのやり取り（検索・一覧のクエリの組み立てを含む）は Model。決まりと書き方は [architecture-backend.md](../agents/rules/architecture-backend.md)。

```text
画面（frontend/client）──→ 会員の側の API（backend/client）──┐
                                                         ├──→ PostgreSQL（matching_dev）
画面（frontend/admin） ──→ 管理画面の API（backend/admin） ──┘
                           会員の側 ──→ Firestore（Emulator）
表の作り（マイグレーション）は backend/client にまとめる
```

## 2. 業務のまとまり

業務のまとまりは、Auth・Members のような、業務ごとの分け方。Controller・Request・Resource・Service・例外は、このまとまりのフォルダで分け、名前をそろえる。Model は `app/Models/` の直下のまま。外のサービスの呼び出しは `app/Clients/<相手>/`（`Firestore`・`Mail`）。

### 2-1. 会員の側

| まとまり | 中身 |
| --- | --- |
| `Auth` | 新規登録・ログイン・ログアウト・メールの確認・パスワード |
| `Profile` | 自分のアカウント・相手のプロフィール |
| `Members` | 会員の検索・保存した検索条件・通報・お知らせ |
| `Matching` | いいね・届いたいいね・スキップ・マッチ・ブロック |
| `Messaging` | トークルーム・メッセージ・Firestore のトークン |
| `Billing` | プラン・購入 |

`Profile` について：

- 自分のアカウントは、URL が `/me`。自分の情報を見る・プロフィールを直す・退会
- `Members` から分けた。「Members」では中身が分かりにくいため（2026-11-19 に人が決めた）

### 2-2. 管理画面

まとまりは画面の領域で、`frontend/admin/src/domains/` とそろえる。

| まとまり | 中身 |
| --- | --- |
| `Admins` | 管理者のログイン・自分 |
| `Dashboard` | ダッシュボードの集計 |
| `Members` | 会員の一覧と詳細・停止・強制退会・メモ・会員ごとのやり取りと違反とブロック |
| `Messages` | メッセージ・トークルーム |
| `Reports` | 通報の案件 |
| `Notices` | お知らせ |
| `Sales` | 売上 |
| `Plans` | プランと値段 |
| `AuditLogs` | 監査ログ |

## 3. 移行の地図（今のファイル → 新しい置き場）

案。名詞の切り方とメソッドの名前は、移すチケットで決め直してよい（決めたら、ここを直す）。Service は、まとまりの中の近い名詞（同じ表や同じ画面を扱うもの）をまとめて1つにし、いくつかの Controller から呼ぶ（`architecture-backend.md` の3章）。新しい URL の名詞は #127 で決める。**太字**は、標準の5つ（`index`・`show`・`store`・`update`・`destroy`）以外のメソッドがあり、隠れた名詞を探して分ける所。

### 会員の側

| 今のファイル（メソッド） | 新しい Controller | Service |
| --- | --- | --- |
| `AuthController`（login・logout）・`UserController`（store：新規登録） | `Auth/AuthController`（login・logout・store） | `Auth/AuthService` |
| `AuthController`（me） | **`me` は `Profile/AccountController@show`** | `Profile/AccountService` |
| `EmailVerificationController`（show・store） | `Auth/EmailVerificationController` | `Auth/EmailVerificationService` |
| `PasswordController`（update）・`PasswordResetController`（store・update） | `Auth/PasswordController`・`Auth/PasswordResetController` | `Auth/PasswordService` |
| `UserController`（index：検索） | `Members/MemberController@index` | `Members/MemberService`（`search`） |
| `UserController`（destroy：退会） | `Profile/AccountController@destroy` | `Profile/AccountService`（`withdraw`） |
| `ProfileController`（show：相手のプロフィール） | `Profile/ProfileController@show` | `Profile/ProfileService`（`showProfile`） |
| `ProfileController`（update：自分のプロフィール） | **`Profile/AccountController@update`** | `Profile/ProfileService`（`updateProfile`） |
| `SearchConditionController`（index・store・update・destroy） | `Members/SearchConditionController` | `Members/SearchConditionService` |
| `ReportController`（store） | `Members/ReportController` | `Members/ReportService` |
| `NoticeController`（index） | `Members/NoticeController@index` | `Members/NoticeService` |
| `NoticeController`（**read**） | **`Members/NoticeReadController@store`**（名詞：既読） | `Members/NoticeService` |
| `LikeController`（store・index）・`ReceivedLikeController`（index） | `Matching/LikeController`・`Matching/ReceivedLikeController` | `Matching/LikeService`（`send`・`listSent`・`listReceived`） |
| `SkipController`（store・index・destroy） | `Matching/SkipController` | `Matching/SkipService` |
| `UserMatchController`（index） | `Matching/MatchController` | `Matching/MatchService` |
| `BlockController`（store・index・destroy） | `Matching/BlockController` | `Matching/BlockService` |
| `TalkRoomController`（index）・`MessageController`（index・store） | `Messaging/TalkRoomController`・`Messaging/MessageController` | `Messaging/MessageService`（`listRooms`・`listMessages`・`send`） |
| `FirebaseTokenController`（store） | `Messaging/FirebaseTokenController` | `Messaging/FirebaseTokenService` |
| `PlanController`（index）・`PurchaseController`（store・index） | `Billing/PlanController`・`Billing/PurchaseController` | `Billing/PlanService`・`Billing/PurchaseService` |
| `app/Models/*` | 移さない（`app/Models/` のまま） | ― |
| `app/Mail/VerifyMail.php` | 移さない（メールの中身）。送るのは Service から `Clients/Mail/MailClient` を通す | ― |
| `app/Support/Logging/` | そのまま | ― |

表の補足：

- `Members/MemberService` の `search` のクエリは、`User` の `scopeSearch` に置く
- 自分のプロフィールを直す新しい URL は `PATCH /me`（`03-how.md` の281行目）
- `Matching/LikeService` と `Messaging/MessageService` は、Firestore へは `Clients/Firestore/FirestoreClient`（`FirestoreClient`）を通す
- 下のタブのバッジの数（`GET /api/me/badge-counts`。#247）は、新しく足した `Messaging/BadgeCountController@show`。`Messaging/MessageService`（`countUnreadMessages`・`countNewMatches`）と `Matching/LikeService`（`countReceived`）を呼ぶ。数える条件は Model のスコープ（`TalkRoomMember::scopeListedFor`・`Like::scopeReceivedBy`）で、一覧を移すときも、このスコープを使う

### 管理画面

管理画面には、まだ Model がない。移すときに、使う表の Model を `backend/admin/app/Models/` に作る。書き込みのルート（停止・解除・強制退会・お知らせ・メモ・値段・通報の状態）は、役割を確かめる Middleware（`admin.can-write`）のグループに入れる。

| 今のファイル（メソッド） | 新しい Controller | Service |
| --- | --- | --- |
| `AuthController`（login） | `Admins/AuthController@login` | `Admins/AuthService`（`login`・`canAdminWrite`） |
| `AuthController`（**me**） | **管理者本人を見る Controller**（名前は未定） | `Admins/AuthService`（本人を見る操作。名前は未定） |
| `DashboardController`（index） | `Dashboard/DashboardController` | `Dashboard/DashboardService` |
| `MemberController`（index・show） | `Members/MemberController` | `Members/MemberService` |
| `SuspensionController`（store・destroy） | `Members/SuspensionController` | `Members/SuspensionService` |
| `NoticeController`（store） | `Notices/NoticeController@store` | `Notices/NoticeService` |
| `NoticeController`（**ban**） | **`Members/BanController@store`**（名詞：強制退会） | `Members/BanService` |
| `MemberNoteController`（store） | `Members/MemberNoteController` | `Members/MemberNoteService` |
| `MemberActivityController`（**talkRooms**） | **`Members/MemberTalkRoomController@index`** | `Members/MemberActivityService` |
| `MemberActivityController`（**violations**） | **`MemberViolationController@index`** | `Members/MemberActivityService` |
| `MemberActivityController`（**blocks**） | **`MemberBlockController@index`** | `Members/MemberActivityService` |
| `MemberActivityController`（**blockRanking**） | **`BlockRankingController@index`** | `Members/MemberActivityService` |
| `MessageController`（index）・`TalkRoomController`（show） | `Messages/MessageController`・`Messages/TalkRoomController` | `Messages/MessageService`（`search`・`showRoom`） |
| `ReportCaseController`（index・show・update） | `Reports/ReportCaseController` | `Reports/ReportCaseService` |
| `SalesController`（**purchases**） | **`Sales/PurchaseController@index`** | `Sales/SalesService` |
| `SalesController`（**monthly**） | **`Sales/MonthlySalesController@index`** | `Sales/SalesService` |
| `PlanController`（index・update） | `Plans/PlanController` | `Plans/PlanService` |
| `AuditLogController`（index） | `AuditLogs/AuditLogController` | `AuditLogs/AuditLogService` |
| `Controller.php`（基底） | 移さない | ― |

表の補足：

- 管理者本人を見る Controller と、`Admins/AuthService` の本人を見る操作の名前は、移すチケットで決める
  - `Me` は使わない（`docs/glossary.md` の「アカウント」）
- `canAdminWrite` は、書き込みのルートの Middleware `admin.can-write` から呼ぶ
- `MemberActivityController` は、名詞ごとに4つの Controller に分ける

移す順は、画面・機能ごと。最初はホーム（#237：`ProfileController`）。そのあとは、機能を足すとき・不具合を直すときに、触る所を移す。移し方の決まりは [architecture-backend.md](../agents/rules/architecture-backend.md) の10章。移す前に、その API が「API テストがある」状態（成功1本と、`docs/api/` に書いた失敗ごとに1本）にする。

**見本のファイル**：最初の見本はホームのプロフィール（#237。今の URL のまま中を移す）。移したら、ここにパスを書く（まだない）。

## 4. 表の書き込みの持ち主

2つのアプリが同じ DB を使う。**この表にない書き込みを足すときは、先にこの表を直す。** 表の作り（マイグレーション）は、どちらのアプリのためでも `backend/client` に置く。

| 表 | 会員の側が書く | 管理画面が書く | 約束 |
| --- | --- | --- | --- |
| `users` | 登録・ログインの日時・メールの確認・退会（`email` の書き換え・`deleted_at`）・購入（`is_paid`・`paid_until`） | 停止（`suspended_at`・`suspended_reason`） | 停止したら、会員の側はログインを断る |
| `profiles` | 全部 | 読むだけ | ― |
| `likes`・`user_matches`・`blocks` | 全部 | 読むだけ | ― |
| `talk_rooms`・`talk_room_members`・`messages` | 全部 | 読むだけ | ― |
| `plans` | 読むだけ | `price` | 値段を変えても、過去の購入の金額は変わらない（目標。今は購入の行に値段をコピーしていない） |
| `purchases` | 全部 | 読むだけ | ― |
| `admins` | シーダーだけ | `last_login_at` | ― |
| `admin_audit_logs` | なし | 全部 | ― |

## 5. テストの DB

| アプリ | テストの DB | 表の作り方 |
| --- | --- | --- |
| 会員の側 | `matching_test` | 自分のマイグレーション |
| 管理画面 | `matching_admin_test` | `backend/client` のマイグレーションを指して作る |

テストの置き場と書き方は [architecture-backend.md](../agents/rules/architecture-backend.md) の8章と `agents/rules/testing.md`。

## 6. やり直しのきっかけ

今の段階に合う形にした。次のことが起きたら見直し、`docs/decisions.md` に、きっかけ・前と後・理由を1行残す。

| きっかけ | 見直す方向 |
| --- | --- |
| 1つの Service が読みにくくなった（public のメソッドが増えて、どれを呼べばよいか迷う・300行を超えた・`private` の手順が入り組んだ） | 隠れた名詞を探して Service を分ける。それでも重いなら、そのときに形を見直す（チケットにする。決めたら `decisions.md` に1行） |
| 1つの Model のスコープとクエリが増え、Model が読みにくくなった（`User` が最初になりやすい） | 検索や集計のクエリだけを、別のクラス（検索のクエリのクラス）に出す |
| Controller・Service・Model のどれに書くかで、レビューで同じ議論がくり返された | `architecture-backend.md` の判断の順（1章）と表を直す |
| 1つのまとまりで Service が10を超えた | まとまりを小さく分ける |
| 1つの変更で、3つ以上のまとまりを触ることが続く | まとまりの境目を引き直す。まとまりの間をイベントでつなぐ |
| チームが3つ以上になり、同じフォルダを取り合う | モジュラーモノリスへ（[modular-monolith.html](../explanations/modular-monolith.html)） |
| 検索や一覧の p95 が 500ms を超えた | Model のクエリとインデックス → 読み取り専用の DB → 検索エンジン |
| 2つのアプリで、同じ業務の決まり（停止・値段）がずれて不具合が出た | 共有のパッケージ（`packages/`）に、その決まりだけを切り出す |

## 7. 参考にした資料

### このリポジトリの中

- [../explanations/architecture-styles.html](../explanations/architecture-styles.html)
  - アーキテクチャの地図：MVC・レイヤード・ヘキサゴナル・オニオン・クリーン・DDD・モジュラーモノリス・垂直スライスを、メリット・向く場面・将来の変更で比べた
- [../explanations/layered-design.html](../explanations/layered-design.html)
  - 決める途中で作った詳細設計の解説（第3版のまま残した参考の版）
  - 図・サンプルコード・メリットとデメリット
  - 正本は architecture-backend.md と、このファイル
- [../explanations/modular-monolith.html](../explanations/modular-monolith.html)
  - レイヤードからモジュラーモノリスへ移るときのディレクトリと順番
  - フレームワークや言語を替えるときの備え
- [cycles/01-backend-foundation/03-how.md](cycles/01-backend-foundation/03-how.md)
  - 決めたことと、比べて採らなかった案（議事録）

### 外の資料

各資料の「何に使ったか」と「読んだか」を書く。

- [DIP を用いたレイヤードアーキテクチャの記事（StyleEdge の技術ブログ・2023-11-17）](https://techblog.styleedge.co.jp/entry/2023/11/17/074959)
  - 何に使ったか：4層の名前と置き場（`Application`・`Domains`・`Http`・`Infrastructure`）
  - 何に使ったか：Eloquent を Infrastructure だけで使う
  - 何に使ったか：エンティティの生成用と再構成用のファクトリメソッド
  - 何に使ったか：QueryService は必要なときだけ
  - 会員の側の形のもとにした
  - 読んだか：読んだ（2026-11-15）。第1版の形で、第2版（#236）では使っていない
- [Pest の Architecture Testing](https://pestphp.com/docs/arch-testing)
  - 何に使ったか：`arch()` で依存の向きを確かめる書き方
  - 読んだか：読んでいない（書き方は AI の知識。使う前に確かめる）
- [The Clean Architecture（Robert C. Martin）](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
  - 何に使ったか：依存は内側へだけ、という考え方
  - 読んだか：読んでいない（考え方の出どころとして）
- [Hexagonal Architecture（Alistair Cockburn）](https://alistair.cockburn.us/hexagonal-architecture/)
  - 何に使ったか：ポートとアダプター（外との境目に差し替え口を作る）
  - 読んだか：読んでいない（考え方の出どころとして）
- [The Onion Architecture（Jeffrey Palermo）](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
  - 何に使ったか：ドメインを中心に置く同心円の層
  - 読んだか：読んでいない（考え方の出どころとして）
- [StranglerFigApplication（Martin Fowler）](https://martinfowler.com/bliki/StranglerFigApplication.html)
  - 何に使ったか：古いものを、新しいもので少しずつ置き換える移し方
  - 読んだか：読んでいない（考え方の出どころとして）
- [CQRS（Martin Fowler）](https://martinfowler.com/bliki/CQRS.html)
  - 何に使ったか：書き込みと読み取りの道を分ける（QueryService の考え方のもと）
  - 読んだか：読んでいない（考え方の出どころとして）
