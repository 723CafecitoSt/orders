// Payload preparation only. This module never performs network requests or records payments.
// Enable network integration only after review of authentication, reconciliation and deployment.
const money = amount => ({amount, currency:'USD'});
const cents = n => Number.isSafeInteger(n) && n >= 0;
const key = s => typeof s === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(s);
function validate(snapshot, operationId, locationId) {
 if (!key(operationId) || typeof locationId !== 'string' || !locationId.trim() || !snapshot || !Array.isArray(snapshot.items) || !snapshot.items.length || !cents(snapshot.totalCents) || snapshot.totalCents === 0) throw Error('Invalid sandbox operation');
}
export function buildSandboxOrder(snapshot, operationId, locationId) {
 validate(snapshot, operationId, locationId);
 const taxes = [{uid:'tax725',name:'Sales Tax 7.25%',percentage:'7.25',scope:'LINE_ITEM',type:'ADDITIVE'}, {uid:'tax825',name:'Sales Tax 8.25%',percentage:'8.25',scope:'LINE_ITEM',type:'ADDITIVE'}];
 const line_items = snapshot.items.map(i => {
  if (typeof i.name !== 'string' || !i.name.trim() || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 99 || !cents(i.baseCents) || ![0,725,825].includes(i.taxBps) || !Array.isArray(i.modifiers)) throw Error('Invalid item');
  const modifiers = i.modifiers.map(m => {
   if (typeof m.name !== 'string' || !m.name.trim() || !cents(m.priceCents) || typeof m.taxable !== 'boolean') throw Error('Invalid modifier');
   // Square line-level taxes cannot express mixed taxable status on a modifier.
   if (i.taxBps && !m.taxable && m.priceCents) throw Error('Mixed taxable modifier requires review');
   return {name:m.name,base_price_money:money(m.priceCents)};
  });
  return {name:i.name,quantity:String(i.quantity),base_price_money:money(i.baseCents),modifiers,...(i.taxBps ? {applied_taxes:[{tax_uid:'tax'+i.taxBps}]} : {})};
 });
 return {idempotency_key:operationId+'-order',order:{location_id:locationId,line_items,taxes,reference_id:operationId,pricing_options:{auto_apply_taxes:false,auto_apply_discounts:false}}};
}
export function buildSandboxCash(snapshot,operationId,locationId,squareOrder,receivedCents) {
 validate(snapshot,operationId,locationId);
 if (!squareOrder?.id || squareOrder.location_id !== locationId || squareOrder.total_money?.currency !== 'USD' || squareOrder.total_money.amount !== snapshot.totalCents) throw Error('Square order total or location mismatch');
 if (!cents(receivedCents) || receivedCents < snapshot.totalCents) throw Error('Insufficient cash');
 return {idempotency_key:operationId+'-payment',source_id:'CASH',amount_money:money(snapshot.totalCents),location_id:locationId,order_id:squareOrder.id,cash_details:{buyer_supplied_money:money(receivedCents)},autocomplete:false};
}
export function buildSandboxPayOrder(snapshot,operationId,locationId,squareOrder,payment) {
 validate(snapshot,operationId,locationId);
 if (!squareOrder?.id || squareOrder.location_id !== locationId || squareOrder.total_money?.currency !== 'USD' || squareOrder.total_money.amount !== snapshot.totalCents || !payment?.id || payment.status !== 'APPROVED' || payment.source_type !== 'CASH' || payment.order_id !== squareOrder.id || payment.location_id !== locationId || payment.amount_money?.currency !== 'USD' || payment.amount_money.amount !== snapshot.totalCents) throw Error('Payment requires reconciliation');
 return {idempotency_key:operationId+'-payorder',payment_ids:[payment.id]};
}
export function verifiedSandboxCompletion(snapshot, locationId, order, payment) {
 return Boolean(order?.id && order.location_id === locationId && order.state === 'COMPLETED' && order.total_money?.currency === 'USD' && order.total_money.amount === snapshot.totalCents && payment?.id && payment.status === 'COMPLETED' && payment.source_type === 'CASH' && payment.order_id === order.id && payment.location_id === locationId && payment.amount_money?.currency === 'USD' && payment.amount_money.amount === snapshot.totalCents);
}
