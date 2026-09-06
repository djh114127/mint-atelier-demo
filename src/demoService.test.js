import assert from "node:assert/strict";
import test from "node:test";

import {
  requestDemoCoverImage,
  requestDemoDecision,
  requestDemoGeneration,
  requestDemoSearch,
} from "./demoService.js";

test("demo workflow returns a complete keyless content set", async () => {
  const search = await requestDemoSearch({ keyword: "夏日通勤穿搭" });
  assert.equal(search.items.length, 6);
  assert.match(search.items[0].source, /演示样例/);

  const decision = await requestDemoDecision({ decisionKind: "rag", options: search.items });
  assert.equal(decision.selectedIds.length, 3);

  const topics = await requestDemoGeneration({ kind: "topics", keyword: "夏日通勤穿搭" });
  assert.equal(topics.items.length, 10);

  const drafts = await requestDemoGeneration({ kind: "drafts", selectedTopic: topics.items[0] });
  assert.equal(drafts.items.length, 5);
  assert.match(drafts.items[0].body, /#.+?\[话题\]#/);

  const prompts = await requestDemoGeneration({ kind: "coverPrompts", selectedDraft: drafts.items[0] });
  assert.equal(prompts.items.length, 5);
  assert.match(prompts.items[0].prompt, /排除真人/);

  const cover = await requestDemoCoverImage({ selectedPrompt: prompts.items[0] });
  assert.equal(cover.image.src, "/assets/spring-outfit.jpg");
});
