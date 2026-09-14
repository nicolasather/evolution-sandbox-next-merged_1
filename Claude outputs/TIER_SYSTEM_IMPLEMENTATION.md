# Stone Age Tier System - Implementation Guide

## Overview

Thêm 3-tier progression system vào Evolution Sandbox game:
- **Olduvai (Đồ Đá Cũ)**: 27 items, 33 recipes - Mở khóa từ đầu
- **Middle (Đồ Đá Giữa)**: 97 items, 101 recipes - Mở khi unlock 50% Olduvai (16/33)
- **Late (Đồ Đá Mới)**: 198 items, 424 recipes - Mở khi unlock 50% Middle (50/101)

---

## Files to Replace/Update

### 1. **lib/types.ts** → `/mnt/user-data/outputs/types.ts`

**Changes:**
- Thêm `StoneAgeTier` type
- Thêm `stone_age_tier?: StoneAgeTier` vào `Discovery` interface
- Thêm `StoneAgeTierInfo` interface
- Thêm `stone_age_tiers?: Record<StoneAgeTier, StoneAgeTierInfo>` vào `Db` interface
- Thêm `TierProgress` interface
- Update `CombineResult` type để thêm `tier_locked` status

**Copy:**
```bash
cp /mnt/user-data/outputs/types.ts lib/types.ts
```

---

### 2. **lib/engine.ts** → `/mnt/user-data/outputs/engine.ts`

**Changes:**
- Thêm `tierRecipeIndex` property để track recipes per tier
- Thêm method `getTierProgress()` - return unlock progress cho mỗi tier
- Thêm method `isRecipeUnlocked(resultId)` - check recipe tier lock
- Thêm method `getUnlockedTiers()` - list tiers đã unlock
- Update `combine()` method để check tier lock trước khi combine

**Copy:**
```bash
cp /mnt/user-data/outputs/engine.ts lib/engine.ts
```

---

### 3. **components/ArchiveView.tsx** → `/mnt/user-data/outputs/ArchiveView.tsx`

**Changes:**
- Thêm tier filter buttons (Olduvai, Middle, Late)
- Thêm TierProgressBar component (collapsible)
- Thêm tier badge display trên mỗi card
- Add visual indicator cho tier-locked items (opacity 0.4, cursor: not-allowed)
- Tier buttons bị lock (🔒) nếu chưa unlock

**Copy:**
```bash
cp /mnt/user-data/outputs/ArchiveView.tsx components/ArchiveView.tsx
```

---

### 4. **NEW: components/TierProgressBar.tsx** → `/mnt/user-data/outputs/TierProgressBar.tsx`

**Description:**
- Component collapsible hiển thị progress bar cho mỗi tier
- Hiển thị:
  - Current/Total recipes unlocked
  - Progress percentage
  - Color coding: 🔴 Red (locked), 🟡 Yellow (ready to unlock), 🟢 Green (unlocked)
  - Status message (locked/ready/unlocked)

**Copy:**
```bash
cp /mnt/user-data/outputs/TierProgressBar.tsx components/TierProgressBar.tsx
```

---

## Integration Steps

### Step 1: Copy Files
```bash
# On your machine, in the evolution-sandbox-next-merged folder:
cd merged

# Copy type definitions
cp <path-to-outputs>/types.ts lib/types.ts

# Copy updated engine
cp <path-to-outputs>/engine.ts lib/engine.ts

# Copy updated ArchiveView
cp <path-to-outputs>/ArchiveView.tsx components/ArchiveView.tsx

# Copy new TierProgressBar
cp <path-to-outputs>/TierProgressBar.tsx components/TierProgressBar.tsx
```

### Step 2: Update useSandbox.ts
In `lib/useSandbox.ts`, thêm logic để handle `tier_locked` status:

```typescript
// In the fire() callback, thêm handling cho tier_locked:
const fire = useCallback((a: string, b: string) => {
  const res = engine.combine(a, b);
  setResult(res);
  setHint(false);
  
  if (res.status === 'tier_locked') {
    // Show tier lock message
    console.log(`Tier locked: ${res.message}`);
    // Can show a special toast/notification for tier lock
  } else if (res.status === 'new' || res.status === 'known') {
    // ... existing code
  }
  // ... rest of existing code
}, [engine, pushToast, clearSlots]);
```

### Step 3: Update Sandbox.tsx (Optional Enhancement)
Thêm tier progress bar vào main game UI (không bắt buộc, có thể chỉ trong Archive):

```typescript
// In Sandbox.tsx, add tier progress display:
<TierProgressBar engine={engine} />
```

### Step 4: Test
```bash
npm run dev
```

Kiểm tra:
1. ✅ Archive view hiển thị tier filters
2. ✅ Progress bar hiển thị chính xác
3. ✅ Tier-locked items không thể craft
4. ✅ Tier unlock khi đạt 50% recipes
5. ✅ Tier badge hiển thị trên mỗi item

---

## Game Logic Flow

### Tier Unlock Condition

```javascript
// Unlock Middle tier: Need 50% of Olduvai recipes (16/33)
if (olduvai.unlocked >= 16) {
  unlock('middle');
}

// Unlock Late tier: Need 50% of Middle recipes (50/101)
if (middle.unlocked >= 50) {
  unlock('late');
}
```

### Recipe Lock Check

```javascript
// Khi user cố gắng combine A + B → Result:
if (result.stone_age_tier === 'middle' && !unlockedTiers.includes('middle')) {
  return {
    status: 'tier_locked',
    message: 'Unlock Middle tier to access',
    requiredTier: 'middle'
  };
}
```

### UI Indicators

| Status | Visual | Interaction |
|--------|--------|-------------|
| **Unlocked** | Normal opacity | Clickable |
| **Ready to unlock** | 🟡 Yellow progress | Show "Ready to unlock next tier" |
| **Tier locked** | 🔒 Opacity 0.4 | Show-only, not clickable |

---

## CSS Classes to Add (Optional)

If you want custom styling, add to your CSS:

```css
.card.tier-locked {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: rgba(255, 100, 100, 0.2);
}

.tier-progress-container {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  padding: 1rem;
}

.tier-progress-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tier-progress-item.locked {
  opacity: 0.6;
}
```

---

## Database Notes

Your db.json đã có:
- ✅ `stone_age_tier` field cho mỗi node
- ✅ `stone_age_tiers` metadata với unlock requirements
- ✅ Tất cả 322 nodes đã phân loại đúng tier

Không cần thêm/thay đổi db.json, file đã ready!

---

## Testing Checklist

- [ ] Types compile without errors
- [ ] Engine methods work correctly
- [ ] Archive View loads without errors
- [ ] Tier filters work
- [ ] Progress bar displays correctly
- [ ] Tier-locked items show properly
- [ ] Can unlock tiers by crafting
- [ ] Progression persists after reload
- [ ] No console errors

---

## Troubleshooting

### Problem: "Cannot find module TierProgressBar"
**Solution:** Make sure file path is correct in imports
```typescript
// Should be:
import { TierProgressBar } from './TierProgressBar';
```

### Problem: Tier progress always shows 0
**Solution:** Check that nodes have `stone_age_tier` field and recipes are set correctly

### Problem: Can't craft tier-locked recipes
**Solution:** This is intentional! User must unlock tier by crafting 50% of previous tier

### Problem: UI looks broken
**Solution:** Make sure you have the CSS classes or inline styles are applied

---

## File Sizes

- `types.ts`: ~5 KB
- `engine.ts`: ~15 KB (mostly same as original)
- `ArchiveView.tsx`: ~7 KB
- `TierProgressBar.tsx`: ~4 KB

**Total: ~31 KB added to codebase**

---

## Next Steps (Optional)

1. **Add animations** when tier unlocks
2. **Add achievement system** for tier completions
3. **Add tier icons/glyphs** in UI
4. **Add tier-based story/narrative elements**
5. **Add tier statistics** to end-game summary

---

Created: 2026-09-13
For: Evolution Sandbox Game
