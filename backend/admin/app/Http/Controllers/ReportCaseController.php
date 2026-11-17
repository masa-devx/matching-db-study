<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A7 通報の案件の一覧・中身・状態を変える（レガシー版。#203。docs/api/m7-reports.md）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - 一覧：案件ごとに、通報の件数・新しい通報の日時・会員・プロフィールを読む（2＋4N 本）。
 *   「通報した人数」には、件数と同じ数を入れる。並びは、案件を作った新しい順（新しい通報が来ても、上に来ない）
 * - 中身：通報を全部返す。通報ごとに、通報した会員・プロフィール・指したメッセージを読む（N+1）。
 *   指したメッセージが、通報された会員のものかを見ずに、中身を出す。読んだことは、監査ログに残さない
 * - 状態を変える：owner だけ（SuspensionController::store() からコピーした）。送られた値を確かめずに入れる
 *   （status に何でも入る。済みで、何をしたかがなくても通る。済みを、まだに戻せる）。同時に変えると、あとの人が上書きする
 */
class ReportCaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $page = (int) $request->input('page', 1);
        $query = DB::table('report_cases');
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $total = (clone $query)->count();
        $rows = $query->orderBy('created_at', 'desc')->offset(($page - 1) * 20)->limit(20)->get();

        $data = [];
        foreach ($rows as $case) {
            // 1件ごとに4本（N+1）
            $count = DB::table('reports')->where('report_case_id', $case->id)->count();
            $last = DB::table('reports')->where('report_case_id', $case->id)->max('created_at');
            $user = DB::table('users')->where('id', $case->reported_id)->first();
            $nickname = DB::table('profiles')->where('user_id', $case->reported_id)->value('nickname');
            $data[] = [
                'id' => $case->public_id,
                'status' => $case->status,
                'action' => $case->action,
                'member' => [
                    'id' => $user?->public_id,
                    'nickname' => $nickname,
                    // 会員の今の状態を、ここで決める（会員の一覧にある決め方を、もう一度書いた）
                    'state' => $user?->deleted_at ? 'withdrawn' : ($user?->suspended_at ? 'suspended' : 'active'),
                ],
                'report_count' => $count,
                // 人数を数えていない。件数と同じ数を入れる（同じ人が10回通報すると、10人に見える）
                'reporter_count' => $count,
                'last_reported_at' => $last,
                'created_at' => $case->created_at,
            ];
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }

    public function show(Request $request, string $publicId): JsonResponse
    {
        // index() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $case = DB::table('report_cases')->where('public_id', $publicId)->first();
        if (! $case) {
            return response()->json(['message' => '案件が見つかりません'], 404);
        }

        $user = DB::table('users')->where('id', $case->reported_id)->first();
        $nickname = DB::table('profiles')->where('user_id', $case->reported_id)->value('nickname');

        // 通報を全部読む（1000件でも一度に返す）
        $reports = [];
        foreach (DB::table('reports')->where('report_case_id', $case->id)->orderBy('created_at', 'desc')->get() as $r) {
            // 1件ごとに3本（N+1）
            $reporter = DB::table('users')->where('id', $r->reporter_id)->first();
            $reporterName = DB::table('profiles')->where('user_id', $r->reporter_id)->value('nickname');
            // 指したメッセージを、だれが送ったものかを見ずに出す（関係ない人のやり取りも出る）
            $message = $r->message_id ? DB::table('messages')->where('id', $r->message_id)->first() : null;
            $reports[] = [
                'id' => $r->id,
                'reporter' => ['id' => $reporter?->public_id, 'nickname' => $reporterName],
                'reason' => $r->reason,
                'detail' => $r->detail,
                'created_at' => $r->created_at,
                'message' => $message ? ['body' => $message->body, 'created_at' => $message->created_at] : null,
            ];
        }

        return response()->json([
            'id' => $case->public_id,
            'status' => $case->status,
            'action' => $case->action,
            'note' => $case->note,
            'handled_by' => $case->handled_by ? DB::table('admins')->where('id', $case->handled_by)->value('name') : null,
            'closed_at' => $case->closed_at,
            'created_at' => $case->created_at,
            'member' => [
                'id' => $user?->public_id,
                'nickname' => $nickname,
                'state' => $user?->deleted_at ? 'withdrawn' : ($user?->suspended_at ? 'suspended' : 'active'),
                // この会員の、これまでの案件の数（この案件も入る）
                'case_count' => DB::table('report_cases')->where('reported_id', $case->reported_id)->count(),
            ],
            'reports' => $reports,
        ]);
    }

    public function update(Request $request, string $publicId): JsonResponse
    {
        // SuspensionController::store() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        // 役割の確かめ
        $admin = DB::table('admins')->where('id', $payload->sub)->first();
        if ($admin?->role !== 'owner') {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $case = DB::table('report_cases')->where('public_id', $publicId)->first();
        if (! $case) {
            return response()->json(['message' => '案件が見つかりません'], 404);
        }

        // 送られた値を、確かめずに入れる。前の状態も見ない（済みを、まだに戻せる）
        $status = $request->input('status');
        DB::table('report_cases')->where('id', $case->id)->update([
            'status' => $status,
            'action' => $request->input('action'),
            'note' => $request->input('note'),
            'handled_by' => $admin->id,
            'closed_at' => $status === 'closed' ? now() : null,
            'updated_at' => now(),
        ]);

        DB::table('admin_audit_logs')->insert([
            'admin_id' => $admin->id,
            'action' => 'report_case.update',
            'target_type' => 'report_case',
            'target_id' => $case->public_id,
            'detail' => json_encode(['status' => $status, 'action' => $request->input('action')], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);

        return response()->json(['message' => '変えました']);
    }
}
