<?php

declare(strict_types=1);

use App\Support\Logging\StructuredLog;
use Illuminate\Support\Facades\Log;

// 業務の出来事のログの共通の関数（app/Support/Logging/StructuredLog.php。logging.md の1）。
// 渡し間違えたときに、秘密の値をログに書かないことを確かめる（FR-AUTH-032）

describe('開発者が、業務の出来事のログを出す', function (): void {
    it('名前と、渡した要約の値を、そのまま info で書く', function (): void {
        $log = Log::spy();

        StructuredLog::info('auth.passwordChanged', ['userId' => 1, 'deletedSessions' => 2]);

        $log->shouldHaveReceived('info')->once()->with('auth.passwordChanged', ['userId' => 1, 'deletedSessions' => 2]);
    });

    it('パスワード・トークン・秘密の値・メールアドレスのキーを渡し間違えても、値は伏せて書く（メールアドレスのドメインは書く）', function (): void {
        $log = Log::spy();

        StructuredLog::info('auth.example', [
            'userId' => 1,
            'password' => 'secret-1',
            'currentPassword' => 'secret-2',
            'resetToken' => 'secret-3',
            'clientSecret' => 'secret-4',
            'email' => 'a@example.test',
            'emailDomain' => 'example.test',
        ]);

        $log->shouldHaveReceived('info')->once()->with('auth.example', [
            'userId' => 1,
            'password' => '[masked]',
            'currentPassword' => '[masked]',
            'resetToken' => '[masked]',
            'clientSecret' => '[masked]',
            'email' => '[masked]',
            'emailDomain' => 'example.test',
        ]);
    });
});
