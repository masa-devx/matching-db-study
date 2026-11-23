---
paths:
  - "backend/*/tests/**"
  - "frontend/*/tests/**"
---

# テストコードの書き方

Pest のテストを、あとから読んだ人が「どの API の、どんな前提で、何を確かめているか」をすぐ分かるように書く。
何を確かめるか（観点・ダミーデータ・テストを弱めて通さない）は [testing.md](testing.md) に書く。ここは書き方だけ。2026-11-19 に人が決めた。
会員の画面（`frontend/client/tests/`）のテストも同じ形で書く。違う所だけを9章に書く（2026-11-23 に人が決めた）。

## 1. 置き場と名前

| もの | 置き場 | 例 |
| --- | --- | --- |
| API テスト | `tests/Feature/<業務のまとまり>/<操作>Test.php` | `tests/Feature/Profile/ShowTest.php`（相手のプロフィールを見る） |
| どのまとまりにも入らないもの | `tests/Feature/` の直下 | `HealthTest.php`・`TestEnvironmentTest.php` |
| DB を使わないロジック | `tests/Unit/`。`app/` と同じフォルダの形にする | `tests/Unit/Models/UserTest.php` |
| ダミーデータ | `tests/DummyData/Dummy<名詞>.php` | `DummyUser::create()` |
| テストで呼ぶ API の URL | `tests/Endpoints.php` | `Endpoints::profile($target->publicId)` |

- なぜ：業務の名前で分けると、URL やクラスを移しても、テストの置き場が変わらない

### API テストの名前

- まとまりは `app/` と同じ名前（`docs/backend.md` の2章）
- 1つのまとまりに名詞が2つ以上あるときは `<操作><名詞>Test.php`（例：`Profile/ShowAccountTest.php`。2026-11-20 に決めた）
- 今ある `Profile/ShowTest.php`・`UpdateTest.php` の名前は、その API を移すときに見直す

### テストで呼ぶ API の URL

- `tests/Endpoints.php` の1つのクラスに、API ごとにメソッドを1つ書く
- 名前は「何の API か」で、業務のまとまりごとに見出しで区切る
- URL の文字は、ここにだけ書く
- `route()` で作らない。ルートの URL を変えてもテストが落ちず、画面が壊れても気づけないため（2026-11-19 に人が決めた）

## 2. ファイルの形

```php
<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// GET /api/users/{user_id}：相手のプロフィールを見る。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」

// テストで使う値（DB の行は、それぞれのテストの中で作る）
$unknownPublicId = '00000000-0000-0000-0000-000000000000';

/**
 * 正常系：要件が通す操作
 */
describe('ログインしている人が、相手のプロフィールを見る', function (): void {
    it('マッチしていない相手なら、トークルームの番号は空（`room_id` が null）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしている人が、いない会員のプロフィールを見る', function () use ($unknownPublicId): void {
    it('見られない（404「会員が見つかりません」）', function () use ($unknownPublicId): void {
        DummyAuth::actingAs(DummyUser::create())->getJson(Endpoints::profile($unknownPublicId))
            ->assertNotFound()
            ->assertExactJson(['message' => '会員が見つかりません']);
    });
});
```

- ファイルの先頭のコメントに「どの API の、何のテストか」を2行までで書く
- `use` の並びは Pint にそろえてもらう（クラス → 関数の順）

### ファイルの中の並び（API テスト）

スクロールしたときに、上から「使う値 → 正常系 → 異常系」の順で読めるようにする（2026-11-22 に人が決めた。`tests/Feature/Auth/ChangePasswordTest.php` が最初の見本）。

1. 先頭の説明（上のとおり2行まで）
2. テストで使う値：入力の値・期待する文など、変わらない値だけ
   - ファイルの上の変数に置き、`function () use ($validInput): void` で `describe()` と `it()` に渡す
   - DB の行（会員など）は置かない。それぞれのテストの中で作る（4章）
3. 正常系の `describe()` を全部
4. 異常系の `describe()` を全部

正常系と異常系の区切りは、上の見本の `/** */` の形のコメントにする。

- 正常系か異常系かは、**要件が、その操作を通すか断るか**で決める。結果が要件と違うかどうかでは決めない
  - 例：パスワードを変えたあとも、ほかの端末がログインしたまま（要件は 401）。操作は要件が通すので、正常系。結果が違うので「分かっている不具合」のコメントを付ける（6章）
  - 例：1文字のパスワードで通ってしまう（要件は 422）。操作は要件が断るので、異常系。同じく「分かっている不具合」のコメントを付ける
- `describe()` は前提で分け、1つの `describe()` の中が、全部正常系か、全部異常系になるようにする（「正しい今のパスワードを送る」と「違う今のパスワードを送る」は、別の `describe()` にする）
- 正常系・異常系の印は、`describe()` と `it()` の名前に入れない（コメントと名前の2か所に書くと、食い違うため）
- どちらとも取れないときは、その `describe()` の上に、そちらに入れた理由をコメントで書く（例：`// 正常系とした：会員はアカウント停止中だが、要件はログアウトを通す`）
- 区切りはコメントなので、テストを流したときの出力には出ない。出力では、`describe()` の前提を読んで見分ける
- 今あるテストは、一度に直さない。そのファイルを触るチケットで、この並びに直す。`tests/Unit/`・`tests/Arch/` には当てはめない
- なぜ：成功する場面と断る場面が混ざって並ぶと、どこまでが「要件が通す操作」かを、1本ずつ読まないと分からないため。1本のテストは、それだけ読めば分かるように書き（Google の Testing Blog「Tests Too DRY? Make Them DAMP!」）、共通のデータを先に作っておく形（『xUnit Test Patterns』の Mystery Guest）は避ける

## 3. `describe()` と `it()`

テストの名前だけを読んで、何のテストで、何を確かめているかが分かるように書く。日本語として自然な文にし、このリポジトリだけで通じる言い方や、コードの名前だけの言い方にしない（2026-11-20 に人が決めた。#243）。

- `describe()` には、**だれが・どんな状態で・何をするか**（前提と操作）を書く。`describe()` だけを読んでも、何のテストかが分かるようにする
  - 例：「ログインしていない人が、相手のプロフィールを見る」「使えなくなった会員が、前にもらったトークンで相手のプロフィールを見る」
  - 書かない例：「トークンがおかしい」「URL の番号がおかしい」（何の操作のテストかが分からない）
- `it()` には、その前提で**何が起きるか**を、業務の言葉で書く。状態コード・文・API の項目の名前は、括弧の中に添える
  - 例：「停止させられた会員は、見られない（401「ログインしてください」）」「マッチしていない相手なら、トークルームの番号は空（`room_id` が null）」
  - 書かない例：「401 で「ログインしてください」」「room_id は null」（状態コードや項目の名前だけが主語になっている）
- SQL の本数を確かめるテストは、数字だけにせず、何を確かめたいかを書く。数字は括弧の中に書き、内訳はテストの中のコメントに書く
  - 例：「書き換えるときの SQL は、決まった本数で済む（4本）」
  - 書かない例：「SQL は4本（送った人・会員の番号・プロフィール・書き換え）」
- 要件 ID があるものは、`it()` の名前の最後の括弧に書く
- `describe()` の入れ子は1段まで
- なぜ：流したときに「ログインしていない人が、相手のプロフィールを見る → 見られない（401…）」と1文で読める。Bruno のシナリオ（`bruno/`）の前提とも対応が取れる

## 4. 1本のテストの中の並べ方

**用意する → 呼ぶ → 確かめる**の順に書き、間を空行で区切る。

- 用意するデータは、その `it()` の中で作る。`beforeEach()` にまとめない
- なぜ：`beforeEach()` にまとめると、そのテストだけを読んでも、何を用意したかが分からなくなる。テストどうしが同じデータに頼るようにもなる
- 2回以上使う入力は、変数にする（`$input = ['nickname' => 'あと', ...]`）

## 5. 確かめ方

| 確かめたいこと | 書き方 | 使わない書き方（理由） |
| --- | --- | --- |
| 状態コード | 状態コードごとの関数（下に一覧） | `assertServerError()`（500〜599 のどれでも通るので、弱くなる） |
| 返す項目 | `assertJsonPath('profile.nickname', 'さき')` | ― |
| 返してはいけない項目 | `assertJsonMissingPath('email')` | ― |
| エラーの文 | `assertExactJson(['message' => '会員が見つかりません'])` | `__('errors.user_not_found')` で読む・状態コードだけを見る（理由は下） |
| DB の変化 | `assertDatabaseHas('profiles', [...])`（表の名前で書く） | Model を読む（中の作りに頼る） |
| ほかの会員の行が変わらない | 書き換えた人のほかに、もう1人作って、その行も `assertDatabaseHas()` で確かめる | 書き換えた人の行だけを見る（全員が変わっても気づけない） |

- 状態コードの関数：`assertOk()`・`assertNotFound()`・`assertUnauthorized()`・`assertForbidden()`・`assertUnprocessable()`・`assertInternalServerError()`
- エラーの文は、文を文字で書く。状態コードだけでなく、文まで見る
  - `__('errors.user_not_found')` で読まない。文を変えてもテストが一緒に変わり、画面の文が変わったことに気づけないため
  - 状態コードだけを見ない。URL を間違えたときの「ルートがない」404 と見分けられないため

## 6. 要件と違う所（分かっている不具合）

今の動きを確かめるテストは、次の順で書く（[testing.md](testing.md) の「テストを弱めて通さない」）。

1. 期待値を要件どおりに書いて流す
2. 落ちたら、そこが要件と今の動きの違い。期待値を今の動きにし、`it()` の上にコメントを書く
3. 確かめている行を手で1回壊し、落ちるのを見てから戻す

```php
// 分かっている不具合：要件は 404。形を確かめずに UUID の列を探し、PostgreSQL のエラーになる
it('番号が UUID の形でないと、見られずにサーバーのエラーになる（500）', function (): void {
```

- コメントは「分かっている不具合：要件は〜。原因は〜」の形で、2行まで
- `it()` の名前には、今の動きを、3章の形で書く（「番号が UUID の形でないと、見られずにサーバーのエラーになる（500）」）。要件の動きは名前に書かない
- なぜ：直すときは、このコメントの付いたテストを要件どおりに戻せば、落ちる（Red）→ 直す → 通る（Green）の順で進められる

## 7. コメント・型・書かないもの

- コメントは2〜3行まで。「何をしているか」ではなく「なぜか」を書く
- Issue・PR の番号は書かない（あとで変わり、読み返したときに分からなくなる）。要件 ID と、`docs/` のファイルの名前は書いてよい
- 無名関数には戻り値の型 `: void` を書く
- ダミーデータのクラスは `final` にし、テストから呼ぶものを `public static`、中の手順を `private static` にする

## 8. 書いたら流す

[docs/commands.md](../../docs/commands.md) の「テスト」「静的検査・整形」を流す。1つのファイルだけを流すときは、パスを付ける。

## 9. 画面のテスト（`frontend/client/tests/`）

1〜8章を、そのまま当てはめる。2章の並び（使う値 → 正常系 → 異常系と `/** */` の区切り）・3章の名前・4章の「用意する → 呼ぶ → 確かめる」・6章の「分かっている不具合：…」・7章のコメントの決まりは、バックエンドと同じ。ここには、違う所だけを書く。

### 置き場と名前

| もの | 置き場 | 例 |
| --- | --- | --- |
| 結合テスト | `tests/integration/<機能>/<確かめるファイルの名前>.test.ts(x)` | `tests/integration/settings/SettingsPage.test.tsx` |
| `app/`・`shared/session/` の部品 | `tests/integration/app/`・`tests/integration/session/` | `tests/integration/app/RequireAuth.test.tsx` |
| `src/api/client.ts` | `tests/api/client.test.ts` | ― |
| 単体 | `tests/unit/`。`src` と同じフォルダの形 | `tests/unit/features/messages/rules.test.ts` |
| 偽の応答・道具 | `tests/support/` | `tests/support/handlers/profileApi.ts` |

- `<機能>` は `docs/frontend.md` の「会員の画面の行き先」の機能の名前（`architecture-frontend.md` の7章）
- ファイルの名前は、確かめるファイルの名前に `.test` を付ける（画面を移して名前が変わったら、テストの名前も変える）

### ファイルの形

```tsx
// SettingsPage.tsx のパスワードの変更（FR-AUTH-033）。API は MSW で偽物にする

// テストで使う値
const CURRENT_PASSWORD = 'password'

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員が、設定で、決まりに合わない新しいパスワードに変える（422）', () => {
  it('API が返した文を出す（FR-AUTH-033）', async () => {
    server.use(http.put(apiUrl('/api/me/password'), () => HttpResponse.json(body, { status: 422 })))
    await fillPasswordForm()

    await userEvent.click(screen.getByRole('button', { name: '変える' }))

    expect(await screen.findByText('新しいパスワードは8文字以上にしてください')).toBeInTheDocument()
  })
})
```

- 「テストで使う値」には、変わらない値（入力・期待する文）・偽物（`vi.fn()`・`vi.mock()`）・画面を描く関数を置く
- `beforeEach()` に書くのは、道具の準備と片付けだけ：偽物の片付け（`mockReset()`・`sessionStorage.clear()`）・`src/api/client.ts` への処理の渡し直し（`configureApiClient()`）・偽の時計。データ（Cookie・`sessionStorage` に入れる値・偽の応答）は、それぞれの `it()` の中で用意する
- jsdom にない機能の代わり（`<dialog>` の `showModal()` など。`tests/support/dialog.ts`）は、`beforeAll()` で1回だけ置く
- 4章の「呼ぶ」は、会員の操作（`userEvent.click()` など）か、hook・関数を呼ぶ1行
- 単体（`tests/unit/`）には、2章の並びを当てはめない（バックエンドの `tests/Unit/` と同じ）
- 書き方の決まり（アロー関数・名前付き export・`type`・`useState` の型。`quality-frontend.md` の S1〜S5）に従う。7章の「無名関数に `: void` を書く」は PHP だけの決まりなので、当てはめない

### 偽の応答（MSW）

- 既定の応答は `tests/support/handlers/〇〇Api.ts` に置く（今の API と同じ形。`docs/api/` の改善版の今の列）
- テストごとに違う応答（失敗・空・別の会員）は、その `it()` の中の「用意する」で `server.use(...)` で上書きする。テストが終わると、`tests/support/setup.ts` が戻す
- 何本呼んだか・何を送ったかは、`sentRequests()`・`sentPaths()` で確かめる
- 応答を返さない偽物で読み込み中を見るテストは、要求が偽物に届いたのを確かめてから終える（`await vi.waitFor(() => expect(sentRequests(…)).toHaveLength(1))`）。届く前に終えると、届くのが次のテストになり、次のテストの偽の応答を使ってしまう

### 画面の要素の探し方と確かめ方

- 画面の要素は、役割（`getByRole`）→ ラベル（`getByLabelText`）→ 文字（`getByText`）→ テスト用の ID（`getByTestId`）の順で探す
- 画面の文は、文字で書いて確かめる。状態だけを見ない
- 失敗するはずの呼び出しは `await expect(…).rejects.toThrow(<失敗の型>)` で、`await` を付け、失敗の型まで確かめる
- 偽の時計（`vi.useFakeTimers()`）を使うテストでは、`vi.waitFor()` が時計を進めながら待つ。時間の境目を数えるときは、本物の時計で待つ（`tests/integration/messages/useBadgeCounts.test.ts` の `waitWithRealClock`）
