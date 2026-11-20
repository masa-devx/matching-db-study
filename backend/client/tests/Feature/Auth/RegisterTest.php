<?php

declare(strict_types=1);

use App\Mail\VerifyMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

// POST /api/users：会員を登録する。応答に出す項目と、確認のメールのテスト。
// 確認用の文字は、確認のメールにだけ入れる。応答に出すと、メールを見ずに確認を通せる（不変条件 2）

describe('ログインしていない人が、会員として登録する', function (): void {
    it('登録でき（201）、応答に確認用の文字とパスワードは入らない（FR-AUTH-001・FR-AUTH-005）', function (): void {
        Mail::fake();
        $input = ['email' => 'new@example.test', 'password' => 'password', 'nickname' => 'あらた', 'gender' => 'female', 'birthday' => '1995-01-01'];

        postJson(Endpoints::register(), $input)
            ->assertCreated()
            ->assertJsonPath('email', 'new@example.test')
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('password');
    });

    it('確認用の文字は、確認のメールのリンクに入る（FR-AUTH-001・FR-AUTH-005）', function (): void {
        Mail::fake();
        $input = ['email' => 'new@example.test', 'password' => 'password', 'nickname' => 'あらた', 'gender' => 'female', 'birthday' => '1995-01-01'];

        postJson(Endpoints::register(), $input)->assertCreated();

        $token = DB::table('users')->where('email', 'new@example.test')->value('verification_token');
        expect($token)->toBeString();
        expect($token)->not->toBeEmpty();
        assert(is_string($token));   // Larastan に文字だと伝える（value() の戻り値は mixed で、上の expect では型が絞れないため）
        Mail::assertSent(VerifyMail::class, function (VerifyMail $mail) use ($token): bool {
            $mail->assertSeeInText('/verify/'.$token);

            return $mail->hasTo('new@example.test');
        });
    });

    it('確認のメールのリンクを開くと、メールアドレスが確認済みになる（FR-AUTH-005）', function (): void {
        Mail::fake();
        $input = ['email' => 'new@example.test', 'password' => 'password', 'nickname' => 'あらた', 'gender' => 'female', 'birthday' => '1995-01-01'];
        postJson(Endpoints::register(), $input)->assertCreated();
        $token = DB::table('users')->where('email', 'new@example.test')->value('verification_token');
        assert(is_string($token));   // 上と同じ理由

        getJson(Endpoints::emailVerification($token))
            ->assertOk()
            ->assertExactJson(['message' => 'メールアドレスを確認しました']);

        assertDatabaseMissing('users', ['email' => 'new@example.test', 'email_verified_at' => null]);
    });
});
