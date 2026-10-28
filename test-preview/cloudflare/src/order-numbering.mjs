const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/Ciudad_Juarez',year:'numeric',month:'2-digit',day:'2-digit'});
export function businessDateAt(now){if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid server timestamp');const p=Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`}
// The global sequence remains the stable pagination cursor; only the display number resets.
export const DISPLAY_NUMBER_SQL='COALESCE(d.daily_number,n.number)';
export const DAILY_JOIN_SQL=' LEFT JOIN business_order_numbers d ON d.order_id=n.order_id ';
export async function legacyDailyFloor(db,day,now){if(await db.prepare('SELECT business_date FROM daily_order_counters WHERE business_date=?').bind(day).first())return 0;
 const rows=await db.prepare('SELECT n.number,o.created_at FROM order_numbers n JOIN orders o ON o.id=n.order_id LEFT JOIN business_order_numbers d ON d.order_id=o.id WHERE d.order_id IS NULL AND o.created_at BETWEEN ? AND ?').bind(Math.max(0,now-172800000),now+172800000).all();return rows.results.filter(r=>businessDateAt(r.created_at)===day).reduce((max,r)=>Math.max(max,r.number),0);
}
