<?php

declare(strict_types=1);

// 管理画面のアーキテクチャのテスト（tests/Arch/LayersTest.php）は、会員の側（正本）のコピー。違うのは、印より上の一覧だけ。
// 片方だけ直すと、もう片方に穴が残る（#231 のレビューで、会員の側を3回直した）。印より下が同じかを比べて、違えば落とす。
// 会員の側のテストのファイルを、文字として読む（コードとして読み込むのではない。管理画面は、会員の側のコードを読み込まない）

const SAME_RULES_MARKER = '// ==== ここから下は、会員の側';

/**
 * ファイルを、印の行より上と下に分ける。印は、行の頭から始まる1行（上のコメントに同じ文字があっても、ずれない）。
 *
 * @return array{0: string, 1: string}
 */
function archSplitAtMarker(string $path): array
{
    expect(is_file($path))->toBeTrue("比べる相手のファイルが読めない：{$path}（会員の側の tests/Arch/LayersTest.php の置き場が変わったら、ここも直す）");
    $source = (string) file_get_contents($path);
    $found = preg_match('/^'.preg_quote(SAME_RULES_MARKER, '/').'.*$/m', $source, $match, PREG_OFFSET_CAPTURE);
    expect($found)->toBe(1, '印の行（'.SAME_RULES_MARKER."…）がない：{$path}");

    return [substr($source, 0, $match[0][1]), substr($source, $match[0][1])];
}

$client = dirname(__DIR__, 3).'/client/tests/Arch/LayersTest.php';
$admin = __DIR__.'/LayersTest.php';

test('アーキテクチャのテストの決まりの部分（印より下）は、会員の側（正本）と同じ', function () use ($client, $admin): void {
    // 違うときは、会員の側に合わせる（会員の側を直したなら、その直しを、管理画面にもコピーする）
    expect(archSplitAtMarker($admin)[1])->toBe(archSplitAtMarker($client)[1]);
});

// 印より上は、このアプリだけの一覧（const）とコメントだけ。そこに決まりを書くと、比べる範囲の外になり、
// 片方だけに決まりを足したり緩めたりしても、上のテストが通ってしまう（#234 のレビューで見つけた）
test('印より上には、決まり（arch・test など）を書かない', function (string $path): void {
    [$above] = archSplitAtMarker($path);
    preg_match_all('/^\s*(arch|test|it|describe|expect|function|beforeEach|afterEach)\s*\(|->\s*(skip|todo|only)\s*\(/m', $above, $matches);

    expect($matches[0])->toBe([]);
})->with([
    '会員の側' => [$client],
    '管理画面' => [$admin],
]);
