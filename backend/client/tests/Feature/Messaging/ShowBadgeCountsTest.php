<?php

declare(strict_types=1);

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyMessage;
use Tests\DummyData\DummyUser;
use Tests\DummyData\TestUser;
use Tests\Endpoints;

use function Pest\Laravel\getJson;
use function Pest\Laravel\travelTo;

// GET /api/me/badge-counts：下のタブのバッジの数（未読・新しいマッチ・届いたいいね。docs/api/05-messages.md）。
// 数は、今のトークの一覧と届いたいいねの一覧から、画面（TabBar）が数えていたものと同じにする

// テストで使う値（DB の行は、それぞれのテストの中で作る）
$noCounts = ['unread_messages' => 0, 'new_matches' => 0, 'received_likes' => 0];

/**
 * 今の一覧の API（トークの一覧・届いたいいねの一覧）を読み、前の画面（TabBar）と同じ数え方で数える。
 * 未読は unread_count の合計、新しいマッチは最新の1件がなく一度も開いていないルーム、届いたいいねは一覧の件数
 *
 * @return array{unread_messages: int, new_matches: int, received_likes: int}
 */
function badgeCountsFromLists(TestUser $user): array
{
    $rooms = DummyAuth::actingAs($user)->getJson(Endpoints::talkRooms())->assertOk()->json();
    $likes = DummyAuth::actingAs($user)->getJson(Endpoints::receivedLikes())->assertOk()->json();

    return [
        'unread_messages' => array_sum(array_column($rooms, 'unread_count')),
        'new_matches' => count(array_filter($rooms, fn (array $room): bool => $room['last_message'] === null && $room['last_read_at'] === null)),
        'received_likes' => count($likes),
    ];
}

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、マッチも届いたいいねもないときに、タブの数を読む', function () use ($noCounts): void {
    it('数はどれも 0 で、今の一覧で数えたものと同じ（FR-UI-032）', function () use ($noCounts): void {
        $loginUser = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($noCounts);
        expect(badgeCountsFromLists($loginUser))->toBe($noCounts);
    });
});

describe('ログインした会員に、相手からメッセージが届いているときに、タブの数を読む', function () use ($noCounts): void {
    it('相手から届いて、まだ読んでいないメッセージを合計する。自分が送ったものと、開いたときより前のものは数えない（FR-UI-032・FR-MSG-009）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $readPartner = DummyUser::create();
        $unopenedPartner = DummyUser::create();
        travelTo(Carbon::parse('2026-11-22 10:00:00'));
        $readRoom = DummyMatching::match($loginUser, $readPartner);
        DummyMessage::send($readRoom, $readPartner);
        DummyMessage::send($readRoom, $readPartner);
        DummyMessage::send($readRoom, $loginUser);
        $unopenedRoom = DummyMatching::match($unopenedPartner, $loginUser);
        DummyMessage::send($unopenedRoom, $unopenedPartner);
        DummyMessage::send($unopenedRoom, $unopenedPartner);
        travelTo(Carbon::parse('2026-11-22 10:05:00'));
        DummyMessage::read($readRoom, $loginUser);
        travelTo(Carbon::parse('2026-11-22 10:10:00'));
        DummyMessage::send($readRoom, $readPartner);
        DummyMessage::send($readRoom, $loginUser);

        // 開いたあとに相手から届いた1通と、まだ開いていないルームの2通
        $expected = ['unread_messages' => 3, 'new_matches' => 0, 'received_likes' => 0];
        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($expected);
        expect(badgeCountsFromLists($loginUser))->toBe($expected);
    });

    it('全部を開いたあとなら、未読は 0 で、今の一覧で数えたものと同じ（FR-MSG-010）', function () use ($noCounts): void {
        $loginUser = DummyUser::create(gender: 'male');
        $partner = DummyUser::create();
        travelTo(Carbon::parse('2026-11-22 10:00:00'));
        $room = DummyMatching::match($loginUser, $partner);
        DummyMessage::send($room, $partner);
        travelTo(Carbon::parse('2026-11-22 10:05:00'));
        DummyMessage::read($room, $loginUser);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($noCounts);
        expect(badgeCountsFromLists($loginUser))->toBe($noCounts);
    });

    it('ほかの会員どうしのメッセージは、数えない（FR-MSG-009）', function () use ($noCounts): void {
        $loginUser = DummyUser::create(gender: 'male');
        $other = DummyUser::create(gender: 'male');
        $otherPartner = DummyUser::create();
        $otherRoom = DummyMatching::match($other, $otherPartner);
        DummyMessage::send($otherRoom, $otherPartner);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($noCounts);
    });
});

describe('ログインした会員に、マッチしたばかりの相手がいるときに、タブの数を読む', function (): void {
    it('まだ一度も開いていなくて、まだ1通もないルームだけを、新しいマッチとして数える（FR-UI-073）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $newPartner = DummyUser::create();
        $openedPartner = DummyUser::create();
        $talkingPartner = DummyUser::create();
        DummyMatching::match($newPartner, $loginUser);
        $openedRoom = DummyMatching::match($openedPartner, $loginUser);
        DummyMessage::read($openedRoom, $loginUser);
        $talkingRoom = DummyMatching::match($loginUser, $talkingPartner);
        DummyMessage::send($talkingRoom, $loginUser);

        // 開いたルームと、自分が先に送ったルームは、新しいマッチに入れない
        $expected = ['unread_messages' => 0, 'new_matches' => 1, 'received_likes' => 0];
        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($expected);
        expect(badgeCountsFromLists($loginUser))->toBe($expected);
    });
});

describe('ログインした会員に、いいねが届いているときに、タブの数を読む', function (): void {
    it('まだ返事をしていない届いたいいねを数え、送り返した相手・スキップした相手と、ほかの会員あてのいいねは数えない（FR-UI-064・FR-LIKE-010・FR-LIKE-012）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $waiting = DummyUser::create();
        $likedBack = DummyUser::create();
        $skipped = DummyUser::create();
        $other = DummyUser::create(gender: 'male');
        DummyMatching::like($waiting, $loginUser);
        DummyMatching::like($likedBack, $loginUser);
        DummyMatching::like($loginUser, $likedBack);
        DummyMatching::like($skipped, $loginUser);
        DummyMatching::skip($loginUser, $skipped);
        DummyMatching::like($waiting, $other);

        $expected = ['unread_messages' => 0, 'new_matches' => 0, 'received_likes' => 1];
        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($expected);
        expect(badgeCountsFromLists($loginUser))->toBe($expected);
    });
});

describe('ログインした会員に、ブロックした相手とブロックされた相手がいるときに、タブの数を読む', function (): void {
    it('ブロックした相手とブロックされた相手のメッセージ・マッチ・いいねは、どの数にも入れず、今の一覧で数えたものと同じ（FR-BLOCK-007・FR-BLOCK-009）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $blockedByMe = DummyUser::create();
        $blockedMe = DummyUser::create();
        $blockedNewMatch = DummyUser::create();
        $usual = DummyUser::create();
        foreach ([$blockedByMe, $blockedMe] as $partner) {
            $room = DummyMatching::match($loginUser, $partner);
            DummyMessage::send($room, $partner);
        }
        DummyMatching::match($blockedNewMatch, $loginUser);   // まだ1通もないルーム。新しいマッチにも入れない
        $usualRoom = DummyMatching::match($loginUser, $usual);
        DummyMessage::send($usualRoom, $usual);
        $likers = [DummyUser::create(), DummyUser::create()];
        foreach ($likers as $liker) {
            DummyMatching::like($liker, $loginUser);
        }
        DummyMatching::block($loginUser, $blockedByMe);
        DummyMatching::block($blockedMe, $loginUser);
        DummyMatching::block($loginUser, $blockedNewMatch);
        DummyMatching::block($loginUser, $likers[0]);
        DummyMatching::block($likers[1], $loginUser);

        $expected = ['unread_messages' => 1, 'new_matches' => 0, 'received_likes' => 0];
        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($expected);
        expect(badgeCountsFromLists($loginUser))->toBe($expected);
    });
});

describe('ログインした会員に、退会・アカウント停止・強制退会した相手がいるときに、タブの数を読む', function () use ($noCounts): void {
    it('その相手のメッセージ・マッチ・いいねは、どの数にも入れず、今の一覧で数えたものと同じ（FR-WD-006・FR-WD-014）', function (array $status) use ($noCounts): void {
        $loginUser = DummyUser::create(gender: 'male');
        $talked = DummyUser::create(...$status);
        $matched = DummyUser::create(...$status);
        $liker = DummyUser::create(...$status);
        $room = DummyMatching::match($loginUser, $talked);
        DummyMessage::send($room, $talked);
        DummyMatching::match($matched, $loginUser);
        DummyMatching::like($liker, $loginUser);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($noCounts);
        expect(badgeCountsFromLists($loginUser))->toBe($noCounts);
    })->with([
        '退会した相手' => [['withdrawn' => true]],
        'アカウント停止された相手' => [['suspended' => true]],
        '強制退会になった相手' => [['banned' => true]],
    ]);

    it('アカウント停止が解けた相手は、また数え、今の一覧で数えたものと同じ（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $partner = DummyUser::create(suspended: true);
        $liker = DummyUser::create(suspended: true);
        $room = DummyMatching::match($loginUser, $partner);
        DummyMessage::send($room, $partner);
        DummyMatching::like($liker, $loginUser);
        DummyUser::liftSuspension($partner);
        DummyUser::liftSuspension($liker);

        $expected = ['unread_messages' => 1, 'new_matches' => 0, 'received_likes' => 1];
        DummyAuth::actingAs($loginUser)->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson($expected);
        expect(badgeCountsFromLists($loginUser))->toBe($expected);
    });
});

describe('ログインした会員が、相手が多いときに、タブの数を読む', function (): void {
    // 内訳：会員の状態と、メールアドレスを確認したか（Middleware が2本）・未読・新しいマッチ・届いたいいね（1本ずつ）。
    // 本番は、ほかにセッションの select と update が流れる（テストのセッションの置き場は array なので流れない）
    it('タブの数を読むときの SQL は、相手の数が増えても決まった本数で済む（5本。NFR-MSG-004）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        foreach (range(1, 5) as $i) {
            $partner = DummyUser::create();
            $room = DummyMatching::match($loginUser, $partner);
            DummyMessage::send($room, $partner);
            DummyMatching::like(DummyUser::create(), $loginUser);
        }
        $request = DummyAuth::actingAs($loginUser);   // ダミーが会員の Model を読むので、数え始める前に作る
        DB::enableQueryLog();

        $request->getJson(Endpoints::badgeCounts())
            ->assertOk()
            ->assertExactJson(['unread_messages' => 5, 'new_matches' => 0, 'received_likes' => 5]);

        expect(DB::getQueryLog())->toHaveCount(5);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、タブの数を読む', function (): void {
    it('読めず、DB も読まない（401「ログインしてください」。FR-MSG-012）', function (): void {
        DB::enableQueryLog();

        getJson(Endpoints::badgeCounts())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);

        expect(DB::getQueryLog())->toHaveCount(0);
    });
});

describe('使えなくなった会員が、ログインしたまま、タブの数を読む', function (): void {
    it('アカウント停止された会員は、読めず、停止されていると知らされる（401「このアカウントは停止されています」。NFR-AUTH-001）', function (): void {
        DummyAuth::actingAs(DummyUser::create(suspended: true))->getJson(Endpoints::badgeCounts())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'このアカウントは停止されています', 'code' => 'account_suspended']);
    });

    it('退会した会員は、読めない（401「ログインしてください」。NFR-AUTH-001）', function (): void {
        DummyAuth::actingAs(DummyUser::create(withdrawn: true))->getJson(Endpoints::badgeCounts())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});

describe('メールアドレスを確認していない会員が、タブの数を読む', function (): void {
    it('読めない（403「この機能は使えません」・code が email_unverified。FR-MSG-013・FR-AUTH-021）', function (): void {
        DummyAuth::actingAs(DummyUser::create(unverified: true))->getJson(Endpoints::badgeCounts())
            ->assertForbidden()
            ->assertExactJson(['message' => 'この機能は使えません', 'code' => 'email_unverified']);
    });
});
