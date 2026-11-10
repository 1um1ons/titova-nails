const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DB = path.join(__dirname, 'bookings.json');
function readBookings(){try{return JSON.parse(fs.readFileSync(DB,'utf8'));}catch{return [];}}
function writeBookings(items){fs.writeFileSync(DB,JSON.stringify(items,null,2));}
function slotsFor(date){const day=new Date(date+'T12:00:00').getDay();if(day===0||day===6)return Array.from({length:8},(_,i)=>String(10+i).padStart(2,'0')+':00');if(day===3)return ['16:00','19:00'];return ['09:00','18:30'];}
async function telegram(text){if(!BOT_TOKEN||!CHAT_ID)throw new Error('Telegram не настроен: добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env');const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:CHAT_ID,text, disable_web_page_preview:true})});const data=await r.json();if(!data.ok)throw new Error(data.description||'Ошибка Telegram');}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&url.pathname==='/api/availability'){
    const date=url.searchParams.get('date');if(!date){res.writeHead(400);return res.end(JSON.stringify({error:'Укажите дату'}));}
    const taken=readBookings().filter(x=>x.date===date).map(x=>x.time);
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({slots:slotsFor(date).map(time=>({time,available:!taken.includes(time)}))}));
  }
  if(req.method==='POST'&&url.pathname==='/api/book'){
    let body='';for await(const chunk of req)body+=chunk;let b;try{b=JSON.parse(body);}catch{res.writeHead(400);return res.end(JSON.stringify({error:'Некорректные данные'}));}
    if(!b.date||!b.time||!b.service||!b.name||!b.phone||!slotsFor(b.date).includes(b.time)){res.writeHead(400);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'Проверьте заполнение формы и выбранное время.'}));}
    const bookings=readBookings();if(bookings.some(x=>x.date===b.date&&x.time===b.time)){res.writeHead(409,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Это окошко уже заняли. Выберите другое время.'}));}
    const item={...b,createdAt:new Date().toISOString()};bookings.push(item);writeBookings(bookings);
    const msg=`💅 НОВАЯ ЗАПИСЬ — TITOVA NAILS\n\nДата: ${b.date}\nВремя: ${b.time}\nУслуга: ${b.service}\nИмя: ${b.name}\nТелефон: ${b.phone}\n\nОтветьте клиенту для подтверждения записи.`;
    try{await telegram(msg);}catch(e){console.error(e.message);}
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({message:'Заявка принята! Я свяжусь с тобой для подтверждения.'}));
  }
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);}
  res.writeHead(404);res.end('Not found');
});
server.listen(PORT,()=>console.log(`TITOVA NAILS запущен: http://localhost:${PORT}`));
