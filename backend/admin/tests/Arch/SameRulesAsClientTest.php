<?php

declare(strict_types=1);

// 管理画面のアーキテクチャのテスト（tests/Arch/LayersTest.php）は、会員の側（正本）のコピー。違うのは、印より上の一覧だけ。
// 片方だけ直すと、もう片方に穴が残る（#231 のレビューで、会員の側を3回直した）。印より下が同じかを比べて、違えば落とす。
// 会員の側のテストのファイルを、文字として読む（コードとして読み込むのではない。管理画面は、会員の側のコードを読み込まない）
test('アーキテクチャのテストの決まりの部分は、会員の側（正本）と同じ', function (): void {
    $marker = '// ==== ここから下は、会員の側';
    $client = (string) @file_get_contents(dirname(__DIR__, 3).'/client/tests/Arch/LayersTest.php');
    $admin = (string) file_get_contents(__DIR__.'/LayersTest.php');

    expect($client)->toContain($marker)
        ->and($admin)->toContain($marker);

    $rules = static fn (string $source): string => substr($source, (int) strpos($source, $marker));

    // 違うときは、会員の側に合わせる（会員の側を直したなら、その直しを、管理画面にもコピーする）
    expect($rules($admin))->toBe($rules($client));
});
