---
name: ticket
description: 改訂版（refactored-repo）のチケット（Issue）を、10種類のひな形（エピック・機能・小さな機能・改善・不具合・ツールの導入・調査・雑務・障害・提案）で下書きし、確認を取ってから作り、Project「matching-db-study 改訂版」に入れて種類・Priority・Size・Area・Cycle・Status を付ける。エピックの子は sub-issue につなぐ。「チケットを作って」「Inbox に入れて」「ボードを直して」「ticket」と言われたときに使う。
---

# チケットを作って、ボードに載せる

目的：種類・大きさ・優先度のそろったチケットを、1つのボードで見えるようにする。レガシー版（legacy-repo）のチケットは `issue-plan` を使う。

先に [docs/process.md](../../../docs/process.md) の3章を読む。

## 1. 種類とひな形を決める

- 種類から `.github/ISSUE_TEMPLATE/r-*.md` を選ぶ（対応は process.md の3-1）。GitHub の画面は main のひな形を出すので、本文はこのファイルから作る
- 同じチケットがないかを探す：`gh issue list --search "<言葉>" --state all`
- PR が2つ以上になるものは、エピックにして子に分ける
- 画面を移すチケットは、改善（`r-improvement.md`）で作り、「画面を移すときだけ」（画面・きっかけ・棚卸し・6つの領域）を埋める。1画面に1枚（`agents/rules/architecture-frontend.md` の9章）。ほかの改善では、その見出しを消す

## 2. 下書きを出す

- ひな形の見出しに沿って本文を書き、scratchpad に置く。コメント（`<!-- -->`）は消す
- タイトルは「[種類] 何を」（例：`[改善] トークンを読む所を1か所にする`）。先頭の言葉は process.md の3-1 の表（`[親]`・`[機能]`・`[小機能]`・`[改善]`・`[不具合]`・`[ツール]`・`[調査]`・`[雑務]`・`[障害]`・`[提案]`）
- ラベルは領域（`db`・`api`・`frontend`・`auth`・`docs`）だけ
- 本文は `agents/rules/writing.md` の書き方と言葉で書く（チケットの本文は GitHub にあり、機械の検査が届かないので、書く前に表を読む）
- チャットに表で見せる：タイトル・種類・Priority・Size・Area・Cycle・Status・本文の要点。本文の全部は貼らない
- 種類と Priority は PM の役、Size と Area はリーダーの役として案を出す。人が決める

## 3. 確認を取ってから作る

「作る」と言われたものだけを作る。返事がなければ作らない。

1. `gh issue create --title ... --body-file ... --label ...`（マイルストーンは付けない）
2. エピックの子なら、親の sub-issue にする：`gh api repos/masa-devx/matching-db-study/issues/<親>/sub_issues -X POST -F sub_issue_id=<子の id>`（子の id は `gh api repos/masa-devx/matching-db-study/issues/<子> --jq .id`）
3. ボードに入れる：`gh project item-add 9 --owner masa-devx --url <URL> --format json --jq .id`
4. ボードの項目を付ける（下）
5. 作った番号・URL・項目を一覧で伝える

## ボードの項目を付ける

- 項目と選択肢の id は、そのつど読む：`gh project field-list 9 --owner masa-devx --format json`（scratchpad に保存して `jq` で引く）
- 単一選択（Status・種類・Priority・Size・Area）：`gh project item-edit --id <item> --project-id <project の id> --field-id <field> --single-select-option-id <option>`
- Cycle（イテレーション）：`gh project item-edit ... --field-id <Cycle の id> --iteration-id <id>`。イテレーションの id は `field-list` の `configuration.iterations`
- project の id：`gh project view 9 --owner masa-devx --format json --jq .id`
- 新しく届いたもの（声・レビューで見つけた負債・提案）は Status を Inbox にし、Priority と Size は空のままでよい。仕分けは `pm` が行う

## 終わりの条件

- 確認を取ったチケットができ、ボードに入り、決めた項目が付いている。エピックの子は sub-issue になっている

## エラー時

- `project` の権限がないと言われたら、人に `! gh auth refresh -s project` を実行してもらう
- sub-issue につなげなかったら、エピックの本文の「子のチケット」に `#番号` を書いて代わりにし、その旨を伝える
