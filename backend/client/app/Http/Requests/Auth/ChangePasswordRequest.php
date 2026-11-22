<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * パスワードを変える（PUT /api/me/password）の入力の形。新しいパスワードは、登録と同じ決まり（FR-AUTH-033・FR-AUTH-004）。
 * 今のパスワードが合うかは、業務の確かめなので PasswordService で見る
 */
final class ChangePasswordRequest extends FormRequest
{
    /** @return array<string, list<string|Closure>> */
    public function rules(): array
    {
        return [
            // 今のパスワードは、形だけを見る。送らないときは required にせず、違うときと同じ 422 にする（docs/api/01b-auth.md）
            'current_password' => ['string'],
            // 文字の数（min・max）は mb_strlen で数える。72バイトは bcrypt が読む長さで、それより後ろは照合に使われない。
            // NUL の文字は bcrypt にできず 500 になり、そのときのエラーのログにパスワードが出るおそれがあるので断る（FR-AUTH-032）
            'password' => ['required', 'string', 'min:8', 'max:64', static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value)) {
                    return;
                }
                if (str_contains($value, "\0")) {
                    $fail('validation.no_null_character')->translate();
                } elseif (strlen($value) > 72) {
                    $fail('validation.max_bytes')->translate(['max' => 72]);
                }
            }],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['current_password' => '今のパスワード', 'password' => '新しいパスワード'];
    }
}
