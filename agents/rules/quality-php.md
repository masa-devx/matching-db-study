---
paths:
  - "backend/*/app/**"
  - "backend/*/bootstrap/**"
  - "backend/*/database/**"
  - "backend/*/routes/**"
  - "backend/*/tests/**"
  - "backend/*/phpstan.neon"
---

# PHP の書き方（Laravel 13・PHP 8.5）

PHP のコードを書くときの、Laravel 13 と PHP 8.5 の決まり。型と PHPDoc は [quality-types.md](quality-types.md)、置き場・名前・依存の向きは [architecture-backend.md](architecture-backend.md)、テストの書き方は [testing-style.md](testing-style.md) に書く。ここには、それらと重ならない所だけを書く（2026-11-21 に人が決めた。#261）。

解説（なぜこの形か・PHP 8.4／8.5 の新しい書き方・好みで選ぶもの）は [explanations/php-coding.html](../../explanations/php-coding.html)。

## 1. 書き方は、Pint（`laravel` の preset）が直した形を正とする

- 空白・改行・括弧・`use` の並びは、`./vendor/bin/pint` が直した形を正とする。手で直さない
- PER Coding Style と違う所も、Pint に合わせる。主な違い（手元の Pint 1.32.2 で確かめた）
  - 引数のない `new`：`new Box`（PER は `new Box()`）
  - 文字をつなぐ `.`：`'a'.'b'`（PER は `'a' . 'b'`）
  - 否定の `!`：`! $flag`（PER は `!$flag`）
  - 短い無名関数：`fn ($x)`（PER は `fn($x)`）
- なぜ：`pint.json` は `"preset": "laravel"` で、CI の `pint --test` もこの形で確かめる。人が覚えるより、Pint に直させるほうがずれない。Laravel の `contributions.md` は今も古い PSR-2 を指しているので、文書ではなく preset を正とする
- 根拠：https://github.com/laravel/pint/blob/main/resources/presets/laravel.php ・ https://laravel.com/docs/13.x/pint ・ https://www.php-fig.org/per/coding-style/

## 2. Laravel のメソッドと関数に、引数を名前で渡さない

- Laravel のメソッドと関数（`Illuminate\` の名前空間のもの。`DB::transaction()`・`response()->json()` など）には、引数を順番で渡す。`attempts: 3` のように名前で渡さない
- 決まりの外（名前で渡してよい）
  - 自分で書いたクラス（Service・Client・テストのダミーデータ）
  - Symfony・Pest・PHP の組み込みの関数（`Request::create(..., server: [...])` など。2026-11-21 に人が決めた）
- 例外（Laravel のものでも、名前で渡してよい）
  - Laravel のひな形がもとから名前で書いている所（`bootstrap/app.php` の `Application::configure(basePath: ...)`・`withRouting(web: ...)`）
  - Laravel の文書が名前で書いている値のクラス（メールの `Envelope(subject: ...)`・`Content(text: ..., with: [...])` など）。順番で書くと、何番目が何かを読めなくなるため（2026-11-21 に人が決めた）
- なぜ：Laravel は、引数の名前を後方互換を約束する範囲に入れていない。小さい版の更新で名前が変わると、名前で渡した所だけが `Error` になる
- 根拠：https://laravel.com/docs/13.x/releases#named-arguments

## 3. 自分のクラスはコンストラクタで受け取り、interface を使わないクラスはコンテナに登録しない

- Service・Client は、使う側のコンストラクタの引数（`private readonly ProfileService $profiles`）で受け取る
- interface を使わないクラスは、`AppServiceProvider` に `bind()`・`singleton()` を書かない。Laravel が引数の型から自分で作る
- `bind()` を書くのは、interface に対して本物とテスト用の偽物を差し替えるときだけ（`architecture-backend.md` の9章）
- なぜ：具体的なクラスだけに頼るクラスは、コンテナに教えなくても作れる。要らない登録を書くと、登録とクラスの2か所を直すことになる
- 根拠：https://laravel.com/docs/13.x/container#zero-configuration-resolution

## 4. Eloquent の Model に、列と同じ名前のプロパティを宣言しない

- Model（`app/Models/`）には、列と同じ名前の `public` のプロパティを宣言しない。PHP 8.4 のプロパティのフックと `private(set)` も、列には使わない
- 書くときに整える・読むときに作るのは、Laravel の Accessor・Mutator（`Attribute::make()`）か `casts()` で書く
- なぜ：Eloquent は、宣言していないプロパティへの読み書きを `__get`・`__set` で受けて、列の値に入れる。宣言すると PHP がそちらに読み書きし、Eloquent を通らない。手元で確かめると、フック付きのプロパティを宣言した Model は、`getAttributes()` が `[]` になり、保存しても列に入らなかった
- 根拠：https://laravel.com/docs/13.x/eloquent-mutators#defining-an-accessor ・ https://wiki.php.net/rfc/property-hooks
