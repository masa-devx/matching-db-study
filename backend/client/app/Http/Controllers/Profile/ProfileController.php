<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Services\Profile\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 相手のプロフィールを見る・プロフィールを書き換える（/api/users/{user_id}）。
 * 受け取る → ProfileService を呼ぶ → 返す、だけを書く。URL の {user_id} の中身は users.public_id（UUID）。
 */
final class ProfileController extends Controller
{
    public function __construct(private readonly ProfileService $profileService) {}

    public function show(Request $request, string $targetPublicId): JsonResponse
    {
        $result = $this->profileService->showProfile($targetPublicId, $this->loginUserId($request));

        // 分かっている不具合：返してよい項目を選ばず、列を全部返す（FR-002）。直すときに Resource を作って移す
        return response()->json([...$result['target']->toArray(), 'room_id' => $result['roomId']]);
    }

    public function update(Request $request, string $targetPublicId): JsonResponse
    {
        // 分かっている不具合：確かめていない入力を全部渡し（FR-010）、列を全部返す（validated() と Resource は直すときに）
        return response()->json($this->profileService->updateProfile($targetPublicId, $request->all()));
    }
}
