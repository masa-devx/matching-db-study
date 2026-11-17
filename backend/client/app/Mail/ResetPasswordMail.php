<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * パスワードの再設定のメール（M2 のレガシー版。docs/api/01b-auth.md の「#196」）。
 * リンクには、再設定用の文字をそのまま入れる。期限も署名もない（確認のメールと同じ作り）。
 */
class ResetPasswordMail extends Mailable
{
    public function __construct(public string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'パスワードの再設定',
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.reset-password',
            with: [
                // 画面の「新しいパスワードを決める」ページを開く（確認のメールと同じく、app.frontend_url を使う）
                'url' => config('app.frontend_url').'/reset-password/'.$this->token,
            ],
        );
    }
}
