# PR レビューの扱い

指摘そのものは PR のコメント。ここには、扱いのまとめだけを書く。

| PR | 印 | 指摘（短く） | 扱い（直した・チケット #・直さない理由） |
| --- | --- | --- | --- |
| #100 | must | M1 アーキテクチャのテストが2章を守れていない | 直した（8章を書き直し。Carbon・ヘルパー関数・`App\Models`・`App\Support`・Http → Infrastructure・名前・strict_types・`Arch` の組・管理画面に Pest） |
| #100 | must | M2 API テストが中の作りに頼る | 直した（10章：表の名前で確かめる・`tests/Support/` の作る関数・Model を移すだけのコミット） |
| #100 | must | M3 時計の見本が10章とぶつかる | 直した（`SystemClock` を `CarbonImmutable::now('UTC')`。API テストは `travelTo`） |
| #100 | should | S1 見本は書き方の見本 | 直した（4章の頭に注記） |
| #100 | should | S2 読み取りの DTO の置き場 | 直した（`QueryServices/<まとまり>/` に置き、Http から使ってよい。`toCriteria()`） |
| #100 | should | S3 Model を `Infrastructure/Models` に置く決定のまわり | 直した（`database.md` の paths・Factory の見つけ方・補完のコマンドは移すチケットで） |
| #100 | should | S4 `App\Support` を使ってよい層 | 直した（Http と Infrastructure だけ） |
| #100 | should | S5 UseCase の if | 直した（決まりを「結果で手順を分ける if だけ」に） |
| #100 | should | S6 interface の一覧の食い違い | 直した（Repository・外・トランザクション・日時。ほかは足してから作る） |
| #100 | should | S7 03-how の古い表 | 直した（取り消した案と注記） |
| #100 | should | S8 管理画面のまとまりの一覧・ログイン | 直した（一覧は backend.md だけ。`LoginAdminUseCase`・`AdminQueryService`） |
| #100 | should | S9 02-what の範囲・移行の地図 | 直した（arch テストを範囲と条件に。地図に Model・Mail・Support・管理画面のファイルごと） |
| #100 | should | S10 testing.md | 直した（種類の表・置き場・固めるテストの例外・偽物の作り方） |
| #100 | should | S11 業務の例外のログ | 直した（`dontReport`） |
| #100 | ask | A1 いいねの上限は定数か | 定数（要件で決まった値で、運営が変える値ではない） |
| #100 | ask | A2 見たことの記録の道 | (a) `RecordAuditLogUseCase` で書く |
| #100 | nits | N1〜N6 | 直した（`MemberSearchQueryService`・`reconstruct()`／`create()`・`BindingServiceProvider`・100行・基底の Controller は移さない・「守っている」の数え方） |
| #100 | must | 3回目 M1 `LEGACY` の `App\Models` で Http の禁止が効かない | 直した（`LEGACY_CONTROLLERS` と `LEGACY_MODELS` に分け、ignoring には古いコントローラーだけ） |
| #100 | should | 3回目 S1〜S6（QueryService と Domain・管理画面の役割の例外・03-how の記録・管理画面のテストの今・壊す単位・「守っている」は下限） | 直した |
| #100 | nits | 3回目 N1〜N7（集約のないまとまり・strict_types の対象・arch() を1つ1期待・書き分け・固めるテストの手順・admin-app・AGENTS.md の地図） | 直した |
| #100 | ― | 技術の指摘（ロック・日付の区切り・`is_paid` など9件） | 今回は外した。人が「作る」と言ったらチケットにする |
