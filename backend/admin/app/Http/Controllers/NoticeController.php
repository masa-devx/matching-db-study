<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A7 会員にお知らせを送る・会員を強制退会にする（レガシー版。#213。docs/api/m7-reports.md の「#213」）。
 * どちらも owner だけ（SuspensionController::store() からコピーした）。
 * - お知らせ：送られた値を確かめずに入れる（種類に何でも入る。題・本文がなければ NOT NULL の違反で 500）。
 *   退会した会員・強制退会の会員にも送れる（届いても、読めない）
 * - 強制退会：users.banned_at・banned_reason と、deleted_at を書く（退会した会員と同じく、ほかの会員から見えなくなる）。
 *   メールアドレスは書き換えない（同じメールアドレスで、登録し直せない）。会員が持っている JWT は、止めない。
 *   もう強制退会の会員にも、もう一度できる（日時と理由を上書きする）。戻す操作はない
 */
class NoticeController extends Controller
{
    public function store(Request $request, string $publicId): JsonResponse
    {
        // SuspensionController::store() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $admin = DB::table('admins')->where('id', $payload->sub)->first();
        if ($admin?->role !== 'owner') {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // 通報の案件から送るときは、その案件の public_id が来る。なければ null（ない ID でも、null で入る）
        $caseId = $request->filled('report_case_id')
            ? DB::table('report_cases')->where('public_id', $request->input('report_case_id'))->value('id')
            : null;

        DB::table('notices')->insert([
            'user_id' => $user->id,
            'kind' => $request->input('kind', 'info'),
            'title' => $request->input('title'),
            'body' => $request->input('body'),
            'sent_by' => $admin->id,
            'report_case_id' => $caseId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 監査ログ。本文は入れない（題と種類だけ）
        DB::table('admin_audit_logs')->insert([
            'admin_id' => $admin->id,
            'action' => 'member.notice',
            'target_type' => 'user',
            'target_id' => $user->public_id,
            'detail' => json_encode(['kind' => $request->input('kind', 'info'), 'title' => $request->input('title')], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);

        return response()->json(['message' => '送りました'], 201);
    }

    public function ban(Request $request, string $publicId): JsonResponse
    {
        // store() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $admin = DB::table('admins')->where('id', $payload->sub)->first();
        if ($admin?->role !== 'owner') {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // 3つの列を書く。deleted_at は、自分で退会した会員と同じ列（どちらで消えたかは、banned_at があるかで見分ける）
        DB::table('users')->where('id', $user->id)->update([
            'banned_at' => now(),
            'banned_reason' => $request->input('reason'),
            'deleted_at' => now(),
        ]);

        DB::table('admin_audit_logs')->insert([
            'admin_id' => $admin->id,
            'action' => 'member.ban',
            'target_type' => 'user',
            'target_id' => $user->public_id,
            'detail' => json_encode(['reason' => $request->input('reason')], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);

        return response()->json(['message' => '強制退会にしました']);
    }
}
