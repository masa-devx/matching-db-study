# どう作るか（設計と議事録）

日付：2026-11-15
出た役：リーダー・人

## テストの考え方（決まった）

### 意味のあるテストの5つの条件

1. 何を守るかを1文で言える（名前に入れる。例：「ブロックした相手は、検索の結果に出ない」）
2. それを壊すと落ちる（守っている行を消して確かめる）
3. 中身を書き換えても落ちない（外から見える振る舞い＝リクエスト・応答・DB だけを見る。あとでファイルを安全に移すため）
4. 落ちたとき、何が壊れたか分かる
5. いつ流しても同じ結果

### API テストの観点

| 観点 | 確かめること |
| --- | --- |
| 成功 | 状態コード・返す項目・返してはいけない項目・DB の変化 |
| 認証 | トークンがない・壊れている・期限切れ |
| 認可 | 他人のもの・役割が足りない |
| 入力 | 必須・型・境界の両側 |
| 業務の決まり | このアプリだけの決まり |
| 副作用 | 書いてよい行だけが変わる・他人の行は変わらない |
| 一覧 | 並び・ページ・空のとき・出してはいけない人 |
| 既知のリスク | 今の振る舞いをそのまま固め、コメントを残す |

深く書く順：お金 → 他人のデータ → 認証 → 書き込み → 読み取り。

### 置き場

- 5つの条件と観点の表は、チケット③（会員の側の API テストの土台）の中で `agents/rules/testing.md` に「API テストの観点」の節として足す
- これからどの種類のテスト（単体・API・アーキテクチャ・SQL の本数など）を使い、何を守らせるかも、`testing.md` に足して管理していく

## 今のテストの準備（2026-11-15 に見た）

| | 会員の側（`backend/client`） | 管理画面（`backend/admin`） |
| --- | --- | --- |
| テストの DB | PostgreSQL の `matching_test`。違う DB につながると `tests/TestCase.php` が止める | **SQLite のメモリ**（`phpunit.xml`）。D-010（本物の PostgreSQL で確かめる）と合わない |
| 表の作り | 自分のマイグレーションで `RefreshDatabase` | **マイグレーションを持たない**（表の作りは `backend/client` にまとめた）。このままでは表のない DB でテストが走る |
| テストデータ | `UserFactory`・`ProfileFactory` だけ | なし |
| ログインした状態 | 部品なし（JWT はコントローラーごとにコピー） | 部品なし |
| テスト | `HealthTest` だけ | 雛形のまま |

## 管理画面のテストの DB と表の作り方

| 案 | 中身 | 良いところ | 弱いところ |
| --- | --- | --- | --- |
| A（選んだ） | 管理画面のテスト用に別の DB（`matching_admin_test`）を作り、表は `backend/client` のマイグレーションを `--path` で指して作る。違う DB につながったら止める仕組みも会員の側と同じにする | 表の作りの正本が1か所のまま。2つのテストを同時に流してもぶつからない。本物の PostgreSQL | 管理画面が会員の側のマイグレーションの置き場を知っている（パスでつながる） |
| B | 会員の側と同じ `matching_test` を使い、先に会員の側でマイグレーションしておく。管理画面はテストごとに巻き戻すだけ | 準備が少ない | 同時に流すとぶつかる。会員の側を先に流さないと、管理画面のテストが動かない（順番に頼る） |
| C | 管理画面にマイグレーションを写す | 管理画面だけで閉じる | 正本が2か所になり、ずれる |

人が「それで OK」と答えたので、A で進める（違えば直す）。DB を作る SQL は `docker/db/init/`、CI は `.github/workflows/admin-backend.yml` に足す。

## 設計書

- 置き場は `docs/backend.md`（`docs/frontend.md` に合わせる）。会員の側と管理画面を1つの文書にし、違うところだけ節を分ける

## アーキテクチャ

比べた資料：`explanations/architecture-styles.html`

| 場所 | 形 | 理由（人の言葉） |
| --- | --- | --- |
| 会員の側（`backend/client`） | レイヤードアーキテクチャ（3層：プレゼンテーション・ビジネスロジック・データアクセス） | 当時の規模は中くらい。いろいろな現場で取り入れられていて、入ってきた人がすぐ読める |
| 管理画面（`backend/admin`） | モジュール（機能・画面ごとの縦切り） | 機能や画面ごとに何があるかが分かればよい |

- 人はほかのプロジェクトで「interface 層」（入口の層）を取り入れていた。入口（HTTP・コマンド・キュー・Webhook）を `app/Interfaces/` にまとめる案（B）と、Laravel の標準の置き場のままの案（A）を比べた（`explanations/layered-design.html`。決まりを `agents/rules/architecture.md` にまとめたあと、第3版のまま参考として残した）
- 決めた依存の向きは、アーキテクチャのテスト（Pest の `arch()`）で守る。このサイクルの範囲に入れる

### 会員の側の形（2026-11-15 に決めた）

参考：DIP（依存性逆転）を使ったレイヤードアーキテクチャ（`Http`・`Application`・`Domain`・`Infrastructure`）。比べた資料は `explanations/architecture-styles.html`・`modular-monolith.html`。決まりと書き方は `agents/rules/architecture.md`、全体の地図は `docs/backend.md`。

```text
app/
├── Http/            # UI 層：Controllers・Requests（入力）・Resources（出力）・Middleware
├── Application/     # UseCases/（1操作1クラス）・Dtos/（入力と出力の型）
├── Domain/          # <業務のまとまり>/<集約>/：エンティティ・値オブジェクト・enum・〜RepositoryInterface・例外。Services/ にドメインサービス
├── Infrastructure/  # Models（Eloquent）・Repositories（interface の実装と詰め替え）・QueryServices（必要なときだけ）・External（Firestore・JWT）
└── Providers/       # interface と実装をつなぐ
```

- 依存の向き：Http → Application → Domain ← Infrastructure（Infrastructure が Domain の interface を実装する）
- ユースケースのフォルダの名前は `UseCases/`
- Application 層は Laravel の機能をはみ出して使わない（`DB::transaction()` も直接は使わない。トランザクションの扱いは下で決める）
- QueryService は必要に応じて（検索・管理画面の集計など）
- 聞き慣れない名前（Ports・Queries・Listeners）は使わない。外のサービスの約束は、使う Domain のフォルダに `〜Interface.php` で置く
- トランザクションは `Application/Transaction/TransactionManagerInterface.php`（実装は `Infrastructure/Transaction/LaravelTransactionManager.php`）、日時は `Domain/Shared/ClockInterface.php`（実装は `Infrastructure/Clock/SystemClock.php`。PHP 標準の `DateTimeImmutable` を返す）を通す
- 方針：今の段階に合う設計にする。機能・会員・ファイルが増えて問題が出たら、そのときに設計をやり直す。やり直しのきっかけ（数字）を決めて振り返りで見る。変えたら `docs/decisions.md` に、きっかけと前と後を1行残す

### 管理画面の形（2026-11-15 に決めた。同じ日に見直した）

- **会員の側と同じ4層の骨組み**（Http・Application・Domain・Infrastructure。層の中は画面の領域ごとのフォルダ：`Dashboard`・`Members`・`Messages`・`Sales`・`Plans`・`AuditLogs`。`frontend/admin/src/domains/` とそろえる）
- 読み取り（一覧・詳細・集計。API の9割）は、Controller から Infrastructure の QueryService を直接呼ぶ。Domain を通さない
- 書き込み（停止・解除・値段の変更）だけ、UseCase と Domain を通す。管理画面の Domain は「運営の権限と監査」：`Admins/`（Admin・AdminRole・Permission）・`Members/MemberSuspension`・`Plans/PlanPrice`・`AuditLogs/`
- Application と Domain では Laravel を使わない（会員の側と同じ。トランザクションと日時は interface 越し）。依存の向き・アーキテクチャのテストも会員の側と同じ
- 見直した理由：書く手間は AI で小さくなるが、読む・レビューする・説明する手間は残る。形を1つにすれば、覚えるのも AI が真似するのもテストも1種類で済む。役割・停止・監査の決まり（12 の 9-2 で問題が出たところ）を、Domain で単体テストできる
- 最初の案（機能ごとのモジュール・Domain なし・Laravel をそのまま使う）は取り消した
- 比べて採らなかった案：読み取りも全部 Domain を通す（詰め替えが大量に出る）・共有の Domain のパッケージ（`packages/`。12 の「管理画面は会員の側のコードを読み込まない」を変えることになる。2つのアプリの決まりがずれて困ったら考える）
- どのアプリがどの表のどの列を書いてよいかを、`docs/backend.md` に表で載せる

## 決めたこと・決めなかったこと・宿題

- 決めたこと：テストの考え方と置き場（上）
- 決めなかったこと：チケットの Size と順番
- 宿題：人が、`POST /api/me/likes` に観点を当てはめて、守るテストを3つ挙げる（練習。急がない）。1回目の答えは「認証まわりやいいねなど」。名前の形（〜のとき、〜になる）にするのが次の一歩
