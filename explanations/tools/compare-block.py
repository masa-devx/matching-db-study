"""レガシー版と改善版を並べる HTML（ORM のコード → 発行される SQL）を作る。
解説のページの「Eloquent が発行する SQL」の節と、9-4 の前と後の比べに使う。

使い方:
  python3 -I explanations/tools/compare-block.py <JSON>            → HTML を標準出力に出す
  python3 -I explanations/tools/compare-block.py <JSON> <ページ>   → ページの印の間を書き換える
    印はページに手で1回だけ置く: <!-- compare: sql/02-likes.json --> と <!-- /compare -->
    JSON を直したら、同じコマンドでページを作り直せる（印の外は変えない）
JSON の置き場: explanations/sql/<ページの名前>.json

JSON の形（1つのファイルに、操作をいくつ並べてもよい。// の説明は見本のためで、JSON には書かない）:
{
  "operations": [
    {
      "title": "いいねを送る（<code>POST /api/me/likes</code>）",
      "columns": [
        {
          "kind": "legacy",              // legacy（黄）・improved（緑）・alt（青。横いっぱい）
          "title": "レガシー版",
          "count": "1本",                // SQL の本数（色つきのラベル）
          "code_label": "PHP（Eloquent）", // 省略可。クエリビルダーなら "PHP（クエリビルダー）"
          "code": "Like::create([...]);", // PHP。そのまま書く（< や > はこの道具が直す）
          "sql": "insert into ...;",       // 発行される SQL。値を入れ、行を分けて、-- で説明を書く
          "notes": ["<code>create()</code> は ..."]  // 箇条書き。HTML を書いてよい
        }
      ]
    }
  ]
}
"""
import html
import json
import pathlib
import sys

KINDS = {"legacy", "improved", "alt"}


def block(lang: str, text: str, label: str) -> str:
    body = html.escape(text.strip("\n"), quote=False)
    return f'<pre><code class="language-{lang}" data-label="{html.escape(label)}">{body}</code></pre>'


def column(c: dict) -> str:
    kind = c.get("kind", "legacy")
    if kind not in KINDS:
        raise SystemExit(f"kind は {sorted(KINDS)} のどれか: {kind}")
    notes = "".join(f"<li>{n}</li>" for n in c.get("notes", []))
    return (
        f'    <section class="compare-col {kind}">\n'
        f'      <p class="compare-title">{c["title"]}<span class="count">{c["count"]}</span></p>\n'
        f'      {block("php", c["code"], c.get("code_label", "PHP（Eloquent）"))}\n'
        f'      <p class="arrow">↓ 発行される SQL</p>\n'
        f'      {block("sql", c["sql"], c.get("sql_label", "SQL（PostgreSQL）"))}\n'
        + (f"      <ul>{notes}</ul>\n" if notes else "")
        + "    </section>"
    )


def render(spec: dict) -> str:
    out = []
    for op in spec["operations"]:
        out.append(f'  <h4>{op["title"]}</h4>')
        out.append('  <div class="compare">')
        out.extend(column(c) for c in op["columns"])
        out.append("  </div>")
    return "\n".join(out)


def main() -> None:
    json_path = pathlib.Path(sys.argv[1])
    html_text = render(json.loads(json_path.read_text(encoding="utf-8")))
    if len(sys.argv) < 3:
        print(html_text)
        return
    page = pathlib.Path(sys.argv[2])
    rel = json_path.resolve().relative_to(page.resolve().parent).as_posix()
    start, end = f"<!-- compare: {rel} -->", "<!-- /compare -->"
    s = page.read_text(encoding="utf-8")
    if s.count(start) != 1:
        raise SystemExit(f"{page} に印 {start} が1つだけあること")
    i = s.index(start) + len(start)
    j = s.index(end, i)
    page.write_text(s[:i] + "\n" + html_text + "\n  " + s[j:], encoding="utf-8")
    print(f"{page} の {rel} を書き換えた")


if __name__ == "__main__":
    main()
