#!/bin/bash
# Navigation E2E Test Runner
# 
# Usage:
#   ./scripts/run-navigation-tests.sh          # Quick test (1 browser, ~5 min)
#   ./scripts/run-navigation-tests.sh full      # Full test with tabs (~15 min)
#   ./scripts/run-navigation-tests.sh single   # Single page debug
#   ./scripts/run-navigation-tests.sh reset    # Reset session cache

set -e

cd "$(dirname "$0")/.." || exit 1

case "${1:-quick}" in
  quick)
    echo "🚀 Running Quick Navigation Test (1 browser, ~5 min)..."
    bunx playwright test e2e/specs/quick-nav.spec.ts \
      --project=chromium \
      --reporter=list \
      --timeout=300000
    ;;

  full|enhanced)
    echo "🚀 Running Full Navigation Test with Tab Discovery (~15 min)..."
    bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts \
      --project=chromium \
      --reporter=list \
      --timeout=900000
    ;;

  comprehensive)
    echo "🚀 Running Comprehensive Navigation Test (~30 min, all browsers)..."
    bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts \
      --reporter=list \
      --timeout=900000
    ;;

  single)
    echo "🔍 Running Single Page Debug..."
    bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts \
      --project=chromium \
      --grep="Debug" \
      --reporter=list
    ;;

  reset)
    echo "🔄 Resetting session cache..."
    rm -f test-results/.session-cache.json
    echo "✅ Session cache cleared. Next test run will login fresh."
    ;;

  report)
    echo "📊 Generating test report..."
    if [ -f "test-results/full-navigation-report.html" ]; then
      echo "Report: file://$(pwd)/test-results/full-navigation-report.html"
    else
      echo "No report found. Run 'full' test first."
    fi
    ;;

  *)
    echo "Usage: $0 [quick|full|comprehensive|single|reset|report]"
    echo ""
    echo "  quick          - Quick test on 1 browser (~5 min)"
    echo "  full/enhanced  - Full test with tab discovery (~15 min)"
    echo "  comprehensive  - All browsers, all viewports (~30 min)"
    echo "  single         - Debug single page"
    echo "  reset          - Clear session cache"
    echo "  report         - Open last test report"
    exit 1
    ;;
esac
