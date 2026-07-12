import { expect, test } from "vite-plus/test";

import { loadSocialCalc } from "./helpers/socialcalc";

test("reuses one SocialCalc bundle per isolated test worker", async () => {
  const first = await loadSocialCalc({ browser: true });
  const second = await loadSocialCalc({ browser: true });

  expect(second).toBe(first);
});
