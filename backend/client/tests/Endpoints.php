<?php

declare(strict_types=1);

namespace Tests;

/**
 * テストで呼ぶ API の URL を作る。URL の文字は、このファイルにだけ書く（変わったときに1か所で直すため）。
 * route() では作らない（ルートの URL を変えてもテストが落ちず、画面が壊れても気づけないため）。
 * メソッドの名前は「何の API か」。業務のまとまりごとに見出しで区切り、API を移すチケットで足す。
 */
final class Endpoints
{
    // ---- ログインが要らない API ----

    /**
     * ログインしなくても呼べるルート（「メソッド ルートの形」。routes/api.php の書き方と同じ）。
     * ここにないルートは、どれもログインが要る（tests/Feature/Auth/LoginRequiredRoutesTest.php）。
     * 新しいルートは、何もしなければ「ログインが要る」側に入るので、Middleware を付け忘れるとテストが落ちる。
     *
     * @return list<string>
     */
    public static function routesWithoutLogin(): array
    {
        return [
            'GET api/health',
            'POST api/users',                          // 登録
            'GET api/email-verifications/{token}',     // メールアドレスの確認
            'POST api/email-verifications',            // 確認のメールを送り直す
            'POST api/auth/login',
            'POST api/password-resets',                // パスワードを忘れたとき
            'PUT api/password-resets/{token}',
        ];
    }

    // ---- Auth（登録・ログイン） ----

    /** 会員を登録する（POST /api/users） */
    public static function register(): string
    {
        return '/api/users';
    }

    /** メールアドレスを確認する（GET /api/email-verifications/{token}。確認のメールのリンク） */
    public static function emailVerification(string $token): string
    {
        return "/api/email-verifications/{$token}";
    }

    // ---- Members（会員の検索） ----

    /** 会員を検索する（GET /api/users） */
    public static function searchUsers(): string
    {
        return '/api/users';
    }

    // ---- Profile（自分のアカウントと、相手のプロフィール） ----

    /** 自分のアカウントを見る（GET /api/me。名前は docs/glossary.md の「アカウント」） */
    public static function account(): string
    {
        return '/api/me';
    }

    /** 相手のプロフィールを見る・書き換える（GET・PUT /api/users/{user_id}。{user_id} の中身は users.public_id） */
    public static function profile(string $targetPublicId): string
    {
        return "/api/users/{$targetPublicId}";
    }
}
