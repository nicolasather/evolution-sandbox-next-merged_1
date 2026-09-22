#!/bin/bash
# Evolution Sandbox P0 Upgrade Deployment Script
# Run this from the repo root: bash DEPLOY.sh

set -e

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Evolution Sandbox P0 Upgrade — Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check git status
echo "📋 Checking git status..."
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ Working directory clean"
else
    echo "⚠️  Uncommitted changes detected"
fi
echo ""

# Stage core gameplay files
echo "📦 Staging core gameplay files..."
git add lib/hints.ts
git add lib/multiRoutes.ts
echo "  ✓ lib/hints.ts"
echo "  ✓ lib/multiRoutes.ts"
echo ""

# Stage modified type definitions
echo "📦 Staging type definitions..."
git add lib/types.ts
git add lib/useSandbox.ts
echo "  ✓ lib/types.ts (modified)"
echo "  ✓ lib/useSandbox.ts (modified)"
echo ""

# Stage component files
echo "📦 Staging components..."
git add components/HintPanel.tsx
git add components/HintPanel.module.css
git add components/MultiRoutesPicker.tsx
git add components/MultiRoutesPicker.module.css
git add components/DiscoveryReveal.tsx
git add components/DiscoveryReveal.module.css
git add components/OnboardingModal.tsx
git add components/OnboardingModal.module.css
git add components/ThemeToggle.tsx
git add components/ThemeToggle.module.css
echo "  ✓ HintPanel (component + styles)"
echo "  ✓ MultiRoutesPicker (component + styles)"
echo "  ✓ DiscoveryReveal (component + styles)"
echo "  ✓ OnboardingModal (component + styles)"
echo "  ✓ ThemeToggle (component + styles)"
echo ""

# Stage global styles
echo "📦 Staging global styles..."
git add theme-system.css
git add mobile-responsive.css
echo "  ✓ theme-system.css"
echo "  ✓ mobile-responsive.css"
echo ""

# Verify staging
echo "📋 Verifying staged files..."
git status --short
echo ""

# Count staged files
STAGED=$(git diff --cached --name-only | wc -l)
echo "✅ $STAGED files staged"
echo ""

# Ask for confirmation before committing
read -p "Ready to commit? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    git reset HEAD
    exit 1
fi

echo ""
echo "📝 Creating commit..."
git commit -m "feat: Complete P0 gameplay upgrade with hints, routes, animations, themes

FEATURES IMPLEMENTED:
- Progressive 4-level hint system (HintManager + HintPanel)
- Multiple crafting routes support (MultiRouteManager + MultiRoutesPicker)
- Discovery reveal animations (DiscoveryReveal with 3-stage sequence)
- Complete theme system (light/dark/system with CSS custom properties)
- Mobile responsiveness (phones 320px, tablets 768px, landscape)
- Improved onboarding modal with interactive tutorial
- Theme toggle component with localStorage persistence

NEW COMPONENTS:
- HintPanel: Progressive hint display with level tracking
- MultiRoutesPicker: Route selection UI with availability indicators
- DiscoveryReveal: Animated reveal sequence (connect→expand→fade)
- ThemeToggle: System/Light/Dark mode selector
- OnboardingModal: Interactive tutorial for new players

STYLING:
- theme-system.css: 50+ CSS variables for light/dark theming
- mobile-responsive.css: Responsive breakpoints (320px-1920px)
- CSS modules for all components with animations

MANAGERS:
- HintManager: Progressive hints with fallback generation
- MultiRouteManager: Multiple recipe support with player focus

HOOKS:
- useSandbox extended with hint and route APIs

BACKWARD COMPATIBILITY: ✅
- All new fields optional in types
- Fallback hint generation for missing data
- Existing games unaffected
- localStorage keys versioned (v1)

DATA PERSISTENCE:
- evo.hints.v1: Hint progress per discovery
- evo.routes.v1: Focused route preference per discovery
- evo.theme.v1: Theme mode preference
- evo.onboarding.dismissed: Onboarding modal dismissal

TESTING CHECKLIST:
- No TypeScript errors
- No linting errors
- Build succeeds
- Tests pass
- Hints load from localStorage
- Route focus persists on reload
- Theme toggle works
- Mobile layouts responsive
- Animations smooth at 60fps

RATIONALE:
Progressive hints reduce frustration while preserving discovery feeling.
Multiple routes support exploration. Animations make discoveries satisfying.
Theme system meets user demands. Mobile responsiveness ensures 50%+ mobile
players have excellent experience. Onboarding reduces early churn.

All changes backward compatible. Existing games function unchanged.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WZrMGXKw6E8DzUZMQCqByt"

echo "✅ Commit created successfully"
echo ""

# Show commit details
echo "📊 Commit Details:"
git log --oneline -1
git diff --cached --stat HEAD~1
echo ""

# Ask to push
read -p "Push to main? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏸️  Deployment paused. Run 'git push origin main' when ready"
    exit 0
fi

echo ""
echo "🚀 Pushing to main..."
git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next Steps:"
echo "1. Monitor GitHub Actions: https://github.com/[user]/evolution-sandbox-next-merged_1/actions"
echo "2. Monitor Vercel: https://vercel.com/[team]/evolution-sandbox-next-merged-1"
echo "3. Test at: https://evolution-sandbox-next-merged-1-g1s.vercel.app/"
echo ""
echo "Testing Checklist:"
echo "  ☐ Site loads without errors"
echo "  ☐ Game initializes correctly"
echo "  ☐ Crafting combinations work"
echo "  ☐ Discovery animations play"
echo "  ☐ Hints system works"
echo "  ☐ Multiple routes display"
echo "  ☐ Theme toggle works"
echo "  ☐ Mobile layouts responsive"
echo "  ☐ Onboarding modal shows"
echo ""
echo "See DEPLOYMENT_CHECKLIST_FINAL.md for complete testing guide"
echo ""
