import {loadCatalog} from '../src/catalog-d1.mjs';
import {priceOrder} from '../src/pricing.mjs';
// Local disposable fixture, never import into a deployable Worker.
import {createStaff} from '../src/auth.mjs';
export async function uiFixture(db){
 const id='staff_fixture',username='local_fixture';
 if(!(await db.prepare('SELECT id FROM employees WHERE id=?').bind(id).first()))await createStaff(db,{id,username,password:'test-password-123',role:'admin'});
 if(!(await db.prepare('SELECT id FROM employees WHERE id=?').bind('staff_blocked').first()))await createStaff(db,{id:'staff_blocked',username:'fixture_blocked',password:'test-password-123',role:'cashier'});
 await db.prepare("INSERT OR IGNORE INTO products(id,name,base_cents,iced_cents,tax_bps,active) VALUES('default1','Latte',700,700,825,1),('default15','Waffle',800,NULL,825,1)").run();
 const groups=[['coffee-flavors','Coffee flavors',0,0,['Pistachio','Coconut','Caramel','Pumpkin Spice','Vanilla','Zero Sugar Vanilla'],100],['milk','Milk',1,0,['Regular','Oat Milk'],0],['temperature','Temperature',1,0,['Hot','Iced'],0],['extras','Extras',0,0,['Extra shot','Decaf','No ice','Light ice','No foam','Extra foam'],0],['waffle-toppings','Waffle toppings',0,1,['Banana','Nutella','Lechera','Peanut Butter','Chocolate','Maple Syrup','Honey'],100]];
 for(let [gid,name,max,included,names,price] of groups){await db.prepare('INSERT OR IGNORE INTO modifier_groups(id,name,min_selected,max_selected,included_count,active) VALUES(?,?,0,?,?,1)').bind(gid,name,max,included).run();for(let i=0;i<names.length;i++)await db.prepare('INSERT OR IGNORE INTO modifiers(id,group_id,name,price_cents,taxable,active) VALUES(?,?,?,?,1,1)').bind(gid+'-'+i,gid,names[i],gid==='extras'&&i===0?150:price).run();await db.prepare('INSERT OR IGNORE INTO product_groups(product_id,group_id) VALUES(?,?)').bind(gid==='waffle-toppings'?'default15':'default1',gid).run()}
 for(let [prod,station] of [['default1','beverages'],['default15','food']])await db.prepare('INSERT OR IGNORE INTO product_stations(product_id,station,updated_by,updated_at) VALUES(?,?,?,?)').bind(prod,station,id,Date.now()).run();
 return {username,password:'test-password-123',products:['default1','default15']};
}

export async function bulkKitchenFixture(db){const employee=await db.prepare("SELECT id FROM employees WHERE username='local_fixture'").first();if(!employee)throw Error('Initialize fixture first');let catalog=await loadCatalog(db),snapshot=priceOrder({items:[{productId:'default1',quantity:1,temperature:'Iced',modifierIds:['milk-0','temperature-1']}]},catalog),prefix='bulk_'+crypto.randomUUID().replaceAll('-',''),ids=Array.from({length:505},(_,i)=>prefix+'_'+i);await db.prepare('INSERT INTO orders(id,employee_id,snapshot_json,subtotal_cents,tax_cents,total_cents,created_at,request_fingerprint) SELECT value,?,?,?,?,?,?,NULL FROM json_each(?)').bind(employee.id,JSON.stringify(snapshot),snapshot.subtotalCents,snapshot.taxCents,snapshot.totalCents,Date.now(),JSON.stringify(ids)).run();return {count:ids.length};}
