---
paths:
  - "backend/app/**"
  - "backend/database/**"
  - "backend/routes/**"
  - "backend/tests/**"
  - "backend/phpstan.neon"
---

# PHP の型と PHPDoc

レガシー版（`legacy-repo`）から型を書く（D-016）。言語で書ける型は言語で書き、言語で書けない型（配列やコレクションの中身・Eloquent のリレーション）は PHPDoc に書く。型は PHPStan（Larastan）が CI で確かめる（D-017・[docs/ci.md](../../docs/ci.md)）。

## 段階ごとの強さ

| ブランチ | PHPStan のレベル | 理由 |
| --- | --- | --- |
| `legacy-repo`（レガシー版） | 6 | 引数・戻り値・プロパティに型がないものを見つける。NULL の扱い（レベル 8）は見ない。レガシー版の「`null` に書こうとして `500`」のような問題は、わざと残して測るため |
| `refactored-repo`（改善版） | 直す一歩ごとに上げ、最後は 9 | NULL の扱い（8）・`mixed` を使わない（9）まで守る。レベルを上げたときの指摘の数を、前と後の数字として decisions.md に残す |

レベルを下げない。どうしても通らない指摘は、`phpstan.neon` の `ignoreErrors` に理由のコメントと一緒に書き、行の中に `@phpstan-ignore` を散らさない（どこで目をつぶったかを1か所で見られるようにするため）。

## 書き方

- すべての PHP のファイルの先頭に `declare(strict_types=1);` を書く。`"5"` を `int` の引数に黙って変えさせないため
- 引数・戻り値・プロパティには、言語の型を必ず書く。コントローラの `$id` も `int $id` か `string $id` にする（ルートの引数は文字で来るので、受けたい型を決める）
- 戻り値に値がないときは `void`、例外を投げて戻らないときは `never`
- 配列は、中身の型を PHPDoc に書く。`array` だけにしない

  ```php
  /** @return list<string> */                          // 0 から順の番号の配列
  /** @param array<string, mixed> $attributes */       // キーが文字の配列（中身がばらばらのときだけ mixed）
  /** @return array{status: string, migrations: int} */ // 決まったキーの配列
  ```

- Eloquent のリレーションとコレクションは、PHPDoc で相手の型を書く

  ```php
  /** @return HasOne<Profile, $this> */
  public function profile(): HasOne

  /** @return Collection<int, User> */
  ```

- Model の列の型（`@property`）と、Eloquent の魔法のメソッド（`where〇〇()` など）の `@method` は、**Model には書かない**。型の確かめは、Larastan がマイグレーションと Eloquent の仕組みから推し量る。エディタの補完が要るときは、Laravel IDE Helper で別のファイル（`backend/_ide_helper_models.php`。git に入れない）に書き出す。Model に書くと長くなり、マイグレーションと同じ事実が2か所になって、作り直し忘れでずれるため（architecture.md の SSoT）
- Model に手で書くのは、リレーションの戻り値（`@return HasOne<Profile, $this>`）など、Larastan が推し量れない型だけ
- `mixed` は、本当に何でも来るところ（`$request->all()` の中身など）だけにする
- 型を書いても PHP は実行するときに確かめるので、型が合わないと `TypeError` になる。レガシー版でも、型を書いたら、curl で動きを確かめ直す

## してはいけないこと

| してはいけない | 理由 |
| --- | --- |
| PHPDoc にだけ型を書き、言語の型を書かない（言語で書けるのに） | PHPDoc は実行するときに確かめられない。言語の型なら、違う値が来たときにすぐ分かる |
| 言語の型と PHPDoc の型を食い違わせる（`int` と書いて `@return string`） | PHPStan は食い違いを指摘するが、読む人が迷う |
| レベルを通すために `@var` で型を言い張る（`/** @var User $user */` を、本当は `null` かもしれない値に付ける） | 静的解析をだますだけで、実行するときのエラーは消えない |
| `phpstan.neon` のレベルを下げる・`paths` から外す | 確かめていないことになる |
