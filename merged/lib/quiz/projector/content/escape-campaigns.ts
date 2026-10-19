/** Three authored escape campaigns (four rooms each). Every room is a small puzzle GRAPH, never a random key hunt:
 *  two question puzzles → a lock (needs both clues) → a door; an extended puzzle adds a second requirement; a bonus puzzle is optional.
 *  Text is deliberately functional and subject-neutral: the quiz supplies the curriculum, the room supplies the mechanism. */
import type { CampaignId, L10n } from '../types';

export type HotKind = 'puzzle' | 'lock' | 'door';
export type Hotspot = {
  id: string; slot: 'A' | 'B' | 'L' | 'D' | 'P' | 'X'; kind: HotKind; tier: 1 | 2 | 3; label: L10n; desc: L10n;
  x: number; y: number; w: number; h: number; question: boolean; diff: 1 | 2 | 3;
  needs: string[]; needsAt?: Partial<Record<2 | 3, string[]>>; grants: string | null; consumes: string[];
};
export type Item = { id: string; label: L10n; room: number };
export type EscapeRoom = { id: string; name: L10n; desc: L10n; hotspots: Hotspot[] };
export type Campaign = { id: CampaignId; name: L10n; blurb: L10n; rooms: EscapeRoom[]; items: Record<string, Item> };

/** Four hand-placed layouts (scene space 1000×600) so rooms do not look alike. Rects: x,y,w,h per slot A B L D P X. */
const LAYOUTS: Record<string, [number, number, number, number][]> = {
  a: [[90, 300, 190, 190], [330, 360, 200, 150], [560, 250, 170, 210], [790, 190, 160, 300], [350, 120, 180, 130], [640, 500, 150, 70]],
  b: [[110, 190, 180, 200], [310, 410, 210, 140], [600, 150, 170, 220], [800, 220, 150, 290], [60, 450, 190, 110], [460, 50, 120, 90]],
  c: [[140, 330, 170, 200], [370, 150, 200, 160], [620, 330, 180, 200], [820, 160, 140, 320], [60, 120, 200, 130], [420, 480, 190, 80]],
  d: [[80, 160, 200, 170], [340, 330, 190, 190], [570, 130, 190, 200], [790, 260, 160, 280], [600, 440, 160, 110], [300, 90, 160, 90]],
};
type Prop = [string, string, string, string, string]; // label en, vi, give en, give vi (slot-specific meaning below)

function mk(cid: string, ri: number, layout: keyof typeof LAYOUTS, name: L10n, desc: L10n, p: { A: Prop; B: Prop; L: Prop; D: Prop; P: Prop; X: Prop }): { room: EscapeRoom; items: Item[] } {
  const L = LAYOUTS[layout]!; const id = (s: string) => `${cid}${ri}_${s}`;
  const slot = (s: 'A' | 'B' | 'L' | 'D' | 'P' | 'X', i: number, kind: HotKind, tier: 1 | 2 | 3, question: boolean, diff: 1 | 2 | 3, extra: Partial<Hotspot>): Hotspot => {
    const pr = p[s]; const r = L[i]!;
    return { id: id(s), slot: s, kind, tier, label: { en: pr[0], vi: pr[1] }, desc: { en: pr[2], vi: pr[3] }, x: r[0], y: r[1], w: r[2], h: r[3], question, diff, needs: [], grants: null, consumes: [], ...extra };
  };
  const items: Item[] = [];
  const item = (s: string, en: string, vi: string) => { items.push({ id: id(s), label: { en, vi }, room: ri }); return id(s); };
  const a = item('a', p.A[4].split('|')[0]!, p.A[4].split('|')[1]!), b = item('b', p.B[4].split('|')[0]!, p.B[4].split('|')[1]!);
  const key = item('key', p.L[4].split('|')[0]!, p.L[4].split('|')[1]!), d = item('d', p.P[4].split('|')[0]!, p.P[4].split('|')[1]!), seal = item('seal', p.X[4].split('|')[0]!, p.X[4].split('|')[1]!);
  const hotspots: Hotspot[] = [
    slot('A', 0, 'puzzle', 1, true, 1, { grants: a }), slot('B', 1, 'puzzle', 1, true, 2, { grants: b }),
    slot('L', 2, 'lock', 1, false, 1, { needs: [a, b], consumes: [a, b], grants: key }),
    slot('D', 3, 'door', 1, false, 1, { needs: [key], needsAt: { 2: [d] } }),
    slot('P', 4, 'puzzle', 2, true, 2, { grants: d }), slot('X', 5, 'puzzle', 3, true, 3, { grants: seal }),
  ];
  return { room: { id: id('room'), name, desc, hotspots }, items };
}
// prop tuple: [label en, label vi, description en, description vi, "item en|item vi"]
function campaign(id: CampaignId, name: L10n, blurb: L10n, rooms: ReturnType<typeof mk>[]): Campaign {
  const items: Record<string, Item> = {}; rooms.forEach((r) => r.items.forEach((i) => { items[i.id] = i; }));
  return { id, name, blurb, rooms: rooms.map((r) => r.room), items };
}

export const CLOCKHOUSE = campaign('clockhouse', { en: 'Clockhouse', vi: 'Nhà đồng hồ' }, { en: 'Brass gears, pendulums and a stopped tower clock.', vi: 'Bánh răng đồng, quả lắc và tháp đồng hồ ngừng chạy.' }, [
  mk('clk', 1, 'a', { en: 'Hour Hall', vi: 'Sảnh giờ' }, { en: 'A tall hall with a stopped hour wheel.', vi: 'Sảnh cao với bánh xe giờ đã ngừng.' }, {
    A: ['Hour wheel', 'Bánh xe giờ', 'A wheel of twelve etched marks.', 'Bánh xe mười hai vạch khắc.', 'Etched gear mark|Dấu bánh răng khắc'],
    B: ['Ledger desk', 'Bàn sổ cái', 'A ledger with a table of entries.', 'Sổ cái với bảng ghi chép.', 'Ratio card|Thẻ tỉ lệ'],
    L: ['Dial cabinet', 'Tủ mặt số', 'A cabinet with two empty slots.', 'Tủ có hai khe trống.', 'Brass dial key|Chìa mặt số đồng'],
    D: ['Pendulum door', 'Cửa quả lắc', 'A door held by a swinging bar.', 'Cánh cửa giữ bằng thanh lắc.', '-|-'],
    P: ['Weight chain', 'Dây quả nặng', 'A chain with a missing weight.', 'Dây xích thiếu quả nặng.', 'Counterweight tag|Thẻ đối trọng'],
    X: ['Music box', 'Hộp nhạc', 'A small box that hums when wound.', 'Hộp nhỏ ngân khi lên dây.', 'Hall seal|Dấu sảnh'],
  }),
  mk('clk', 2, 'b', { en: 'Pendulum Gallery', vi: 'Hành lang quả lắc' }, { en: 'Long pendulums sweep across the floor.', vi: 'Những quả lắc dài quét qua sàn.' }, {
    A: ['Swing arc chart', 'Biểu đồ cung lắc', 'A chart of swing arcs on the wall.', 'Biểu đồ các cung lắc trên tường.', 'Arc stamp|Dấu cung lắc'],
    B: ['Counter board', 'Bảng đếm', 'A board that counts each swing.', 'Bảng đếm từng lần lắc.', 'Count token|Thẻ đếm'],
    L: ['Escapement lock', 'Khóa cơ cấu thoát', 'A lock that needs a stamp and a token.', 'Ổ khóa cần một dấu và một thẻ.', 'Escapement key|Chìa cơ cấu thoát'],
    D: ['Gallery door', 'Cửa hành lang', 'A door with a ticking bolt.', 'Cửa có chốt kêu tích tắc.', '-|-'],
    P: ['Bob stand', 'Giá quả nặng', 'A stand holding spare bobs.', 'Giá đỡ các quả nặng dự phòng.', 'Bob tag|Thẻ quả nặng'],
    X: ['Brass bell', 'Chuông đồng', 'A bell on a short cord.', 'Chuông treo dây ngắn.', 'Gallery seal|Dấu hành lang'],
  }),
  mk('clk', 3, 'c', { en: 'Spring Workshop', vi: 'Xưởng lò xo' }, { en: 'Benches of coiled springs and tools.', vi: 'Bàn đầy lò xo cuộn và dụng cụ.' }, {
    A: ['Spring rack', 'Giá lò xo', 'Springs sorted by length.', 'Lò xo xếp theo độ dài.', 'Spring gauge|Thước lò xo'],
    B: ['Parts table', 'Bàn linh kiện', 'A table of parts and counts.', 'Bàn linh kiện kèm số lượng.', 'Parts list|Danh sách linh kiện'],
    L: ['Tool chest', 'Rương dụng cụ', 'A chest with a two-part latch.', 'Rương có chốt hai phần.', 'Workshop key|Chìa xưởng'],
    D: ['Bench door', 'Cửa xưởng', 'A door behind the long bench.', 'Cửa sau chiếc bàn dài.', '-|-'],
    P: ['Winding crank', 'Tay quay lên dây', 'A crank with a notched wheel.', 'Tay quay với bánh khía.', 'Crank tag|Thẻ tay quay'],
    X: ['Oil lamp', 'Đèn dầu', 'A lamp that flickers on and off.', 'Đèn dầu chập chờn.', 'Workshop seal|Dấu xưởng'],
  }),
  mk('clk', 4, 'd', { en: 'Tower Belfry', vi: 'Gác chuông tháp' }, { en: 'The great clock face and the last door.', vi: 'Mặt đồng hồ lớn và cánh cửa cuối.' }, {
    A: ['Great hands', 'Kim lớn', 'Two hands stuck at different times.', 'Hai kim kẹt ở hai thời điểm.', 'Hand pin|Chốt kim'],
    B: ['Bell ropes', 'Dây chuông', 'Ropes labelled with numbers.', 'Dây thừng đánh số.', 'Rope tally|Phiếu dây'],
    L: ['Face latch', 'Chốt mặt đồng hồ', 'A latch behind the clock face.', 'Chốt sau mặt đồng hồ.', 'Belfry key|Chìa gác chuông'],
    D: ['Belfry exit', 'Lối ra gác chuông', 'The final door to the street.', 'Cánh cửa cuối ra phố.', '-|-'],
    P: ['Pulley frame', 'Khung ròng rọc', 'A frame with a missing pulley.', 'Khung thiếu ròng rọc.', 'Pulley tag|Thẻ ròng rọc'],
    X: ['Weather vane', 'Chong chóng gió', 'A vane that turns in the draft.', 'Chong chóng quay trong gió lùa.', 'Belfry seal|Dấu gác chuông'],
  }),
]);

export const CELESTIAL = campaign('celestial_archive', { en: 'Celestial Archive', vi: 'Kho lưu trữ thiên văn' }, { en: 'Shelves of star charts under a glass dome.', vi: 'Kệ bản đồ sao dưới mái vòm kính.' }, [
  mk('cel', 1, 'c', { en: 'Reading Rotunda', vi: 'Phòng đọc tròn' }, { en: 'A round room of shelves and ladders.', vi: 'Căn phòng tròn đầy kệ và thang.' }, {
    A: ['Card catalogue', 'Tủ thẻ mục lục', 'Drawers of index cards.', 'Ngăn kéo đầy thẻ mục lục.', 'Index card|Thẻ mục lục'],
    B: ['Reading lamp table', 'Bàn đèn đọc', 'A table with an open chart.', 'Bàn với tấm biểu đồ mở.', 'Chart page|Trang biểu đồ'],
    L: ['Shelf lock', 'Khóa kệ', 'A shelf locked with two sockets.', 'Kệ khóa với hai ổ cắm.', 'Rotunda key|Chìa phòng đọc'],
    D: ['Archive door', 'Cửa kho', 'A door set in the shelving.', 'Cửa gắn trong kệ sách.', '-|-'],
    P: ['Ladder rail', 'Ray thang', 'A rail with a stuck ladder.', 'Ray thang bị kẹt.', 'Ladder tag|Thẻ thang'],
    X: ['Globe stand', 'Giá quả địa cầu', 'A globe that spins freely.', 'Quả địa cầu quay tự do.', 'Rotunda seal|Dấu phòng đọc'],
  }),
  mk('cel', 2, 'a', { en: 'Star Chart Vault', vi: 'Hầm bản đồ sao' }, { en: 'Flat drawers of large star charts.', vi: 'Các ngăn phẳng chứa bản đồ sao lớn.' }, {
    A: ['Chart drawer', 'Ngăn bản đồ', 'A drawer with a torn corner.', 'Ngăn kéo rách một góc.', 'Chart corner|Góc bản đồ'],
    B: ['Light table', 'Bàn ánh sáng', 'A glass table lit from below.', 'Bàn kính sáng từ phía dưới.', 'Overlay sheet|Tấm phủ'],
    L: ['Vault lock', 'Khóa hầm', 'A lock with two drawer slots.', 'Ổ khóa với hai khe ngăn.', 'Vault key|Chìa hầm'],
    D: ['Vault door', 'Cửa hầm', 'A flat door set in the wall.', 'Cánh cửa phẳng trong tường.', '-|-'],
    P: ['Compass stand', 'Giá la bàn', 'A stand with no compass.', 'Giá không có la bàn.', 'Compass tag|Thẻ la bàn'],
    X: ['Pinned moth case', 'Hộp bướm đêm', 'A case of pinned wings.', 'Hộp cánh được ghim.', 'Vault seal|Dấu hầm'],
  }),
  mk('cel', 3, 'b', { en: 'Orrery Hall', vi: 'Sảnh mô hình hành tinh' }, { en: 'Brass rings turn slowly overhead.', vi: 'Các vòng đồng quay chậm trên đầu.' }, {
    A: ['Inner ring', 'Vòng trong', 'A ring with a gap.', 'Vòng có khe hở.', 'Ring bead|Hạt vòng'],
    B: ['Outer ring', 'Vòng ngoài', 'A ring with unlabelled marks.', 'Vòng có vạch chưa ghi nhãn.', 'Mark key|Bảng vạch'],
    L: ['Orrery lock', 'Khóa mô hình', 'A lock between two rings.', 'Ổ khóa giữa hai vòng.', 'Orrery key|Chìa mô hình'],
    D: ['Hall door', 'Cửa sảnh', 'A door behind the sun model.', 'Cửa sau mô hình mặt trời.', '-|-'],
    P: ['Gear crank', 'Tay quay bánh răng', 'A crank for the outer ring.', 'Tay quay cho vòng ngoài.', 'Crank mark|Dấu tay quay'],
    X: ['Moon dial', 'Mặt số trăng', 'A dial showing phases.', 'Mặt số chỉ các pha.', 'Hall seal|Dấu sảnh'],
  }),
  mk('cel', 4, 'd', { en: 'Dome Observatory', vi: 'Đài quan sát mái vòm' }, { en: 'A telescope under an open dome.', vi: 'Kính thiên văn dưới mái vòm mở.' }, {
    A: ['Telescope mount', 'Chân kính thiên văn', 'A mount with two settings.', 'Chân đế có hai nấc chỉnh.', 'Lens cap|Nắp ống kính'],
    B: ['Observation log', 'Nhật ký quan sát', 'A log with a table of readings.', 'Nhật ký có bảng số đo.', 'Log page|Trang nhật ký'],
    L: ['Dome latch', 'Chốt mái vòm', 'A latch with two sockets.', 'Chốt với hai ổ cắm.', 'Dome key|Chìa mái vòm'],
    D: ['Observatory exit', 'Lối ra đài quan sát', 'The final stair door.', 'Cửa cầu thang cuối.', '-|-'],
    P: ['Focus wheel', 'Bánh lấy nét', 'A wheel that will not turn.', 'Bánh xe không quay được.', 'Focus tag|Thẻ lấy nét'],
    X: ['Star lamp', 'Đèn sao', 'A lamp with a shaped shade.', 'Đèn có chụp tạo hình.', 'Dome seal|Dấu mái vòm'],
  }),
]);

export const GLASS_GARDEN = campaign('glass_garden', { en: 'Glass Garden', vi: 'Vườn kính' }, { en: 'Greenhouses of prisms, ferns and brass pipes.', vi: 'Nhà kính với lăng kính, dương xỉ và ống đồng.' }, [
  mk('gg', 1, 'b', { en: 'Potting Greenhouse', vi: 'Nhà kính chậu cây' }, { en: 'Rows of pots and a watering rail.', vi: 'Hàng chậu và đường ống tưới.' }, {
    A: ['Seed tray', 'Khay hạt giống', 'A tray with labelled rows.', 'Khay có hàng đánh nhãn.', 'Seed label|Nhãn hạt'],
    B: ['Watering schedule', 'Lịch tưới', 'A schedule with blank cells.', 'Lịch có ô trống.', 'Schedule slip|Phiếu lịch'],
    L: ['Pipe valve', 'Van ống', 'A valve with two handles.', 'Van có hai tay quay.', 'Valve key|Chìa van'],
    D: ['Glass door', 'Cửa kính', 'A door of small panes.', 'Cửa gồm nhiều ô kính nhỏ.', '-|-'],
    P: ['Pot rack', 'Giá chậu', 'A rack missing one pot.', 'Giá thiếu một chậu.', 'Pot tag|Thẻ chậu'],
    X: ['Trowel hook', 'Móc xẻng', 'A hook with a small trowel.', 'Móc treo xẻng nhỏ.', 'Pot seal|Dấu chậu'],
  }),
  mk('gg', 2, 'd', { en: 'Prism Arcade', vi: 'Hành lang lăng kính' }, { en: 'Panes that split light into bands.', vi: 'Các tấm kính tách ánh sáng thành dải.' }, {
    A: ['Red pane', 'Tấm kính đỏ', 'A pane that tints the light.', 'Tấm kính nhuộm màu ánh sáng.', 'Pane filter|Bộ lọc kính'],
    B: ['Prism stand', 'Giá lăng kính', 'A prism on a rotating stand.', 'Lăng kính trên giá xoay.', 'Prism angle|Góc lăng kính'],
    L: ['Light lock', 'Khóa ánh sáng', 'A lock with two light sockets.', 'Ổ khóa với hai ổ sáng.', 'Arcade key|Chìa hành lang'],
    D: ['Arcade door', 'Cửa hành lang', 'A door of coloured glass.', 'Cửa kính màu.', '-|-'],
    P: ['Mirror frame', 'Khung gương', 'A frame with a missing mirror.', 'Khung thiếu gương.', 'Mirror tag|Thẻ gương'],
    X: ['Glass bell jar', 'Chuông thủy tinh', 'A bell jar over a small plant.', 'Chuông thủy tinh úp cây nhỏ.', 'Arcade seal|Dấu hành lang'],
  }),
  mk('gg', 3, 'a', { en: 'Fern Atrium', vi: 'Giếng trời dương xỉ' }, { en: 'Tall ferns around a stone basin.', vi: 'Dương xỉ cao quanh bể đá.' }, {
    A: ['Frond press', 'Máy ép lá', 'A press holding a leaf pattern.', 'Máy ép giữ họa tiết lá.', 'Leaf rubbing|Bản chà lá'],
    B: ['Basin gauge', 'Thước bể', 'A gauge with marked levels.', 'Thước có mức đánh dấu.', 'Level note|Ghi chú mực nước'],
    L: ['Basin lock', 'Khóa bể', 'A lock under the water line.', 'Ổ khóa dưới mực nước.', 'Atrium key|Chìa giếng trời'],
    D: ['Atrium gate', 'Cổng giếng trời', 'An iron gate with a vine.', 'Cổng sắt có dây leo.', '-|-'],
    P: ['Trellis frame', 'Khung giàn', 'A trellis missing a rung.', 'Giàn thiếu một thanh.', 'Trellis tag|Thẻ giàn'],
    X: ['Stone toad', 'Cóc đá', 'A statue with a hollow base.', 'Tượng có đế rỗng.', 'Atrium seal|Dấu giếng trời'],
  }),
  mk('gg', 4, 'c', { en: 'Lantern Conservatory', vi: 'Nhà kính đèn lồng' }, { en: 'Hanging lanterns and the last gate.', vi: 'Đèn lồng treo và cổng cuối.' }, {
    A: ['Lantern chain', 'Dây đèn lồng', 'Lanterns that light in sequence.', 'Đèn lồng sáng theo thứ tự.', 'Lantern wick|Bấc đèn'],
    B: ['Seed ledger', 'Sổ hạt giống', 'A ledger of counts per row.', 'Sổ ghi số lượng từng hàng.', 'Ledger page|Trang sổ'],
    L: ['Roof latch', 'Chốt mái', 'A latch above the door.', 'Chốt phía trên cửa.', 'Conservatory key|Chìa nhà kính'],
    D: ['Conservatory exit', 'Lối ra nhà kính', 'The final door to the garden.', 'Cửa cuối ra khu vườn.', '-|-'],
    P: ['Pipe organ', 'Đàn ống', 'Pipes missing one note.', 'Dàn ống thiếu một nốt.', 'Pipe tag|Thẻ ống'],
    X: ['Sundial', 'Đồng hồ mặt trời', 'A dial with a bent gnomon.', 'Mặt số có kim cong.', 'Final seal|Dấu cuối'],
  }),
]);

export const CAMPAIGNS: Record<CampaignId, Campaign> = { clockhouse: CLOCKHOUSE, celestial_archive: CELESTIAL, glass_garden: GLASS_GARDEN };
export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS) as CampaignId[];

export const doorNeeds = (h: Hotspot, maxTier: 1 | 2 | 3): string[] => [...h.needs, ...(maxTier >= 2 ? h.needsAt?.[2] ?? [] : []), ...(maxTier >= 3 ? h.needsAt?.[3] ?? [] : [])];
export const hotspotNeeds = (h: Hotspot, maxTier: 1 | 2 | 3) => (h.kind === 'door' ? doorNeeds(h, maxTier) : h.needs);

export type ValidationReport = { ok: boolean; errors: string[]; questions: number };
/** Every room must be completable from a clean state using only authored actions. No cycles, no stranded locks, no unreachable exit. */
export function validateCampaign(c: Campaign, rooms: number, maxTier: 1 | 2 | 3): ValidationReport {
  const errors: string[] = []; let questions = 0;
  for (const room of c.rooms.slice(0, rooms)) {
    const active = room.hotspots.filter((h) => h.tier <= maxTier);
    const have = new Set<string>(); const done = new Set<string>(); let progress = true;
    while (progress) {
      progress = false;
      for (const h of active) {
        if (done.has(h.id)) continue;
        const req = hotspotNeeds(h, maxTier);
        if (req.every((i) => have.has(i))) { done.add(h.id); progress = true; if (h.grants) have.add(h.grants); h.consumes.forEach(() => undefined); }
      }
    }
    for (const h of active) {
      if (!done.has(h.id)) errors.push(`${room.id}:${h.id} is unreachable (needs ${hotspotNeeds(h, maxTier).join(',')})`);
      if (h.question) questions++;
      for (const need of hotspotNeeds(h, maxTier)) if (!c.items[need]) errors.push(`${h.id} needs unknown item ${need}`);
      if (h.grants && !c.items[h.grants]) errors.push(`${h.id} grants unknown item ${h.grants}`);
    }
    const door = room.hotspots.find((h) => h.kind === 'door');
    if (!door || !done.has(door.id)) errors.push(`${room.id}: exit not reachable`);
    // consumed items must not be needed again by a later requirement in the same room (would strand the player)
    for (const l of active.filter((h) => h.consumes.length)) for (const other of active) if (other !== l && other.id !== l.id && hotspotNeeds(other, maxTier).some((n) => l.consumes.includes(n))) errors.push(`${room.id}: ${other.id} needs an item consumed by ${l.id}`);
    // overlap check on hit areas
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!, b = active[j]!;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) errors.push(`${room.id}: ${a.id} overlaps ${b.id}`);
    }
  }
  return { ok: errors.length === 0, errors, questions };
}
export const questionsRequired = (c: Campaign, rooms: number, maxTier: 1 | 2 | 3) => validateCampaign(c, rooms, maxTier).questions;
