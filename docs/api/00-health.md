# 00 環境

決まり（パス・ステータス・エラーの形）と一覧は [README.md](README.md)。

## `GET /api/health`

| 項目 | 中身 |
| --- | --- |
| だれが使えるか | だれでも |
| 入力 | なし |
| 応答（成功） | `200` `{"status": "ok", "database": "matching_dev", "migrations": 4}` |
| 応答（失敗） | `500`：DB につながらない・マイグレーションの前 |
| 流れる SQL の目安 | 1本 |
| curl の例 | `curl http://127.0.0.1:8000/api/health` |
