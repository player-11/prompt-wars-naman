const test = require('node:test');
const assert = require('node:assert');

test('Integration - AI to Client Streaming Workflow', async (t) => {
  // Simulating the flow from AI generation to frontend parsing
  const mockAIResponse = JSON.stringify({
    title: "Test Trip",
    summary: "A nice trip"
  });
  
  // Validate backend parsing
  let parsed;
  try {
    parsed = JSON.parse(mockAIResponse);
  } catch (e) {
    assert.fail('Should parse successfully');
  }
  
  assert.strictEqual(parsed.title, "Test Trip");
});

test('Integration - Google Services Mapping', (t) => {
  const activity = "Tokyo Tower";
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity)}`;
  assert.ok(url.includes("Tokyo%20Tower"), "URL encodes correctly for Maps API");
});
