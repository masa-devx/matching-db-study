# バックエンドの地図（改訂版）

会員の側（`backend/client`）と管理画面（`backend/admin`）の、全体の地図。エンジニアリーダーとメンバーのエンジニアが、どこに何があり、どこへ移していくかを掴むために読む。

- 状態：第1版（2026-11-15。サイクル 01）。今のコードはレガシー版のまま（Fat Controller）。下の形へは、触るチケットが来た API から少しずつ移す
- **層・依存の向き・ディレクトリ・名前・書き方（サンプルコード）・エラー・トランザクション・アーキテクチャのテストの決まりは [agents/rules/architecture.md](../agents/rules/architecture.md) を正とする**。ここには書かない
- なぜこの形にしたか：[cycles/01-backend-foundation/03-how.md](cycles/01-backend-foundation/03-how.md)。比べたほかの形：[architecture-styles.html](../explanations/architecture-styles.html)・[modular-monolith.html](../explanations/modular-monolith.html)

## 1. 形（ひとこと）

**DIP（依存性逆転）を使ったレイヤードアーキテクチャ**（Http・Application・Domain・Infrastructure）。会員の側と管理画面で、同じ4層の骨組みにする。書き込みは UseCase と Domain を通し、読み取り（一覧・検索・集計）は QueryService を直接呼ぶ。

```text
画面（frontend/client）──→ 会員の側の API（backend/client）──┐
                                                         ├──→ PostgreSQL（matching_dev）
画面（frontend/admin） ──→ 管理画面の API（backend/admin） ──┘
                           会員の側 ──→ Firestore（Emulator）
表の作り（マイグレーション）は backend/client にまとめる
```

## 2. 業務のまとまり

各層の中は、このまとまりのフォルダで分け、名前を全部の層でそろえる。

### 2-1. 会員の側

| まとまり | 中身 | 今のコントローラー（移す元） |
| --- | --- | --- |
| `Auth` | 登録の確認・ログイン・トークン | `AuthController`・`EmailVerificationController` |
| `Members` | 会員・プロフィール・検索・退会 | `UserController`・`ProfileController` |
| `Matching` | いいね・マッチ・ブロック | `LikeController`・`UserMatchController`・`BlockController` |
| `Messaging` | トークルーム・メッセージ・Firestore | `TalkRoomController`・`MessageController`・`FirebaseTokenController` |
| `Billing` | プラン・購入・有料かどうか | `PlanController`・`PurchaseController` |

### 2-2. 管理画面

まとまりは画面の領域で、`frontend/admin/src/domains/` とそろえる。

| まとまり | 読み取り（QueryService） | 書き込み（UseCase） | Domain |
| --- | --- | --- | --- |
| `Dashboard` | `DashboardQueryService` | ― | ― |
| `Members` | `MemberQueryService` | `SuspendMemberUseCase`・`UnsuspendMemberUseCase` | `Members/MemberSuspension` |
| `Messages` | `MessageQueryService` | ― | ― |
| `Sales` | `SalesQueryService` | ― | ― |
| `Plans` | `PlanQueryService` | `UpdatePlanPriceUseCase` | `Plans/PlanPrice` |
| `AuditLogs` | `AuditLogQueryService` | `RecordAuditLogUseCase`（見たことの記録。`member.view` など） | `AuditLogs/AuditLog`・`AuditAction` |
| `Admins` | `AdminQueryService`（`GET /me`） | `LoginAdminUseCase`（`POST /auth/login`。`last_login_at` を書く） | `Admins/Admin/`（`Admin`・`AdminRole`・`Permission`） |

## 3. 移行の地図（今のファイル → 各層）

| 今のファイル | Http | Application | Domain | Infrastructure |
| --- | --- | --- | --- | --- |
| `AuthController`・`EmailVerificationController` | `Auth/` の Controller・`AuthenticateMember` | `Auth/LoginUseCase`・`VerifyEmailUseCase` | `Members/Member`・`Auth/MailerInterface`・`Auth/TokenServiceInterface` | `External/Jwt`・`External/Mail` |
| `UserController`・`ProfileController` | `Members/` | `Members/RegisterMemberUseCase`・`WithdrawMemberUseCase`・`UpdateProfileUseCase` | `Members/Member`・`Members/Profile` | `Repositories/Members`・`QueryServices/Members/MemberSearchQueryService` |
| `LikeController`・`UserMatchController`・`BlockController` | `Matching/` | `Matching/LikeMemberUseCase`・`BlockMemberUseCase` | `Matching/Like`・`UserMatch`・`Block` | `Repositories/Matching` |
| `TalkRoomController`・`MessageController`・`FirebaseTokenController` | `Messaging/` | `Messaging/SendMessageUseCase` | `Messaging/TalkRoom`・`Message` | `Repositories/Messaging`・`External/Firestore` |
| `PlanController`・`PurchaseController` | `Billing/` | `Billing/PurchasePlanUseCase` | `Billing/Plan`・`Purchase`・`Money` | `Repositories/Billing` |
| `app/Models/*`（会員の側の10個） | ― | ― | ― | `Models/`（Model を移すだけのコミットで。10章） |
| `app/Mail/VerifyMail.php` | ― | ― | `Auth/MailerInterface` | `External/Mail/` |
| `app/Support/Logging/` | ― | ― | ― | そのまま `app/Support/Logging/`（Http と Infrastructure だけが使う） |

管理画面（`backend/admin`）：

| 今のファイル | Http | Application | Infrastructure |
| --- | --- | --- | --- |
| `AuthController`（`login`・`me`） | `Admins/` | `Admins/LoginAdminUseCase` | `QueryServices/Admins/AdminQueryService`・`Repositories/Admins` |
| `DashboardController` | `Dashboard/` | ― | `QueryServices/Dashboard/DashboardQueryService` |
| `MemberController`（`index`・`show`） | `Members/` | `AuditLogs/RecordAuditLogUseCase`（`show` の見たことの記録） | `QueryServices/Members/MemberQueryService` |
| `SuspensionController`（`store`・`destroy`） | `Members/` | `Members/SuspendMemberUseCase`・`UnsuspendMemberUseCase` | `Repositories/Members` |
| `MessageController` | `Messages/` | ― | `QueryServices/Messages/MessageQueryService` |
| `SalesController`（`purchases`・`monthly`） | `Sales/` | ― | `QueryServices/Sales/SalesQueryService` |
| `PlanController`（`index`・`update`） | `Plans/` | `Plans/UpdatePlanPriceUseCase` | `QueryServices/Plans/PlanQueryService`・`Repositories/Plans` |
| `AuditLogController` | `AuditLogs/` | ― | `QueryServices/AuditLogs/AuditLogQueryService` |
| `Controller.php`（基底） | 移さない | ― | ― |

Domain の行き先は 2-2 の表。

移す順は、触るチケットが来た順。移し方の決まりは [architecture.md](../agents/rules/architecture.md) の10章。移す前に、その API が「API テストで守っている」状態（成功1本と、`docs/api/` に書いた失敗ごとに1本）にする。

Model を `app/Infrastructure/Models/` へ移すときは、同じチケットで AGENTS.md の「エディタの補完のファイルを作る」のコマンドに、Model のフォルダの指定（`--dir`）を足す。

**見本のファイル**：各層の最初の見本は「いいねする」（`LikeMemberUseCase` まわり）。移したら、ここにパスを書く（まだない）。

## 4. 表の書き込みの持ち主

2つのアプリが同じ DB を使う。**この表にない書き込みを足すときは、先にこの表を直す。** 表の作り（マイグレーション）は、どちらのアプリのためでも `backend/client` に置く。

| 表 | 会員の側が書く | 管理画面が書く | 約束 |
| --- | --- | --- | --- |
| `users` | 登録・ログインの日時・メールの確認・退会（`email` の書き換え・`deleted_at`）・購入（`is_paid`・`paid_until`） | 停止（`suspended_at`・`suspended_reason`） | 停止したら、会員の側はログインを断る |
| `profiles` | 全部 | 読むだけ | ― |
| `likes`・`user_matches`・`blocks` | 全部 | 読むだけ | ― |
| `talk_rooms`・`talk_room_members`・`messages` | 全部 | 読むだけ | ― |
| `plans` | 読むだけ | `price` | 値段を変えても、過去の購入の金額は変わらない（目標。今は購入に値段を写していない） |
| `purchases` | 全部 | 読むだけ | ― |
| `admins` | シーダーだけ | `last_login_at` | ― |
| `admin_audit_logs` | なし | 全部 | ― |

## 5. テストの DB

| アプリ | テストの DB | 表の作り方 |
| --- | --- | --- |
| 会員の側 | `matching_test` | 自分のマイグレーション |
| 管理画面 | `matching_admin_test` | `backend/client` のマイグレーションを指して作る |

テストの置き場と書き方は [architecture.md](../agents/rules/architecture.md) の8章と `agents/rules/testing.md`。

## 6. やり直しのきっかけ

今の段階に合う形にした。次のことが起きたら見直し、`docs/decisions.md` に、きっかけ・前と後・理由を1行残す。

| きっかけ | 見直す方向 |
| --- | --- |
| 1つのまとまりで UseCase が20を超えた | まとまりを小さく分ける |
| 1つの変更で、3つ以上のまとまりを触ることが続く | まとまりの境目を引き直す。まとまりの間をイベントでつなぐ |
| チームが3つ以上になり、同じフォルダを取り合う | モジュラーモノリスへ（[modular-monolith.html](../explanations/modular-monolith.html)） |
| 検索や一覧の p95 が 500ms を超えた | QueryService の SQL とインデックス → 読み取り専用の DB → 検索エンジン |
| 詰め替えが重荷になった（Domain がほぼ表の写し） | そのまとまりだけ、読み取りの道に寄せる |
| 2つのアプリで、同じ業務の決まり（停止・値段）がずれて不具合が出た | 共有の Domain のパッケージ（`packages/`）に切り出す |

## 7. 参考にした資料

### このリポジトリの中

| 資料 | 中身 |
| --- | --- |
| [../explanations/architecture-styles.html](../explanations/architecture-styles.html) | アーキテクチャの地図：MVC・レイヤード・ヘキサゴナル・オニオン・クリーン・DDD・モジュラーモノリス・垂直スライスを、メリット・向く場面・将来の変更で比べた |
| [../explanations/layered-design.html](../explanations/layered-design.html) | 決める途中で作った詳細設計の解説（第3版のまま残した参考の版）。図・サンプルコード・メリットとデメリット。正本は architecture.md と、このファイル |
| [../explanations/modular-monolith.html](../explanations/modular-monolith.html) | レイヤードからモジュラーモノリスへ移るときのディレクトリと順番・フレームワークや言語を替えるときの備え |
| [cycles/01-backend-foundation/03-how.md](cycles/01-backend-foundation/03-how.md) | 決めたことと、比べて採らなかった案（議事録） |

### 外の資料

| 資料 | 何に使ったか | 読んだか |
| --- | --- | --- |
| [DIP を用いたレイヤードアーキテクチャの記事（StyleEdge の技術ブログ・2023-11-17）](https://techblog.styleedge.co.jp/entry/2023/11/17/074959) | 4層の名前と置き場（`Application`・`Domains`・`Http`・`Infrastructure`）・Eloquent を Infrastructure だけで使う・エンティティの生成用と再構成用のファクトリメソッド・QueryService は必要なときだけ。会員の側の形のもとにした | 読んだ（2026-11-15） |
| [Pest の Architecture Testing](https://pestphp.com/docs/arch-testing) | `arch()` で依存の向きを守る書き方 | 読んでいない（書き方は AI の知識。使う前に確かめる） |
| [The Clean Architecture（Robert C. Martin）](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | 依存は内側へだけ、という考え方 | 読んでいない（考え方の出どころとして） |
| [Hexagonal Architecture（Alistair Cockburn）](https://alistair.cockburn.us/hexagonal-architecture/) | ポートとアダプター（外との境目に差し替え口を作る） | 読んでいない（考え方の出どころとして） |
| [The Onion Architecture（Jeffrey Palermo）](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) | ドメインを中心に置く同心円の層 | 読んでいない（考え方の出どころとして） |
| [StranglerFigApplication（Martin Fowler）](https://martinfowler.com/bliki/StranglerFigApplication.html) | 古いものを、新しいもので少しずつ置き換える移し方 | 読んでいない（考え方の出どころとして） |
| [CQRS（Martin Fowler）](https://martinfowler.com/bliki/CQRS.html) | 書き込みと読み取りの道を分ける（QueryService の考え方のもと） | 読んでいない（考え方の出どころとして） |

「読んでいない」ものは、AI の知識で説明した考え方の出どころとして並べた。詳しく使う前に、リンク先を読んで確かめる。
