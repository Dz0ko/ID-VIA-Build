import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConversationRequest, extractAnswer } from '../src/lib/ai/conversation';
test('questions and follow-ups are separate from requested changes', () => {
  for (const p of ['what i need to do to push this project to github ?', 'How do I connect React to a database?', 'kako da povrzam github', 'зошто не работи?', 'Explain step 2', 'and then?', 'What is a modern navbar?', 'thanks']) assert.equal(isConversationRequest(p), true, p);
  for (const p of ['Build a modern navbar', 'Can you build a React website?', 'Please add a FAQ section', 'napravi mi web', 'додади мени', 'Fix the button']) assert.equal(isConversationRequest(p), false, p);
});
test('only an explicit answer envelope bypasses code application', () => {
  assert.equal(extractAnswer('<<<ANSWER>>>\nRun `git push`.\n<<<END_ANSWER>>>'), 'Run `git push`.');
  assert.equal(extractAnswer('<html><body>hello</body></html>'), null);
  assert.equal(extractAnswer('<<<FILE /App.tsx>>>code<<<END>>>'), null);
});

test('polite edit requests and image changes remain edits even with a question mark',()=>{
 for(const p of ['Can you replace only the logo?','Could you edit this headline?','Can you also please change the logo?','Could you help me add a navbar?','I want to change only the button text','Use the attached image as my logo?','dali mozes da go smenis logoto?','можеш ли да го смениш логото?'])assert.equal(isConversationRequest(p),false,p);
 for(const p of ['How can I change the logo?','Can you explain how to edit the headline?','What does this logo mean?'])assert.equal(isConversationRequest(p),true,p);
});
