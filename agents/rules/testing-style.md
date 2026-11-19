---
paths:
  - "backend/*/tests/**"
---

# テストコードの書き方

Pest のテストを、あとから読んだ人が「どの API の、どんな前提で、何を確かめているか」をすぐ分かるように書く。
何を確かめるか（観点・ダミーデータ・テストを弱めて通さない）は [testing.md](testing.md) に書く。ここは書き方だけ。2026-11-19 に人が決めた。

## 1. 置き場と名前

| もの | 置き場 | 例 |
| --- | --- | --- |
| API テスト | `tests/Feature/<業務のまとまり>/<操作>Test.php`。まとまりは `app/` と同じ名前（`docs/backend.md` の2章） | `tests/Feature/Profile/ShowTest.php`（相手のプロフィールを見る） |
| どのまとまりにも入らないもの | `tests/Feature/` の直下 | `HealthTest.php`・`TestEnvironmentTest.php` |
| DB を使わないロジック | `tests/Unit/`。`app/` と同じフォルダの形にする | `tests/Unit/Models/UserTest.php` |
| ダミーデータ | `tests/DummyData/Dummy<名詞>.php` | `DummyUser::create()` |
| テストで呼ぶ API の URL | `tests/Endpoints.php` の1つのクラスに、API ごとにメソッドを1つ。名前は「何の API か」で、業務のまとまりごとに見出しで区切る。URL の文字は、ここにだけ書く。`route()` で作らない（ルートの URL を変えてもテストが落ちず、画面が壊れても気づけないため。2026-11-19 に人が決めた） | `Endpoints::profile($target->publicId)` |

- なぜ：業務の名前で分けると、URL やクラスを移しても、テストの置き場が変わらない

## 2. ファイルの形

```php
<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// GET /api/users/{user_id}：相手のプロフィールを見る。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」

describe('ログインしている人が見る', function (): void {
    it('マッチしていない相手なら、room_id は null', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });
});
```

- ファイルの先頭のコメントに「どの API の、何のテストか」を2行までで書く
- `use` の並びは Pint にそろえてもらう（クラス → 関数の順）

## 3. `describe()` と `it()`

- `describe()` には**前提**（だれが・どんな状態で）を書く。例：「ログインしていない人が見る」「他人のプロフィールを書き換える」「URL の番号がおかしい」
- `it()` には、その前提のもとで**何が起きるか**を短く書く。例：「200 で見られる」「いない会員なら 404（FR-004）」
- 要件 ID があるものは、`it()` の名前の最後に（）で書く
- `describe()` の入れ子は1段まで
- なぜ：流したときに「ログインしている人が見る → マッチしていない相手なら、room_id は null」と1文で読める。Bruno のシナリオ（`bruno/`）の前提とも対応が取れる

## 4. 1本のテストの中の並べ方

**用意する → 呼ぶ → 確かめる**の順に書き、間を空行で区切る。

- 用意するデータは、その `it()` の中で作る。`beforeEach()` にまとめない
- なぜ：`beforeEach()` にまとめると、そのテストだけを読んでも、何を用意したかが分からなくなる。テストどうしが同じデータに頼るようにもなる
- 2回以上使う入力は、変数にする（`$input = ['nickname' => 'あと', ...]`）

## 5. 確かめ方

| 確かめたいこと | 書き方 | 使わない書き方（理由） |
| --- | --- | --- |
| 状態コード | `assertOk()`・`assertNotFound()`・`assertUnauthorized()`・`assertForbidden()`・`assertUnprocessable()`・`assertInternalServerError()` | `assertServerError()`（500〜599 のどれでも通るので、弱くなる） |
| 返す項目 | `assertJsonPath('profile.nickname', 'さき')` | ― |
| 返してはいけない項目 | `assertJsonMissingPath('email')` | ― |
| DB の変化 | `assertDatabaseHas('profiles', [...])`（表の名前で書く） | Model を読む（中の作りに頼る） |
| ほかの会員の行が変わらない | 書き換えた人のほかに、もう1人作って、その行も `assertDatabaseHas()` で確かめる | 書き換えた人の行だけを見る（全員が変わっても気づけない） |

## 6. 要件と違う所（分かっている不具合）

今の動きを確かめるテストは、次の順で書く（[testing.md](testing.md) の「テストを弱めて通さない」）。

1. 期待値を要件どおりに書いて流す
2. 落ちたら、そこが要件と今の動きの違い。期待値を今の動きにし、`it()` の上にコメントを書く
3. 確かめている行を手で1回壊し、落ちるのを見てから戻す

```php
// 分かっている不具合：要件（FR-AUTH-020）は 401。ルートに、ログインを求める Middleware がない
it('200 で見られる', function (): void {
```

- コメントは「分かっている不具合：要件は〜。原因は〜」の形で、2行まで
- `it()` の名前には、今の動きを書く（「200 で見られる」）。要件の動きは名前に書かない
- なぜ：直すときは、このコメントの付いたテストを要件どおりに戻せば、落ちる（Red）→ 直す → 通る（Green）の順で進められる

## 7. コメント・型・書かないもの

- コメントは2〜3行まで。「何をしているか」ではなく「なぜか」を書く
- Issue・PR の番号は書かない（あとで変わり、読み返したときに分からなくなる）。要件 ID と、`docs/` のファイルの名前は書いてよい
- 無名関数には戻り値の型 `: void` を書く
- ダミーデータのクラスは `final` にし、テストから呼ぶものを `public static`、中の手順を `private static` にする

## 8. 書いたら流す

AGENTS.md の「主要コマンド」の「テスト」「静的検査・整形」を流す。1つのファイルだけを流すときは、パスを付ける。
