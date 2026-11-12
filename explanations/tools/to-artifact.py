"""explanations/ の HTML を、claude.ai の Artifact に載せる形に写す。
元のファイルは変えない。使い方: python3 -I explanations/tools/to-artifact.py <元の HTML> <出力先>（出力先は会話の作業用フォルダ）

- 共通の見た目（assets/page.css）と動き（assets/page.js）は、Artifact では別のファイルを読めないので、埋め込む
- highlight.js は cdnjs から読む（Artifact で読める場所）。Mermaid は Artifact が自分で描くので、読み込みの script を外す"""
import pathlib
import re
import sys

src, dst = pathlib.Path(sys.argv[1]), sys.argv[2]
s = src.read_text(encoding="utf-8")
assets = src.parent / "assets"

title = re.search(r"<title>.*?</title>", s, re.S).group(0)
body = re.search(r"<body>(.*)</body>", s, re.S).group(1)
css = (assets / "page.css").read_text(encoding="utf-8")
js = (assets / "page.js").read_text(encoding="utf-8")

body = re.sub(r'<script type="module">.*?</script>', "", body, flags=re.S)
body = body.replace('<script src="assets/page.js"></script>', "<script>\n" + js + "</script>")
# 目次へのリンクは Artifact の中では開けないので、GitHub の目次にする
body = body.replace(
    '<a href="index.html">← 目次へ</a>',
    '<a href="https://github.com/masa-devx/matching-db-study/blob/legacy-repo/explanations/index.html">← 目次（GitHub）</a>',
)

out = (
    title
    + '\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n'
    + css
    + "</style>\n"
    + body.strip()
    + "\n"
)
open(dst, "w", encoding="utf-8").write(out)
print(dst)
