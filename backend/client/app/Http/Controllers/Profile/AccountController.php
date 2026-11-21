<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\Controller;
use App\Services\Profile\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** 自分のアカウントを見る（GET /api/me。FR-AUTH-017。名前は docs/glossary.md の「アカウント」） */
final class AccountController extends Controller
{
    public function __construct(private readonly ProfileService $profileService) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profileService->showAccount($this->loginUserId($request)));
    }
}
