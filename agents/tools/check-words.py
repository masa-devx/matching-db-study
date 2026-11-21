#!/usr/bin/env python3
"""文書に、使わないと決めた言い方が入っていないかを確かめる。

決まりは agents/rules/writing.md。見つかったら、ファイル・行・言葉を出して 1 で終わる。
「」の中に書いた言葉（古い言い方を引用して説明するとき）は数えない。

    python3 -I agents/tools/check-words.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGETS = ["docs", "agents", ".claude/agents", ".github", "AGENTS.md"]
SKIP = {"agents/rules/writing.md", "agents/tools/check-words.py"}
# 意味が1つに決まる言葉だけを機械で見る。「守る」「入口」「まとまり」は文脈で決まるので、レビューで見る
WORDS = ["固めるテスト", "固定するテスト", "テストで固め", "守るテスト", "テストで守", "骨抜き", "既知のリスク", "凍結", "写す", "写した", "写して", "写し忘れ", "止めた会員"]
PATTERN = re.compile("|".join(map(re.escape, WORDS)))
QUOTED = re.compile("「[^」]*」")


def files():
    for target in TARGETS:
        path = ROOT / target
        if path.is_file():
            yield path
        else:
            yield from (p for p in path.rglob("*") if p.suffix in {".md", ".yml", ".yaml"} and p.is_file())


def main() -> int:
    found = 0
    for path in sorted(set(files())):
        rel = path.relative_to(ROOT).as_posix()
        if rel in SKIP:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for match in PATTERN.finditer(QUOTED.sub("", line)):
                print(f"{rel}:{number}: 「{match.group()}」は使わない（agents/rules/writing.md の表の言い方にする）")
                found += 1
    if found:
        print(f"\n{found} か所。古い言い方を説明のために引くときは、「」で囲む")
        return 1
    print("使わない言い方は見つからなかった")
    return 0


if __name__ == "__main__":
    sys.exit(main())
