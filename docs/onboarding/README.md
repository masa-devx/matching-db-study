# 入ってきた人として読む

改訂版に入る前に、今のコード（レガシー版）を「初めて入ったプロジェクト」として読む。読みながら分かったことと、分からなかったことをここに残す。

## 読む順番

| 順 | 領域 | 画面で触る | API を叩く | 読むコード | DB を見る |
| --- | --- | --- | --- | --- | --- |
| 1 | 全体像 | ― | `GET /api/health`（:8000・:8100） | `compose.yaml`・`backend/*/routes/api.php` | `\dt` |
| 2 | 認証 | 登録・ログイン | `POST /api/users`・`POST /api/auth/login` | `AuthController`・`EmailVerificationController` | `users` |
| 3 | 会員と検索 | 一覧・詳細・プロフィール | `GET /api/users`・`GET /api/me` | `UserController`・`ProfileController` | `users`・`profiles` |
| 4 | いいねとマッチ | いいね・マッチの一覧 | `POST /api/me/likes`・`GET /api/me/matches` | `LikeController`・`UserMatchController` | `likes`・`user_matches` |
| 5 | メッセージ | トーク | `GET /api/me/talk-rooms`・`POST /api/me/talk-rooms/{publicId}/messages` | `TalkRoomController`・`MessageController`・`FirebaseTokenController` | `talk_rooms`・`talk_room_members`・`messages` |
| 6 | ブロックと退会 | ブロック・退会 | `POST /api/me/blocks`・`DELETE /api/me` | `BlockController`・`UserController` | `blocks`・`users.deleted_at` |
| 7 | 有料会員 | プラン・購入 | `GET /api/plans`・`POST /api/me/purchases` | `PlanController`・`PurchaseController` | `plans`・`purchases`・`users.is_paid` |
| 8 | 管理画面 | 管理画面（:5174） | `GET /api/members`（:8100） | `backend/admin/app/Http/Controllers` の8つ | `admins`・`admin_audit_logs`・`users.suspended_at` |

コントローラーとテーブルの名前は、ルートとマイグレーションの名前から書いた。どのメソッドが受け持つかは、読みながら確かめる。

## 試しのアカウント

| 種類 | メールアドレス | パスワード |
| --- | --- | --- |
| 会員 | `search00001@example.test`〜 | `password` |
| 管理者（すべてできる） | `owner@admin.example.test` | `password` |
| 管理者（見るだけ） | `viewer@admin.example.test` | `password` |

入れ方と起動の仕方は AGENTS.md の「主要コマンド」。

## ファイル

| ファイル | 中身 |
| --- | --- |
| [feature-map.md](feature-map.md) | 機能 → 画面 → API → コントローラー → 表の対応 |
| [as-is-db.md](as-is-db.md) | 今の表の形と、知られている問題 |
| [quiz-log.md](quiz-log.md) | 出た問い・自分の答え・分からなかったところ |
