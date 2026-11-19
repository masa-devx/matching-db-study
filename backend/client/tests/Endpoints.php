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
    // ---- Profile（プロフィール） ----

    /** 相手のプロフィールを見る・書き換える（GET・PUT /api/users/{user_id}。{user_id} の中身は users.public_id） */
    public static function profile(string $targetPublicId): string
    {
        return "/api/users/{$targetPublicId}";
    }
}
