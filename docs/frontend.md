# 画面の作り方（レガシー版と改善版）

状態：確定（改善版の形は #112・#113 で決めた。API を呼ぶ所を `src/api/` にまとめること・テストの道具は #275 で決め、#292 で `src/api/` に移した。21画面の行き先と移し方は #293 で書いた）
決まり：改善版の画面の受け持ち・import の決まり・書き方・状態の置き場・テスト・画面の移し方の手順は [architecture-frontend.md](../agents/rules/architecture-frontend.md) を正とする。この文書は、形を選んだ理由と、今のファイルをどこへ移すかの地図
決定：[decisions.md](decisions.md) の D-004（React＋TypeScript＋Vite）・D-006（OpenAPI は使わない）・D-018（画面も分ける）・D-026（改善版の置き場）・D-027（会員の認証はセッション）・D-029（axios・`src/api/`・MSW と Playwright）

画面も、DB と同じく「レガシー版で作る → 測る → 直す → もう一度測る」で進める。03b から、画面の子 Issue も `legacy-repo` と `refactored-repo` に分ける。Zustand は、画面をまたぐ状態が要る画面を移すチケットで入れる（D-005。Vuex のあとを継いだ Pinia と近い書き方。2026-11-23 に人が確かめた）。

## レガシー版とは

Vite の React＋TypeScript のひな形を入れたまま、設計を考えずに作る**スパゲティコード**。取ってくる・持つ・見せる・決まりを、1つの部品の中で絡み合わせて書く。

```tsx
// レガシー版の形（1画面に1つの大きな部品）
export default function SearchPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [prefecture, setPrefecture] = useState('');
  useEffect(() => {
    // 部品の中で、そのつど fetch する。読み込み中・失敗・401 は考えない
    fetch(`http://127.0.0.1:8000/api/users?prefecture=${prefecture}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setUsers);   // 検索を連打すると、古い応答があとから上書きする
  }, [prefecture]);
  return (/* 200行の JSX。年齢の計算や表示の条件もここに書く */);
}
```

## 6つの領域

画面を直すときに見る6つの領域。1つの画面を移すときに、6つの領域をすべて、その画面で直して測る（下の「画面の移し方」）。

- 測る数字は、1つの数字を1つの領域だけが受け持つ（`.github/ISSUE_TEMPLATE/r-improvement.md` の6つの領域の表と同じ）

### コンポーネント設計

- レガシー版（legacy-repo）：1画面に1つの大きな部品
- 改善版（refactored-repo）：次の3つに分ける
  - container：hook とつなぎ、presenter に渡す
  - hook：取る・持つ
  - presenter：props で見せるだけ
- 測る数字：部品の行の数
- 確かめること：presenter を、API なしでテストできるか

### API との通信

- レガシー版：部品の中の `useEffect` で、そのつど `fetch`。URL とトークンの読み出しを、あちこちに書く
- 改善版：axios で、API を呼ぶところを `src/api/` にまとめる（送り先・`401`・失敗）。検索の連打は `AbortController` で止める
- 測る数字：画面を開いたときの API の本数
- 確かめること：連打したとき、古い結果があとから上書きするか

### 状態管理

- レガシー版：なんでも `useState` と Context に置く
- 改善版：どの状態をどこに置くかを分ける。画面をまたぐ状態が要る画面を移すチケットで、Zustand を入れる（D-005。Vuex のあとを継いだ Pinia と近い書き方。2026-11-23 に人が確かめた）
- 測る数字：`useState` の数と置き場

### 表示速度

- レガシー版：考えない
- 改善版：長い一覧・画像・バンドルの大きさを直す
- 測る数字：描き直しの回数（React Profiler）
- 画面をまたいで測るもの（Lighthouse の LCP・INP・CLS・`vite build` の大きさ）は、#295 で決める

### テスト

- レガシー版：なし
- 改善版：結合テスト（Vitest・Testing Library・MSW）と E2E（Playwright）を中心にする。直す前に、今の動きを確かめるテストを足す
- 測る数字：テストの本数
- 確かめること：テストが、要件 ID の受け入れ条件に対応しているか
- 道具（MSW・Playwright）は、画面をまたぐので #290 で入れる

### 開発効率

- レガシー版：ひな形のまま。型は `any` でよい
- 改善版：Biome（lint と整形）・型の検査・テストを CI に入れる。API がまだないときの仮の応答
- 測る数字：なし
- 確かめること：CI で止まるか。移すときに困ったこと（決まりの足りない所）を、決まりの直しの案にしたか

## 認証（D-027）

会員の認証はセッション（D-027。#259 で移した）。ブラウザには、HttpOnly の Cookie で、セッションの番号だけを渡す。書き込みには、CSRF のトークン（`X-XSRF-TOKEN`）を付ける。

| | レガシー版（legacy-repo） | 改善版（refactored-repo） |
| --- | --- | --- |
| ログインの状態の置き場 | JWT を sessionStorage に置く | セッションの番号を HttpOnly の Cookie に置く |
| 送り方 | 各画面で `Authorization: Bearer` | `src/api/client.ts` だけ（`withCredentials`） |
| ログインしているか | トークンがあるか | 起動のときの `GET /api/me`（`shared/session`） |
| 確かめること | XSS があると、トークンを持ち出せる | 同じ XSS でも、セッションの番号を持ち出せない |

- 401・419・503 の扱いは、[architecture-frontend.md](../agents/rules/architecture-frontend.md) の4章の「401 と 403」
- 前は、改善版を D-014 の形（JWT と取り替え用のトークンを、HttpOnly の Cookie に置く）にする予定だった。#246 で D-027 に置き換えたので、取り替え用のトークンと `POST /api/auth/refresh` は作らない

## 改善版の考え方

クリーンアーキテクチャの2つの考え方を採る。

- **依存の向き**：見せる部品から API の呼び出しへ、一方向にだけ依存する。API を呼ぶ側の作りを変えても、見せる部品は直さない
- **境界で形を変える**：API の形（snake_case・生年月日など）は、API を呼ぶファイルの中で1回だけ画面の形に変える。このように外の形が中へ入り込まないようにする所を、腐敗防止層と呼ぶ

ただし、層を全部の機能に作ることはしない。機能ごとのフォルダ（`features/`）の中に、効く所にだけ作る。理由は次のとおり。

- 業務の決まり（課金・マッチの成立・ブロック）は、正本がバックエンドにある。画面にあるのは、見せ方の決まり・入力の確かめ・手順の状態くらいで、層を全部作ると、呼んで返すだけのファイルが増える
- マッチングアプリでは、見た目と流れ（UI・UX）の変更と、新しい機能の追加がいちばん多い。見せる部品だけを直せること・フォルダを1つ足せば機能が増やせることを優先する

| クリーンアーキテクチャの層 | 置き場 | いつ作るか |
| --- | --- | --- |
| 型と見せ方の決まり（記事の Domain） | `types.ts`・`rules.ts` | 型・決まりがあるときだけ |
| Repository（型の約束） | `repository.ts` の `XxxRepository`（TS の `interface`） | データの出どころが2つあるとき、またはテストで外を偽物にしたいときだけ。今はメッセージだけ |
| Repository の実装 | `repositories/restXxxRepository.ts`・`repositories/firestoreXxxRepository.ts` | 約束を作った機能だけ |
| UseCase（手順と状態） | `hooks/` | いつも。React から外した純粋な関数に分けるのは、手順が込み入る所（購入・登録の手順など）だけ |
| API を呼ぶ＋形を変える | `src/api/〇〇Api.ts`（変換は呼ぶ関数の中） | 業務のまとまりごと。hook と、REST の Repository の実装が呼ぶ |
| Infra（通信） | `src/api/client.ts`（axios） | 1つだけ |
| View | `pages/`（container）・`components/`（presenter） | いつも（小さな機能でも、2つのフォルダを作る） |

言葉（container・presenter・Repository）の意味は、[architecture-frontend.md](../agents/rules/architecture-frontend.md) の2章。

## 改善版の置き場（会員の画面）

← の右は、今のファイル（どこから移すか）。

```text
frontend/client/src/
├── main.tsx                       起動するだけ
├── api/                           API を呼ぶ所。読むのは hook と、まだ移していないレガシー版の画面（architecture-frontend.md の3章）     ← shared/api・features/messages/api.ts・各画面の fetch
│   ├── client.ts                  axios のインスタンス（axios.create() で作ったもの）：送り先・Cookie・CSRF・401／419・503
│   ├── ApiError.ts                失敗の型（状態コード・code・メッセージ・入力の誤り）。#292 で移した
│   └── 〇〇Api.ts                  業務のまとまりごと（authApi・profileApi・membersApi・matchingApi・messagingApi・billingApi）
├── app/                           組み立て。ルートと、どの画面にどの Repository の実装を渡すかを決めるのはここだけ
│   ├── App.tsx                    Provider を重ねる（ログインした自分・トースト）            ← App.tsx の上半分
│   ├── router.tsx                 ルートの表（パス・画面の題・どのタブを選ぶか）。まだ作っていない（今は App.tsx）   ← App.tsx の Routes・TITLES・TabBar の UNDER_HOME
│   ├── RequireAuth.tsx            ログインの守り（1か所。#257 で作った）。開こうとした画面は、まだ覚えない   ← 15画面の守り
│   ├── SessionGate.tsx・MaintenanceGate.tsx・configureApi.ts・maintenance.ts   起動のときの確かめとメンテナンス（作った）
│   └── AppShell.tsx               四角の枠と下のタブ・スクロールする枠を渡す                  ← App.tsx の下半分・components/TabBar
│
├── features/                      機能ごと。名前は要件（docs/requirements/）のまとまりにそろえる
│   ├── auth/                      ログイン・登録・メールの確認・パスワードの再設定・パスワードの変更・ログアウト
│   │                              ← LoginPage・RegisterPage・VerifyPage・ForgotPasswordPage・ResetPasswordPage・components/VerifyBanner・components/AwaitingVerification・SettingsPage の一部
│   ├── profile/                   自分のプロフィール（ホーム）・相手のプロフィール           ← HomePage・UserPage
│   ├── search/                    検索と一覧・検索の条件・保存した検索条件                    ← SearchPage・SearchConditionsPage
│   ├── likes/                     届いたいいね・送ったいいね・いいねとスキップ・マッチの演出  ← LikesPage・SentLikesPage・components/MatchCelebration
│   ├── messages/                  トークの一覧・トーク画面・Repository の実装2つ・読んだ数   ← MessagesPage・TalkPage・MessagesFsPage・TalkFsPage・ReadCounter・firebase.ts の下半分
│   ├── blocks/                    ブロックの一覧・ブロックする                                ← BlocksPage
│   ├── reports/                   通報                                                      ← components/ReportDialog
│   ├── plans/                     プラン・購入・使える機能の決まり・誘導・有料の印            ← PlansPage・PurchasePage・components/UpsellDialog
│   ├── settings/                  設定・案内・退会                                          ← SettingsPage・InfoPage
│   └── notices/                   運営からのお知らせ                                        ← NoticesPage・components/NoticeBanner
│
├── shared/                        どの機能にも属さないもの（features を import しない）
│   ├── session/                   ログインした自分（Account の型・/api/me を読む・読み直す・useSession）← App.tsx・各画面の /api/me
│   ├── firebase/app.ts            Emulator への接続（最初の1回だけ）                         ← firebase.ts の上半分
│   ├── ui/                        見せるだけの部品                                          ← components/ の残り（Button・Avatar・Icon・EmptyState・Skeleton・ConfirmDialog・Toast）
│   │   ├── AsyncView.tsx          読み込み中・失敗・空・中身を出し分ける（新しく作る）
│   │   └── InfiniteList.tsx       下まで来たら1回だけ知らせる（新しく作る）
│   ├── lib/
│   │   ├── date.ts                年齢の計算（1か所）
│   │   └── array.ts               uniqueBy（重なりを除く）
│   └── constants/                 都道府県の名前・プロフィールの選択肢・地方の区切り         ← SearchConditionsPage・HomePage
│
└── styles/
    ├── tokens.css                 色・余白・文字の変数（docs/design.md）
    └── index.css                  全体の土台                                                 ← index.css・App.css を分ける
```

### いくつもの画面で使うものの持ち主

| もの | 今使っている画面 | 持ち主と、出すもの |
| --- | --- | --- |
| ブロックする | トーク・相手のプロフィール・通報 | `blocks/` が hook を `index.ts` から出す |
| いいね・スキップ・マッチの演出 | 検索・相手のプロフィール・いいね | `likes/` が hook と演出の部品を出す |
| 誘導のダイアログ・有料の印 | ほぼ全部の画面 | `plans/` が出す。ダイアログは container が受け取って渡す |
| 通報のダイアログ | トーク・相手のプロフィール | `reports/` が出す。container が受け取って渡す |
| 会員のカード | 検索・いいね・ブロックの一覧 | `profile/` が presenter を出す |
| 未読の数・届いたいいねの数 | 下のタブ | 数だけを返す API が1本なので、`messages/` が `useBadgeCounts` を出す（届いたいいねの数も。#247）。読むのは `TabBar` の中だけ。読み直す関数は、使う画面を移すときに足す |
| 読んだ数の表示（`ReadCounter`） | Firestore 版のトークとその一覧 | `messages/components/`（数えるのは Firestore の Repository の実装） |
| Firebase へのログイン（`signInFirebase`） | Firestore 版のトーク | Firestore の Repository の実装が、最初に使うときに1回だけ。Firestore のトークンは `messagingApi` から取る |

- 退会は `settings/` に置く。`blocks/` は退会を受け持たない（#121 の範囲から外す）
- 下のタブの数は、下のタブの数だけの機能（`features/tab-counts`）にする案・API を2本に分けてそれぞれの機能に持たせる案と比べ、1本の API と `features/messages` の hook にした（ポーリングを1本にするため。#247）。いいねの画面を移すときに見直す

### 会員の画面の行き先（21画面）

`frontend/client/src/App.tsx` のルートの21画面が、どの機能に入るか。今のファイルは、どれも `src` の直下にある。「使う API」は、今のファイルが import している `src/api/〇〇Api.ts`。

| パス | 今のファイル | 移す先 | 使う API | 移したか |
| --- | --- | --- | --- | --- |
| `/login` | `LoginPage.tsx` | `auth` | `authApi` | まだ |
| `/register` | `RegisterPage.tsx` | `auth` | `authApi` | まだ |
| `/verify/:token` | `VerifyPage.tsx` | `auth` | `authApi` | まだ |
| `/forgot-password` | `ForgotPasswordPage.tsx` | `auth` | `authApi` | まだ |
| `/reset-password/:token` | `ResetPasswordPage.tsx` | `auth` | `authApi` | まだ |
| `/home` | `HomePage.tsx` | `profile` | `profileApi` | まだ |
| `/users/:publicId` | `UserPage.tsx` | `profile` | `profileApi`・`matchingApi` | まだ |
| `/likes` | `LikesPage.tsx` | `likes` | `matchingApi`・`profileApi` | まだ（#294） |
| `/likes/sent` | `SentLikesPage.tsx` | `likes` | `matchingApi` | まだ |
| `/messages` | `MessagesPage.tsx` | `messages` | `messagingApi` | まだ |
| `/messages/:roomId` | `TalkPage.tsx` | `messages` | `messagingApi`・`matchingApi`・`profileApi` | まだ |
| `/messages-fs` | `MessagesFsPage.tsx` | `messages` | `profileApi`・Firestore | まだ |
| `/messages-fs/:roomId` | `TalkFsPage.tsx` | `messages` | `profileApi`・Firestore | まだ |
| `/search` | `SearchPage.tsx` | `search` | `membersApi`・`matchingApi` | まだ |
| `/search/conditions` | `SearchConditionsPage.tsx` | `search` | `membersApi`・`profileApi` | まだ |
| `/settings` | `SettingsPage.tsx` | `settings` | `authApi`・`profileApi` | まだ |
| `/notices` | `NoticesPage.tsx` | `notices` | `membersApi` | まだ |
| `/blocks` | `BlocksPage.tsx` | `blocks` | `matchingApi` | まだ |
| `/plans` | `PlansPage.tsx` | `plans` | `billingApi`・`profileApi` | まだ |
| `/plans/:planId` | `PurchasePage.tsx` | `plans` | `billingApi`・`profileApi` | まだ |
| `/info/:slug` | `InfoPage.tsx` | `settings` | なし | まだ |

- 「移す先」は `features/<機能>`。機能の名前は、上の図にそろえた
- `/`（ログインしているかで移す）と `*`（ない URL）は、画面でなくルートの表の行なので、`app/router.tsx` に入れる（まだ作っていない。今は `App.tsx`）
- 設定の画面のうち、パスワードの変更は `auth` に入れる（上の図）。設定の画面を移すチケットで、`auth` の `index.ts` から受け取る
- `features/messages` は、下のタブの数（`useBadgeCounts`）だけを移した。トークの4画面は、まだ移していない
- 画面でない部品（`components/` の `VerifyBanner`・`NoticeBanner`・`ReportDialog`・`UpsellDialog`・`MatchCelebration`）の行き先は、上の図。最初に使う画面を移すときに一緒に移す
- いくつもの画面が使う部品を、最初に使う画面と一緒に移したあと、まだ移していないレガシー版の画面は、`features/<機能>` の `index.ts` だけを読んでよい（`architecture-frontend.md` の3章）
- 画面ごとの細かな棚卸し（状態・API・ロジックと、その置き場）は、ここに書かない。その画面を移すチケットの最初に書く（`.github/ISSUE_TEMPLATE/r-improvement.md` の「画面を移すときだけ」）
- 移したら、その行の「移したか」を、移したチケットの番号に直す

#### 機能の名前と、要件・バックエンドの名前

機能の名前は、要件（`docs/requirements/`）とバックエンドの業務のまとまり（`docs/backend.md` の2章）にそろえる。画面の機能は、業務のまとまりより細かく分ける。

| 画面の機能 | 要件 | バックエンドの業務のまとまり |
| --- | --- | --- |
| `auth` | `auth.md` | `Auth` |
| `profile` | `members.md` | `Profile` |
| `search` | `search.md`・`saved-searches.md` | `Members` |
| `likes` | `likes.md`・`matches.md` | `Matching` |
| `messages` | `messages.md` | `Messaging` |
| `blocks` | `blocks.md` | `Matching` |
| `reports` | `reports.md` | `Members` |
| `plans` | `paid-members.md` | `Billing` |
| `settings` | `withdrawal.md` | `Profile`（退会） |
| `notices` | `screens.md` の FR-UI-098 | `Members` |

- 名前がそろっていないもの
  - `plans`：要件は `paid-members`、バックエンドは `Billing`
  - `settings`・`notices`：要件のファイルがない
- どちらも、図の名前のままにする。`plans` は D-026 の⑧（`plans/rules.ts`）で使っている名前で、変えると決まりと決定も直すことになるため

### 1つの機能の中（例：`features/search/`）

```text
features/search/
├── index.ts                       外に見せるものだけ（SearchPage など）。ほかの機能は、ここからしか import しない
├── pages/
│   └── SearchPage.tsx             container
├── components/                    presenter
│   ├── SearchView.tsx
│   └── SearchForm.tsx
├── hooks/
│   ├── useSearchConditions.ts     条件を URL に読み書きする（クエリがないときだけ、最後の条件に戻す）
│   └── useSearchMembers.ts        取る・足す・重なりを除く・古い応答を捨てる・状態を持つ
├── types.ts                       画面の型（SearchConditions・MemberCard）
├── rules.ts                       画面の決まり（年齢の下 ≤ 上など）。純粋な関数
└── *.test.ts(x)                   テストは隣に置く
```

- API を呼び、API の形（`MemberCardResponse`）を画面の形（`MemberCard`）に変えるのは、`src/api/membersApi.ts`。`useSearchMembers` が呼ぶ

ファイルが少ない機能（`blocks/` など）も、`pages/` と `components/` は作る。画面をまだ移していない機能（今は下のタブの数だけの `messages/`）は、画面を移すチケットで作る（`architecture-frontend.md` の2章）。`hooks/`・`types.ts`・`rules.ts` は、要るときだけ作る。機能の中に `api.ts` は作らない（D-029）。

### データの出どころが2つある機能（`features/messages/`）

```text
features/messages/
├── index.ts
├── pages/MessagesPage.tsx・TalkPage.tsx        1つずつ（今は Laravel 版と Firestore 版で2つずつ）
├── components/RoomList.tsx・Talk.tsx・Bubble.tsx・Composer.tsx・ReadCounter.tsx
├── hooks/useRooms.ts・useTalk.ts               Repository を受け取って使う
├── repository.ts                                MessageRepository（型の約束）
├── repositories/
│   ├── restMessageRepository.ts                 Laravel：ポーリング。messagingApi を呼ぶ
│   └── firestoreMessageRepository.ts            Firestore：onSnapshot。読んだ数もここで数える。Firebase へのログインもここ
├── types.ts・rules.ts                           Message・Room・送れる文字数
└── *.test.ts(x)
```

- どちらの実装を渡すかは `app/router.tsx`（まだ作っていない。今は `App.tsx`）が決める。Firestore の画面は `lazy()` で分けて読む
- 約束の形と、2つの版の違いの変え方は、[architecture-frontend.md](../agents/rules/architecture-frontend.md) の6章

## 画面の移し方

手順（単位・きっかけ・順番・PR の大きさ・レビューで見る所）の正は、[architecture-frontend.md](../agents/rules/architecture-frontend.md) の9章。ここには、そう決めた理由を書く。

- 決めたこと：1画面ずつ移す。1つの画面を移すときに、6つの領域をすべて、その画面で直して測る（2026-11-23 に人が決めた。D-030）
- 移すきっかけ：その画面に機能を足すとき・不具合を直すとき
- 移している間は、レガシー版の画面（`src` の直下）と改善版の画面（`features/`）が並んでよい
- 全部の画面を先に棚卸ししない。画面ごとの細かな棚卸しは、その画面を移すチケットの最初にする

### 理由

- 1つの領域を全部の画面に広げると、PR が大きくなり、何が良くなったかが数字で見えない
- 1つの画面で6つの領域をすべて直すと、同じ画面の前と後の数字で比べられる
- 機能を足す・不具合を直すときに移すと、移す手間を、その画面を触る仕事と一緒にできる。触らない画面は、移さずに残してよい
- 先に全部を棚卸しすると、移すまでの間にコードが変わり、書いたものが古くなる

### ほかの案

- 1つの領域を全部の画面に広げる（例：先に全部の画面の API の呼び出しを hook に移す）
- 全部の画面を先に棚卸しし、移す順番を決めてから進める（#275・#276 の初めの形）

### 画面をまたぐもの

- テストの道具（MSW・Playwright）：#290
- 表示速度を測る仕組み（ビルドの大きさ・LCP・Firestore の画面の `lazy()`）：#295
- ルートの表：移した画面も、今の `App.tsx` のルートの表（画面の題は `TITLES`、タブは `components/TabBar.tsx` の `UNDER_HOME`）に1行足す。`app/router.tsx` に移すのは、画面が増えて困ったときに別のチケットで
- 順番：#293（この地図）→ #290 → #294（試しの1画面：届いたいいね）→ #295

## 管理画面（`frontend/admin`）への当てはめ

- 同じ形にする（`app/`・`features/`・`shared/`）。`src/domains/` は `src/features/` に名前を変える。記事の層の名前（Domain）とフォルダの名前を分け、機能ごとのフォルダだと分かるようにするため。今ある機能は、members・messages・sales・audit-logs・dashboard・reports・blocks の7つ。ログインと役割のために `auth/` を足す
- 書き方の決まりは [architecture-frontend.md](../agents/rules/architecture-frontend.md) の11章

## 足すきっかけ

最初から全部を作らない。下のどれかが起きたら足し、`docs/decisions.md` に1行足して、この文書と決まりのファイルを直す。

| 起きたこと | 足すもの |
| --- | --- |
| 同じ部品・決まりを、2つ目の機能が使いたくなった | 持ち主の機能の `index.ts` から出す。3つ目が使う見せるだけの部品は `shared/ui` へ移す（API を呼ぶ部品は移さない） |
| データの出どころが2つになった・テストで外を偽物にしたい | その機能にだけ `repository.ts` と `repositories/` を作る |
| 同じ取り方（中止・重なり・続きの読み込み）を3つの hook に書いた | `shared/` に共通の hook を作る |
| 画面をまたいで同じデータを何度も取り直して遅い | そのデータだけ store に置く（それでも足りなければ、TanStack Query を使わない決めを見直す） |
| 部品が 150行を超えた | presenter を分ける・hook に出す |
| 手順が込み入り、hook のテストが書きにくい | その手順だけ、React から外した純粋な関数にする |
| 機能どうしの import が互いに向き合い始めた | `shared/` に移すか、`app/` でつなぐ。増えたら dependency-cruiser を考える |
| A/B テスト・機能のフラグが要件に出てきた | フラグを読む所を1か所に作り、container で presenter を出し分ける |

## まだ決めていないこと

- E2E（Playwright）を CI に入れるか。最初は手元で流す（architecture-frontend.md の7章）
- REST のメッセージを画面の形（`isMine`）に変える所は、トークの画面を移すときに決める（`Account` は `public_id` だけを持つ。architecture-frontend.md の6章）
- 有料で断るときの 403 に `code` を付けること（要件は `code: paid_required` を決めているが、API は返していない）。「使える機能を `/api/me` で返す」チケットに入れる
- 検索のフリーワードを URL に入れたとき、アクセスのログに残してよいか
