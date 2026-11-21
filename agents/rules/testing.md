---
paths:
  - "backend/*/tests/**"
  - "backend/*/phpunit.xml"
  - "frontend/*/src/**/*.test.*"
  - "frontend/*/vitest.config.*"
---

# 単体/E2Eの切り分けと、テストを弱めて通すことの禁止

## 種別と実行コマンド

実行コマンドは [docs/commands.md](../../docs/commands.md) と同じものを書く。

| 種別 | ツール | 何を確かめるか |
| --- | --- | --- |
| 単体 | Pest・Vitest（画面） | ロジックの境界値・異常系 |
| 結合（API テスト） | Pest（テスト用の PostgreSQL に対して実行） | DB や API をまたぐ制御・API の振る舞い |
| アーキテクチャ | Pest の `arch()`（`pestphp/pest-plugin-arch`） | 層の依存の向きと名前（`architecture-backend.md` の8章） |
| E2E | 03b（React を足す）で決める | 主要フロー・認可・状態遷移 |

### 単体

- 置き場所：`backend/client/tests/Unit/`・`backend/admin/tests/Unit/`（`app/` の構造を再現）・`frontend/*/src/**/*.test.ts(x)`（確かめるファイルの隣）
- 実行：`docker compose run --rm app ./vendor/bin/pest tests/Unit`。画面は `frontend/client`（管理画面は `frontend/admin`）で `npm test`（Vitest・Testing Library・jsdom。#114）

### 結合（API テスト）

- 置き場所：`backend/client/tests/Feature/`・`backend/admin/tests/Feature/`
- 実行：`docker compose run --rm app ./vendor/bin/pest tests/Feature`（管理画面は `admin-app`）

### アーキテクチャ

- 置き場所：`backend/client/tests/Arch/`（正本）・`backend/admin/tests/Arch/`（コピー）
- コピーの決まりの部分が正本と同じかを、`SameRulesAsClientTest.php` が比べる
- 実行：`docker compose run --rm app ./vendor/bin/pest tests/Arch`（管理画面は `admin-app`）

### E2E

- 置き場所・実行：03b で決める

### 管理画面（`backend/admin`）のテスト

- 管理画面も、Pest と、本物の PostgreSQL で動く（#105）
- テスト用の DB は `matching_admin_test`。会員の側の `matching_test` とは別なので、2つを同時に流しても、ぶつからない
- 管理画面はマイグレーションを持たないので、表は、会員の側のマイグレーション（`backend/client/database/migrations`）で作る（`backend/admin/tests/TestCase.php`）
- この仕組みは `tests/Feature/TestEnvironmentTest.php` で確かめる
- ダミーデータは `backend/admin/tests/DummyData/`：`DummyAdmin`（`create()`（役割を引数で）・`actingAs()`）・`DummyMember`（`create()`）
- 会員の側の `DummyUser` とは、別のもの（管理画面は Model を持たないので、表に直接入れる）

### 置き場の決まり

- 単体の置き場所は、実装のパスと対応づける（例: `app/Models/User.php` の `isPaidAt()` → `tests/Unit/Models/UserTest.php`）
- Service は DB を使うので、単体ではなく API テスト（`Feature`）で、本物の PostgreSQL に対して確かめる
- 各テストの組（`Unit`・`Feature`・`Arch`）は、`phpunit.xml` の `<testsuites>` に並べる。並べていないフォルダのテストは流れない
- API テストは、`tests/Feature/<業務のまとまり>/` に置く（例：`tests/Feature/Profile/ShowTest.php`）
  - まとまりは `app/` と同じ名前（`docs/backend.md` の2章）
  - どのまとまりにも入らないもの（`HealthTest.php`）は `tests/Feature/` の直下
- テストのダミーデータ（会員・いいねなどの行と、ログインした状態を作るクラス）は `tests/DummyData/` に置く
- ダミーデータのテストは書かない。シードと同じく、データを用意するだけのものだから（2026-11-19 に人が決めた）
- API テストに Model の名前空間を書かない（`architecture-backend.md` の10章）
- E2Eは実行前にシードデータの投入とアプリ起動が要る（後述）

## API テストの観点

API テスト（API を呼び、状態コード・応答・DB の変化を確かめるテスト）を書くときの決まり。2026-11-15 に決めた（`docs/cycles/01-backend-foundation/03-how.md`）。

### 意味のあるテストの5つの条件

1. 何を確かめるかを1文で言える。その文をテストの名前にする（例：「ブロックした相手は、検索の結果に出ない」）
2. それを壊すと落ちる。その動きを作っている実装の行を消して、落ちることを確かめる
3. 中身を書き換えても落ちない。外から見える振る舞い（リクエスト・応答・DB）だけを見る。あとでファイルを移しても、テストを変えずに済む
4. 落ちたとき、何が壊れたか分かる
5. いつ流しても同じ結果になる

### 観点

API ごとに、下の表から当てはまる観点を選ぶ。「API テストがある」と言える最低の本数は、`architecture-backend.md` の10章（成功が1本と、`docs/api/` に書いた失敗ごとに1本）。

| 観点 | 確かめること |
| --- | --- |
| 成功 | 状態コード・返す項目・返してはいけない項目・DB の変化 |
| 認証 | ログインしていない・でたらめなセッションの Cookie・24時間で切れた（会員の側）。トークンがない・壊れている・期限切れ（管理画面） |
| 認可 | 他人のもの・役割が足りない |
| 入力 | 必須・型・境界の両側 |
| 業務の決まり | このアプリだけの決まり（例：無料の男性のいいねは1日10回まで） |
| 副作用 | 書いてよい行だけが変わる・他人の行は変わらない |
| 一覧 | 並び・ページ・空のとき・出してはいけない人 |
| 分かっている不具合 | 今の振る舞いをそのまま確かめ、「分かっている不具合：…」とコメントを残す |

深く書く順：お金 → 他人のデータ → 認証 → 書き込み → 読み取り。

### テストのダミーデータ（会員の側）

データと、ログインした状態は、`backend/client/tests/DummyData/` のクラスで作る。クラスは `Dummy<名詞>`（`final`）で、テストから呼ぶメソッドは `public static`、中の手順は `private static` にする。テストでは `use Tests\DummyData\DummyUser;` と読み込み、`DummyUser::create()` と呼ぶ（クラスは名前から自動で読み込まれるので、`composer.json` に足さなくてよい）。ダミーデータだけで書いた見本は `tests/Feature/Profile/ShowTest.php`。

| メソッド | 作るもの | 作らないもの |
| --- | --- | --- |
| `DummyUser::create()` | 会員とプロフィール（既定と引数は下） | 購入の行（`purchases`）・管理画面の監査ログ |
| `DummyMatching::match()` | お互いのいいね・マッチ・トークルームと参加者2人。トークルームの番号を返す | Firestore のルーム |
| `DummyAuth::actingAs()` | その会員でログインした状態（Laravel の `actingAs`。ガードに会員を直に置き、Cookie を通らない）にし、画面のオリジンを付ける。続けて `->getJson(...)` と書く | ― |
| `DummyAuth::loginFromScreen()` | 画面のオリジンからログインの API を呼び（200 を確かめる）、セッションの Cookie の値を返す。置き場は DB にする。Cookie で続くか・切れるかを見るテストで使う | ― |
| `DummyAuth::withSessionCookie()` | 画面のオリジンを付け、渡したセッションの Cookie を送る。続けて `->getJson(...)` と書く | ― |
| `DummyAuth::fromScreen()` | 画面のオリジン（`Origin`）だけを付ける（ログインの API を呼ぶとき） | ― |
| `DummyAuth::xsrfTokenOf()` | 応答が付けた CSRF のトークンの Cookie の値（`X-XSRF-TOKEN` に入れて送る） | ― |
| `DummyAuth::useSessionTable()` | セッションの置き場を DB（表 `sessions`）にする。Cookie だけでログインが続くか・切れるかを見るテストの最初に呼ぶ | ― |
| `DummyAuth::forgetLoginBetweenRequests()` | 次のリクエストの前に、ログインした会員とセッションを忘れさせる（Laravel のテストは、1つのテストの中で覚えたままにするため） | ― |
| `DummyAuth::token()` | トークンの文字だけ（会員の側はセッションに移ったので、送っても「ログインしていない」になる。今は使うテストがない。JWT を消すチケットで外す） | ― |
| `DummyAuth::withToken()` | 渡したトークンを `Authorization` に付ける（壊れたトークン・期限切れのトークンを送るとき）。続けて `->getJson(...)` と書く | ― |
| `DummyAuth::tokenSignedWithOtherKey()` | 中身は本物と同じで、ほかの鍵で署名したトークン（署名を確かめているかを見るとき） | ― |
| `DummyUser::MISSING_PUBLIC_ID` | だれも持っていない `public_id`（UUID の形は正しい）。いない会員の URL に使う | ― |

- `DummyUser::create()` の既定は、メールアドレスを確認した・無料の・女性
- `DummyUser::create()` の引数で変えられるもの：性別・有料・退会・停止・強制退会・確認していない・ニックネーム・生年月日・都道府県・身長
  - 確認していない（`unverified: true`）会員は、確認の日時が空で、確認用の文字を持つ
  - `withProfile: false` ならプロフィールを作らない
- 引数と返す値は、`tests/DummyData/` の PHPDoc を正とする（この表には書かない）
- 足りないもの（メッセージ・購入など）は、要るチケットで `tests/DummyData/` のクラスにメソッドを足すか、クラスを足す。この表にも1行足す
- 引数が6つを超えて読みにくくなったら、作る役のクラス（ビルダー）に移すかを考える（2026-11-19 に人が決めた）
- 時刻は `travelTo()`（`Pest\Laravel` の関数。`$this->travelTo()` と同じ）で止める。ダミーデータは日時の列に `now()` を入れるので、止めてから呼ぶと、その日時の行ができる

```php
travelTo(Carbon::parse('2026-11-10 12:00:00'));
$loginUser = DummyUser::create(paid: true);   // users.created_at は 2026-11-10 12:00:00・有料の期限は 2026-12-10 12:00:00
```

- セッション（会員の側）の期限は、Laravel の時計で決まるので、`travel()` が効く（FR-AUTH-013 のテスト）
- Cookie を渡すリクエストは、`withCredentials()` を付ける（Laravel のテストの `getJson()`・`postJson()` は、付けないと Cookie を送らない）
- CSRF の確かめは、Laravel がテストの中では飛ばす。確かめるテスト（FR-AUTH-018）だけ、`config()->set('sanctum.middleware.validate_csrf_token', ValidateCsrfTokenInTests::class)` で、飛ばさない形（`tests/Support/`）に替える
- トークン（管理画面と、`DummyAuth::token()`）の期限だけは、本物の時計で決まる（JWT のライブラリが `time()` を見るため、`travelTo()` は効かない）。`DummyAuth::token()` に期限を渡すときは、`time()` をもとに書く（期限切れなら `time() - 60`）

### テストの書き方

置き場・名前・`describe()` と `it()`・並べ方・確かめ方・コメントは [testing-style.md](testing-style.md) に書く。

## 単体とE2Eの切り分け

E2Eで検証する:
- ユーザーフローの完走（ログイン→操作→結果の確認）
- 認証・認可（他人のデータが見えない・権限で表示が変わる）
- 複数画面やAPIをまたぐ統合動作、状態遷移（ローディング→成功/エラー）
- 実APIとの通信を含むフロー（モックしない）

単体で検証する:
- 純粋な計算・整形・バリデーション（外部I/Oなし）
- E2Eでは網羅しにくい細かい分岐

中間（結合テスト）に落とす:
- DBをまたぐ制御フロー、API のルートやサーバー側の処理の薄い制御
- E2Eにするとモックが増えすぎて実装詳細に張り付くケース

## E2Eのシードデータ

E2Eは、固定のシードデータを入れたデータベースに対して走らせる。ログインできる
テストユーザーと権限の違いを確かめるためのデータを、あらかじめ用意しておく。

- シードは1つの定義に集約し、テスト内で独自のマジック値を作らない
  （`backend/client/database/seeders/` と `backend/client/database/factories/`）
- 最低限用意する: 権限ごとのログインユーザー（管理者・一般など固定メール＋固定ID）、
  他人のデータが見えないことを確かめるための「別の持ち主のデータ」
- 実行の流れ: シード投入 → アプリ起動 → E2E 実行
  （コマンドは 03b で E2E の道具を決めるときに書く）
- 読み取り専用のテストは既存シードを使う。変更を伴うテストは専用データをfixturesで作り、
  後始末する（共有シードを書き換えると並列実行で他のテストが壊れる）

## テストを弱めて通さない

テストが何も確かめていないのに、通って見える書き方を避ける。

記入例（TypeScript・Vitest）。技術が決まったら、その言語とツールの例に書き換える:

```typescript
// ❌ 何も確かめていない
expect(result).toBeDefined();
// ❌ 常時成功モック（本物が壊れても通る）
vi.mock("./calcTax", () => ({ calcTax: () => 1000 }));
// ❌ 条件付きスキップ（環境がないと黙って成功扱い）
if (!process.env.API_KEY) return;
// ❌ awaitしないrejects（失敗しても通る）
expect(createInvoice(input)).rejects.toThrow();
// ❌ 実行されないかもしれないexpect（空配列なら何も検証しない）
for (const line of lines) expect(line.amount).toBeGreaterThan(0);

// ✅ 期待値を固定してassertする。境界の両側を書く
expect(calcTax(10000)).toBe(1000);
expect(calcTax(0)).toBe(0);
// ✅ rejectsはawaitし、例外の種類まで確かめる
await expect(createInvoice(input)).rejects.toThrow(InvoiceValidationError);
```

- 修正を戻すとテストが落ちることを確かめる。修正の前後どちらでも通るテストは、
  ないより悪い（確かめているように見えるため）
- 新しいケースは既存テストの横に足す。既存テストの入力を新しいケースに書き換えない。
  既存テストの削除・スキップには理由を書く

- compose の `environment` で渡した変数を、テストで別の値にするときは、`phpunit.xml` に `<server>` と `force="true"` の `<env>` の両方で書く
  （Laravel は `$_SERVER` から先に読み、Docker の環境変数は `$_SERVER` に入る。`<env>` は `$_SERVER` を変えないので、
  片方だけだと compose の値が勝つ。00 で DB の接続先とメールの送り先の2回、テストが開発用の設定のまま動いた）
- E2Eでアプリ内部のAPI応答をモックしない（結合を確かめるのがE2Eの仕事）
- 一部だけ実行する指定・飛ばす指定（記入例: `.only` / `.skip`）を残したままコミットしない
- 新規テストは先にRed（失敗）を確認してから実装する
- 期待結果はプランの「新規テストケース」と要件を出典にする。実装コードを正解にしない
- **例外：今の動きを確かめるテスト**（移す前に足す API テスト）は、最初から通り、期待値は今の振る舞いになる。テストを弱めて通したものと見分けるため、次の順で書く
  1. 期待値を要件（`docs/requirements/`）と `docs/api/` から書き、テストの名前に要件 ID を書いて流す
  2. 落ちたら、それが要件と今の振る舞いの違い。そこだけ期待値を今の振る舞いに直し、テストに「分かっている不具合：…」とコメントを書く（直すのは改善のチケット）
  3. 今の動きを確かめるテストごとに、そのテストが確かめているコードの行（条件・状態コード）を手で1回壊し、落ちるのを見る。壊した行と落ちたテストの名前を PR に並べる
- **新しい URL に移したときのテスト**（今の URL を変えずに残し、同じ機能を新しい URL に作るとき。`docs/cycles/01-backend-foundation/03-how.md` の「今の URL を壊さずに直す流れ」）
  1. 新しい URL のテストは、今の URL に対する、今の動きを確かめるテストをコピーして作る
  2. 違ってよい点（`data` で包む・状態コード（形の違う ID は 404 など）・出さない項目）は、移すチケットの表に並べる。表にないものは、期待値を変えない
  3. 今の URL に対する、今の動きを確かめるテストは、今の振る舞いのまま期待値を書く（例：形の違う ID は 500 のまま）。今の URL を消すときに、このテストも一緒に消す。消すチケットに、新しい URL のどのテストが引き継いだかを書く
- **安全の穴を直すときのテスト**（要件と違う動きのうち、他人のデータや権限に関わるものを直すとき）
  1. 直すのは、ほかの変更（移す・性能）と別のコミットにする
  2. 直す前に、「分かっている不具合：…」として今の動きを確かめているテストを、要件どおりの期待値に変え、落ちることを先に見せる
  3. 書き換えたテストの名前を、PR に並べる
- 外のサービス（Firestore・メール。`app/Clients/` の Client）を偽物に差し替えるときは、いつも成功を返すだけの作りにしない。送った中身を覚えておき、テストで確かめられるようにする。偽物の外への書き込みは、トランザクションの中で呼ばれたら失敗する（`architecture-backend.md` の5章：外への書き込みはコミットのあと）
- プランで決めた期待結果を、実装を通すために書き換えない。変える必要があれば停止して報告する

## テストの独立性（並列実行対応）

- 各テストが自分専用のデータを作り、終了時に片付ける
- 他のテストが作ったデータ・実行順序に依存しない
- 今の時刻に依存しない。時刻は引数で渡すか、テストのツールで固定する
  （月末・年末・タイムゾーンで落ちるため。記入例: `new Date()` を直接使わず `vi.useFakeTimers()` で固定する）
- 決まった時間だけ待たない。条件がそろうまで待つ仕組みを使う
  （記入例: `waitForTimeout` ではなく `expect(...).toPass()` やロケータの自動待機）
- 画面の要素は、役割・ラベル・テスト用の ID で探す。見た目のためのクラス名に依存しない
