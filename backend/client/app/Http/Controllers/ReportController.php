<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Report;
use App\Models\ReportCase;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * M7 通報する（レガシー版。#202。docs/api/m7-reports.md）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む
 * - 相手がいるかだけを見る。自分でも通報できる
 * - 指したメッセージ（message_id）を確かめない。自分のいないルームのメッセージも、ない番号も入る
 * - 理由（reason）と自由な文（detail）を確かめない。理由がなければ NOT NULL の違反で 500
 * - 案件は「あるかを見てから作る」。ロックも UNIQUE もないので、同時に通報が来ると、同じ会員の案件が2つできる
 * - 通報を入れたあとに、ブロックを入れる。トランザクションがないので、ブロックが失敗しても通報は入ったまま
 * - 何回でも続けて通報できる
 */
class ReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);

        // 相手は public_id（UUID）で来る。自分かどうか・退会したかは見ない
        $reportedId = User::where('public_id', $request->input('user_id'))->value('id');
        if (! $reportedId) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // まだ済みでない案件を探し、なければ作る。探してから作るまでのあいだに、ほかの通報が入ると、案件が2つできる
        $case = ReportCase::where('reported_id', $reportedId)->where('status', '<>', 'closed')->first();
        if (! $case) {
            $case = ReportCase::create(['reported_id' => $reportedId, 'status' => 'open']);
        }

        // 送られた値を、そのまま入れる（message_id がだれのメッセージかを見ない。理由が6つのどれかも見ない）
        Report::create([
            'report_case_id' => $case->id,
            'reporter_id' => $loginUserId,
            'reported_id' => $reportedId,
            'message_id' => $request->input('message_id'),
            'reason' => $request->input('reason'),
            'detail' => $request->input('detail'),
        ]);

        // 「ブロックもする」が付いていたら、ブロックする。もうブロックしていると UNIQUE の違反で 500（通報は入ったまま）
        if ($request->boolean('block')) {
            Block::create(['blocker_id' => $loginUserId, 'blocked_id' => $reportedId]);
        }

        return response()->json(['message' => '通報しました'], 201);
    }
}
