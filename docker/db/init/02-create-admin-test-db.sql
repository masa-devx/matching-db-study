-- 管理画面（backend/admin）のテスト用の DB を作る。会員の側のテスト用（matching_test）とは分ける
-- （2つのテストを同時に流しても、表の作り直しがぶつからないため。docs/cycles/01-backend-foundation/03-how.md）
-- このファイルは、DB のボリュームが空のとき（最初の1回）だけ流れる。
-- もう DB を作ってある PC では、AGENTS.md の「主要コマンド」の「管理画面のテスト」の前提条件のコマンドで作る
CREATE DATABASE matching_admin_test;

\connect matching_admin_test
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
