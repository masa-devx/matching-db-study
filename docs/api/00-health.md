# 00 環境

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

| メソッドとパス | 何をする |
| --- | --- |
| `GET /up` | 会員の側の API が動いているかを返す |

## `GET /up`

Laravel にもとからある口（`backend/client/bootstrap/app.php` の `health: '/up'`）。`routes/api.php` には書いていない。

| 項目 | 中身 |
| --- | --- |
| だれが使えるか | だれでも |
| 入力 | なし |
| 応答（成功） | `200`。HTML のページ。`Accept: application/json` を付けると `{"status": "up"}` |
| 応答（失敗） | `500`（下の「弱いところ」のとおり、今は DB が落ちても出ない） |
| メンテナンス中 | 止まらずに `200`（Laravel がもとから外している。FR-MAINT-004） |
| 流れる SQL の目安 | 0本 |
| curl の例 | `curl -i http://127.0.0.1:8000/up` |

- 前にあった `GET /api/health`（DB の名前とマイグレーションの数を返していた）は消した。呼ぶと `404`
  - 監視からも CI からも呼んでいなかった。返していた中身は、外から見えなくてよい情報だった
- 弱いところ：DB につながるかは確かめない
  - Laravel の `HealthCheck` は、出来事 `DiagnosingHealth` を出すだけ。会員の側には、それを受ける Listener がない
  - そのため、DB が落ちても `GET /up` は `200` を返す
  - DB の確かめを足すかは、監視を入れるチケットで決め直す
- 管理画面（`backend/admin`）の `GET /api/health` は、このファイルの外。今は変えていない（`docs/commands.md` の「管理画面」）
