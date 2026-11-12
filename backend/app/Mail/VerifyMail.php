<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * 確認のメール（01b の素朴な版。docs/api/01b-auth.md）。
 * リンクには users.verification_token をそのまま入れる。期限も署名もない。
 */
class VerifyMail extends Mailable
{
    public function __construct(public User $user) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'メールアドレスの確認',
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.verify',
            with: [
                // url() は、今のリクエストのホスト（手元は http://127.0.0.1:8000）でリンクを作る
                'url' => url('/api/email-verifications/'.$this->user->verification_token),
            ],
        );
    }
}
