---
name: release
description: 改訂版のサイクルの終わりに、手元で「本番に出す」と同じ順番でリリースする。バックアップ・マイグレーション・出したあとの確かめ・戻し方を1回試す・タグ・リリースノートを docs/cycles/<番号>/09-release.md に残す。「リリースして」「リリースの準備をして」「release」と言われたときに使う。
---

# リリースする（手元だけ）

目的：出す順番・確かめ・戻し方を、本番と同じ手順で練習する。デプロイ先はない。

先に [docs/process.md](../../../docs/process.md) の8章を読む。

## 1. 出すものをまとめる

- 前のタグ（`git tag --list 'v*'`）から今の `refactored-repo` までの PR を集める：`git log --merges --oneline <前のタグ>..refactored-repo`
- チケットと照らし、`02-what.md` の受け入れの条件がすべて Done かを見る。残りがあれば、出すか次へ回すかを PM の役で人と決める
- `09-release.md` の「出すもの」と、マイグレーションの一覧（`git diff --name-only <前のタグ>..refactored-repo -- backend/client/database/migrations`）を書く

## 2. 手順を下書きして、確かめる

`09-release.md` に手順を書き、人に見せてから進める。

1. バックアップ：`docker compose exec db pg_dump -U postgres -Fc -f /tmp/matching_dev-<タグ>.dump matching_dev`
2. `refactored-repo` に切り替え、`docker compose restart app admin-app`
3. マイグレーション：`docker compose run --rm app php artisan migrate`。かかった時間を測る。大きな表を変えるときは、流している間に別の端末から読み書きできるかも見る
4. 出したあとの確かめ：会員の側の `GET /up`（動いているかだけ）・管理画面の `GET /api/health`（DB の名前とマイグレーションの数）・会員の側が DB につながるか（`docker compose run --rm app php artisan migrate:status`）・受け入れの条件の主な操作（curl か画面）・わざと 500 を起こして、エラーの通知が Mailpit（`http://127.0.0.1:58025`）に届くか（通知の仕組みがあるとき）
5. 戻し方を1回試す：`php artisan migrate:rollback --step=<本数>`、だめならバックアップから `pg_restore` で戻す → 確かめ → もう一度出す
6. 結果を `09-release.md` のチェックに付ける

## 3. タグとリリースノート

- タグの番号：機能が入れば `v0.<次>.0`、直しだけなら `v0.x.<次>`
- リリースノートは2つ書く：会員と運営に向けたお知らせ（技術の言葉を使わない）と、開発者に向けた変更の一覧（PR の番号）
- タグを打つ・push する・GitHub のリリースを作る（`gh release create`）のは、人に確かめてから行う
- `docs/cycles/README.md` のリリースの列を埋める

## 終わりの条件

- `09-release.md` の手順がすべて済み、戻し方を1回試し、タグがある

## エラー時

- マイグレーションが失敗したら、先へ進まず、戻し方で戻してから原因を調べる。調べた結果は障害のチケット（`ticket`）にする
