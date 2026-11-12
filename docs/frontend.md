# 画面の作り方（レガシー版と直した版）

状態：確定（細かい道具と置き場所は 03b で決める）
決定：[decisions.md](decisions.md) の D-004（React＋TypeScript＋Vite）・D-006（OpenAPI は使わない）・D-014（認証）・D-018（画面も分ける）

画面も、DB と同じく「レガシー版で作る → 測る → 直す → もう一度測る」で進める。03b から、画面の子 Issue も `legacy-repo` と `refactored-repo` に分ける。05b（Context から Zustand）は、それ自体が前と後の比べなので分けない。

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

## 6つの項目

| 項目 | レガシー版（legacy-repo） | 直した版（refactored-repo） | 測る・確かめること |
| --- | --- | --- | --- |
| コンポーネント設計 | 1画面に1つの大きな部品 | container（データを取る・持つ）と presenter（props で見せるだけ）に分ける | 1つの部品の行の数。presenter を、API なしでテストできるか |
| API との通信 | 部品の中の `useEffect` で、そのつど `fetch`。URL とトークンの読み出しを、あちこちに書く | API を呼ぶところを1か所にまとめる（送り先・`401`・失敗・読み込み中）。検索の連打は `AbortController` で止める | 連打したとき、古い結果があとから上書きするか |
| 状態管理 | なんでも `useState` と Context に置く | どの状態をどこに置くかを分ける。05b で Zustand に移す | 描き直しの回数（React Profiler） |
| 画面の表示速度 | 考えない | 04 の検索の一覧で直す（長い一覧・画像・バンドルの大きさ） | Lighthouse の LCP・INP・CLS。`vite build` の大きさ |
| テスト | なし | Vitest＋Testing Library（presenter と、API を呼ぶところ）。直す前に、今の動きを固定するテストを足す | テストが、要件 ID の受け入れ条件に対応しているか |
| 開発効率 | ひな形の ESLint のまま。型は `any` でよい | ESLint・Prettier・型の検査を CI に入れる。API がまだないときの仮の応答 | CI で止まるか |

## 認証（D-014）

| | レガシー版 | 直した版 |
| --- | --- | --- |
| トークンの置き場所 | ログインの応答の JWT を sessionStorage に置き、`Authorization: Bearer` で送る | HttpOnly の Cookie（画面からは読めない）。`fetch` に `credentials: 'include'` |
| 確かめること | XSS があると、トークンを持ち出せる | 同じ XSS でも、トークンを持ち出せない |

## 03b で決めること

- `frontend/` の中の置き場所（ページ・部品・API を呼ぶところ）
- E2E の道具（[testing.md](../agents/rules/testing.md)）
- 画面の CI（[ci.md](ci.md)）
