# 設計の判断の地図

このプロジェクトで決めたこと・直したことを、大きなトピックと小さな見出しに分けた地図。「なぜそうしたか」を、2段・3段と聞かれても、自分の言葉で説明できるようにするために使う（2026-11-20 に人が決めた）。

- 実装がトピックに当たったら、`code-walkthrough` の説明の練習のあとに、そのトピックの問いに答える（`agents/skills/code-walkthrough/SKILL.md` の 3-2）
- 問いへの答えと、練習の記録は、人の手元の非公開のメモに置く（置き場は `agents/notes.local.md` に書く。git に入らない）。この地図には、トピックと、記録のある場所だけを書く
- 決めたことの理由の正本は、それぞれの記録（`docs/decisions.md`・`docs/cycles/`・解説の HTML）。この地図は、その入口

## 説明するときの流れ

1. 困りごと：だれの・どんな場面で・どのくらい（数字）
2. 原因：なぜ起きていたか
3. 案：2つ以上。何で比べたか
4. 選んだ案と、決め手
5. 弱い点と、その手当て
6. 結果：前と後の数字・何が変わったか
7. 今ならどうするか

続けて聞かれる「なぜ？」の種類：

| 種類 | 例 |
| --- | --- |
| 基本 | なぜそれを選んだのか |
| 別の案 | 〇〇にしていたら、何が違ったか |
| 規模 | 会員が10倍・100倍になったら、どうなるか |
| 失敗 | 困ったこと・あとから気づいたことは。どう気づいたか |
| サービス | 利用者や運営にとって、何が良くなったか |

気をつけること：

- 「そう決まっていたので」「AI がそう言ったので」で終わらせない
- このプロジェクトは学習用。前の現場で見た問題を、実務のコードを持ち込まずに再現し、測って直したことを話す。仕事でしたことと、学習で確かめたことを分ける
- 仮説で終わらせない。測った数字・壊して確かめたテストで話す

## トピックの地図

| # | 大きなトピック | 小さな見出し | 主な記録 |
| --- | --- | --- | --- |
| 1 | 認証と認可 | 1-1 認証の方式を選ぶ（JWT からセッションへ・Firebase Auth を選ばない） | D-014・D-027・`docs/cycles/01-backend-foundation/03-how.md`「認証をセッションに移す」・`explanations/auth-session.html` |
|  |  | 1-2 止めた会員をすぐ止める（Middleware・毎回 DB で確かめる） | #243・PR #262・`docs/cycles/01-backend-foundation/05-problems.md` |
|  |  | 1-3 移すときの危なさの手当て（一度に切り替える・メンテナンス・戻し方） | `03-how.md`・`docs/requirements/maintenance.md` |
|  |  | 1-4 CSRF・XSS・Cookie | `explanations/auth-session.html` の5・6章 |
|  |  | 1-5 安全の穴を直す進め方（テストを先に変えて Red） | PR #255・#262・`agents/rules/testing.md` |
| 2 | DB の設計 | 2-1 表の分け方（`users` と `profiles`） | D-015 |
|  |  | 2-2 制約で守るもの・アプリで守るもの（UNIQUE・外部キー・CHECK） | `agents/rules/database.md`・`docs/data-model.md` |
|  |  | 2-3 状態の持ち方（日時の列・真偽・enum） | `agents/rules/architecture-backend.md` の3章 |
|  |  | 2-4 外に出す ID と中の ID（`public_id` の UUID） | D-022 |
|  |  | 2-5 あとから増える項目の持ち方（列・jsonb・1項目1行） | `explanations/04b-saved-searches.html` |
| 3 | SQL と性能 | 3-1 インデックスと EXPLAIN（検索） | `explanations/04-search.html`・`docs/api/04-search.md` |
|  |  | 3-2 JOIN と 1＋N（メッセージの一覧） | `explanations/05-messages.html` |
|  |  | 3-3 ページの送り方（OFFSET とカーソル） | `explanations/04-search.html` |
|  |  | 3-4 データを増やして測る（2万人・10万件） | AGENTS.md の「試しの会員を入れる」 |
|  |  | 3-5 キャッシュ（使う場面と、使わない理由） | ― |
|  |  | 3-6 相手ごとの最新の1件（ウィンドウ関数・DISTINCT ON・LATERAL） | `explanations/05-messages.html` |
| 4 | トランザクションと同時更新 | 4-1 トランザクションの範囲と、外への書き込み（メール・Firestore は確定のあと） | `architecture-backend.md` の5章・7章 |
|  |  | 4-2 同時に来たとき（UNIQUE の違反・25P02・セーブポイント） | `architecture-backend.md` の7章 |
|  |  | 4-3 ロック（楽観・悲観） | 09（まだ） |
| 5 | API の設計 | 5-1 URL とリソースの切り方（`/me` を付ける基準・CRUD でない操作） | `03-how.md`「API の URL とルートの設計」 |
|  |  | 5-2 エラーの返し方を1か所にする（業務の例外） | #241・PR #242 |
|  |  | 5-3 返す項目（`#[Hidden]` と Resource） | PR #255 |
|  |  | 5-4 今の URL を壊さずに、新しい URL へ移す | `03-how.md` |
|  |  | 5-5 API の約束の書き方（OpenAPI・契約のテスト） | #125 |
| 6 | アーキテクチャ | 6-1 形を選ぶ（Controller → Service → Model。4層をやめた理由） | D-025・`explanations/layered-design.html`・`explanations/architecture-styles.html` |
|  |  | 6-2 責務と置き場（Middleware・Service・Model） | `architecture-backend.md` の2章・PR #262 |
|  |  | 6-3 名前の決まり | `architecture-backend.md` の3章・PR #262 |
|  |  | 6-4 会員が増えたときの伸び方 | `explanations/modular-monolith.html` |
| 7 | 画面（フロントエンド） | 7-1 状態の置き場（Context から Zustand・TanStack Query を使わない） | D-005 |
|  |  | 7-2 部品の分け方（container と presenter・機能のフォルダ） | D-026・`agents/rules/architecture-frontend.md` |
|  |  | 7-3 API との通信（401 の扱い・失敗の表示・`client.ts`） | PR #262・#257 |
|  |  | 7-4 表示の速さ（Web Vitals・長い一覧） | `explanations/04-search.html` |
|  |  | 7-5 リアルタイムとポーリング（Firestore で届く・数を読む API） | `explanations/05c-firestore.html`・#247 |
| 8 | 技術選定 | 8-1 Laravel と PostgreSQL（テストも本物の PostgreSQL） | D-001・D-010 |
|  |  | 8-2 Firestore と比べる（NoSQL） | D-008・`explanations/05c-firestore.html` |
|  |  | 8-3 検査の道具（Pest・Larastan・Pint・Biome） | D-016・D-017 |
| 9 | 品質と開発の進め方 | 9-1 テスト（今の動きを確かめるテスト・壊して確かめる） | `agents/rules/testing.md`・`testing-style.md` |
|  |  | 9-2 レビューの回し方（角度ごとのレビュー・must と should） | `docs/cycles/01-backend-foundation/07-review.md` |
|  |  | 9-3 AI との進め方（人が先に答える・差分を人が見る） | AGENTS.md・`docs/process.md` |
|  |  | 9-4 わざとレガシー版を作って測り、テストを足してから直す進め方 | AGENTS.md・`docs/process.md` |
|  |  | 9-5 要件の決め方（要件 ID・受け入れの条件・なぜ作るか） | `docs/requirements/`・`docs/cycles/01-backend-foundation/01-why.md` |
| 10 | 運用 | 10-1 ログと秘密の値 | `agents/rules/logging.md` |
|  |  | 10-2 リリースと戻し方 | `03-how.md` の「リリースの順番」 |
|  |  | 10-3 メンテナンス | `docs/requirements/maintenance.md`・#258 |
|  |  | 10-4 止めずに変えるマイグレーション・DB の引っ越し | 10・11（まだ） |
| 11 | 業務の決まりとデータの整合 | 11-1 いいねとマッチ（お互いのいいね・二重を防ぐ UNIQUE） | `explanations/02-likes.html`・`explanations/03-matches.html` |
|  |  | 11-2 回数の上限と、同時に来たとき（無料の男性のいいねは1日10回） | `explanations/07-paid-members.html`・09（まだ） |
|  |  | 11-3 ブロックと退会（NOT EXISTS・論理削除と再登録・部分インデックス） | `explanations/06-blocks-withdrawal.html` |
|  |  | 11-4 有料会員（買ったときの値段を残す・期限・使える機能を1か所で決める） | `explanations/07-paid-members.html`・#245 |
|  |  | 11-5 決済の通知（状態の遷移・冪等性） | 08（まだ） |
| 12 | 管理画面 | 12-1 管理画面を別のアプリにする（表は共通・コードは読み込まない） | `explanations/12-admin.html`・`docs/backend.md` |
|  |  | 12-2 役割の確かめ（見るだけの管理者） | #244 の3・6 |
|  |  | 12-3 監査ログ（だれが何をしたか） | `explanations/12-admin.html` |
| 13 | 他人のデータを守る | 13-1 持ち主の確かめ（自分のものだけを探す・他人のものは 404） | #244・`agents/rules/database.md` |
|  |  | 13-2 返す項目・受け取る項目（`#[Hidden]`・`$fillable`・Resource） | PR #255・#244 |
|  |  | 13-3 秘密の値の扱い（鍵・確認用の文字・ログに出さない） | `agents/rules/logging.md`・PR #255 |

新しい小さな見出しに当たったら、初めて当たったチケットで、この表に足す。
