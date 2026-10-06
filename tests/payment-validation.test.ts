// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { assertPaymentMatches,paymentReference,positiveInteger,safeReturnPath,verifySignature,type CheckoutIntent } from '../supabase/functions/_shared/payment-validation';
const intent: CheckoutIntent = { reference: 'fictional-reference', employer_id:'fictional-employer', kind:'addon',amount_minor:1000,currency:'ZAR',plan_name:null,addon_id:'fictional-addon',credit_type:'ai_credit',credits:2,created_at:'2026-01-01' };
const transaction = { status:'success', reference:intent.reference,amount:1000,currency:'ZAR',metadata:{employerId:intent.employer_id,addonId:intent.addon_id} };
describe('payment trust boundary', () => {
  it('accepts the exact verified intent', () => { expect(() => assertPaymentMatches(intent,transaction,intent.employer_id)).not.toThrow(); });
  it.each([{amount:1},{currency:'USD'},{status:'failed'},{reference:'other'},{metadata:{employerId:'attacker',addonId:intent.addon_id}}])('rejects mismatched provider data %j', change => {
    expect(() => assertPaymentMatches(intent,{...transaction,...change})).toThrow();
  });
  it('rejects a different workspace even with a successful transaction', () => { expect(() => assertPaymentMatches(intent,transaction,'attacker')).toThrow(); });
  it('validates raw-body signatures and rejects altered payloads', async () => {
    const body='{"event":"charge.success"}', key='fictional-test-secret';
    const signature=createHmac('sha512',key).update(body).digest('hex');
    expect(await verifySignature(body,signature,key)).toBe(true);
    expect(await verifySignature(body+' ',signature,key)).toBe(false);
    expect(await verifySignature(body,null,key)).toBe(false);
    expect(await verifySignature(body,'invalid',key)).toBe(false);
  });
  it('rejects unsafe references, amounts and external return URLs', () => {
    expect(() => paymentReference('../admin')).toThrow(); expect(() => positiveInteger(-1)).toThrow(); expect(() => positiveInteger(1.2)).toThrow();
    expect(safeReturnPath('//attacker.example')).toBe('/employer/addons'); expect(safeReturnPath('/\\attacker')).toBe('/employer/addons');
    expect(safeReturnPath('/employer/billing')).toBe('/employer/billing');
  });
});
