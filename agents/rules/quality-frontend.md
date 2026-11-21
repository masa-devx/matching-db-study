---
paths:
  - "frontend/*/src/**"
  - "frontend/*/biome.json"
  - "frontend/*/tsconfig*.json"
  - "frontend/*/package.json"
---

# 画面の書き方（React 19・TypeScript 7・Biome 2）

画面（`frontend/client`・`frontend/admin`）のコードを書くときの、React と TypeScript と Biome の決まり。置き場・依存の向き・状態の置き場は [architecture-frontend.md](architecture-frontend.md)、テストは [testing.md](testing.md) に書く。ここには、それらと重ならない所だけを書く（2026-11-21 に人が決めた。#114。下書きの24個のうち、強く勧める18個を採った）。

解説（なぜこの形か・採らなかった6個・今のコードの数）は [explanations/frontend-coding.html](../../explanations/frontend-coding.html)。

- 改訂版の新しいコード（`app/`・`features/`・`shared/`）は、すべての決まりに従う
- レガシー版の画面は、移すチケット（`architecture-frontend.md` の9章）で直す。移さずに触るときも、触った所は従う
- 番号（R1・T1・B1）は、解説のページと同じ。採らなかった番号（R10・R11・T5・T6・T8・B5）は欠番

## 一覧

| 番号 | 決まり | 機械で止めるか |
| --- | --- | --- |
| R1 | 描く間に外を変えず、props と state を書き換えない | 止めない（レビュー） |
| R2 | hook は一番上で呼び、`use` の名前は hook だけ | `lint:rules`（app・shared） |
| R3 | Effect は、React の外に合わせるときだけ | 止めない（レビュー） |
| R4 | データを取る Effect は、片付けで古い応答を捨てる | 止めない（レビュー） |
| R5 | 依存の配列はコードから決める。lint を止めない | `lint:rules`（app・shared） |
| R6 | 一覧の `key` はデータの id | `lint:rules`（app・shared） |
| R7 | 計算できる値・食い違う組み合わせを state に持たない | 止めない（レビュー） |
| R8 | `&&` の左には真偽の値 | 止めない（レビュー） |
| R9 | Context は `<Ctx value>`、ref は props で受ける | 止めない（レビュー） |
| T1 | `any` を書かない | `lint:rules`（app・shared） |
| T2 | 外から来る値は `unknown` で受けて絞り込む | 止めない（レビュー） |
| T3 | `as`・`!` は人が確かめられる所だけ | `!` は `lint:rules`（app・shared） |
| T4 | `XxxResponse` は API の JSON のまま書く | 止めない（レビュー） |
| T7 | `noUncheckedIndexedAccess` を入れる | `npm run build` |
| B1 | 整形と import の並びは Biome の形を正とする | 止めない（`biome check`） |
| B2 | 改訂版の置き場では `any`・`!` を error にする | `lint:rules`（app・shared） |
| B3 | lint を止めるときは規則と理由を書く | 理由が空なら Biome が誤りにする |
| B4 | a11y の規則をそのまま使う | `lint:rules`（app・shared） |

- `lint:rules`：会員の画面の `npm run lint:rules`。改訂版の置き場（`src/app`・`src/shared`）では、Biome の `recommended` の規則と、`biome.json` の `overrides` で足した規則を、警告も誤りとして見る（`recommended` に入っていない規則は流れない）。CI でも流れる
- `src/features` は、まだないので `lint:rules` の2つ目のコマンドに入っていない。`biome.json` の `overrides`（B2）には書いてあるが、CI では効かない。ディレクトリのチケットで作るときに、`lint:rules` に `src/features` を足す
- 管理画面は、改訂版の置き場ができる #123 で、同じ形（`overrides`・`lint:rules`）を足す

## 言葉

- 描く（render）：React がコンポーネントの関数を呼び、JSX を受け取ること。何度呼ばれてもよいように書く
- Effect：`useEffect` に渡す関数。描いたあとに動き、React の外（ネットワーク・DOM・タイマー）に合わせるために使う
- 片付け（cleanup）：Effect が返す関数。次の Effect の前と、コンポーネントが消えるときに呼ばれる
- 依存の配列：`useEffect(fn, [a, b])` の `[a, b]`。この値が変わったときだけ、Effect がもう一度動く
- 絞り込み（narrowing）：`typeof`・`in`・`===` などで調べて、型を狭めること
- 型の言い切り（type assertion）：`x as T` と `x!`。値を調べずに「この型だ」と TypeScript に伝える。動くときには何もしない

## 1. React の書き方

### R1. 描く間に外を変えず、props と state を書き換えない

- コンポーネントと hook の本体（描く間に動く所）では、外を変えない。API を呼ぶ・`sessionStorage` に書く・DOM を触るのは、イベントの処理か Effect の中
- props・state・hook の戻り値を、その場で書き換えない（`list.push(x)`・`user.name = 'a'`）。新しい値を作って `setXxx` に渡す
- コンポーネントの関数を、ふつうの関数として呼ばない（`{Row(props)}` でなく `<Row {...props} />`）
- なぜ：React は、同じ入力なら同じ結果になると決めて、描く回数と順番を自分で決める。開発中の `StrictMode` は、わざと2回描く。その場で書き換えると、前と同じ値と見なされ、画面が変わらないことがある
- 根拠：https://react.dev/reference/rules/components-and-hooks-must-be-pure

### R2. hook は一番上で呼び、`use` で始まる名前は hook だけに付ける

- hook は、コンポーネントか自分で作った hook の一番上で呼ぶ。`if`・ループ・`return` のあと・イベントの処理・`try` の中で呼ばない
- `use` で始まる名前は、中で hook を呼ぶ関数だけに付ける
- 例外：React 19 の `use`（Promise・Context を読む）は、`if` やループの中で呼んでよい
- なぜ：React は、hook を呼んだ順番で、どの state がどれかを見分ける。`use` の名前は、lint と読む人が hook として扱う
- 根拠：https://react.dev/reference/rules/rules-of-hooks
- 機械：Biome の `useHookAtTopLevel`・`noComponentHookFactories`

### R3. Effect は、React の外に合わせるときだけ書く

- Effect に書いてよいのは、React の外（API・Firestore・DOM の API・`window` のイベント・タイマー）に合わせる処理だけ
- 次のものは、Effect に書かない
  - props や state から計算できる値：描く間に計算する
  - 押した・送ったときに起きること：イベントの処理に書く
  - props が変わったら state を全部戻す：親で `key` を変える
  - Effect で state を変え、別の Effect がそれを見て動く形：1つのイベントの処理で、次の state を全部決める
- なぜ：要らない Effect は、1回余計に描き、値が食い違う瞬間を作る
- 根拠：https://react.dev/learn/you-might-not-need-an-effect
- データを取る Effect は、`architecture-frontend.md` の4章のとおり hook に置き、R4 に従う

### R4. データを取る Effect は、片付けで古い応答を捨てる

- API や Firestore を読む Effect には、必ず片付けを書く
- 片付けでは、`AbortController` で止めるか、`ignore` の印を立てて結果を捨てる
- `AbortController` で止められないものは、`ignore` の印で捨てる：`res.json()` が返ったあと `setXxx` までの間・`signal` を渡していない2本目の API
- なぜ：依存（会員の id・検索の条件）が変わると、前の応答があとから届き、新しい表示を上書きする
- 根拠：https://react.dev/learn/synchronizing-with-effects（「Fetching data」）
- `architecture-frontend.md` の4章の「検索の連打は `AbortController` で古い方を止める」を、データを取るすべての Effect に広げたもの
- 見本：`shared/session/SessionProvider.tsx`（読み込みに番号を付け、古い番号の結果を捨てる）

### R5. 依存の配列は、コードから決まるものを全部書く。lint を止めない

- Effect の中で使う、描くたびに変わりうる値（props・state・その値から作った値・関数）は、全部を依存の配列に書く
- 依存を減らしたいときは、配列でなくコードを直す
  - 値をコンポーネントの外に出す（定数）
  - Effect の中で作る
  - 変わっても動き直さなくてよい処理は、`useEffectEvent` に出す（React 19.2 から）。依存を隠すためには使わない
- `useExhaustiveDependencies` を `biome-ignore` で止めない
- なぜ：「1回だけ動かしたい」ために依存を省くと、古い props の値を使ったまま動き続ける
- 根拠：https://react.dev/learn/removing-effect-dependencies

### R6. 一覧の `key` は、データの id にする

- `map` で作る要素には、必ず `key` を付ける。データの id（`public_id` など）にする
- 配列の番号（`i`）・`Math.random()`・描くたびに作る値を使わない。id がないデータは、`toXxx` で id を作る
- 例外：数が決まっていて、足し引き・並べ替えが起きない一覧（スケルトン）は、番号でよい。lint を止めて理由を書く（B3）
- なぜ：番号だと、足す・消す・並べ替えるときに、入力中の値や開いている状態が、別の行に付いたまま残る
- 根拠：https://react.dev/learn/rendering-lists（「Rules of keys」）
- 機械：Biome の `noArrayIndexKey`・`useJsxKeyInIterable`

### R7. 計算できる値と、食い違う組み合わせを state に持たない

- props や ほかの state から計算できる値は、state にしない。描く間に計算する
- props を state の初めの値にするときは、名前を `initialXxx`・`defaultXxx` にする
- 同時に `true` になってはいけない真偽を並べない（`isLoading` と `isError`）。1つの `status` にする
- 同じデータを2か所に持たない（一覧と「選んだ行」の中身）。選んだ行は id だけを持つ
- なぜ：計算できる値を state に持つと、元の値が変わったときに直し忘れる。食い違う組み合わせを型で作れなくすれば、「読み込み中なのに失敗も出ている」画面がなくなる
- 根拠：https://react.dev/learn/choosing-the-state-structure
- どこに置くかは `architecture-frontend.md` の5章。hook が返す状態の形は4章

### R8. `&&` の左には真偽の値を置く

- JSX の `{a && <X />}` の `a` は、真偽の値にする。数・配列の長さは `count > 0 &&`・`list.length > 0 &&` と比べて書く
- なぜ：左が `0` だと、React は `0` を画面に出す（未読が 0 件のときに「0」とだけ出る）
- 根拠：https://react.dev/learn/conditional-rendering（「Don't put numbers on the left side of &&」）

### R9. Context は `<Ctx value>` で渡し、ref は props で受ける

- Context は `<SessionContext value={...}>` と書く。`<SessionContext.Provider>` と書かない
- 部品が `ref` を受けるときは、ふつうの props（`function Input({ ref })`）で受ける。`forwardRef` を使わない
- なぜ：React 19 から、どちらも短く書ける。React は、`<Context.Provider>` を使わないように勧め、`forwardRef` は先の版でなくすと書いている
- 根拠：https://react.dev/blog/2024/12/05/react-19（「`<Context>` as a provider」・「`ref` as a prop」）

## 2. TypeScript と型の書き方

### T1. `any` を書かない

- 型に `any` を書かない（`useState<any>`・`(row: any) =>`・`as any`）
- 何が来るか分からない値は `unknown` にし、T2 で絞り込む。API の応答は `XxxResponse`（T4）、画面の値は画面の型で書く
- `window` に足した値は、`declare global` で `Window` に宣言を足す（`window as any` と書かない）
- なぜ：`any` は、その値の型の検査を止め、そこから読んだ値にも広がる
- 根拠：https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- 機械：Biome の `noExplicitAny`（改訂版の置き場は error。B2）

### T2. 外から来る値は、`unknown` か `XxxResponse` で受け、絞り込んでから使う

- 外から来る値は、次のもの
  - `res.json()` の結果
  - `JSON.parse` の結果
  - `sessionStorage`・`localStorage` から読んだ文字
  - Firestore のドキュメントの中身（`doc.data()`）
  - `catch (e)` の `e`
- API の応答は、`api.ts`（Repository の実装）の中で、1回だけ `XxxResponse` として受ける（T3 の例外）
- それ以外は `unknown` で受け、`typeof`・`in`・`Array.isArray`・`instanceof` で調べてから使う。同じ調べ方を2か所で使うときは、型ガード（`function isXxx(v: unknown): v is Xxx`）にする
- なぜ：`res.json()` と `JSON.parse` は `any` を返し、`noExplicitAny` では見つからない。ストレージには、古い版の画面が書いた値や、人が書き換えた値が入る
- 根拠：https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- 見本：`shared/api/client.ts` の `codeOf`（`unknown` で受け、`typeof`・`in` で調べる）

### T3. `as` と `!` は、人が確かめられる所だけに書く

- 書いてよい所
  - DOM（`document.getElementById('root')`・`e.target as Node`）：HTML を見れば確かめられる
  - API の応答を `XxxResponse` として受ける1か所（T2）
  - `as const`
- 書かない所
  - `JSON.parse`・ストレージ・Firestore の値（T2 の絞り込みにする）
  - `useParams()` の値（`roomId!`）：`if (!roomId) return` で絞るか、ない場合の表示を書く
  - `as unknown as T`
- 定数の形を確かめたいときは、`as` でなく `satisfies` を使う（`const LABELS = {...} satisfies Record<Plan, string>`）
- なぜ：言い切りは、動くときに何も調べず、違っていても例外も出ない。`satisfies` は形が合わないと誤りにする
- 根拠：https://www.typescriptlang.org/docs/handbook/2/everyday-types.html（「Type Assertions」・「Non-null Assertion Operator」）
- 機械：`!` は Biome の `noNonNullAssertion`（改訂版の置き場は error。B2）。`as` は止めない（レビュー）

### T4. `XxxResponse` は API の JSON のまま書き、画面の型を作る元にしない

- `XxxResponse` は、`docs/api/` に書いた JSON の形のまま書く
  - キーの名前は API のまま（`public_id`・`email_verified_at`）
  - API が `null` を返すキーは `| null`、返さないことがあるキーだけ `?`
  - 日時は `string`
- 画面の型は、画面で使う形で別に書く（`userId`・`emailVerified: boolean`・`Date`）。`XxxResponse` から `Pick`・`Omit` で作らない
- `toXxx` は、引数に `XxxResponse`、戻り値に画面の型を書く
- なぜ：API の形が変わったときに、直す所を `api.ts` の中にとどめるため
- 根拠：`architecture-frontend.md` の4章と D-006（画面の型は手で書く）から決めた（TypeScript の公式の文書の決まりではない）
- 見本：`shared/session/SessionProvider.tsx` の `AccountResponse` と `Account`

### T7. `tsconfig` に `noUncheckedIndexedAccess` を入れる

- 両方の画面の `tsconfig.app.json` に入れた（#114）。配列の `[0]`・`Record` の `[key]` で読んだ値は、`undefined` かもしれない型になる
- `if` か `??` で絞ってから使う
- なぜ：入れる前は、`list[0].id` が、空の配列でも型の誤りにならず、動くときに止まった
- 根拠：https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess
- `strict` は、TypeScript 7 では書かなくても既定で入っている（手元の `tsc --help --all` で確かめた）

## 3. 書き方の道具（Biome）

### B1. 整形と import の並びは、Biome が直した形を正とする

- 空白・改行・引用符・セミコロン・import の並びは、Biome が直した形を正とする。手で直さない
- 形は、今の `biome.json` のまま（空白2つ・1行 120 文字・`'` の引用符・セミコロンは要る所だけ）
- 直すのは `npx biome check --write <ファイル>`（整形と import の並び）。`npm run lint` は import の並びを見ない
- 触ったファイルだけを直す。触っていないファイルの並びは、そのファイルを触るチケットで直す
- 根拠：https://biomejs.dev/formatter/

### B2. 改訂版の置き場では、`noExplicitAny`・`noNonNullAssertion` を error にする

- `biome.json` の `overrides` で、`src/app/**`・`src/shared/**`・`src/features/**` だけ、2つを `error` にした（#114）
- レガシー版のファイルは `warn` のまま（画面を移すときに直す）
- なぜ：`warn` は `npm run lint` を止めない。全体を `error` にすると、レガシー版の `any`（会員の画面 73・管理画面 46）で、すぐに通らなくなる
- 根拠：https://biomejs.dev/reference/configuration/（`overrides`）

### B3. lint を止めるときは、規則の名前と理由を書く

- `biome-ignore` には、規則の名前と、`:` のあとに理由を書く（`// biome-ignore lint/suspicious/noArrayIndexKey: 数が決まったスケルトン`）。理由が空だと、Biome が誤り（`suppressions/parse`）にする（#114 で確かめた）
- `biome-ignore-all`（ファイル全体）を使わない
- `useExhaustiveDependencies` は止めない（R5）
- 効いていない `biome-ignore` は消す
- なぜ：理由のない `biome-ignore` は、あとから外してよいかを判断できない
- 根拠：https://biomejs.dev/analyzer/suppressions/

### B4. a11y の規則は、そのまま使う

- `a11y` の規則（`useButtonType`・`useAltText`・`useKeyWithClickEvents`・`useSemanticElements` など）を `off` にしない
- 画像の `alt`・`<button>` の `type`・クリックできる要素のキーボード操作は、lint の指摘を直してから出す
- なぜ：画面のレビュー役（`.claude/agents/frontend-reviewer.md`）が見るアクセシビリティのうち、lint で見つかるものは、レビューの前に機械で止める
