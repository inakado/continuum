import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentAnswer, PublicAssessmentItem, StudentAnswerKey, StudentWorkDetail } from '@continuum/shared';
import StudentWorkQuestions from './StudentWorkQuestions';

const id='00000000-0000-4000-8000-000000000001';
const base={id,title:'Физика',statement:'Условие задачи',images:{},maxPoints:2};
const options=[{id:'one',content:'Первый'},{id:'two',content:'Второй'},{id:'three',content:'Третий'}];
const examples: {item:PublicAssessmentItem;key:StudentAnswerKey;answer:AssessmentAnswer;expected:string}[]=[
  {item:{...base,type:'short_number',unit:'м/с²'},key:{type:'short_number',value:'-12.5'},answer:{type:'short_number',value:'-2'},expected:'−12,5 м/с²'},
  {item:{...base,type:'short_text'},key:{type:'short_text',value:'ускорение'},answer:{type:'short_text',value:'сила'},expected:'ускорение'},
  {item:{...base,type:'single_choice',options},key:{type:'single_choice',optionId:'two'},answer:{type:'single_choice',optionId:'three'},expected:'2'},
  {item:{...base,type:'multiple_choice',options},key:{type:'multiple_choice',optionIds:['two','one']},answer:{type:'multiple_choice',optionIds:['one','three']},expected:'1, 2'},
  {item:{...base,type:'matching',options,rows:[{id:'a',content:'Скорость'},{id:'b',content:'Ускорение'}]},key:{type:'matching',matches:{a:'one',b:'two'}},answer:{type:'matching',matches:{a:'one',b:'one'}},expected:'А — 1, Б — 2'},
];
afterEach(()=>{cleanup();vi.restoreAllMocks();sessionStorage.clear();});
function show(example:typeof examples[number], status:'completed'|'in_progress'='completed',points=1, answer:AssessmentAnswer|undefined=example.answer){
  const work:StudentWorkDetail={id,title:'Работа',taskCount:1,versionNumber:1,assignedAt:'2026-10-31T00:00:00Z',startedAt:'2026-10-31T00:01:00Z',completedAt:status==='completed'?'2026-10-31T00:02:00Z':null,revision:3,status,answeredCount:1,result:null,instructions:'',items:[example.item],answers:answer?{[id]:answer}:{},taskResults:{[id]:{points,maxPoints:2}},answerKeys:{[id]:example.key}};
  return render(<StudentWorkQuestions work={work} answers={work.answers} disabled={false} automaticCompleted={status==='completed'} onChange={vi.fn()}/>);
}
it.each(examples)('keeps the saved response and displays the canonical answer for $item.type', example=>{
  show(example);
  const feedback=screen.getByRole('group',{name:'Результат задания 1'});
  expect(feedback).toHaveTextContent('Частично верно');
  expect(feedback).toHaveTextContent(example.expected);
  expect(within(feedback).getByLabelText('1 из 2 баллов')).toBeVisible();
  if(example.answer.type==='short_number'||example.answer.type==='short_text'){
    expect(screen.getByRole('textbox')).toHaveValue(example.answer.value);expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  }
  if(example.answer.type==='single_choice')expect(screen.getByLabelText('Вариант 3: Физика')).toBeChecked();
  if(example.answer.type==='multiple_choice'){
    expect(screen.getByLabelText('Вариант 1: Физика')).toBeChecked();expect(screen.getByLabelText('Вариант 3: Физика')).toBeChecked();
    expect(screen.getAllByRole('img',{name:'Верный вариант'})).toHaveLength(2);
    expect(screen.getByRole('img',{name:'Неверный вариант'})).toBeVisible();
  }
  if(example.answer.type==='matching')expect(screen.getAllByRole('combobox').map(input=>(input as HTMLSelectElement).value)).toEqual(['one','one']);
});
it.each(examples)('does not reveal $item.type keys or option markers before completion',example=>{
  show(example,'in_progress');
  expect(screen.queryByRole('group',{name:'Результат задания 1'})).not.toBeInTheDocument();
  expect(screen.queryByRole('img',{name:'Верный вариант'})).not.toBeInTheDocument();
  expect(screen.queryByText('Правильный ответ')).not.toBeInTheDocument();
});
it('does not repeat an equivalent numeric key when the server awards full points',()=>{
  show(examples[0],'completed',2,{type:'short_number',value:'-12,50'});
  expect(screen.getByRole('textbox')).toHaveValue('-12,50');expect(screen.getByText('Верно')).toBeVisible();
  expect(screen.queryByText('Правильный ответ')).not.toBeInTheDocument();
});
it('distinguishes an empty saved value from an incorrect answer',()=>{
  show(examples[0],'completed',0,{type:'short_number',value:'  '});
  expect(screen.getByText('Нет ответа')).toBeVisible();expect(screen.getByText('Правильный ответ')).toBeVisible();
});
it('wraps long text keys as plain text without interpreting HTML',()=>{
  const text='<img src=x onerror=alert(1)> '+ 'Текст '.repeat(150);
  show({...examples[1],key:{type:'short_text',value:text}});
  expect(screen.getByRole('group',{name:'Результат задания 1'})).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img[src="x"]')).toBeNull();
});
