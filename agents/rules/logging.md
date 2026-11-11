---
paths:
  - "backend/app/**"
  - "backend/config/logging.php"
---

# 構造化・要約・秘密値禁止

## ルール

1. 業務コードで標準出力のログ（PHP の `echo`・`var_dump`・`error_log`・`dd`、画面の `console.log`）を直接使わない。
   ログは共通関数を経由する（`backend/app/Support/Logging/`。SQL のログ（`DB::listen`）もここに置く）。
   直書きすると requestId の付与とマスク処理を迂回してしまうため
2. ラップするのは外部IO・副作用・失敗しうる処理だけ（DB・外部API・
   通知送信）。純粋関数はラップしない（ノイズになるだけ）
3. エラーは記録したあと必ず再スローする。握りつぶして正常系を返さない
4. 失敗しうる非同期の処理は、必ず待つか、呼び出し元へ返す。空の catch で捨てない
   （記入例: `.catch(() => {})`。失敗が記録されず、原因を追えなくなるため）
5. 画面から呼ばれる処理（APIなど）の失敗は、ユーザーに伝わる形で画面まで返す。
   無反応や読み込み中のまま止めない
6. 引数は要約だけを記録する（IDなど）。オブジェクトを丸ごと渡さない
7. infoを出すのは外部APIの成功・1秒を超える処理・重要イベントだけ。
   それ以外の成功は黙る（ログのノイズを増やさない）

## 標準キー

| キー | 内容 |
| --- | --- |
| name | domain.function 形式（例: invoice.createDraft） |
| userId | 関連する主体のID |
| requestId | リクエスト単位の相関ID |
| err | { name, message, stack } に整形 |
| ms | 所要時間 |

ログを集める先：手元だけ（`backend/storage/logs/` と標準出力）。デプロイしないので、Sentry などは使わない

## 秘密値をログに流さない

認証トークン・パスワード再設定リンク・APIキー・カード/口座情報・
生の個人情報は、いかなるログにも書かない。

記入例（TypeScript）:

```typescript
// ❌ リンクは実質パスワード。ログに残してはいけない
console.log("reset link generated", email, link);

// ✅ 共通関数経由で要約のみ。リンク自体は記録しない
log.info("auth.sendResetLink", { emailDomain: email.split("@")[1] });
```
