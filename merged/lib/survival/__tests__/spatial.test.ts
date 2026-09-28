import { generateCamp } from '@/lib/survival/generate';
import { nearestTileOfKind } from '@/lib/survival/spatial';

describe('nearestTileOfKind', () => {
  it('finds a real tile of the requested kind', () => {
    const camp = generateCamp('nearest-check');
    const water = nearestTileOfKind(camp.terrain, 'water');
    expect(water).not.toBeNull();
    expect(camp.terrain.tiles[water!.y][water!.x]).toBe('water');
  });

  it('returns null for a kind that genuinely has no tile', () => {
    const camp = generateCamp('nearest-none');
    // "camp" only ever occupies exactly the camp cell — ask for a second one nowhere else
    const fake = { ...camp.terrain, tiles: camp.terrain.tiles.map(row => row.map(t => (t === 'camp' ? 'open' : t))) };
    expect(nearestTileOfKind(fake, 'camp')).toBeNull();
  });

  it('picks the closest of several matching tiles', () => {
    const camp = generateCamp('nearest-multi');
    const woodland = nearestTileOfKind(camp.terrain, 'woodland');
    expect(woodland).not.toBeNull();
    let minDist = Infinity;
    for (let y = 0; y < camp.terrain.height; y++) {
      for (let x = 0; x < camp.terrain.width; x++) {
        if (camp.terrain.tiles[y][x] === 'woodland') {
          minDist = Math.min(minDist, Math.abs(x - camp.terrain.campX) + Math.abs(y - camp.terrain.campY));
        }
      }
    }
    const gotDist = Math.abs(woodland!.x - camp.terrain.campX) + Math.abs(woodland!.y - camp.terrain.campY);
    expect(gotDist).toBe(minDist);
  });
});
