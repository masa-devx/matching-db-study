<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\VerifyMail;
use App\Models\Block;
use App\Models\Like;
use App\Models\Profile;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 01b 登録（レガシー版。docs/api/01b-auth.md）。
 * 入力を確かめない・トランザクションがない・応答に確認用の文字が出る。改善する段階で、要件 ID のテストにする。
 * 04 で、相手を探す index() を足した（docs/api/04-search.md）。OFFSET で20人ずつ・1＋N 本・条件は文字で比べる。
 * 06 で、退会の destroy() を足し（docs/api/06-blocks-withdrawal.md）、検索からブロックした・された相手と退会した会員を除いた。
 * 07 で、身長の条件を男性の無料の会員には使わせないようにした（送ったときだけ2本増える。docs/api/07-paid-members.md）。
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

        // 07：身長の条件は、男性の無料の会員は使えない（送ったときだけ確かめる。すぐ下で同じプロフィールをもう一度読む）
        if ($request->filled('height_min') || $request->filled('height_max')) {
            // 07：男性の無料の会員は使えない（is_paid だけを見る。paid_until は見ない。送る・いいね・検索に写した）
            $myProfile = Profile::where('user_id', $payload->sub)->first();
            $myUser = User::find($payload->sub);
            if ($myProfile?->gender === 'male' && ! $myUser->is_paid) {
                return response()->json(['message' => '有料会員になると使えます'], 403);
            }
        }

        // 性別を送らなければ、自分の反対の性別（male でなければ、みな male を探す）
        $me = Profile::where('user_id', $payload->sub)->first();
        $gender = $request->input('gender', $me?->gender === 'male' ? 'female' : 'male');

        // いいねした相手を全部 PHP に持ってきて、not in に並べる（いいねが増えるほど SQL が長くなる）
        $likedIds = Like::where('from_user_id', $payload->sub)->pluck('to_user_id');

        // 06：ブロックした・された相手を、向きごとに PHP に持ってくる（いいねを除くのと同じ形。ほかの一覧にも写す）
        $blocked = Block::where('blocker_id', $payload->sub)->pluck('blocked_id');     // UNIQUE の先頭なので索引が効く
        $blockedMe = Block::where('blocked_id', $payload->sub)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        $page = (int) $request->input('page', 1);

        $users = User::whereNotNull('email_verified_at')
            ->where('id', '!=', $payload->sub)
            ->whereNotIn('id', $likedIds)
            ->whereNotIn('id', $blockIds)
            // 06：退会した会員を除くのは、ここ（検索）だけ
            ->whereNull('deleted_at')
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

    public function destroy(Request $request): JsonResponse|Response
    {
        // AuthController::me() から写した（これで13か所目）。退会した人の JWT でも、ここまで来る
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $user = User::find($payload->sub);
        if (! Hash::check((string) $request->input('password'), $user->password)) {
            return response()->json(['message' => 'パスワードが違います'], 422);
        }

        // メールアドレスの UNIQUE とぶつからないよう、書き換えて空ける（元のメールアドレスは残らない）。
        // 元が 237文字以上だと 255文字を超えて 500。持っていた JWT は止めない（30日のあいだ使える）
        $user->update([
            'email' => $user->email.'#deleted#'.time(),
            'deleted_at' => now(),
        ]);

        return response()->noContent();
    }
}
