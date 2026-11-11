---
name: issue-plan
description: 機能や直したいことの名前から、親 Issue と子 Issue（DB・テーブル設計／バックエンド API／フロントエンド／固定するテスト）の下書きを作り、確認を取ってから GitHub に作り、Project とマイルストーンにつなぐ。「02 の Issue を作って」「いいねの Issue を立てて」「N+1 を直す Issue を作って」「issue-plan」と言われたとき、新しい一歩や改善に入る前に使う。
---

# 親 Issue と子 Issue を作る

目的：1つの機能（または1つの改善）を、PR 1つで閉じられる大きさの子 Issue に分け、Project のボードで進み具合が見えるようにする。

## 1. 何の Issue かを決める

- 機能（素朴に作る）か、改善（直す）かを確かめる
  - 機能 → ひな形は `.github/ISSUE_TEMPLATE/feature.md`（親）と `task.md`（子）。マイルストーンは「M1 レガシーで作り切る」か「M3 追加機能」
  - 改善 → ひな形は `refactor.md`（親）と `task.md`（子）。マイルストーンは「M2 リファクタ」（追加機能を直すなら「M3 追加機能」）
  - 環境・ハーネス・文書だけ → `chore.md`（子 Issue は作らない）。マイルストーンは「M0 準備」
- 番号と名前は [explanations/index.html](../../../explanations/index.html) の目次に合わせる
- 同じ機能の Issue がもうないかを確かめる（`gh issue list --search "<番号>" --state all`）

## 2. 前提を読む

- [docs/product.md](../../../docs/product.md)（不変条件・用語）と、その機能の要件（`docs/requirements/<機能>.md`）。要件がなければ、親 Issue の「要件」は「新しく作る」と書く
- [docs/decisions.md](../../../docs/decisions.md)・[background.md](../../background.md) の「最初の範囲」
- 改善なら、その一歩の解説のページの 9-2（測った問題と数字）

## 3. 下書きを出す

- 親 Issue：ひな形の見出しに沿って書く。「子 Issue」の節に、作る子 Issue のタイトルを並べる
- 子 Issue：その機能に必要な領域だけ作る。表は一気に作らず、その機能に要るものだけにする
  - 機能：DB・テーブル設計 → バックエンド API → フロントエンド（03b より前は作らない）
  - 改善：固定するテスト（必ず最初）→ 直すのに必要な領域
- ラベル：親は `parent` と段階（`legacy`／`refactor`）。子は領域（`db`・`api`・`frontend`・`auth`）と段階
- チャットに、親と子のタイトル・ラベル・マイルストーン・本文の要点を表で見せる。本文は全部を貼らない

## 4. 確認を取ってから作る

GitHub に作るのは外に出る操作なので、「作る」と言われたものだけを作る。返事がなければ作らない。

1. 親 Issue を作る（`gh issue create --title ... --body-file ... --label ... --milestone ...`）
2. 子 Issue を作り、親の sub-issue にする（`gh issue create` のあと、`gh api` で親の `sub_issues` に足す）
3. 親と子を Project「matching-db-study」に足す（`gh project item-add`）
4. 作った Issue の番号と URL を一覧で伝える

本文は scratchpad に書いたファイルから渡す（`--body-file`）。秘密の値は本文に書かない。

## 終わりの条件

- 確認を取った親 Issue と子 Issue ができ、子が親の sub-issue になっている
- すべてにラベルとマイルストーンが付き、Project に入っている

## エラー時

- `project` の権限がないと言われたら、ユーザーに `! gh auth refresh -s project` を実行してもらう
- sub-issue につなげなかったら、親の本文の「子 Issue」の節に `#番号` を書いて代わりにし、その旨を伝える
