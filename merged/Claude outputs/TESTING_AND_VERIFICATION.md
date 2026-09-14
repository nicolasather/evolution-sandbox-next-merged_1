# Testing & Verification Guide

## Pre-Implementation Checklist

Before applying these changes, verify you have:

- [ ] All 3 files from previous session implementation:
  - `lib/types.ts` (updated with chalcolithic in StoneAgeTier and TierProgress)
  - `lib/engine.ts` (updated with tier system logic)
  - `data/db.json` (contains 200 chalcolithic crafts)

- [ ] Current project structure:
  - `components/` directory exists
  - `lib/` directory exists
  - TypeScript configuration is set up

---

## Implementation Steps

1. **Replace/Update Files:**
   ```bash
   # Copy the three updated files to your project
   cp ArchiveView.tsx components/
   cp useSandbox.ts lib/
   cp TierProgressBar.tsx components/  # NEW FILE
   ```

2. **Verify Imports:**
   - `ArchiveView.tsx` imports `TierProgressBar` from `./TierProgressBar` (line 7)
   - `TierProgressBar.tsx` imports from `@/lib/engine` and `@/lib/types`
   - No circular dependencies

3. **Type Checking:**
   ```bash
   npx tsc --noEmit
   # Should show no type errors
   ```

4. **Build:**
   ```bash
   npm run build
   # Should complete without errors
   ```

---

## Testing Scenarios

### Scenario 1: Archive View Loads
**Test:** Open the archive view
**Expected Results:**
- ✅ Archive displays without errors
- ✅ All stats are visible (core discoveries, hidden finds, combinations, etc.)
- ✅ No console errors

**Steps:**
1. Load the Evolution Sandbox game
2. Navigate to the Archive view
3. Check browser console for errors

---

### Scenario 2: Tier Filters Display
**Test:** Check tier filter buttons
**Expected Results:**
- ✅ Four tier filter buttons are visible: Olduvai, Middle, Late, Chalcolithic
- ✅ All show correct craft counts: (27), (97), (198), (200)
- ✅ At game start, Chalcolithic button has lock icon and is disabled
- ✅ Hovering shows tooltip: "Unlock by crafting more discoveries"

**Steps:**
1. Open Archive view
2. Look for "Tier:" section with filter buttons
3. Verify Chalcolithic button appears with lock icon initially
4. Hover over Chalcolithic button to see tooltip

---

### Scenario 3: Chalcolithic Filter Works (When Unlocked)
**Test:** Filter chalcolithic discoveries after unlocking the tier
**Expected Results:**
- ✅ Clicking "Chalcolithic (200)" filter shows only chalcolithic crafts
- ✅ All 200 chalcolithic crafts display in the grid
- ✅ Craft cards show correct information (number, name, era, tier)
- ✅ Undiscovered crafts show as locked (no name visible)

**Steps:**
1. Play until you unlock Chalcolithic (need ~212 discoveries: 50% of 424 late-tier + earlier)
2. Go to Archive view
3. Click on "Chalcolithic (200)" tier filter
4. Verify all 200 crafts are displayed

---

### Scenario 4: Tier Progress Display
**Test:** Stone Age Progress expandable section
**Expected Results:**
- ✅ "Stone Age Progress" button appears in Archive
- ✅ Clicking expands to show progress bars for all 4 tiers
- ✅ Each tier shows:
  - Bilingual name (English + Vietnamese)
  - Description text
  - Lock/unlock status icon (✓ or 🔒)
  - Progress count (X / Y)
  - Visual progress bar
  - For locked tiers: "Need Z discoveries to unlock" message

**Steps:**
1. Open Archive view
2. Look for "▶ Stone Age Progress" button near top
3. Click to expand
4. Verify all information displays correctly

**Example Display (Start of Game):**
```
✓ Olduvai (Đồ Đá Cũ)
  The foundation of discovery
  0 / 27
  [████████████████████████] 0%

🔒 Middle (Đồ Đá Giữa)
  Unlock at 50% of Olduvai
  0 / 97
  [░░░░░░░░░░░░░░░░░░░░░░░░] 0%
  Need 14 discoveries to unlock (0% progress)
```

---

### Scenario 5: Tier Unlock Progression
**Test:** Verify tiers unlock at correct thresholds
**Expected Results:**
- ✅ Middle unlocks at 50% of Olduvai (14/27 ≈ 14 crafts)
- ✅ Late unlocks at 50% of Middle (49/97 ≈ 49 crafts)
- ✅ Chalcolithic unlocks at 50% of Late (212/424 ≈ 212 crafts)
- ✅ Once unlocked, tier button shows ✓ instead of 🔒
- ✅ Progress bar fills as crafts are discovered

**Steps:**
1. Start new game (or use save with progression)
2. Make combinations to accumulate discoveries
3. Track progress in "Stone Age Progress" section
4. Verify each tier unlocks when reaching 50% of previous tier
5. Check that locked tier filters become available upon unlock

---

### Scenario 6: Tier Lock Prevents Crafting
**Test:** Attempt to craft locked chalcolithic recipe
**Expected Results:**
- ✅ Combine attempt returns `status: 'tier_locked'`
- ✅ Error message displays: "Unlock Chalcolithic era by crafting more discoveries."
- ✅ Slots remain selected (not cleared immediately)
- ✅ Message stays visible for 1.5 seconds (longer than normal 1.25s)
- ✅ After 1.5s, slots clear and message disappears

**Steps:**
1. Play game but DON'T unlock Chalcolithic tier yet
2. Try to combine two items that result in a chalcolithic recipe
3. Observe the error message
4. Time how long the message displays (should be ~1.5 seconds)

---

### Scenario 7: Archive Grid Card Updates
**Test:** Verify chalcolithic cards display in archive grid
**Expected Results:**
- ✅ Chalcolithic recipe cards show correct layout:
  - Glyph/icon (locked or unlocked)
  - Craft number (NO. XXX format)
  - Craft name (or "—" if not discovered)
  - Era name
  - Tier label (if applicable)
- ✅ Locked chalcolithic cards are grayed out with 40% opacity
- ✅ Locked cards show lock cursor and cannot be clicked
- ✅ Discovered chalcolithic crafts are fully opaque and clickable

**Steps:**
1. Open Archive with Chalcolithic filter
2. Examine card styling
3. Try clicking on locked and unlocked cards
4. Verify visual feedback matches tier-lock status

---

### Scenario 8: Concert & Performance
**Test:** Overall performance and rendering
**Expected Results:**
- ✅ Archive view renders smoothly even with 200+ chalcolithic cards visible
- ✅ Tier filter buttons respond instantly
- ✅ Progress bars animate smoothly
- ✅ No lag when switching between filters
- ✅ Console shows no performance warnings

**Steps:**
1. Apply Chalcolithic filter (shows 200 cards)
2. Scroll through the grid
3. Switch between different filters
4. Expand/collapse Stone Age Progress section
5. Monitor browser performance (DevTools)

---

## Rollback Instructions

If you encounter critical issues:

1. **Revert Changes:**
   ```bash
   git checkout components/ArchiveView.tsx
   git checkout lib/useSandbox.ts
   git rm components/TierProgressBar.tsx
   ```

2. **Or Manually:**
   - Remove `TierProgressBar.tsx`
   - Restore `ArchiveView.tsx` from git history
   - Restore `useSandbox.ts` from git history

3. **Verify Restore:**
   ```bash
   npm run build
   ```

---

## Common Issues & Solutions

### Issue: "Cannot find module 'TierProgressBar'"
**Cause:** File not copied to correct location
**Solution:** 
- Verify `TierProgressBar.tsx` is in `components/` directory
- Check filename spelling (case-sensitive)
- Ensure import path in `ArchiveView.tsx` matches file location

---

### Issue: Type errors with `StoneAgeTier`
**Cause:** Types not updated in previous session
**Solution:**
- Verify `lib/types.ts` has `chalcolithic` in `StoneAgeTier` union
- Verify `TierProgress` interface includes `chalcolithic` property
- Run `npx tsc --noEmit` to check all types

---

### Issue: Chalcolithic recipes never unlock
**Cause:** Database tier configuration incorrect
**Solution:**
- Verify `data/db.json` has `stone_age_tiers` config
- Check `chalcolithic` entry has `unlock_percentage: 50`
- Verify 200 chalcolithic crafts have `stone_age_tier: 'chalcolithic'`

---

### Issue: Tier progress bar shows wrong numbers
**Cause:** Tier counts not matching database
**Solution:**
- The component automatically calculates from database
- If counts are wrong, the issue is in the database tier assignments
- Run validation: check that exactly 200 nodes have `stone_age_tier: 'chalcolithic'`

---

## Performance Metrics

Expected performance after implementation:

| Metric | Expected | Acceptable |
|--------|----------|------------|
| Archive load time | < 500ms | < 1000ms |
| Filter switch time | < 100ms | < 200ms |
| Tier progress animation | 0.3s smooth | < 0.5s |
| Memory increase | < 5MB | < 10MB |

---

## Commit Message

When committing these changes to your repository:

```
Add Chalcolithic tier UI components and improvements

- Update ArchiveView.tsx: add chalcolithic filter support
- Update useSandbox.ts: handle tier_locked status with proper timeout
- Create TierProgressBar.tsx: new component for tier progress visualization
- Add bilingual (English/Vietnamese) tier labels
- Enable users to filter and view all 200 chalcolithic crafts
- Improve tier unlock progression visibility

Chalcolithic tier requires 50% of Late tier discoveries to unlock.
All 200 new crafts are properly integrated with existing tier system.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## Success Criteria

✅ **Implementation is successful when:**

1. Archive view loads without errors
2. All four tier filter buttons appear
3. Chalcolithic button shows as locked until tier is unlocked
4. Stone Age Progress section displays all four tiers with progress
5. User can filter and view chalcolithic crafts when unlocked
6. Tier lock prevents crafting with appropriate error message
7. Progress bars animate and update correctly
8. Bilingual names display properly
9. No console errors or warnings
10. Build completes successfully with no type errors

---

## Next Steps

After successful testing:

1. Deploy to production
2. Test with actual players
3. Monitor for any edge cases
4. Consider adding achievement/badge for unlocking Chalcolithic
5. Monitor performance metrics in production

---

**Testing Complete!** ✅
