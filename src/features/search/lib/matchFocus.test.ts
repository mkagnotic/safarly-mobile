import { test } from "node:test";
import assert from "node:assert/strict";

import { matchFocusTarget, RESULTS_TOP } from "./matchFocus.ts";

test("matchFocusTarget: a summary's `for` scrolls to that listing's group", () => {
  const groups = [
    { id: "parcel-a", matchIds: ["t1"] },
    { id: "parcel-b", matchIds: ["t2", "t3"] },
  ];
  assert.equal(matchFocusTarget({ activeTab: "package", highlightId: undefined, forId: "parcel-b", groups, flatIds: [] }), "parcel-b");
  // single match: the group holding the card (the 21 Oct screenshot case)
  assert.equal(matchFocusTarget({ activeTab: "package", highlightId: "t1", forId: undefined, groups, flatIds: [] }), "parcel-a");
  // for wins over inference; unknown listing / match -> nothing to scroll to
  assert.equal(matchFocusTarget({ activeTab: "receiver", highlightId: "t1", forId: "parcel-b", groups, flatIds: [] }), "parcel-b");
  assert.equal(matchFocusTarget({ activeTab: "package", highlightId: "zz", forId: "nope", groups, flatIds: [] }), null);
  assert.equal(matchFocusTarget({ activeTab: "package", highlightId: undefined, forId: undefined, groups, flatIds: [] }), null);
});

test("matchFocusTarget: flat lists and the buddy tab target the card", () => {
  assert.equal(matchFocusTarget({ activeTab: "package", highlightId: "t2", forId: "p", groups: null, flatIds: ["t1", "t2"] }), "t2");
  assert.equal(matchFocusTarget({ activeTab: "buddy", highlightId: "b2", forId: "mine", groups: null, flatIds: ["b1", "b2"] }), "b2");
  assert.equal(matchFocusTarget({ activeTab: "buddy", highlightId: undefined, forId: "mine", groups: null, flatIds: ["b1"] }), RESULTS_TOP);
  assert.equal(matchFocusTarget({ activeTab: "buddy", highlightId: undefined, forId: "mine", groups: null, flatIds: [] }), null);
});
