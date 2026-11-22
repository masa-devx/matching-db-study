<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Session\LoginSession;
use App\Services\Auth\PasswordService;
use Illuminate\Http\JsonResponse;

/**
 * ログインした会員が、パスワードを変える（PUT /api/me/password。FR-AUTH-033）。
 * 今のパスワードの確かめ・保存・ほかの端末の行の削除は PasswordService、この端末の番号の作り直しは LoginSession
 */
final class PasswordController extends Controller
{
    public function __construct(
        private readonly PasswordService $passwordService,
        private readonly LoginSession $loginSession,
    ) {}

    public function update(ChangePasswordRequest $request): JsonResponse
    {
        $this->passwordService->changePassword(
            $this->loginUserId($request),
            $request->string('current_password')->toString(),
            $request->string('password')->toString(),   // ChangePasswordRequest で、8〜64文字・72バイトまでの文字だと確かめてある
            $this->loginSession->currentId($request),
        );
        // 番号の作り直しは、パスワードを変えて、ほかの端末の行を消したあと（今のパスワードが違うときは、作り直さない）
        $this->loginSession->renew($request);

        return response()->json(['message' => 'パスワードを変えました']);
    }
}
