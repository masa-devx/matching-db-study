<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 監査ログの一覧（レガシー版）。要件では owner だけだが、役割の確かめを写し忘れている（viewer でも見られる）。
 * 新しい順に 50件ずつ・1件ごとに管理者の名前を読む（2＋N 本）。
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $page = (int) $request->input('page', 1);
        $total = DB::table('admin_audit_logs')->count();
        $rows = DB::table('admin_audit_logs')->orderBy('id', 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $log) {
            $log->admin = DB::table('admins')->where('id', $log->admin_id)->value('name');
            $data[] = $log;
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }
}
