<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * 確認のメール（01b のレガシー版。docs/api/01b-auth.md）。
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
                // M2（#193）：リンクを、画面の確認のページに向ける（前は API を直接開き、JSON の文字だけが出ていた）。
                // 確認用の文字は、前と同じく平文のまま URL に入る
                'url' => config('app.frontend_url').'/verify/'.$this->user->verification_token,
            ],
        );
    }
}
