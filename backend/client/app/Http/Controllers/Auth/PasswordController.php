<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\PasswordService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ログインした会員が、パスワードを変える（PUT /api/me/password。FR-AUTH-033）。
 * 今のパスワードの確かめと保存は PasswordService
 */
final class PasswordController extends Controller
{
    public function __construct(private readonly PasswordService $passwordService) {}

    public function update(Request $request): JsonResponse
    {
        // 分かっている不具合：新しいパスワードの形を確かめていない（FR-AUTH-033・FR-AUTH-004）。送らなければ null のまま渡し、500 になる
        $this->passwordService->changePassword(
            $this->loginUserId($request),
            $request->string('current_password')->toString(),
            $request->filled('password') ? $request->string('password')->toString() : null,
        );

        return response()->json(['message' => 'パスワードを変えました']);
    }
}
