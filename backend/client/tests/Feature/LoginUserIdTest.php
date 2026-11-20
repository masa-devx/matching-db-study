<?php

declare(strict_types=1);

use App\Http\Controllers\Profile\ProfileController;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use Tests\DummyData\DummyUser;

use function Pest\Laravel\getJson;

// Controller::loginUserId()：ルートに、ログインを確かめる Middleware（user.authenticate）を付け忘れたときの動き。
// 付け忘れはプログラムの誤りなので、「会員 0 番」として動かず、エラーのログに残る 500 にする

describe('ログインを確かめる Middleware を付け忘れたルートを呼ぶ', function (): void {
    it('会員 0 番として動かず、サーバーのエラーとしてログに残る（500）', function (): void {
        // テストの中だけで、Middleware を付けないルートを足す（本物の routes/api.php は変えない）
        Route::get('/api/test-missing-authenticate/{user_id}', [ProfileController::class, 'show']);
        $target = DummyUser::create();
        Exceptions::fake();

        getJson("/api/test-missing-authenticate/{$target->publicId}")->assertInternalServerError();

        Exceptions::assertReported(LogicException::class);
    });
});
