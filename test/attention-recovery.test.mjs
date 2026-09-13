import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryAttentionDecision, reconcilePublication, supervisorDecision} from '../src/project-os.mjs';

test('long-running tools and private subagents never authorize attention',()=>{
  for (const candidate of [{toolDuration:300},{missingView:true},{privateSubagent:true}]) {
    for(let i=0;i<20;i++) assert.deepEqual(recoveryAttentionDecision(candidate),{navigate:false,notify:false});
  }
  assert.deepEqual(recoveryAttentionDecision({verifiedApproval:true}),{navigate:false,notify:true});
  assert.deepEqual(recoveryAttentionDecision({userRequestedOpen:true}),{navigate:true,notify:false});
});

test('busy publication retains its receipt and reconciles before a single delivery',()=>{
  const receipt={key:'fictional-incident',state:'prepared',canonicalTaskId:'issue:example',turnId:'example-turn'};
  const before=structuredClone(receipt);
  const absent={state:'absent',canonicalTaskId:receipt.canonicalTaskId,turnId:receipt.turnId};
  for(let i=0;i<4;i++) assert.equal(reconcilePublication(receipt,absent,{writerBusy:true}).action,'defer');
  assert.deepEqual(receipt,before);
  assert.equal(reconcilePublication(receipt,{state:'indeterminate'},{writerBusy:true}).action,'stop');
  assert.equal(reconcilePublication(receipt,absent,{writerBusy:false}).action,'publish');
  assert.equal(reconcilePublication(receipt,{state:'present',canonicalTaskId:receipt.canonicalTaskId,turnId:receipt.turnId}).action,'none');
  assert.equal(supervisorDecision({healthy:true,previousEscalationKey:receipt.key}).escalate,false);
});
