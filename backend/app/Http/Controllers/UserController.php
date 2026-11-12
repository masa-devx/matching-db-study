<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\VerifyMail;
use App\Models\Like;
use App\Models\Profile;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 01b 登録（レガシー版。docs/api/01b-auth.md）。
 * 入力を確かめない・トランザクションがない・応答に確認用の文字が出る。改善する段階で、要件 ID のテストにする。
 * 04 で、相手を探す index() を足した（docs/api/04-search.md）。OFFSET で20人ずつ・1＋N 本・条件は文字で比べる。
 */
class UserController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // password は User の casts の 'hashed' で bcrypt になる
        $user = User::create($request->only(['email', 'password']) + [
            'verification_token' => Str::random(40),   // 平文・期限なし
        ]);

        Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);

        // ここで失敗しても、会員とプロフィールは残る（トランザクションがない）
        Mail::to($user->email)->send(new VerifyMail($user));

        return response()->json($user, 201);
    }

    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）。これで5か所目
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 性別を送らなければ、自分の反対の性別（male でなければ、みな male を探す）
        $me = Profile::where('user_id', $payload->sub)->first();
        $gender = $request->input('gender', $me?->gender === 'male' ? 'female' : 'male');

        // いいねした相手を全部 PHP に持ってきて、not in に並べる（いいねが増えるほど SQL が長くなる）
        $likedIds = Like::where('from_user_id', $payload->sub)->pluck('to_user_id');

        $page = (int) $request->input('page', 1);

        $users = User::whereNotNull('email_verified_at')
            ->where('id', '!=', $payload->sub)
            ->whereNotIn('id', $likedIds)
            // 条件は profiles にあるので exists（相関サブクエリ）で絞る。送られた条件だけを足し、値は確かめない
            ->whereHas('profile', function (Builder $q) use ($request, $gender) {
                $q->where('gender', $gender);
                // 年齢の幅を、生年月日の幅に直す。生年月日は文字の列なので、文字で比べる
                if ($request->filled('age_min')) {
                    $q->where('birthday', '<=', now()->subYears((int) $request->input('age_min'))->format('Y-m-d'));
                }
                if ($request->filled('age_max')) {
                    $q->where('birthday', '>', now()->subYears((int) $request->input('age_max') + 1)->format('Y-m-d'));
                }
                if ($request->filled('prefecture')) {
                    $q->whereIn('prefecture', $request->input('prefecture'));   // 配列でなければ 500
                }
                // 身長も文字の列なので、'99' >= '170' が真になる
                if ($request->filled('height_min')) {
                    $q->where('height', '>=', $request->input('height_min'));
                }
                if ($request->filled('height_max')) {
                    $q->where('height', '<=', $request->input('height_max'));
                }
            })
            // 最終ログインだけで並べる。同じ時刻の並びが決まらない。desc なので NULL（ログインしていない）が先頭に出る
            ->orderBy('last_login_at', 'desc')
            // 飛ばす行も読んでから捨てる。読んでいるあいだにだれかがログインすると、重なる・抜ける
            ->offset(($page - 1) * 20)
            ->limit(20)
            ->get();

        foreach ($users as $user) {
            $user->load('profile');   // 1人ずつプロフィールを読む（1＋N）
        }

        // users の行をそのまま返す（メールアドレス・確認用の文字・生年月日も出る）
        return response()->json($users);
    }
}
