---
paths:
  - "backend/*/tests/**"
  - "backend/*/phpunit.xml"
  - "frontend/*/src/**/*.test.*"
  - "frontend/*/vitest.config.*"
---

# 単体/E2Eの切り分けと骨抜き禁止

## 種別と実行コマンド

実行コマンドは AGENTS.md の「主要コマンド」と同じものを書く。

| 種別 | ツール | 置き場所 | 実行 | 何を守るか |
| --- | --- | --- | --- | --- |
| 単体 | Pest・Vitest（画面） | `backend/client/tests/Unit/`・`backend/admin/tests/Unit/`（`app/` の構造を再現）・`frontend/client/src/**/*.test.tsx` | `docker compose run --rm app ./vendor/bin/pest tests/Unit`（画面は 03b で決める） | ロジックの境界値・異常系 |
| 結合（API テスト） | Pest（テスト用の PostgreSQL に対して実行） | `backend/client/tests/Feature/`・`backend/admin/tests/Feature/` | `docker compose run --rm app ./vendor/bin/pest tests/Feature`（管理画面は `admin-app`） | DB や API をまたぐ制御・API の振る舞い |
| アーキテクチャ | Pest の `arch()`（`pestphp/pest-plugin-arch`） | `backend/client/tests/Arch/`（正本）・`backend/admin/tests/Arch/`（写し） | `docker compose run --rm app ./vendor/bin/pest tests/Arch`（管理画面は `admin-app`） | 層の依存の向きと名前（`architecture.md` の8章） |

- 管理画面（`backend/admin`）は、**今は PHPUnit と SQLite のメモリ DB**（`phpunit.xml`）で動く。上の表の Pest と PostgreSQL（`matching_admin_test`）は、切り替えるチケットのあとから
| E2E | 03b（React を足す）で決める | 03b で決める | 03b で決める | 主要フロー・認可・状態遷移 |

- 単体の置き場所は、実装のパスと対応づける（例: `app/Domain/Matching/Like/LikeQuota.php` → `tests/Unit/Domain/Matching/Like/LikeQuotaTest.php`・`app/Application/UseCases/Matching/LikeMemberUseCase.php` → `tests/Unit/Application/UseCases/Matching/LikeMemberUseCaseTest.php`）
- 各テストの組（`Unit`・`Feature`・`Arch`）は、`phpunit.xml` の `<testsuites>` に並べる。並べていないフォルダのテストは流れない
- テストの部品（データを作る関数・ログインした状態を作る関数）は `tests/Support/` に置く。API テストに Model の名前空間を書かない（`architecture.md` の10章）
- E2Eは実行前にシードデータの投入とアプリ起動が要る（後述）

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

## 骨抜き禁止

テストが何も守っていないのに、通って見える書き方を避ける。

記入例（TypeScript・Vitest）。技術が決まったら、その言語とツールの例に書き換える:

```typescript
// ❌ 何も守っていない
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
  ないより悪い（守っているように見えるため）
- 新しいケースは既存テストの横に足す。既存テストの入力を新しいケースに書き換えない。
  既存テストの削除・スキップには理由を書く

- compose の `environment` で渡した変数を、テストで別の値にするときは、`phpunit.xml` に `<server>` と `force="true"` の `<env>` の両方で書く
  （Laravel は `$_SERVER` から先に読み、Docker の環境変数は `$_SERVER` に入る。`<env>` は `$_SERVER` を変えないので、
  片方だけだと compose の値が勝つ。00 で DB の接続先とメールの送り先の2回、テストが開発用の設定のまま動いた）
- E2Eでアプリ内部のAPI応答をモックしない（結合を確かめるのがE2Eの仕事）
- 一部だけ実行する指定・飛ばす指定（記入例: `.only` / `.skip`）を残したままコミットしない
- 新規テストは先にRed（失敗）を確認してから実装する
- 期待結果はプランの「新規テストケース」と要件を出典にする。実装コードを正解にしない
- **例外：今の振る舞いを固めるテスト**（移す前に足す API テスト）は、最初から通り、期待値は今の振る舞いになる。骨抜きと見分けるため、次の順で書く
  1. 期待値を要件（`docs/requirements/`）と `docs/api/` から書き、テストの名前に要件 ID を書いて流す
  2. 落ちたら、それが要件と今の振る舞いの違い。そこだけ期待値を今の振る舞いに直し、テストに「既知のリスク：…」とコメントを書く（直すのは改善のチケット）
  3. 固めるテストごとに、そのテストが守る行（条件・状態コード）を手で1回壊し、落ちるのを見る。壊した行と落ちたテストの名前を PR に並べる
- UseCase の単体テストの偽物（Repository・外のサービス）は、いつも成功を返すだけの作りにしない。メモリの上で本当に保存・検索する実装にする。偽物のトランザクションは「中にいる」印を持ち、偽物の外への書き込みは、トランザクションの中で呼ばれたら失敗する
- プランで決めた期待結果を、実装を通すために書き換えない。変える必要があれば停止して報告する

## テストの独立性（並列実行対応）

- 各テストが自分専用のデータを作り、終了時に片付ける
- 他のテストが作ったデータ・実行順序に依存しない
- 今の時刻に依存しない。時刻は引数で渡すか、テストのツールで固定する
  （月末・年末・タイムゾーンで落ちるため。記入例: `new Date()` を直接使わず `vi.useFakeTimers()` で固定する）
- 決まった時間だけ待たない。条件がそろうまで待つ仕組みを使う
  （記入例: `waitForTimeout` ではなく `expect(...).toPass()` やロケータの自動待機）
- 画面の要素は、役割・ラベル・テスト用の ID で探す。見た目のためのクラス名に依存しない
