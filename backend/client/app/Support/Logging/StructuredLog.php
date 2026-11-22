<?php

declare(strict_types=1);

namespace App\Support\Logging;

use Illuminate\Support\Facades\Log;

/**
 * 業務の出来事のログを出す共通の関数（agents/rules/logging.md の1）。Service・Http から、Log::info の代わりに1行で呼ぶ。
 * 名前は domain.function の形（auth.passwordChanged）。値は、番号や数などの要約だけを渡す（logging.md の6）。
 * 渡し間違えたときのために、パスワード・トークン・秘密の値・メールアドレスのキーの値は伏せて書く（FR-AUTH-032）。
 * メールアドレスは、キーが email のときだけ伏せる（ドメインだけの emailDomain は書いてよい。logging.md の見本）。
 * 伏せるのは、いちばん外のキーだけ（配列やオブジェクトを丸ごと渡さない決まりのため）
 */
final class StructuredLog
{
    private const MASKED = '[masked]';

    /** キーの名前に、この言葉が入っていたら伏せる（大文字と小文字は区別しない） */
    private const SECRET_WORDS = ['password', 'token', 'secret'];

    /** @param  array<string, int|float|string|bool|null>  $context */
    public static function info(string $name, array $context = []): void
    {
        Log::info($name, self::mask($context));
    }

    /**
     * @param  array<string, int|float|string|bool|null>  $context
     * @return array<string, int|float|string|bool|null>
     */
    private static function mask(array $context): array
    {
        foreach (array_keys($context) as $key) {
            $lower = strtolower($key);
            if ($lower === 'email' || array_any(self::SECRET_WORDS, fn (string $word): bool => str_contains($lower, $word))) {
                $context[$key] = self::MASKED;
            }
        }

        return $context;
    }
}
