<?php

declare(strict_types=1);

namespace Tests;

/**
 * テストで呼ぶ API の URL を作る。URL の文字は、このファイルにだけ書く（変わったときに1か所で直すため）。
 * route() では作らない（ルートの URL を変えてもテストが落ちず、画面が壊れても気づけないため）。
 * メソッドの名前は「何の API か」。業務のまとまりごとに見出しで区切り、API を移すチケットで足す。
 * ログインが要らないルートの一覧（routesWithoutLogin()）も、URL の文字なので、ここに置く。
 */
final class Endpoints
{
    // ---- ログインが要らない API ----

    /**
     * ログインしなくても呼べるルート（「メソッド ルートの形」。Laravel の Route::uri() の形で、先頭に / を付けない）。
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
            'POST api/email-verifications',            // 確認のメールを送り直す。分かっている不具合：FR-AUTH-007 はログインが要る。登録の画面がログインの前に呼ぶので、改善版の URL に移すまで、このまま
            'POST api/auth/login',
            'POST api/password-resets',                // パスワードを忘れたとき
            'PUT api/password-resets/{token}',
            'POST api/auth/logout',                    // ログアウト。アカウント停止された会員も、自分のセッションを消せるように
        ];
    }

    /**
     * ログインは要るが、メールアドレスを確認していなくても呼べるルート（FR-AUTH-021）。形は routesWithoutLogin() と同じ。
     * ログインが要るルートのうち、ここにないものは、どれも確認が要る（tests/Feature/Auth/LoginRequiredRoutesTest.php）。
     *
     * @return list<string>
     */
    public static function routesWithoutVerifiedEmail(): array
    {
        return [
            'GET api/me',            // 自分の情報（確認を促す帯が、確認したかを読む）
        ];
    }

    // ---- 動いているかの確かめ・メンテナンス ----

    /** 動いているかと、DB につながるかを見る（GET /api/health） */
    public static function health(): string
    {
        return '/api/health';
    }

    /** メンテナンス中に、開発者が開く抜け道の URL（php artisan down --with-secret が作った文字。Laravel が web のルートで受ける） */
    public static function maintenanceBypass(string $secret): string
    {
        return "/{$secret}";
    }

    // ---- Auth（登録・ログイン） ----

    /** 会員を登録する（POST /api/users） */
    public static function register(): string
    {
        return '/api/users';
    }

    /** ログインする（POST /api/auth/login） */
    public static function login(): string
    {
        return '/api/auth/login';
    }

    /** パスワードを変える（PUT /api/me/password） */
    public static function password(): string
    {
        return '/api/me/password';
    }

    /** 検索の条件を保存する（POST /api/me/search-conditions） */
    public static function searchConditions(): string
    {
        return '/api/me/search-conditions';
    }

    /** パスワードを再設定する（PUT /api/password-resets/{token}。再設定のメールのリンク） */
    public static function passwordReset(string $token): string
    {
        return "/api/password-resets/{$token}";
    }

    /** ログアウトする（POST /api/auth/logout） */
    public static function logout(): string
    {
        return '/api/auth/logout';
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

    // ---- Matching（いいね・届いたいいね・マッチ） ----

    /** 送ったいいねの一覧を見る（GET /api/me/likes） */
    public static function sentLikes(): string
    {
        return '/api/me/likes';
    }

    /** 届いたいいねの一覧を見る（GET /api/me/received-likes） */
    public static function receivedLikes(): string
    {
        return '/api/me/received-likes';
    }

    /** マッチした相手の一覧を見る（GET /api/me/matches） */
    public static function matches(): string
    {
        return '/api/me/matches';
    }

    // ---- Messaging（トークルーム） ----

    /** トークの一覧を見る（GET /api/me/talk-rooms） */
    public static function talkRooms(): string
    {
        return '/api/me/talk-rooms';
    }
}
