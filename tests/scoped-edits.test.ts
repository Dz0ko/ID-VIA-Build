import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyFileEdits,editFileContext,parseReadFiles} from '../src/lib/ai/file-edits';
import {applyHtmlEdits} from '../src/lib/ai/html-edits';
import {imageContext} from '../src/lib/ai/image-context';
import {requestsProjectReplacement} from '../src/lib/ai/request-intent';
import {BINARY_PREFIX} from '../src/lib/file-content';
const block=(ops:unknown)=>`<<<FILE_EDITS>>>${JSON.stringify(ops)}<<<END FILE_EDITS>>>`;
const source=[{path:'/src/Header.tsx',content:'export default () => <header><img src="/logo.svg"/>Old headline</header>'},{path:'/api/app.py',content:'SECRET_FROM_ENV = os.environ["SECRET"]'},{path:'/public/photo.png',content:BINARY_PREFIX+'AAAA'},{path:'/public/logo.svg',content:'<svg><text>Old logo</text></svg>'}];
const readable=new Set(source.map(f=>f.path));
test('editing one file preserves every other source and binary byte',()=>{
 const next=applyFileEdits(block([{op:'edit',path:'/src/Header.tsx',edits:[{search:'Old headline',replace:'New headline'}]}]),source,readable);
 assert.equal(next[0].content,source[0].content.replace('Old headline','New headline'));assert.deepEqual(next.slice(1),source.slice(1));
});
test('edits can add and wire a component without replacing the project',()=>{
 const next=applyFileEdits(block([{op:'edit',path:'/src/Header.tsx',edits:[{search:'Old headline',replace:'New headline <span>Welcome</span>'}]},{op:'create',path:'/src/Badge.tsx',content:'export default () => <span>New</span>'}]),source,readable);
 assert.equal(next.length,5);assert.equal(next[1].content,source[1].content);
});
test('invalid operations cannot silently lose files or escape the project',()=>{
 for(const op of [{op:'create',path:'/src/Header.tsx',content:'Overwrite'},{op:'edit',path:'/missing.ts',edits:[{search:'x',replace:'y'}]},{op:'delete',path:'/api/app.py'},{op:'create',path:'../../etc/passwd',content:'bad'},{op:'edit',path:'/public/photo.png',edits:[{search:'AAAA',replace:'BBBB'}]},{op:'edit',path:'/src/Header.tsx',edits:[{search:'missing',replace:'new'}]}])assert.throws(()=>applyFileEdits(block([op]),source,readable));
 assert.throws(()=>applyFileEdits(block([{op:'edit',path:'/src/Header.tsx',edits:[{search:'Old',replace:'New'}]}]),source,new Set()));
 assert.throws(()=>applyFileEdits(block([{op:'create',path:'/new.ts',content:'a'},{op:'create',path:'new.ts',content:'b'}]),source,readable));
 assert.equal(source[0].content.includes('Old headline'),true);
});
test('whole-project replacement requires explicit scope, not a logo, navbar or question',()=>{
 for(const r of ['replace the logo','redesign the navbar','rewrite the headline','make the site look better','do not rebuild the website, just change the logo'])assert.equal(requestsProjectReplacement(r),false,r);
 for(const r of ['Rebuild the whole website','replace the project with a makeup marketplace','Start over from scratch','смени го целиот сајт'])assert.equal(requestsProjectReplacement(r),true,r);
});
test('large projects expose an index and retrieve only requested complete source files',()=>{
 const files=[...source,...Array.from({length:10},(_,i)=>({path:`/large-${i}.txt`,content:'a'.repeat(90000)}))];
 const first=editFileContext(files,'change the logo in Header');
 assert.ok(first.text.includes('/large-9.txt'));assert.ok(first.selected.some(f=>f.path==='/src/Header.tsx'));assert.ok(first.selected.reduce((n,f)=>n+f.content.length,0)<=180000);
 const read=editFileContext(files,'change text',['/large-9.txt']);assert.equal(read.selected.length,1);assert.equal(read.selected[0].content.length,90000);
 assert.deepEqual(parseReadFiles('<<<READ_FILES>>>["src/Header.tsx"]<<<END READ_FILES>>>'),['/src/Header.tsx']);
 assert.throws(()=>parseReadFiles('<<<READ_FILES>>>["../../secret"]<<<END READ_FILES>>>'));
 assert.throws(()=>editFileContext(files,'change',['/not-in-project.txt']));
});
test('images persist as exact bytes without putting base64 into the next model prompt',()=>{
 const images=imageContext([{mediaType:'image/png',data:'aGVsbG8='}]);
 const token=images.instructions.match(/__IDAEVIA_IMAGE_[a-f0-9]+__/)![0];
 const html=`<!doctype html><html><body><img src="old.png"><h1>Keep me</h1></body></html>`;
 const edited=applyHtmlEdits(`<<<HTML_EDITS>>>${JSON.stringify([{search:'src="old.png"',replace:`src="${token}"`}])}<<<END HTML_EDITS>>>`,html);
 const restored=images.restore(edited);assert.ok(restored.includes('data:image/png;base64,aGVsbG8='));assert.ok(restored.includes('<h1>Keep me</h1>'));
 const next=imageContext();const compact=next.compact(restored);assert.ok(!compact.includes('aGVsbG8='));assert.equal(next.restore(compact),restored);
 assert.throws(()=>next.restore('__IDAEVIA_IMAGE_unknown__'));
});
test('a whole-document edit disguised as a patch is rejected',()=>{
 const html='<!doctype html><html><body>'+('original '.repeat(400))+'</body></html>';
 assert.throws(()=>applyHtmlEdits(`<<<HTML_EDITS>>>${JSON.stringify([{search:html,replace:html.replace('original','unrelated')}])}<<<END HTML_EDITS>>>`,html));
});
