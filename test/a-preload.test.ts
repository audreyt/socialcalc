// Preload file: runs first in alphabetical order (before editor-coverage).
// It captures references to SocialCalc functions that other test files
// mutate for stubbing, so iofunctions-coverage can restore the originals
// and exercise their real implementations for coverage reporting.
//
// editor-coverage.test.ts stubs SocialCalc.TriggerIoAction.Email with a
// no-op; because Bun's test runner shares module state across files, that
// stub persists for the remainder of the run, preventing later Email tests
// from actually executing the real function body.  Saving the originals
// here — before any stubbing — lets us later reinstall them.

import { test } from "bun:test";

import { loadSocialCalc } from "./helpers/socialcalc";

test("[preload] capture original TriggerIoAction.Email", async () => {
    const SC: any = await loadSocialCalc({ browser: true });
    (globalThis as any).__scOrig = (globalThis as any).__scOrig || {};
    const orig = (globalThis as any).__scOrig;
    if (SC.TriggerIoAction && SC.TriggerIoAction.Email) {
        orig.TriggerIoAction_Email = SC.TriggerIoAction.Email;
    }
});
