# Quick Start: Implementation Guide

## Files to Update

You have **3 files** to integrate:

### 1. ✏️ **components/ArchiveView.tsx** (REPLACE)
- Location: `components/ArchiveView.tsx`
- Status: Updated file
- Changes: +3 lines (chalcolithic filter, name, tier button)

### 2. ✏️ **lib/useSandbox.ts** (REPLACE)
- Location: `lib/useSandbox.ts`  
- Status: Updated file
- Changes: 1 line modified (tier_locked timeout)

### 3. ➕ **components/TierProgressBar.tsx** (NEW)
- Location: `components/TierProgressBar.tsx`
- Status: New file (66 lines)
- Content: Tier progress visualization component

---

## Implementation Steps (5 minutes)

### Step 1: Copy Updated Files
```bash
# From your project root
cp /path/to/ArchiveView.tsx components/
cp /path/to/useSandbox.ts lib/
cp /path/to/TierProgressBar.tsx components/
```

Or use your IDE's file replace feature.

---

### Step 2: Type Check
```bash
npx tsc --noEmit
```
**Expected:** No errors (if you have chalcolithic in lib/types.ts from previous session)

---

### Step 3: Build & Test
```bash
npm run build
npm run dev  # or your dev command
```

---

### Step 4: Test in Game
1. Open the Evolution Sandbox game
2. Navigate to the Archive view
3. Verify:
   - ✅ "Stone Age Progress" button appears
   - ✅ Four tier filters show: Olduvai, Middle, Late, Chalcolithic
   - ✅ Chalcolithic shows as locked (🔒) initially
   - ✅ Clicking expands tier progress bars

---

### Step 5: Commit
```bash
git add components/ArchiveView.tsx lib/useSandbox.ts components/TierProgressBar.tsx
git commit -m "Add Chalcolithic tier UI components

- Update ArchiveView: chalcolithic filter support
- Update useSandbox: handle tier_locked status  
- Create TierProgressBar: progress visualization
- 200 chalcolithic crafts now visible in archive
"
git push
```

---

## What Changed?

| File | Changes | Impact |
|------|---------|--------|
| ArchiveView.tsx | Added 'chalcolithic' to Filter type, tierNames Record, tierFilters array | Users can filter and view chalcolithic crafts |
| useSandbox.ts | Updated tier_locked timeout from 1250ms to 1500ms | Lock messages stay visible longer for readability |
| TierProgressBar.tsx | New file - displays tier progress | Users can see unlock progression visually |

---

## Verification Checklist

After implementation, verify these work:

- [ ] Archive view opens without errors
- [ ] Stone Age Progress section appears
- [ ] All 4 tier filters visible (with counts: 27, 97, 198, 200)
- [ ] Chalcolithic filter button shows lock icon initially
- [ ] Progress bars display for all tiers
- [ ] Bilingual names show (English + Vietnamese)
- [ ] No console errors
- [ ] Build completes successfully

---

## Key Features Enabled

✅ **Archive Filtering**
- Users can filter archive to show only chalcolithic crafts
- 200 new crafts now discoverable and displayable

✅ **Tier Progression Visibility**
- "Stone Age Progress" section shows real-time unlock status
- Progress bars animate as crafts are discovered
- Clear indication of what's needed to unlock next tier

✅ **Tier Lock Enforcement**
- Attempting locked recipes shows friendly error message
- Message displays for 1.5 seconds so users see it clearly

✅ **Localization**
- All tier names available in English and Vietnamese
- Ready for future language additions

---

## Troubleshooting

**Build fails with type errors?**
→ Verify lib/types.ts has 'chalcolithic' in StoneAgeTier and TierProgress

**TierProgressBar component not found?**
→ Check file is at `components/TierProgressBar.tsx` (exact path and filename)

**Chalcolithic filters don't show?**
→ Clear browser cache or do a hard refresh (Ctrl+Shift+R)

**Progress bars not updating?**
→ This is automatic - if they don't update, the engine might not be detecting tier tier system

**Craft count for chalcolithic wrong?**
→ Verify data/db.json has exactly 200 nodes with `stone_age_tier: 'chalcolithic'`

---

## Dependencies

These files depend on code from previous implementation:
- ✅ lib/types.ts (StoneAgeTier includes 'chalcolithic')
- ✅ lib/engine.ts (Tier logic updated)
- ✅ data/db.json (200 chalcolithic crafts added)

If you haven't completed the previous session's updates, do those first.

---

## Next: Testing

Detailed testing guide available in: **TESTING_AND_VERIFICATION.md**

---

## Git Commit Reference

```
Add Chalcolithic tier UI components

- Update ArchiveView.tsx: add chalcolithic filter/name/tier button
- Update useSandbox.ts: handle tier_locked with 1500ms timeout
- Create TierProgressBar.tsx: tier progress visualization
- Enable users to view and filter 200 chalcolithic crafts
- Add bilingual tier labels (English + Vietnamese)

Unlock requirement: 50% of Late tier (~212 discoveries needed)
All 200 chalcolithic crafts integrated with tier system.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

**Ready to implement? Start with Step 1 above!** 🚀
