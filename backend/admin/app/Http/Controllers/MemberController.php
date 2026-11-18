<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 会員の一覧と詳細（レガシー版）。一覧は 50人ずつ・offset・毎回の件数・1人ごとに2本（2＋2N 本）。
 * users の行をそのまま返す（パスワードのハッシュや確認用の文字まで出る）。詳細を見ると監査ログに書く。
 */
class MemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $q = (string) $request->input('q', '');
        $status = (string) $request->input('status', 'all');
        $page = (int) $request->input('page', 1);

        $query = DB::table('users');
        if ($q !== '') {
            // メールアドレスかニックネームの部分一致（前にも % が付くので、索引は使えない）
            $query->where(function (Builder $w) use ($q) {
                $w->where('email', 'like', "%{$q}%")
                    ->orWhereIn('id', DB::table('profiles')->where('nickname', 'like', "%{$q}%")->select('user_id'));
            });
        }
        if ($status === 'paid') {
            $query->where('is_paid', true);
        } elseif ($status === 'suspended') {
            $query->whereNotNull('suspended_at');
        } elseif ($status === 'withdrawn') {
            $query->whereNotNull('deleted_at');
        } elseif ($status === 'banned') {
            $query->whereNotNull('banned_at');
        }

        // A1（#224）：有料の区分で絞る。区分の決め方（期限の中・あと7日・期限が過ぎた）を、ここと、下の行を作る所と、
        // ダッシュボードの3か所に書いた。is_paid は、期限が過ぎても true のまま（会員の側が、戻していない）なので、
        // 管理画面では、期限（paid_until）も見て分ける。どの列にもインデックスはない
        $plan = (string) $request->input('plan', '');
        if ($plan === 'free') {
            $query->where('is_paid', false);
        } elseif ($plan === 'paid') {
            $query->where('is_paid', true)->where('paid_until', '>=', now());
        } elseif ($plan === 'expiring') {
            $query->where('is_paid', true)->where('paid_until', '>=', now())->where('paid_until', '<', now()->addDays(7));
        } elseif ($plan === 'expired') {
            $query->where('is_paid', true)->where('paid_until', '<', now());
        }

        // A1（#218）：絞り込みを増やした。条件を1つ足すたびに、ここに if を1つ書き足した。
        // プロフィールの条件（性別・年齢・都道府県）は、条件ごとに、profiles を読む副問い合わせを1つずつ足す
        // （3つ選ぶと、profiles を3回読む。profiles.user_id にインデックスはない）
        if ($request->filled('gender')) {
            $query->whereIn('id', DB::table('profiles')->where('gender', $request->input('gender'))->select('user_id'));
        }
        if ($request->filled('prefecture')) {
            $query->whereIn('id', DB::table('profiles')->where('prefecture', $request->input('prefecture'))->select('user_id'));
        }
        if ($request->filled('age_min') || $request->filled('age_max')) {
            // 誕生日の列は文字（varchar）。先頭の4文字（年）を数に直し、今年から引いて年齢にする
            // （一覧の列と同じ、年の引き算。誕生日の前だと1歳多い）。日付の形でない文字（「abc」など）が
            // 入った行があるので、形を確かめてから数に直す（確かめないと、その1行のせいで、全体が 500 になる）。
            // 列を計算してから比べるので、誕生日にインデックスがあっても使えない。
            // 値は数に直してから SQL の文に入れる（数でない文字は 0 になる。範囲は確かめない）
            $min = (int) $request->input('age_min', 0);
            $max = (int) $request->input('age_max', 200);
            $query->whereIn('id', DB::table('profiles')
                ->whereRaw("extract(year from now()) - (case when birthday ~ '^[0-9]{4}-' then cast(substr(birthday, 1, 4) as integer) end) between {$min} and {$max}")
                ->select('user_id'));
        }
        // 登録日：日時の列を、文字に直してから比べる（これも、インデックスが使えない形。日付は UTC で切る）
        if ($request->filled('registered_from')) {
            $query->whereRaw("to_char(created_at, 'YYYY-MM-DD') >= ?", [$request->input('registered_from')]);
        }
        if ($request->filled('registered_to')) {
            $query->whereRaw("to_char(created_at, 'YYYY-MM-DD') <= ?", [$request->input('registered_to')]);
        }
        // 最終ログイン：7d・30d は、その日数の中にログインした会員。none は、30日より前か、一度もログインしていない会員
        if ($request->input('last_login') === '7d') {
            $query->where('last_login_at', '>=', now()->subDays(7));
        } elseif ($request->input('last_login') === '30d') {
            $query->where('last_login_at', '>=', now()->subDays(30));
        } elseif ($request->input('last_login') === 'none') {
            $query->where(function (Builder $w) {
                $w->whereNull('last_login_at')->orWhere('last_login_at', '<', now()->subDays(30));
            });
        }
        if ($request->boolean('unverified')) {
            $query->whereNull('email_verified_at');
        }
        if ($request->filled('id')) {
            // UUID の形でない文字が来ると、DB が型の誤りを返して 500
            $query->where('public_id', $request->input('id'));
        }

        $total = (clone $query)->count();
        // 並び：最終ログインの新しい順も選べる（一度もログインしていない会員が、いちばん上に来る。NULL が先になるため）
        $sort = $request->input('sort') === 'last_login' ? 'last_login_at' : 'created_at';
        $rows = $query->orderBy($sort, 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $user) {
            // 1人ごとに3本（N+1）。#218 で、性別と年齢のために、profiles をもう1回読むようにした
            $user->nickname = DB::table('profiles')->where('user_id', $user->id)->value('nickname');
            $profile = DB::table('profiles')->where('user_id', $user->id)->first();
            $user->gender = $profile?->gender;
            // 年齢の計算を、ここにも書く（年の引き算なので、誕生日の前だと1歳多い）
            $user->age = $profile?->birthday ? (int) date('Y') - (int) substr((string) $profile->birthday, 0, 4) : null;
            $user->purchases = DB::table('purchases')->where('user_id', $user->id)->count();
            // A1（#224）：有料の区分と、いちばん新しい購入のプランの名前。1人ごとに、もう2本（これで1人5本）
            $user->paid_state = ! $user->is_paid ? 'free'
                : ($user->paid_until === null || $user->paid_until < now()->toDateTimeString() ? 'expired'
                    : ($user->paid_until < now()->addDays(7)->toDateTimeString() ? 'expiring' : 'paid'));
            $planId = DB::table('purchases')->where('user_id', $user->id)->orderBy('created_at', 'desc')->value('plan_id');
            $user->plan = $planId ? DB::table('plans')->where('id', $planId)->value('name') : null;
            $data[] = $user;   // users の行をそのまま（password も入る）
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }

    public function show(Request $request, string $publicId): JsonResponse
    {
        // index() と同じ処理を写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        $purchases = [];
        foreach (DB::table('purchases')->where('user_id', $user->id)->orderBy('created_at', 'desc')->get() as $p) {
            $plan = DB::table('plans')->where('id', $p->plan_id)->first();   // 1件ごとに1本。値段は今のプラン
            $purchases[] = ['plan' => $plan?->name, 'price' => $plan?->price, 'bought_at' => $p->created_at];
        }

        // A1（#211）：停止の履歴。新しい順。1件ごとに、止めた管理者・解いた管理者の名前を読む（1＋2N 本）
        $suspensions = [];
        foreach (DB::table('suspensions')->where('user_id', $user->id)->orderBy('created_at', 'desc')->get() as $s) {
            $suspensions[] = [
                'reason' => $s->reason,
                'suspended_at' => $s->created_at,
                'suspended_by' => DB::table('admins')->where('id', $s->suspended_by)->value('name'),
                'lifted_at' => $s->lifted_at,
                'lifted_by' => $s->lifted_by ? DB::table('admins')->where('id', $s->lifted_by)->value('name') : null,
            ];
        }

        // A7（#213）：この会員に送ったお知らせ。新しい順。1件ごとに、送った管理者の名前を読む（1＋N 本）
        $notices = [];
        foreach (DB::table('notices')->where('user_id', $user->id)->orderBy('created_at', 'desc')->get() as $n) {
            $notices[] = [
                'id' => $n->public_id,
                'kind' => $n->kind,
                'title' => $n->title,
                'body' => $n->body,
                'sent_by' => DB::table('admins')->where('id', $n->sent_by)->value('name'),
                'read_at' => $n->read_at,
                'created_at' => $n->created_at,
            ];
        }

        // A1（#216）：対応のメモ。新しい順。1件ごとに、書いた管理者の名前を読む（1＋N 本）。全部を一度に返す
        $notes = [];
        foreach (DB::table('member_notes')->where('user_id', $user->id)->orderBy('created_at', 'desc')->get() as $note) {
            $notes[] = [
                'id' => $note->id,
                'body' => $note->body,
                'admin' => DB::table('admins')->where('id', $note->admin_id)->value('name'),
                'created_at' => $note->created_at,
            ];
        }

        $detail = [
            'user_id' => $user->public_id,
            'email' => $user->email,
            'created_at' => $user->created_at,
            'last_login_at' => $user->last_login_at,
            'email_verified_at' => $user->email_verified_at,
            'is_paid' => $user->is_paid,
            'paid_until' => $user->paid_until,
            'suspended_at' => $user->suspended_at,
            'suspended_reason' => $user->suspended_reason,
            'deleted_at' => $user->deleted_at,
            'profile' => DB::table('profiles')->where('user_id', $user->id)->first(),
            'likes_sent' => DB::table('likes')->where('from_user_id', $user->id)->count(),
            'likes_received' => DB::table('likes')->where('to_user_id', $user->id)->count(),
            'matches' => DB::table('user_matches')->where('user1_id', $user->id)->orWhere('user2_id', $user->id)->count(),
            'blocks_made' => DB::table('blocks')->where('blocker_id', $user->id)->count(),
            'blocks_received' => DB::table('blocks')->where('blocked_id', $user->id)->count(),
            'purchases' => $purchases,
            'suspensions' => $suspensions,
            'banned_at' => $user->banned_at,
            'banned_reason' => $user->banned_reason,
            'notices' => $notices,
            'notes' => $notes,
        ];

        // 監査ログ（ここでは書く）
        DB::table('admin_audit_logs')->insert([
            'admin_id' => $payload->sub,
            'action' => 'member.view',
            'target_type' => 'user',
            'target_id' => $user->public_id,
            'created_at' => now(),
        ]);

        return response()->json($detail);
    }
}
