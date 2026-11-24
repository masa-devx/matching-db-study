---
paths:
  - "frontend/*/src/**"
  - "frontend/*/biome.json"
---

# architecture-frontend（改訂版の画面）

改訂版（`refactored-repo`）の画面で、置き場・責務・依存の向きを決めるときの決まりと、書き方。会員の画面（`frontend/client`）と管理画面（`frontend/admin`）の両方に当てはめる。

- 形を選んだ理由（クリーンアーキテクチャの考え方を、どこまで採ったか）と、今のファイルをどこへ移すかの地図は [docs/frontend.md](../../docs/frontend.md)。決めたことは `docs/decisions.md` の D-018・D-026・D-029
- バックエンドの決まりは [architecture-backend.md](architecture-backend.md)。このファイルはバックエンドには当てはめない
- React・TypeScript・Biome の書き方は [quality-frontend.md](quality-frontend.md)
- レガシー版（1画面に1つの大きな部品）の書き方は、改訂版の新しいコードでは使わない
- API を呼ぶ所は、#292 で、`shared/api/`（`fetch` の包み）と `features/messages/api.ts` から `src/api/`（axios）に移した。レガシー版の画面も、`src/api/〇〇Api.ts` の関数を呼ぶ

## 1. 迷ったときの判断の順

新しいコードを書くとき、上から順に当てはめ、最初に当たった場所に置く。

| 書くもの | 置き場 |
| --- | --- |
| ルートの表（パス・画面の題・どのタブを選ぶか）・ログインの守り・枠とタブ・どの画面にどの Repository の実装を渡すか | `app/` |
| ログインした自分（`Account` の型・`/api/me` を読む・読み直す・`useSession`） | `shared/session/` |
| 送り先・Cookie・CSRF・401／419・503 を1か所で扱う | `src/api/client.ts` |
| API の失敗の型 | `src/api/ApiError.ts` |
| API を呼ぶ・API の形を画面の形に変える | `src/api/〇〇Api.ts`（業務のまとまりごと） |
| Firestore を読む・書く・形を変える | Firestore の Repository の実装（6章） |
| 取る・送る・持つ・中止・重なりを除く・失敗を状態に変える・二重に送らない・楽観的な表示を戻す | 機能の `hooks/` |
| 見せ方の決まり（年齢の下 ≤ 上・使える機能か） | 機能の `rules.ts`（純粋な関数） |
| props を受けて見せるだけ | 機能の `components/`（presenter） |
| hook・URL・ログインした自分をつなぎ、presenter に渡す | 機能の `pages/`（container） |
| どの機能にも属さない、見せるだけの部品・純粋な関数・定数（都道府県・プロフィールの選択肢・地方の区切り） | `shared/ui`・`shared/lib`・`shared/constants` |

### UI とロジックの分け方

- presenter（`components/`）：props を受けて描くだけ。`useState` は、見た目の状態（ダイアログが開いているか・タブのどれを開いているか）だけに使う
- hook（`hooks/`）：取る・送る・止める（中止）・失敗を状態に変える。API を呼ぶのは hook だけ（`src/api/` を通す）
- `rules.ts`：判断（年齢の下 ≤ 上・使える機能か）。React を使わない純粋な関数
- container（`pages/`）：hook と presenter をつなぐだけ。判断も API の呼び出しも書かない

## 2. ディレクトリと名前

```text
src/
├── api/            API を呼ぶ所（hook だけが読む）
│   ├── client.ts   axios のインスタンス（送り先・Cookie・CSRF・401／419・503）
│   ├── ApiError.ts 失敗の型
│   └── 〇〇Api.ts   業務のまとまりごとの API（authApi.ts・messagingApi.ts など）
├── app/            組み立て（router.tsx のルートの表（まだ作っていない。今は App.tsx）・RequireAuth・AppShell・Provider）
├── features/<機能>/
│   ├── index.ts    ほかの機能と app/ に見せるものだけ
│   ├── pages/      container（いつも作る）
│   ├── components/ presenter（いつも作る）
│   ├── hooks/      手順と状態（要るときだけ）
│   ├── types.ts    画面の型（要るときだけ）
│   ├── rules.ts    見せ方の決まり（決まりがあるときだけ）
│   └── repository.ts・repositories/  データの出どころが2つある機能だけ
└── shared/
    ├── session/    ログインした自分
    ├── firebase/   Emulator への接続
    ├── ui/         見せるだけの部品・スクロールする枠の Context
    ├── lib/        純粋な関数（年齢の計算・uniqueBy）
    └── constants/  定数（都道府県の名前・プロフィールの選択肢）
```

- テストは `src` の外の `frontend/client/tests/` に置く（7章）
- 機能の名前は、要件（`docs/requirements/`）のまとまりにそろえる。会員の画面の一覧は `docs/frontend.md` の「改善版の置き場」、21画面の行き先は同じ文書の「会員の画面の行き先」
- `pages/` と `components/` は、小さな機能でもいつも作る。import の決まりをフォルダの単位で書くため（平たく置くと、container と presenter を機械で見分けられない）
- 例外：画面をまだ移していない機能（今は下のタブの数だけの `messages`）は、`pages/`・`components/` を、画面を移すチケットで作る（container も presenter もまだないため。#247）
- ファイルの名前：container は `XxxPage.tsx`、presenter は `XxxView.tsx`（画面全体）か部品の名前、hook は `useXxx.ts`、API を呼ぶファイルは `src/api/〇〇Api.ts`、API の形の型は `XxxResponse`
- `features/*/api.ts` と `shared/api/` は作らない（D-029。API を呼ぶ所は `src/api/` の1か所）

### `src/api/` の中

- `client.ts`：axios のインスタンス（`axios.create()` で作ったもの。送り先や interceptors の設定を持つ）を1つ作る
  - 送り先（`VITE_API_URL`）・Cookie を送る設定・CSRF のトークン（`X-XSRF-TOKEN`）を、ここだけに書く
  - interceptors（axios が送る前と受けたあとに通す関数）で、401・419（419 の書き込みは1回だけ送り直す）・503 を1か所で扱う（4章）
  - 2xx でない応答では、`ApiError` を投げる
- `ApiError.ts`：失敗の型
  - `ApiError`：2xx でない応答（状態コード・`code`・応答の文・入力の誤り）
  - `StoppedRequestError` の3つ（`UnauthorizedError`・`MaintenanceError`・`EmailUnverifiedError`）：ログインしたあとの API の 401・419・503・確認していない 403。`client.ts` が画面を移す・帯を出すので、呼んだ所は黙って止まる
  - `ignoreApiError`：まだ移していないレガシー版の画面だけが使う。前の `fetch` で状態コードを見ずに続けていた所（ブロック・購入など）を、同じに続ける。画面を移したら消す
- ログインが要らない API とログアウトは、axios の設定に `access: 'withoutLogin'`・`access: 'logout'` を書く（`client.ts` で axios の設定の型に足した）。書かなければ、ログインしたあとの API
- `〇〇Api.ts`：業務のまとまり（`docs/backend.md` の2章）ごとに1つ
  - 名前：`authApi.ts`・`profileApi.ts`・`membersApi.ts`・`matchingApi.ts`・`messagingApi.ts`・`billingApi.ts`
  - `〇〇Api` というオブジェクトを名前付きで出し、中に API を呼ぶ関数を並べる
  - 応答の型（`XxxResponse`）は、このファイルの中に置き、外へ出さない
  - 画面の形への変換は、API を呼ぶ関数の中に書く。`toXxx` という名前の関数は作らない
  - 画面の形の型は、使う機能の `types.ts`（ログインした自分は `shared/session/types.ts`）に置き、`import type` で読む
  - まだ移していないレガシー版の画面が使う関数は、API の形のまま返してよい。移すときに画面の形にする（関数に `// API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）` と書く）
  - 画像のパスは、`〇〇Api` の中で `apiUrl` を通して URL にし、画面の型に URL を持たせる（presenter と container は `src/api` を読めないため）

```ts
// src/api/messagingApi.ts（の一部）
type BadgeCountsResponse = { unread_messages: number; new_matches: number; received_likes: number }

export const messagingApi = {
  badgeCounts: async (signal?: AbortSignal): Promise<BadgeCounts> => {
    const { data } = await client.get<BadgeCountsResponse>('/api/me/badge-counts', { signal })
    return { unreadMessages: data.unread_messages, newMatches: data.new_matches, receivedLikes: data.received_likes }
  },
}
```
- 画面の題と、どのタブを選ぶかは、`app/router.tsx` のルートの表に1行で持たせる（画面を足すときに直すのは1か所。管理画面の `domains.tsx` と同じ形）。`app/router.tsx` は、まだ作っていない。今は `App.tsx`（9章）
- `index.ts` が出してよいのは、次のものだけ
  - ページ（`app/` が使う）
  - ほかの機能が使う hook と、読み直す関数（例：未読の数を読み直す）
  - ほかの機能が使う presenter（例：会員のカード・有料の印）
  - API を呼ぶ部品（通報のダイアログ・有料の誘導のダイアログなど）
  - 型

### 言葉

- container
  - 意味：`pages/` の部品。hook・URL・ログインした自分をつなぎ、presenter に props で渡す。取るのも持つのも hook
  - 注意：JSX の中身の大部分を書かない
- presenter
  - 意味：`components/` の部品。props だけで見せる
  - 注意：参考にした記事の「Presenters」（API の形を変える関数）とは別の意味。そちらは `〇〇Api` の関数の中に書く
- Repository
  - 意味：データの出どころ（REST・Firestore）を隠す型の約束（`repository.ts` の `XxxRepository`）と、その実装（`repositories/`）
  - 注意：バックエンドは Repository を使わない（D-025）
  - 注意：画面の Repository は DB とのやり取りではない
  - 注意：`Source`・`Adapter`・`Interface` とは呼ばない
- `src/api/client.ts`
  - 意味：axios のインスタンスを作る1つのファイル
  - 注意：バックエンドの Client（外のサービスを呼ぶクラス）とは別のもの。`frontend/client`（会員の画面）とも別
- axios
  - 意味：API を呼ぶためのライブラリ。応答の JSON を読み、型の引数（`get<XxxResponse>`）で型を付けて返す
  - 注意：通信は既定の XMLHttpRequest。`adapter: 'fetch'` は使わない（D-029）

## 3. 依存の向き

下の一覧の「使ってよい」に書いたものだけを使う（一覧は、許すものを並べたものとして読む）。#114 で Biome の `noRestrictedImports`（`biome.json` の `overrides`）に書き、`npm run lint:rules` と CI で止める。Biome で書けない決まりが出たら、dependency-cruiser を足すかを決める。

- Biome は import の文字そのもので比べるので、規則はフォルダの名前で書く（`shared/ui` から見た `shared/session` は `../session/session` なので `**/session/*`）。`**/shared/session/**` と書くと、同じ `shared/` の中の相対の import を止められない（#114 で確かめた）
- axios を import してよいのは `src/api/client.ts` だけ。`fetch` は、どこでも使わない（テストのファイルも。偽の応答は MSW で作る。7章）。`shared/firebase` は Firebase の SDK を使う
- `src/api/` を読んでよいのは、hook（`features/*/hooks/`・`shared/session/`）だけ。例外は次の3つ
  - `app/configureApi.ts`：起動のときに、401・503 のときの動きを `client.ts` に渡す（`src/api/` は `shared/session` を使えないため）
  - REST の Repository の実装（`features/messages/repositories/restMessageRepository.ts`）：`messagingApi` を呼ぶ
  - まだ移していないレガシー版の画面（`src` の直下・`components`）：`〇〇Api`・`ApiError`・`apiUrl` を読む。画面を移すチケットで hook に移す。axios のインスタンス（`client`）と `configureApiClient` は読まない（`noRestrictedImports` で止める）
- `src/api/` が読んでよい型は、機能の `types.ts` と `shared/session/types.ts` だけ（`noRestrictedImports` の否定の書き方で、ほかのファイルを止める）
- `ignoreApiError` は、改訂版の置き場（`app`・`features`・`shared`）では読まない（`noRestrictedImports` の `importNamePattern` で止める）
- 2xx でない応答では、`client.ts` が `ApiError` を投げる。hook が受けて、状態（`status: 'error'` など）に変える。container と presenter は `ApiError` を読まない
- 機能の中の `sessionStorage`・`localStorage` も、`noRestrictedGlobals` で止める。例外は、検索の条件を読み書きする `features/search/hooks/useSearchConditions.ts` の1か所（5章）
- `rules.ts`・`types.ts`・`repository.ts`・`shared/lib`・`shared/constants` の `window`・`document`・ストレージも、`noRestrictedGlobals` で止める
- `noRestrictedGlobals` は、あとの `overrides` が前の `options` を置き換える。そのため、場所ごとに止める名前を全部書く（`fetch` を何か所にも書いているのはこのため）
- axios を止めるのは、`noRestrictedImports` の `axios` の行。どの `overrides` にも同じ行を書く（あとの `overrides` が前の `options` を置き換えるため。プラグインにしないのは、`lint:rules` の1つ目のコマンド（`--only`）ではプラグインが流れず、レガシー版のファイルを見られないため）
- `app/` のテストのファイルと、`shared/session/` のテストのファイルは、`src/api/` を読んでよい（偽物の設定を渡すため）
- `app/` から機能を読むときは `features/<機能>` と書く。`features/<機能>/index` と書いても止まる
- 画面を移している間は、`app/`・`shared/`・`features/` から、まだ移していないレガシー版のファイル（`src/components/*` など）を import してよい。そのファイルは、移すチケットで `shared/ui` か機能へ移す（例：`app/RequireAuth.tsx` が使う `components/AwaitingVerification.tsx`・`features/likes` が使う `Avatar`・`Button`・`EmptyState`・`Skeleton`・`UpsellDialog`・`Toast`）
  - 1つの画面を移すたびに、いくつもの画面が使う部品まで移すと、PR が大きくなるため（#294 で決めた）
  - 3章の一覧の「使ってよい」に、この部品も足して読む。hook は、Biome が `components/` を止めるので、読めない（`useToast` も使えない。下の4章の「書き込み」）
- まだ移していないレガシー版の画面は、`features/<機能>` の `index.ts` だけを読んでよい（いくつもの画面が使う部品を、最初に使う画面と一緒に移したあと。例：`MatchCelebration` を `features/likes` に移したあとの `UserPage`・`SearchPage`）

Biome で止められないもの（レビューで見る。#114 で確かめた）：

- 機能どうしが、互いの `index.ts` を import し合う形
- 機能の中から、ほかの機能の中のファイル（`../../likes/hooks/useX`）を直に import する形
- `window.fetch`・`globalThis.fetch`・`window.sessionStorage` のように、`window.` を付けて書く形（`noRestrictedGlobals` は、グローバルの名前をそのまま書いた所だけを見る）
- `src/api/` の中で、`〇〇Api.ts` どうしが import し合う形
- `src/api/` が、機能の `types.ts`・`shared/session/types.ts` から型でないものを import する形（Biome の `noRestrictedImports` は、型だけの import を見分けられない。2つのファイルには型だけを置く）
- hook が JSX を返す形

- `app/`
  - 使ってよい：すべての機能の `index.ts`・`shared/`
  - 使ってよい：`src/api/client.ts` の設定の関数（`app/configureApi.ts` だけ）
  - 使ってはいけない（よくある間違い）：機能の中のファイルを直に import する・画面の中身を書く・`〇〇Api` を呼ぶ
- `features/*/pages/`
  - 使ってよい：自分の機能の `components/`・`hooks/`・`types.ts`・`rules.ts`
  - 使ってよい：ほかの機能の `index.ts`
  - 使ってよい：`shared/`（`shared/firebase` を除く）
  - 使ってはいけない（よくある間違い）：`src/api/`（`ApiError.ts` も）・`repositories/`・axios
  - hook を通す。Repository の実装は `app/` から props で受け取る
- `features/*/components/`
  - 使ってよい：自分の機能の `types.ts`・`rules.ts`
  - 使ってよい：ほかの機能の `index.ts` が出した presenter
  - 使ってよい：`shared/ui`・`shared/lib`・`shared/constants`
  - 使ってよい：React（`useState` などの React の hook）・`<Link>`
  - 使ってはいけない（よくある間違い）：機能の `hooks/` フォルダ・`src/api/`・`shared/session`・store
  - 使ってはいけない（よくある間違い）：`useNavigate`・`useParams`・`useSearchParams`・`useToast`・`fetch`・`sessionStorage`
- `features/*/hooks/`
  - 使ってよい：`src/api/` の `〇〇Api.ts`・`ApiError.ts`
  - 使ってよい：自分の機能の `repository.ts`・`types.ts`・`rules.ts`
  - 使ってよい：ほかの機能の `index.ts`（hook・型・読み直す関数）
  - 使ってよい：`shared/session`・`shared/lib`
  - 使ってはいけない（よくある間違い）：JSX を返す・`src/api/client.ts` を直接・axios・`fetch`
- `src/api/`（`client.ts`・`ApiError.ts`・`〇〇Api.ts`）
  - 使ってよい：axios（`client.ts` だけ）・機能の `types.ts` と `shared/session` の型（`import type`）・`shared/lib`
  - 使ってはいけない（よくある間違い）：React・hook・store・`features/` の型でないもの・`app/`
- `features/*/repositories/`
  - 使ってよい：`src/api/` の `〇〇Api.ts`（REST の実装）・`shared/firebase`（Firestore の実装）・自分の機能の `repository.ts`・`types.ts`・`shared/lib`
  - 使ってはいけない（よくある間違い）：React・hook・store
- `features/*/rules.ts`・`types.ts`・`repository.ts`
  - 使ってよい：`shared/lib`・`shared/constants`・`shared/session` の型
  - 使ってはいけない（よくある間違い）：React・API・ブラウザの機能（純粋な関数と型だけ）
- `shared/session/`
  - 使ってよい：`src/api/` の `〇〇Api.ts`・`ApiError.ts`・`shared/firebase`・`shared/lib`・React
  - 使ってはいけない（よくある間違い）：`features/`・`app/`
- `shared/firebase/`
  - 使ってよい：Firebase の SDK
  - 使ってはいけない（よくある間違い）：`features/`・`app/`・React
- `shared/ui/`
  - 使ってよい：`shared/lib`・React
  - 使ってはいけない（よくある間違い）：`features/`・`src/api/`・`shared/session`
- `shared/lib/`・`shared/constants/`
  - 使ってよい：なし
  - 使ってはいけない（よくある間違い）：React・ブラウザの機能

- 機能どうしで、互いの `index.ts` を import し合わない（例：`profile` が `likes` を使い、`likes` も `profile` を使う）。両方が要るものは、`shared/` に移すか、`app/` か container でつなぐ。Biome の `noRestrictedImports` では止められないので、レビューで見る（増えたら dependency-cruiser を考える）

```mermaid
flowchart TB
  app["app/"]
  page["features/*/pages（container）"]
  comp["features/*/components（presenter）"]
  hook["features/*/hooks"]
  api["src/api/〇〇Api.ts"]
  repo["features/*/repositories"]
  rules["features/*/rules.ts・types.ts・repository.ts"]
  other["ほかの機能の index.ts"]
  session["shared/session"]
  client["src/api/client.ts"]
  firebase["shared/firebase"]
  ui["shared/ui"]
  lib["shared/lib・constants"]
  app --> other
  app --> repo
  page --> comp
  page --> hook
  page --> other
  page --> session
  page --> ui
  comp --> rules
  comp --> ui
  comp --> other
  hook --> api
  hook --> rules
  hook --> other
  hook --> session
  api --> client
  repo --> api
  repo --> firebase
  repo --> rules
  rules --> lib
  rules --> session
  session --> api
  session --> firebase
  ui --> lib
```

- `app/` は、自分の機能のページも `index.ts` を通して使う（図の `app --> other`）
- 図にない矢印は書かない。`shared/` から `features/` への矢印はない
- 図にない例外：`app/configureApi.ts` から `src/api/client.ts`（起動のときの設定だけ）。`src/api/` から機能の `types.ts`・`shared/session/types.ts`（`import type` だけ）

## 4. 書き方

### API を呼ぶ所

- API を呼ぶのは、`src/api/〇〇Api.ts` の関数だけ。呼ぶのは hook（3章）。Repository を作った機能では、REST の Repository の実装が `〇〇Api` を呼ぶ
- API の形が画面の形と同じでも、必ず `〇〇Api` の関数を通し、画面の型を返す
- API の形（`XxxResponse`）は、`〇〇Api` の関数の中で1回だけ画面の形に変える。Firestore の形は、Firestore の Repository の実装の中で変える。その型を、そのファイルの外へ出さない
- 応答は、axios の型の引数（`client.get<XxxResponse>(…)`）で受け、形は確かめない（`quality-frontend.md` の T2）
- 送り先（`VITE_API_URL`）を読むのは `client.ts` だけ。セッションの Cookie を送るのと、書き込みに CSRF のトークン（`X-XSRF-TOKEN`）を付けるのも `client.ts` だけ（D-027）
- 401・419・503 は、`client.ts` の interceptors の1か所で扱う。画面ごとに状態コードを見分けない（下の「401 と 403」）
- 同じ呼び出しが重なるとき（検索の連打）は、hook が `AbortController` で古い方を止める

### 401 と 403

- 401 の扱いを当てるのは、ログインしたあとの API だけ。ログイン・登録・メールの確認・パスワードの再設定の API には当てない（パスワードが違うときも 401 が返るので、画面に誤りの文を出す）。`client.ts` を呼ぶときに、当てないことを指定する
- 会員の認証はセッション（D-027）。401 では送り直さない（送り直すのは、下の 419 の1回だけ）
- 401 なら、`shared/session` が自分の情報を消し、ポーリングを止め、ログインの画面へ移す
  - 決まり：`RequireAuth` が今の URL を覚え、ログインのあとに戻す。戻り先は、アプリの中のパス（`/` で始まり、`//` で始まらない）だけにする
  - 分かっている不具合：今は覚えない（FR-UI-011）
- 今のつなぎ方（#257・#259。#292 で axios に移したが、動きは変えていない）
  - ログインしているかは、`shared/session/SessionProvider.tsx` が決める。起動のときに `GET /api/me` を1回読み、通るかで決める（Cookie は HttpOnly なので、画面からは読めない）
  - 401 なら、前の会員の画面の情報（前の検索の条件・D-027 に切り替える前の JWT の残り）を消し、「していない」にする。`code` が `account_suspended` なら、理由を持ち、`RequireAuth` が `/login?reason=account-suspended` へ移す
  - タブを開き直したとき（`visibilitychange`）に `GET /api/me` を読み直す。ほかのタブで別の会員がログインしていたら、画面を読み込み直す（Cookie はタブのあいだで共有するため）
  - 分かっている不具合：ログインが要らない画面（ログイン・登録）も、起動の `GET /api/me` を待ってから出る（PR #280 のレビューの A2）
  - 決まるまでは、`app/SessionGate.tsx` が「読み込み中…」を出す。401 でない失敗（500・つながらない・10秒の時間切れ）は、「読み込めませんでした」と、もう一度のボタンを出す
  - ログインの画面は、ログインの API のあとに `signIn()` を呼び、`GET /api/me` が通らなければ「ログインできませんでした。画面を読み込み直してください」を出す（Cookie が届いていない設定のとき）
  - ログインが要る画面は、`app/RequireAuth.tsx` の下に置き、画面ごとに確かめない
  - コードでは「自分」を `Me` と呼ばず、`Account` と呼ぶ（`docs/glossary.md` の「アカウント」）
  - `src/api` は `shared/session` を使えないので、`app/configureApi.ts` が起動のときに、401 のときの動きを `configureApiClient()` で `client.ts` に渡す
  - ログインしたあとの API の 401・419 のとき、`client.ts` は応答の `code`（419 は `'csrf'`）を `app/` に渡して `UnauthorizedError` を投げる。`app/` は `shared/session` の `clearSession()` を呼び、理由を付けてログインの画面へ読み込み直す（FR-UI-100）
  - 書き込みが 419 なら、`client.ts` が CSRF のトークンをもらい直して、1回だけ送り直す（419 では何も変わっていないので、二重にならない）
  - 401 のときは、まだ読み込み直す形（`configureApi`）。読み込み直すので、ポーリングも止まる。画面の中で移す形にしたら、ポーリングを止めることを、はっきり書く
- ログアウトの手順は、`shared/session/useLogout.ts` の1か所に書く（ホーム・設定・確認待ちの画面が使う）。移る先とトーストは、呼ぶ画面が決める
  - `authApi.logout()`（`access: 'logout'`。401 でも移らない）で呼ぶ。応答を待ち、2xx・`401`・`419` のあとでだけ「していない」にする（サーバーのセッションが消えないと、Cookie が生きたままなので）
- メンテナンス中の 503（FR-MAINT-006）は、`client.ts` の interceptor が見分け、`app/configureApi.ts` から渡された `onMaintenance` を呼ぶ。`app/MaintenanceGate.tsx` が、どの画面の代わりにも「ただいまメンテナンス中です」を出す（画面ごとに 503 を見分けない）
  - ログインしたあとの API は `MaintenanceError` を投げる。ログインが要らない API とログアウト（`access` を書いたもの）は `ApiError`（503）を投げ、呼んだ画面が今までどおりの文を出す
  - 起動のときの `GET /api/me` が 503 を返すので、ログインしていない人にもメンテナンスの画面が出る
  - メンテナンスに入ったあとに、前に送った要求の 401 が届いても、ログインの画面へは移さない
  - 解けたかは、会員が読み込み直して確かめる。メンテナンスでセッションを全部消すので、解いたあとはログインの画面に移る（FR-MAINT-002）
- メールアドレスを確認していない会員の 403（`code: "email_unverified"`。FR-AUTH-021）は、`client.ts` が `EmailUnverifiedError` を投げて、呼んだ画面の続きを止める（画面は移さない）。確認を促すのは、`app/RequireAuth.tsx` が画面の代わりに出す「確認待ち」（`components/AwaitingVerification.tsx`）と、枠のいちばん上の帯（`VerifyBanner`。FR-UI-014）。画面で受け止めるときは、親の `StoppedRequestError` で見分ける
- 403 は、応答の `code` で見分ける（有料が要る・男性でない・確認していない・ブロック）。ステータスだけで「有料が要る」と読まない。API が `code` を返すまでは、誘導のダイアログを 403 で出さず、`plans/rules.ts` の判断で出す

### 失敗と読み込み中

- `client.ts` は、2xx でない応答で `ApiError`（状態コード・`code`・メッセージ・入力の誤り）を投げる。hook が `catch` で受け、`instanceof` で見分けて状態に変える
- hook が返す状態は、次の形を基本にする：`{ status: 'loading' | 'error' | 'success', data, refreshing, moreError }`
  - `refreshing`：中身を出したまま取り直している（ポーリング・続きの読み込み）。スケルトンに戻さない
  - `moreError`：続きの読み込みだけが失敗した。一覧は残し、下に「もう一度」を出す
  - 中止（`AbortError`）では、状態を変えない
- presenter は、`shared/ui/AsyncView` で、読み込み中・失敗・中身を出し分ける（#294 で作った）。スケルトンは画面ごとのものを props で渡す（中身と形をそろえ、CLS を出さない。FR-UI-025）
  - 失敗のときは「読み込めませんでした」と「もう一度」を出す（FR-UI-013）。「もう一度」で呼ぶ関数は、hook が返す
  - 空のときの出し方は、画面ごとに違うので、presenter が中身の中で決める（届いたいいねが空でも、スキップした相手の一覧は出す）
- hook は、受けた失敗を、次のように扱う（#294 で決めた）
  - `StoppedRequestError`（ログインが切れた・メンテナンス中・確認していない）：`client.ts` が画面を移す・帯を出すので、黙る。読み込みなら状態を変えず、書き込みなら `'stopped'` を返す
  - `ApiError`：状態（`status: 'error'`）か、書き込みの結果（`'failed'`）に変える
  - どちらでもない失敗（つながらない・時間切れ）：サーバーのログに残らないので、`reportError` で記録してから、`ApiError` と同じに変える（`logging.md` の4）
  - 例外：画面に何も出さずに読み直すだけの hook（`recountBadges`）は、`ApiError` も記録する。会員にも画面にも失敗が見えず、記録のほかに気づく手段がないため
  - hook の外へ投げ直さない。投げ直すと、処理されない失敗になり、送っている間の印が消えず、ボタンが押せないまま残る
- 失敗の JSON を、一覧として置かない

### 書き込み

- 書き込みの hook は、送っている間（`submitting`）は次を受け付けない。購入のように二重になると困る書き込みは、API の側でも二重を止めているかを確かめる
- 書き込みの hook は、結果（`'done' | 'failed' | 'stopped'` など）を返す。トーストを出すのは container（`pages/`）。hook は `components/Toast` を読めない（3章。#294 で決めた）
- 楽観的な表示（いいね・メッセージの送信）は、hook が送る側で id を作り、届いた本物と突き合わせて消す。失敗したら hook が戻す
- 書き込みのあとに、ほかの機能の数（未読・届いたいいね）が変わるときは、その機能の `index.ts` が出す「読み直す関数」を呼ぶ（例：届いたいいねのスキップ・マッチ・元に戻すのあとに、`features/messages` の `recountBadges`）
- 購入が成功したあと、有料の機能の API が 403 を返したあとは、`shared/session` の読み直す関数を呼ぶ（使える機能が変わるため）

### 機能をまたぐ部品

- ほかの機能の、API を呼ぶ部品（例：トーク画面から開く通報のダイアログ）は、container（`pages/`）がほかの機能の `index.ts` から受け取り、`children` か props で presenter に渡す
- presenter は、ほかの機能の `index.ts` が出した presenter（会員のカード・有料の印など）だけを使ってよい
- 見せるだけの部品は、3つ目の機能が使うときに `shared/ui` へ移す。API を呼ぶ部品は `shared/` へ移さず、持ち主の機能の `index.ts` から出す

### 有料の出し分け

- 画面に `if (isPaid)` を書かない。`GET /api/me` が返す使える機能を、`plans/rules.ts` の1か所で判断する（FR-PAID-016・017）
- 画面の決まりは、見せ方を決めるだけ。断るのは API（403 など）

### A/B テスト・機能のフラグ

- 分けるのは container（`pages/`）だけ。presenter を差し替え、部品の奥に条件を書かない
- フラグを読む所は1か所に作る（要件に出てきたときに作る）

### 読み込みの大きさ

- Firestore の画面のルートは、`lazy()` で分けて読む（Firebase の SDK を、全員の最初の読み込みに入れない）。`app/router.tsx`（まだ作っていない。今は `App.tsx`）は、Firestore の Repository の実装を直に import しない
- ほかの機能のルートを分けて読むかは、`vite build` の大きさと LCP を測ってから決める

## 5. 状態の置き場

くわしい決まりがあるものは、表の下の見出しに書く。

| 状態 | 置き場 |
| --- | --- |
| API から取ったデータ（一覧・詳細） | その機能の hook（`useState`）（くわしくは下） |
| 検索の条件 | 正は URL（`useSearchParams`）（くわしくは下） |
| ログインした自分（性別・使える機能） | `shared/session/`（くわしくは下） |
| 画面をまたぐ数 | その機能の hook（くわしくは下） |
| 楽観的な表示・送っている間 | その機能の hook |
| スクロールする枠 | `AppShell` が `shared/ui` の Context で渡す（`document.querySelector` で探さない） |
| トースト | `shared/ui/Toast`（Context） |
| メンテナンス中か | `app/maintenance.ts`（React の外の変数。`MaintenanceGate` が `useSyncExternalStore` で読む。`client.ts` の 503 から変えるので、React の外に置く） |
| 入力中の値 | hook か presenter（くわしくは下） |

### API から取ったデータ（一覧・詳細）

- その機能の hook（`useState`）に置く
- TanStack Query は使わない（D-005）
- 画面を離れたら捨てる。相手のプロフィールから戻ったときに、一覧のスクロールの位置は戻さない（今の動きと同じ）

### 検索の条件

- 正は URL（`useSearchParams`）
- URL にクエリがないとき（タブのリンクから開いたとき）だけ、sessionStorage の最後の条件に戻す（FR-UI-016・043）
- 読み書きは `useSearchConditions` の1か所
- フリーワードも URL に入るので、アクセスのログに残してよいかは、まだ確かめていない

### ログインした自分（性別・使える機能）

- `shared/session/` に置く（今は Context）。画面をまたぐ状態が要る画面を移すチケットで、Zustand に移す（Zustand は #294 で入れた。D-005。Vuex のあとを継いだ Pinia と近い書き方。2026-11-23 に人が確かめた）
- `GET /api/me` を読むのは、起動したとき・購入が成功したとき・有料の機能で 403 が返ったとき
- ログアウトのときは消し、Firebase からも抜ける

### 画面をまたぐ数

未読の数・届いたいいねの数・管理画面のまだ対応していない通報の数。

- Zustand の小さな store に置く（D-005。Vuex のあとを継いだ Pinia と近い書き方。2026-11-23 に人が確かめた）。下のタブの数は、#294 で、`TabBar` の中の state から store に移した（届いたいいねの画面が、書き込みのあとに読み直すため）
- store は、それを読む hook のファイルの中に作り、外に出さない（例：`features/messages/hooks/useBadgeCounts.ts` の `useBadgeCountsStore`）。外に出すのは、読む hook と、読み直す関数だけ
  - `features/*/hooks/` のほかの置き場で `zustand` を import すると、Biome の `noRestrictedImports` が止める（`biome.json` の `overrides`。PR #301 のレビューで足した）
  - なぜ：store を書き換える所を、そのファイルの中だけにする。presenter は store を読まない（3章）
  - API を呼ぶ関数（`recountBadges`）も、同じファイルに置く。`src/api` を読んでよいのは `hooks/` の置き場だけ（3章）なので、store を `hooks/` の外のファイル（`stores/` など）に分けない
- 読み直す関数（`recountBadges`）を `features/messages/index.ts` から出す。数が変わる書き込みのあと、その画面の hook が呼ぶ（4章の「書き込み」）
- 読むのをやめたら（ログアウトして下のタブが消えた）、store の数を消す。消さないと、同じタブで次にログインした会員に、読み終えるまで前の会員の数が出る
- 数を読む部品は `TabBar`（管理画面はサイドバー）の中だけにし、描き直しをその部品にとどめる
- 数だけを返す API ができるまでは、今の読み方のまま、`src/api/〇〇Api.ts` に移す。下のタブの未読・新しいマッチ・届いたいいねは、数だけを返す API（`GET /api/me/badge-counts`）を、`features/messages` の `useBadgeCounts`・`recountBadges` が `messagingApi.badgeCounts()` で読む（#247・#294）

### 入力中の値

- 失敗のときに戻す値（送れなかったメッセージ）は、hook が持つ
- ほかの所から入れる値（保存した条件・URL）も、hook が持つ
- presenter は `value` と `onChange` を受け取るだけ
- それ以外（ダイアログが開いているか、など）は presenter の `useState`
- 例外：API の結果で開くダイアログ（403 のときの有料会員への誘導・マッチの演出）は、hook が持つ。開くかを決めるのが API の結果だから（#294 で決めた）

## 6. データの出どころが2つある機能（メッセージ）

- `MessageRepository` の約束は、次の形を基本にする：`subscribe(roomId, onChange, onError): () => void`・`loadOlder(roomId, before)`・`send(roomId, body)`
- 画面の `Message` は、`isMine`（自分が送ったか）と、`Date` の時刻を持つ。Laravel 版（中の id・ISO の文字）と Firestore 版（uid・Timestamp）の違いは、各実装の中だけで変える
- まだ決めていないこと：REST のメッセージを画面の形（`isMine`）に変える所（`messagingApi` か Repository の実装か）は、トークの画面を移すときに決める（`Account` は `public_id` だけを持ち、メッセージの `sender_id` は中の番号）
- 片方にしかない機能（既読・送れるかの判断・ブロック・通報）は、約束に「あるか」（`features`）を持たせ、container がそれで出し分ける
- 失敗は、両方とも `ApiError` と同じ形の画面の失敗に変えて渡す（Firestore の `permission-denied` なども）
- Firebase へのログインは、Firestore の実装が最初に使うときに1回だけする。ログアウトのときに抜けるのは `shared/session`
- テストでは、メモリの上で保存する偽物の `MessageRepository` を渡し、同じテストを流す

## 7. テスト

会員から見える動きを確かめる結合テストを中心にする（2026-11-23 に人が決めた。D-029）。E2E は、まだ入れない。入れるのは #299（2026-11-23 に人が決めた）。

- なぜ：中の作り（どの hook を呼ぶか・どのファイルに置くか）でなく、動き（画面に何が出るか・押したら何が起きるか）を見るテストは、AI がコードを書き換えても、そのまま残る。AI の誤りにも気づきやすい
- 道具は Vitest・Testing Library・MSW（結合）。MSW は #290 で入れた（版は AGENTS.md の技術スタック）。E2E の道具（Playwright）は #299 で入れる
- テストのコードの書き方は [testing.md](testing.md) の「画面のテスト」に従う

| 種類 | 何を | 道具 | 置き場（`frontend/client/` の下） |
| --- | --- | --- | --- |
| 結合 | 画面（container）を描き、会員の操作で確かめる | Vitest・Testing Library・MSW | `tests/integration/<機能>/` |
| API を呼ぶ所 | `src/api/client.ts` の扱い | Vitest・MSW | `tests/api/client.test.ts` |
| 単体 | `rules.ts` の純粋な関数・`〇〇Api` の中の形の変換 | Vitest | `tests/unit/`（`src` と同じフォルダの形） |
| 道具 | MSW の server・偽の応答・Cookie などの道具 | MSW | `tests/support/` |

- テストは `src` の外の `tests/` に集める（2026-11-23 に人が決めた）。確かめるファイルの隣には置かない
  - なぜ：画面を移すと、ファイルの置き場が変わる。テストを業務の名前で分けておけば、移してもテストの置き場が変わらない（バックエンドの `tests/Feature/<業務のまとまり>/` と同じ考え）
- `<機能>` は、`docs/frontend.md` の「会員の画面の行き先」の機能の名前（`auth`・`profile`・`likes`・`messages`・`settings` など）。画面をまだ移していなくても、移す先の機能の名前で置く
- `app/` の部品（RequireAuth・SessionGate・MaintenanceGate・configureApi・下のタブ）は `tests/integration/app/`、`shared/session/` は `tests/integration/session/`
- 書き方（並べ方・名前）は [testing-style.md](testing-style.md) の「画面のテスト」

### 結合テスト

- 画面（container）を描き、API を MSW（ネットワークの手前で、偽の応答を返す道具）で偽物にする
- 会員の操作は `userEvent`（クリック・入力）で行い、画面に出たものを確かめる
- 中身があるときだけでなく、読み込み中・失敗（500・つながらない）・空のときも見る
- 実行：`frontend/client` で `npm test`
- MSW の準備は `tests/support/server.ts`（`setupServer`）。`tests/support/setup.ts` が、テストの前に `listen`、テストごとに `resetHandlers`、終わりに `close` を呼ぶ
- 偽の応答のない API は、`tests/support/server.ts` の `request:unhandled` で集め、`tests/support/setup.ts` の `afterEach` で誤りにする。`onUnhandledFrame: 'error'`（MSW 3 で `onUnhandledRequest` から名前が変わった）は、本物の API へ送らないためだけ
- どの API を何本呼んだか・何を送ったかは、`tests/support/server.ts` の `sentRequests()`・`sentPaths()` で見る
- テストの中の画面のオリジンと API の送り先は、どちらも `http://localhost:8000` にそろえる（`vite.config.ts` の `test`）。jsdom は、ほかのオリジンへの要求で CORS を確かめ、CORS の印のない偽の応答を止めるため。CORS は、#299 で E2E を入れるまで、テストで確かめる手段がない

### E2E

- まだ入れない（2026-11-23 に人が決めた）。入れるのは #299（本物の API と DB で、主な流れを通す）
- #299 で書くときの、主な流れの一覧（流れごとに1本以上）
  - ログイン
  - 登録
  - 検索
  - いいね
  - マッチ
  - トーク
  - 有料

### 単体テスト

- `rules.ts` の純粋な関数（境界値）と、`〇〇Api` の関数の中の形の変換だけを、単体で確かめる
- 形の変換のテストに入れる応答の例は、`docs/api/` の改善版の例と同じ形にする。API の形を変える PR では、同じ PR で例とこのテストを直す

### 偽の応答

- MSW の偽の応答は、`tests/support/handlers/〇〇Api.ts`（業務のまとまりごと。`src/api/〇〇Api.ts` と同じ名前）の1か所に置く
- 応答の形は、今の API と同じにする（`docs/api/` の改善版の今の列。要件の形がまだ入っていない API は、今の形）
- テストごとに違う応答（失敗・空）は、そのテストの中で、ハンドラーを上書きする

### 画面の要素の探し方

- 次の順で探す：役割（`getByRole`）→ ラベル（`getByLabelText`）→ 文字（`getByText`）→ テスト用の ID（`getByTestId`）
- 見た目のためのクラス名では探さない

### カバレッジ

- 数字の目標を置かない。CI で、カバレッジの数字では落とさない
- 抜けは、要件 ID ごとのテストで見る。E2E を入れたら（#299）、上の「主な流れの一覧」でも見る

### 弱いところ

- MSW の偽の応答が、本物の API とずれることがある。#299 で E2E を入れるまでは、ずれを見つける手段がない。API の形を変える PR では、`docs/api/` の例と偽の応答を一緒に直す

### 移すときのテスト

- 画面を移すチケットで、先に足す「今の動きを確かめるテスト」も、結合テストの形（画面を描き、API を MSW で偽物にする）で書く。移したあとも、同じテストが、import の行と置き場のほかは書き換えずに通るようにする
- `src/api/client.ts` の動き（CSRF・401／419・503・止めたとき・JSON でない応答）は、`tests/api/client.test.ts` が MSW で確かめる（#290）
- テストのファイルでも `fetch` は使わない（`noRestrictedGlobals`。#290 で、テストのファイルの例外を外した）

## 8. 共通の原則

バックエンドの [architecture-backend.md](architecture-backend.md) の9章と同じ考え方を、画面の言葉で書く。

### SSoT（1つの事実は1か所に）

- 年齢の計算・都道府県の名前・プロフィールの選択肢・使える機能の判断・入力の決まりを書く前に、`shared/lib`・`shared/constants`・各機能の `rules.ts` を検索して使う。見つからないときだけ新しく書く
- 共通にするのは同じ事実だけ。見た目が似ているだけの部品は、各機能に置いたままにする
- 画面の型は手で書く（D-006）。同じ API の型を2か所に書かない

### やりすぎない

- Repository は、データの出どころが2つあるとき、またはテストで外を偽物にしたいときだけ作る
- UseCase を React から外した純粋な関数にするのは、手順が込み入り、hook のテストが書きにくいときだけ
- 要件にない汎用の部品・設定・抽象化を足さない。起こりえない入力への防御を足さない

### 1ファイル1責務

- ファイルの担当を一文で言えること。「検索の条件を URL に読み書きする」は合格、「検索まわりいろいろ」は失格
- 部品が 150行を超えたら、presenter を分けるか、hook に出す

## 9. まだ移していないレガシー版の画面（画面の移し方）

画面の移し方の手順の正は、この章。そう決めた理由とほかの案は `docs/frontend.md` の「画面の移し方」と `docs/decisions.md` の D-030、21画面の行き先は `docs/frontend.md` の「会員の画面の行き先」（2026-11-23 に人が決めた）。

### 単位ときっかけ

- 1画面（ルート1つ）ずつ移す。PR も1画面に1つ
  - 例外：メッセージの Laravel 版と Firestore 版の2つのルートは、1つの PR で移してよい（1つの container にまとめるため。6章）
- 1つの画面を移すときに、6つの領域（コンポーネント設計・API との通信・状態管理・表示速度・テスト・開発効率）をすべて、その画面で直して測る
- 移すきっかけは、その画面に機能を足すとき・不具合を直すとき。触らない画面は、移さずに残してよい
- 移している間は、レガシー版の画面（`src` の直下）と改善版の画面（`features/`）が並んでよい
- 移した画面も、今の `App.tsx` のルートの表（画面の題は `TITLES`、タブは `components/TabBar.tsx` の `UNDER_HOME`）に1行足す。`app/router.tsx` に移すのは、画面が増えて困ったときに別のチケットで
- 全部の画面を先に棚卸ししない。その画面の棚卸しは、移すチケットの最初にする
- 画面をまたぐもの（テストの道具・表示速度を測る仕組み）は、画面を移すチケットに入れず、別のチケットにする

### 手順

- 移すチケットは改善（`.github/ISSUE_TEMPLATE/r-improvement.md`）で作り、「画面を移すときだけ」を埋める
- きっかけのチケット（機能・不具合）とは分け、移すチケットを先に進める。きっかけが小さな機能・不具合なら、下の4として同じ PR に入れてよい

1. 棚卸し：その画面の状態（`useState`・Context）・呼ぶ API・ロジック（判断・計算・形の変換）を数え、置き場（1章の表）を決めて、チケットに書く。前の数字（6つの領域の「測る数字」）を取る
2. 今の動きを確かめるテスト：結合テスト（画面を描き、MSW で API を偽物にする。7章）を足し、移す前のコードで通す（最初のコミット）
   - 今の動きが「処理されない失敗」（画面の外へ投げ直す。読み込めないと読み込み中のまま、など）になる場面は、テストを書けない（Vitest が、処理されない失敗を誤りにする）。チケットと PR に「分かっている不具合」として書き、4で直すときにテストを足す（#294 で決めた）
3. 移す：画面の見え方と動きを変えずに、`features/<機能>/` に移す（2つ目のコミット）
   - 2のテストを、import の行と置き場のほかは書き換えずに通す
   - ルートの表（`App.tsx`）を新しい画面に向け、古いファイルを消す
   - その画面の `ignoreApiError` の呼び出しは、代わりに hook の `catch` で、今と同じに続ける（失敗しても先へ進む動きを変えない）
   - その画面だけが使っていた「API の形のまま」の `〇〇Api` の関数を、画面の形を返すようにする
   - ほかのまだ移していない画面も使う「API の形のまま」の関数は、形を変えずに残し、画面の形を返す関数を別の名前で足す（例：`profileApi.myMatchPerson()`。`member()` は、まだ移していない相手のプロフィールの画面が使う）。残した関数は、最後に使う画面を移すチケットで消す（#294 で決めた）
     - 例外：呼ぶ所を型の検査で追え、同じ PR で全部直せるときは、その場で形を変えてよい。呼ぶ所を PR に並べる（例：`matchingApi.like()`。`UserPage` と `SearchPage` が呼ぶ。PR #301 のレビューで決めた）
   - 状態の置き場は5章に従う。画面をまたぐ状態が要る画面なら、このとき Zustand の store を作る（5章）
4. 振る舞いを変える：機能を足す・不具合を直す・失敗を状態に変える・失敗の表示を足す。3とは別のコミットにし、テストを足す
5. 測る：後の数字を取り、6つの領域の前と後を PR に書く。`docs/frontend.md` の「会員の画面の行き先」の「移したか」を直す

### レビューで見る所

- 3の移すコミットで、振る舞いが変わっていないか（2のテストを、import の行と置き場のほかは書き換えていない・画面の文が同じ）
- 分かっている不具合を、3で直していないか（直すのは4）
- 3章の依存の向き（`npm run lint:rules` と、Biome で止められない形）
- 6つの領域の前と後が、PR にそろっているか
- 移すときに困ったこと（決まりの足りない所）を、決まりの直しの案にしたか

### 移さずに直すとき

- 移すと PR が大きくなりすぎるとき（急ぎの不具合など）は、移さずに直してよい。そのチケットに理由を書く

## 10. やってはいけない書き方

- 部品の中で API を呼ぶ・`import.meta.env.VITE_API_URL` を読む・トークンを読む
- `fetch` を書く・axios を `src/api/client.ts` の外で import する
- `any` を使う（代わりに何を書くかは [quality-frontend.md](quality-frontend.md) の T1・T2）
- API の形（snake_case・生年月日）を、`src/api/〇〇Api.ts`・Repository の実装の外で読む
- ログインの守りを画面ごとに書く（`app/RequireAuth.tsx` の1か所）
- presenter の中で、機能の hook・`shared/session`・ルーターの hook を使う
- 画面の題・タブの選び方を、ルートの表の外に書く

## 11. 管理画面での当てはめ

- 同じ形にする（`app/`・`features/`・`shared/`）。`src/domains/` は `src/features/` に名前を変える（#123）
- サイドバーとルートを1つの表から作る今の形（`domains.tsx`）は、`app/features.tsx` としてそのまま使う。各機能のページは `index.ts` から import する
- ログインと役割（今は sessionStorage の `admin` から読む）は `features/auth/` と `shared/session/` に置き、役割の判断を画面ごとに書かない。断るのは API
- ヘッダーの会員の検索（`MemberSearch.tsx`）は、`members` の `index.ts` から `AppShell` に出す
- まだ対応していない通報の数は、5章の「画面をまたぐ数」と同じに扱う
- 見た目の部品は Mantine をそのまま使う（`shared/ui` で包み直さない。包むのは、同じ組み合わせを3か所で使ったとき）
- 書き込み（停止・解除など）には、確かめのダイアログと失敗の表示を必ず付ける
- `Notice.tsx`・`Icon.tsx`・`date.ts` と `domains/members/paid.tsx` の置き場は、#123 で決める
