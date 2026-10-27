// Server-only verification building block. Caller must load `expected` from durable,
// authenticated server state created before the Square POS launch, never from a callback.
export async function verifySandboxCard({expected,serverTransactionId,accessToken,fetchImpl=fetch,environment='sandbox'}){
 if(environment!=='sandbox')throw Error('Production is disabled');
 if(!expected||!expected.locationId||!Number.isSafeInteger(expected.amountCents)||expected.amountCents<=0||!serverTransactionId||!accessToken)return {status:'review'};
 async function get(path){const r=await fetchImpl('https://connect.squareupsandbox.com/v2/'+path,{headers:{Authorization:'Bearer '+accessToken,'Square-Version':'2026-09-16'}});if(!r.ok)throw Error('Square lookup failed');return r.json()}
 try{const {order}=await get('orders/'+encodeURIComponent(serverTransactionId));if(!order||order.id!==serverTransactionId||order.location_id!==expected.locationId||!Array.isArray(order.tenders)||order.tenders.length!==1||!order.tenders[0].payment_id)return {status:'review'};const {payment}=await get('payments/'+encodeURIComponent(order.tenders[0].payment_id));if(!payment||payment.status!=='COMPLETED'||payment.source_type!=='CARD'||payment.order_id!==order.id||payment.location_id!==expected.locationId||payment.amount_money?.currency!=='USD'||payment.amount_money?.amount!==expected.amountCents||payment.id!==order.tenders[0].payment_id)return {status:'review'};return {status:'verified_match',paymentId:payment.id,orderId:order.id};}catch{return {status:'uncertain'}}
}
