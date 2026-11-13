# frontend（レガシー版）

React＋TypeScript＋Vite の画面。要件は [docs/requirements/screens.md](../docs/requirements/screens.md)、解説は [explanations/03b-react.html](../explanations/03b-react.html)。

```bash
# リポジトリのルートで API を起動してから
cd frontend
npm install
npm run dev     # http://localhost:5173
npm run build   # 型の検査とビルド
npm run lint    # oxlint
```

API の送り先は `VITE_API_URL`（既定は `http://127.0.0.1:8000`）。変えるときは `.env.example` を写して `.env.local` を作る。
