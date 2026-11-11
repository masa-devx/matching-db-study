"""explanations/ の HTML を、claude.ai の Artifact に載せる形に写す。
元のファイルは変えない。使い方: python3 -I explanations/tools/to-artifact.py <元の HTML> <出力先>（出力先は会話の作業用フォルダ）"""
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()

title = re.search(r"<title>.*?</title>", s, re.S).group(0)
style = re.search(r"<style>.*?</style>", s, re.S).group(0)
body = re.search(r"<body>(.*)</body>", s, re.S).group(1)

# Artifact は Mermaid を自分で描くので、読み込みの script は外す
body = re.sub(r'<script type="module">.*?</script>', "", body, flags=re.S)
# 目次へのリンクは Artifact の中では開けないので、GitHub の目次にする
body = body.replace(
    '<a href="index.html">← 目次へ</a>',
    '<a href="https://github.com/masa-devx/matching-db-study/blob/legacy-repo/explanations/index.html">← 目次（GitHub）</a>',
)

# 暗い色のときに、フォームやスクロールバーも暗くする
style = style.replace(
    "--card: #151b23; --accent: #4493f8; --ok: #3fb950; --warn: #d29922;\n    }",
    "--card: #151b23; --accent: #4493f8; --ok: #3fb950; --warn: #d29922;\n      color-scheme: dark;\n    }",
)
style = style.replace(
    "--card: #151b23; --accent: #4493f8; --ok: #3fb950; --warn: #d29922;\n  }",
    "--card: #151b23; --accent: #4493f8; --ok: #3fb950; --warn: #d29922;\n    color-scheme: dark;\n  }",
)
# 横の余白は、スマホの端のバーも避ける形にする
style = style.replace(
    "main { max-width: 920px; margin: 0 auto; padding: 24px 16px 80px; }",
    "main { max-width: 920px; margin: 0 auto; padding-block: 24px 80px;\n"
    "    padding-left: max(16px, env(safe-area-inset-left, 0px));\n"
    "    padding-right: max(16px, env(safe-area-inset-right, 0px)); }\n"
    "  h1, h2, h3 { text-wrap: balance; }",
)

out = (
    title
    + '\n<meta name="claude:viewport-fit-sides" content="cover">\n'
    + style
    + "\n"
    + body.strip()
    + "\n"
)
open(dst, "w", encoding="utf-8").write(out)
print(dst)
