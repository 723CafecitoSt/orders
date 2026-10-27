// Totals are always tax-exclusive. Prices and tax rates come only from server catalog.
const int = n => Number.isSafeInteger(n)&&n>=0;
export function priceOrder(request,catalog){
 if(!Array.isArray(request?.items)||request.items.length===0||request.items.length>100)throw Error('Invalid items');
 let bases={0:0,725:0,825:0},subtotal=0,items=[];
 for(const line of request.items){
  let product=catalog.products.find(p=>p.id===line.productId&&p.active);if(!product||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>99)throw Error('Invalid product or quantity');
  let bps=String(product.taxBps);if(!['0','725','825'].includes(bps)||!int(product.baseCents))throw Error('Invalid server price or rate');
  if(line.temperature!==undefined&&!['Hot','Iced'].includes(line.temperature))throw Error('Invalid temperature');
  let base=line.temperature==='Iced'&&product.icedCents!=null?product.icedCents:product.baseCents;if(!int(base))throw Error('Invalid price');
  let chosen=line.modifierIds||[];if(!Array.isArray(chosen)||new Set(chosen).size!==chosen.length)throw Error('Duplicate modifiers');
  let assigned=catalog.groups.filter(g=>(product.groupIds||[]).includes(g.id)&&g.active);let mods=[];
  for(let id of chosen){let group=assigned.find(g=>g.options.some(o=>o.id===id&&o.active));if(!group)throw Error('Invalid modifier');}
  for(const group of assigned){let options=chosen.map(id=>group.options.find(o=>o.id===id&&o.active)).filter(Boolean);if(options.length<(group.min||0)||(group.max&&options.length>group.max))throw Error('Invalid modifier count');options.forEach((o,i)=>{if(!int(o.priceCents)||typeof o.taxable!=='boolean')throw Error('Invalid modifier price');mods.push({id:o.id,name:o.name,priceCents:i<(group.included||0)?0:o.priceCents,taxable:o.taxable})});}
  let unit=base+mods.reduce((n,m)=>n+m.priceCents,0),taxable=base+mods.reduce((n,m)=>n+(m.taxable?m.priceCents:0),0);subtotal+=unit*line.quantity;bases[bps]+=taxable*line.quantity;if(!int(subtotal)||!int(bases[bps]))throw Error('Amount too large');items.push({productId:product.id,name:product.name,quantity:line.quantity,baseCents:base,taxBps:Number(bps),modifiers:mods,unitCents:unit});
 }
 let taxes=Object.fromEntries(Object.entries(bases).map(([bps,amount])=>{let t=(BigInt(amount)*BigInt(bps)+5000n)/10000n;if(t>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Tax too large');return [bps,Number(t)]}));let tax=Object.values(taxes).reduce((a,b)=>a+b,0),total=subtotal+tax;if(!int(total))throw Error('Amount too large');return {items,subtotalCents:subtotal,taxableBases:bases,taxes,taxCents:tax,totalCents:total};
}
