// 本番DBへの書き込みを、Bashの実行前に止めるPreToolUseフック。
// 本番の接続先は、環境変数名 PROD_DATABASE_URL への参照か、
// PROD_DB_HOSTS（カンマ区切り）に並べたホスト名で見分ける。
// 本番への読み取り（SELECTなど）は通し、書き込み・スキーマ変更・マイグレーション適用は止める。
// 文字列で判定するため抜け道は残る。本番の接続には読み取り専用のDBユーザーを使い、DB側でも止める。
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";

const prodHosts = (process.env.PROD_DB_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const targetsProd =
  /\bPROD_DATABASE_URL\b/.test(command) ||
  prodHosts.some((host) => command.includes(host));

if (!targetsProd) process.exit(0);

const writeSql =
  /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY)\b/i;
// Laravel の artisan のマイグレーション・シード・DB を消すコマンド
const writeTool =
  /\bartisan\s+(migrate(:fresh|:reset|:refresh|:rollback|:install)?|db:(wipe|seed)|schema:dump)(?=\s|$)/;
// SQLをファイルや標準入力から渡すと中身を確かめられないため、本番では止める
const opaqueSql = /(^|\s)(-f|--file)\s|<\s*\S+\.sql\b/;

let reason = "";
if (writeTool.test(command)) {
  reason = "本番DBへのマイグレーション適用・スキーマ反映・シード投入は実行できません。";
} else if (writeSql.test(command)) {
  reason = "本番DBへの書き込み・スキーマ変更のSQLは実行できません。";
} else if (opaqueSql.test(command)) {
  reason = "本番DBにはファイルや標準入力からSQLを渡せません。内容を確かめられないためです。";
}

if (reason) {
  // 終了コード2で実行を止め、標準エラーの内容をエージェントに返す
  process.stderr.write(
    `${reason}本番DBで許可されているのは読み取り（SELECT）だけです。` +
      "本番の変更が必要なら、変更内容と理由をユーザーに示して人間に依頼してください。\n",
  );
  process.exit(2);
}
