<?php

declare(strict_types=1);

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Services\Matching\LikeService;
use App\Services\Messaging\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 下のタブのバッジに出す数（GET /api/me/badge-counts。docs/api/05-messages.md）。
 * タブが、トークの一覧と届いたいいねの一覧を全部読まずに済むように、数だけを返す
 */
final class BadgeCountController extends Controller
{
    public function __construct(
        private readonly MessageService $messageService,
        private readonly LikeService $likeService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $userId = $this->loginUserId($request);

        return response()->json([
            'unread_messages' => $this->messageService->countUnreadMessages($userId),
            'new_matches' => $this->messageService->countNewMatches($userId),
            'received_likes' => $this->likeService->countReceived($userId),
        ]);
    }
}
