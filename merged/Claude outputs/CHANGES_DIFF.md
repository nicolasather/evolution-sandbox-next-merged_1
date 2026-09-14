# Detailed Changes - Diff View

## File 1: components/ArchiveView.tsx

### Change 1: Add 'chalcolithic' to Filter type union (Line 13)

```diff
- type Filter = 'all' | 'found' | 'missing' | 'rare' | 'hidden' | 'req' | 'olduvai' | 'middle' | 'late';
+ type Filter = 'all' | 'found' | 'missing' | 'rare' | 'hidden' | 'req' | 'olduvai' | 'middle' | 'late' | 'chalcolithic';
```

---

### Change 2: Add Chalcolithic entry to tierNames Record (Lines 15-19)

```diff
  const tierNames: Record<StoneAgeTier, string> = {
    olduvai: 'Olduvai (Đồ Đá Cũ)',
    middle: 'Middle (Đồ Đá Giữa)',
    late: 'Late (Đồ Đá Mới)',
+   chalcolithic: 'Chalcolithic (Kỷ Nguyên Đồng)',
  };
```

---

### Change 3: Add Chalcolithic to tierFilters array (Lines 60-63)

```diff
  const tierFilters: [Filter, string][] = [
    ['olduvai', 'Olduvai (27)'],
    ['middle', 'Middle (97)'],
    ['late', 'Late (198)'],
+   ['chalcolithic', 'Chalcolithic (200)'],
  ];
```

---

## File 2: lib/useSandbox.ts

### Change: Update tier_locked timeout handling (Line 75)

```diff
- window.setTimeout(() => { setResult(null); clearSlots(); }, res.status === 'fail' ? 1500 : 1250);
+ window.setTimeout(() => { setResult(null); clearSlots(); }, res.status === 'fail' || res.status === 'tier_locked' ? 1500 : 1250);
```

**Impact:** When a combine result has `status: 'tier_locked'`, the result message now displays for 1500ms (same as 'fail' messages) instead of 1250ms, giving users more time to read unlock requirements.

---

## File 3: components/TierProgressBar.tsx (NEW FILE)

**Status:** Created - this file did not exist previously

**Purpose:** Displays visual progress bars for all four Stone Age tiers

**Key Content:**

```typescript
// Tier labels with descriptions
const tierLabels: Record<StoneAgeTier, { name: string; description: string }> = {
  olduvai: { name: 'Olduvai (Đồ Đá Cũ)', description: 'The foundation of discovery' },
  middle: { name: 'Middle (Đồ Đá Giữa)', description: 'Unlock at 50% of Olduvai' },
  late: { name: 'Late (Đồ Đá Mới)', description: 'Unlock at 50% of Middle' },
  chalcolithic: { name: 'Chalcolithic (Kỷ Nguyên Đồng)', description: 'Unlock at 50% of Late' },
};

// Component renders:
// - Lock/unlock status indicators (✓ or 🔒)
// - Progress bars for each tier
// - Unlock requirements text
// - Bilingual labels (English + Vietnamese)
```

**Integration Point:**
Used in `ArchiveView.tsx` at line 88:
```tsx
{showTierProgress && <TierProgressBar engine={engine} />}
```

---

## Summary of Changes by Category

### Type System
- ✅ Added `'chalcolithic'` to `Filter` union type

### UI Components
- ✅ Added chalcolithic to tier filter buttons
- ✅ Added bilingual name for chalcolithic tier
- ✅ Created new TierProgressBar component for progress visualization

### State Management
- ✅ Enhanced `tier_locked` result handling with appropriate timeout duration

### New Features Enabled
- Users can filter archive to show only Chalcolithic crafts
- Users can see progress toward unlocking Chalcolithic tier
- Lock messages display with proper timing for readability
- Complete bilingual (English/Vietnamese) support for Chalcolithic tier

---

## Backward Compatibility

✅ **All changes are backward compatible:**
- No existing functionality is modified
- All changes are additive (new tier added to existing system)
- Type definitions extended rather than replaced
- Default behaviors for existing tiers unchanged
