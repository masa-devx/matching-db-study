<?php

declare(strict_types=1);

use App\Exceptions\BusinessException;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;

// 業務の例外を足したときに、bootstrap/app.php の render と lang/ja/errors.php の文を書き忘れていないかを確かめる。
// 書き忘れると、500 になるのにエラーのログにも残らない（dontReport の対象のため。architecture.md の7章）

/** @return list<class-string<BusinessException>> app/Exceptions の中の、BusinessException を継ぐクラス（abstract を除く） */
function businessExceptionClasses(): array
{
    $classes = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Exceptions'), FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
        if (! $file instanceof SplFileInfo) {
            continue;
        }
        $relative = substr($file->getPathname(), strlen(app_path()) + 1, -strlen('.php'));
        $class = 'App\\'.str_replace('/', '\\', $relative);
        if (is_subclass_of($class, BusinessException::class) && ! (new ReflectionClass($class))->isAbstract()) {
            $classes[] = $class;
        }
    }

    return $classes;
}

it('業務の例外が1つ以上ある（0なら、下のテストは何も確かめずに通る）', function (): void {
    expect(businessExceptionClasses())->not->toBeEmpty();
});

it('どの業務の例外も、500 にならず、決めた文を返す', function (): void {
    $request = Request::create('/api/check', 'GET', server: ['HTTP_ACCEPT' => 'application/json']);

    foreach (businessExceptionClasses() as $class) {
        $response = app(ExceptionHandler::class)->render($request, new $class);
        $body = json_decode((string) $response->getContent(), true);
        $message = is_array($body) && is_string($body['message'] ?? null) ? $body['message'] : '';

        expect($response->getStatusCode())->toBeLessThan(500, "{$class} の render を bootstrap/app.php に書いていない")
            ->and($message)->not->toStartWith('errors.', "{$class} の文を lang/ja/errors.php に書いていない");
    }
});
