---
name: explain-step
description: 実装の前に、次の一歩（機能・テーマ）の解説を作る。何を作るか・先に知る言葉・図（ER 図・フローチャート・シーケンス図）・設計の選択肢の比較・小さな見本・確かめ方・罠・理解を確かめる6つの問いを、explanations/ に HTML で保存し、ブラウザで見られるようにする。コードは書かない。「次の一歩を解説して」「02 を解説して」「いいねの設計を説明して」「explain-step」と言われたとき、新しい一歩に入る前に使う。
---

# 実装の前に、一歩ぶんの解説を作る

目的：一気に作らず、理解してから進む。このスキルでは**実装しない**（コード・マイグレーション・テストを書かない）。

## 1. どの一歩かを決める

- [explanations/index.html](../../../explanations/index.html) の「一歩ずつの目次」を読む
- 番号やテーマを言われたらそれ。言われなければ、状態が「未着手」の一番小さい番号を提案して、確認を取る
- 目次にないテーマなら、どこに入れるか（番号）を提案して確認を取る

## 2. 前提を読む

- AGENTS.md と、関係するルール（DB なら [database.md](../../rules/database.md)）
- [docs/product.md](../../../docs/product.md)（不変条件・用語）と、この一歩の機能の要件（`docs/requirements/<機能>.md`）。要件がまだ「確定」でなければ、解説を作る前に質問しながら決める（ひな形は `docs/requirements/template.md`）。用語は product.md の名前に合わせる
- [docs/decisions.md](../../../docs/decisions.md)。前の判断と矛盾しないようにする
- [background.md](../../background.md)（決めたこと・まだ決めていないこと）。そこにある「DB と API 設計のノート」（置き場所は `agents/notes.local.md`）の19章の対応表で、この一歩に関係する章だけを読み、言葉と具体例をそろえる。ノートにある個人的な話は、ページに書かない
- それまでの一歩のページ（`explanations/<番号>-*.html`）の「決めたこと」と「実装の記録」。前の決定と矛盾しないようにする
- 今のコード・マイグレーション（あれば）。今のテーブルを図に含める
- 秘密の値のファイル（`.env` など）は読まない

## 3. 解説のページを作る

- [explanations/_template.html](../../../explanations/_template.html) を写して `explanations/<番号>-<英小文字の kebab-case>.html` を作る（例：`02-likes.html`）。同じ名前があれば上書きせず、確認を取る
- 【】をすべて埋める。埋められないものは「未定」と書いて理由を添える
- 書き方
  - 文は短く、日本語で。専門用語は「2. 先に知っておく言葉」で1〜2文で説明してから使う
  - 「4. 選択肢」は2〜3案。案ごとに良いところ・弱いところ・向いている場面を書き、選ぶ案と理由を1つに決める
  - 「5. 見本」は、レガシー版（Fat Controller）と改善版を、それぞれ10〜20行まで。レガシー版には、何が問題かを書く。全部は書かない（実装は次に頼まれたときに行う）
  - 「5. 見本」の終わりの「Eloquent が発行する SQL」は、操作ごとに「PHP → 発行される SQL」をレガシー版と改善版で左右に並べる（00・03b・05b は分けないので書かない）
    1. SQL は推測で書かない。Laravel に作らせる：`cat explanations/tools/collect-sql.tinker 呼び出しの.txt | docker compose exec -T app php artisan tinker | grep '^> *@@\|^@@'`（呼び出しの書き方は collect-sql.tinker の先頭）。読み取りは `$sql`（本当に流す）、書き込み・まだない表・改善版は `$dry`（`DB::pretend()`。流さない）
    2. 集めた SQL を `explanations/sql/<番号>-<名前>.json` に書く（形は compare-block.py の先頭）。値を入れ、1行 45文字ほどで改行し、`-- ①…` で何をする SQL かを書く。`begin`・`commit` はログに出ないので手で書き足す。秘密の値は入れない
    3. ページの印（`<!-- compare: sql/….json -->`〜`<!-- /compare -->`）の間を、`python3 -I explanations/tools/compare-block.py explanations/sql/<…>.json explanations/<…>.html` で作る。JSON を直したら同じコマンドで作り直す
    4. 下の表に、操作ごとの本数と、SQL が変わる理由を書く。設計（`docs/api/`）の「流れる SQL の目安」と本数が合わなければ、ページに「要確認」と書いて、チャットで伝える
  - コードのかたまりは `<pre><code class="language-php">` のように言語を付ける（色が付く。SQL は `language-sql`、シェルは `language-bash`）
  - 「6. 確かめ方」は、①レガシー版で問題を見る方法（クエリの数・EXPLAIN（`EXPLAIN (ANALYZE, BUFFERS)`）・同時に送る）②直す前に足す、振る舞いを固定するテストの名前 ③改善したあとに比べる数字
  - 00・05b は、レガシー版と改善版に分けなくてよい（5・6 章は1つの形で書く）
  - 「8. 6つの問い」は、答えも書く（開くと見える形）。答えは、この一歩で選んだ設計に合わせる。問い 6 は「Eloquent で流れる SQL → 問題 → 直し方」と、Rails（ActiveRecord）・Prisma での書き方を短い表で並べる
- 図（「3. 図で見る」）は Mermaid で、1〜3枚
  - テーブルの関係 → `erDiagram`（列の型と、PK・FK・UK を書く）
  - 処理の流れ・判断の分かれ道 → `flowchart`
  - 同時に2つのリクエストが来るとき・API と DB のやり取り → `sequenceDiagram`
  - ラベルに `"` `<` `>` を使うときは、引用符で囲むか言い換える（壊れて描けなくなるため）

## 4. 目次を直す

- `explanations/index.html` の該当の行の名前を、作ったページへのリンクにし、状態を「解説だけ」にする

## 5. claude.ai に載せる

ユーザーは解説を claude.ai の Artifact で読む（手元のサーバーは使わない）。

1. 載せる形に写す：`python3 -I explanations/tools/to-artifact.py explanations/<番号>-<名前>.html <会話の作業用フォルダ>/artifacts/<番号>-<名前>.html`（元のファイルは変えない）
2. `agents/notes.local.md` の「Artifact のリンク」の表を見る
   - そのページの行があれば、その URL を `url` に渡して載せる（同じリンクのまま更新する。初めてその Artifact を触る会話なら、先に `action: "read"` で読む）
   - なければ新しく載せ（`icon` は `book`）、表に1行足す（番号・ページ・URL）
3. 載せたリンクを伝える。最初は本人だけが開ける（非公開）

## 6. 見せ方を伝えて、止まる

- 載せたリンクを伝える
- チャットには、ページの要点（できるようになること・選ぶ案と理由・罠）だけを短く書く。ページの中身を全部は貼らない
- 最後に「6つの問いに自分で答えてみて、分からないところを聞いてください。理解できたら『実装して』と言ってください」と伝えて止まる。返事がないまま実装に進まない
- あわせて「この一歩のタスクをカレンダーに入れますか？」と聞く。入れると言われたら [study-calendar](../study-calendar/SKILL.md) で進める

## 終わりの条件

- `explanations/<番号>-<名前>.html` に【】が残っていない
- Mermaid の図が描ける（コードの形が正しい）
- 目次の行がリンクになり、状態が「解説だけ」になっている
- claude.ai に載せ、リンクが `agents/notes.local.md` にある

## エラー時

- ページを開いても図が出ないとき：インターネットにつながっているか（Mermaid を CDN から読む）、Mermaid の書き方が壊れていないかを確かめる
