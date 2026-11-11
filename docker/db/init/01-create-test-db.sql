-- テスト用の DB を作る。テストは毎回この DB を作り直すので、開発用（matching_dev）とは分ける
-- このファイルは、DB のボリュームが空のとき（最初の1回）だけ流れる
CREATE DATABASE matching_test;

-- 開発用とテスト用の両方で、クエリごとの回数・時間を見られるようにする
\connect matching_dev
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\connect matching_test
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
