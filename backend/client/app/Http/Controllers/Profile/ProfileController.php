<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Services\Profile\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 相手のプロフィールを見る・プロフィールを書き換える（/api/users/{publicId}）。
 * 受け取る → ProfileService を呼ぶ → 返す、だけを書く。
 */
final class ProfileController extends Controller
{
    public function __construct(private readonly ProfileService $profiles) {}

    public function show(Request $request, string $publicId): JsonResponse
    {
        $viewerId = $request->attributes->get('member_id');   // IdentifyMember が載せる。トークンがなければ null
        $result = $this->profiles->showFor($publicId, is_int($viewerId) ? $viewerId : null);

        // 分かっている不具合：返してよい項目を選ばず、列を全部返す（FR-002）。直すときに Resource を作って移す
        return response()->json([...$result['member']->toArray(), 'room_id' => $result['roomId']]);
    }

    public function update(Request $request, string $publicId): JsonResponse
    {
        // 分かっている不具合：確かめていない入力を全部渡し（FR-010）、列を全部返す（validated() と Resource は直すときに）
        return response()->json($this->profiles->update($publicId, $request->all()));
    }
}
