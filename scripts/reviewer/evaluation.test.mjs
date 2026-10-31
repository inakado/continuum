import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReview, bindReview, statementHash } from './evaluation.mjs';
import { texMarkdown, safeMath } from './render-review.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const finding = state => ({ state, evidence: 'Фото 1, строки решения', comment: 'Проверяемая запись' });
const review = { version:1,rubricId:'ege-physics-calculation-2-2026',solutionId:id,sourceRevision:1,referenceId:'test',statementSha256:statementHash('Условие 20 м'),readable:true,summary:'Итог',transcription:'Решение',advice:[],findings:Object.fromEntries(['laws','notation','math','answer','relevance','progress'].map(key=>[key,finding('met')])) };
function score(changes={},readable=true){return evaluateReview({...review,readable,findings:{...review.findings,...Object.fromEntries(Object.entries(changes).map(([key,state])=>[key,finding(state)]))}});}
test('FIPI 2026 examples: full solution and standard notation 2; p64 1.3 / p67 2.3 missing calculations 1; p64 1.4 wrong law 0',()=>{
 assert.equal(score().points,2);
 assert.equal(score({math:'not_met',relevance:'not_met'}).points,1);
 assert.equal(score({math:'not_met'}).points,1);
 assert.equal(score({laws:'not_met'}).points,0);
 assert.equal(score({notation:'not_met'}).points,1);
});
test('wrong final answer needs progress; answer alone does not replace missing physics; unreadable is null',()=>{
 assert.equal(score({answer:'not_met',progress:'met',math:'not_met'}).points,1);
 assert.equal(score({answer:'not_met',progress:'not_met',math:'not_met'}).points,0);
 assert.equal(score({laws:'not_met',progress:'not_met'}).points,0);
 assert.equal(score({laws:'uncertain'}).points,null);
 assert.equal(score({},false).points,null);
});
test('a stale photo revision, different task statement, source or maximum cannot reuse the review',()=>{
 const source={id,sourceRevision:1,statement:'Условие 20 м',maxPoints:2,source:'Школково №1'};
 const references=[{id:'test',statementSha256:review.statementSha256,maxPoints:2,source:source.source}];
 assert.equal(bindReview(review,source,references).decision.points,2);
 for(const patch of [{sourceRevision:2},{statement:'Условие 30 м'},{maxPoints:3},{source:'Другой источник'}])assert.throws(()=>bindReview(review,{...source,...patch},references),/не совпадают/);
});
test('TeX report blocks raw content, file reads, links and control-sequence bypasses',()=>{
 assert.match(texMarkdown('Значение $v_0=20\\ \\text{м/с}$.'),/v_0=20/);
 assert.match(texMarkdown('A & B_1'),/A \\& B\\_1/);
 for(const value of ['\\input{/etc/passwd}','\\write18{cmd}','^^5cinput{x}','a%comment','\\csname input\\endcsname'])assert.throws(()=>safeMath(value));
 assert.throws(()=>texMarkdown('![Фото](images/photo.png)'));
 assert.throws(()=>texMarkdown('[Ссылка](https://example.test)'));
});
test('all eight curated kinematics references are bound to their actual statement and render safely',async()=>{
 const {readFile}=await import('node:fs/promises');
 const references=JSON.parse(await readFile(new URL('./references/kinematics-v1.json',import.meta.url),'utf8'));
 assert.equal(references.length,8);
 assert.deepEqual(references.map(item=>item.number),[23,24,25,26,27,28,29,30]);
 for(const item of references){assert.equal(item.maxPoints,2);assert.equal(statementHash(item.statement),item.statementSha256);assert.doesNotThrow(()=>texMarkdown(item.solution));}
});
