let STATE=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const defaults={projects:[],videos:[],images:[],restorations:[],reviews:[],leads:[],ideas:[],campaigns:[],settings:{whatsapp:'5521989784737',phone:'(21) 98978-4737',location:'Todos os Santos\nRio de Janeiro — RJ',socialLabel:'Frame X Studio',instagramPersonal:'https://instagram.com/eucaiocavalcante',instagramFrameX:'',heroTitle:'Ideias que viram experiências digitais.',heroText:'Sites, Inteligência Artificial, conteúdo e soluções digitais criadas com estratégia, tecnologia e atenção aos detalhes.'}};
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function normalizeItem(x,i){const previewMode=x.previewMode==='auto'?'live':(x.previewMode||'live');return {...x,previewMode,ratio:x.ratio||'vertical',published:x.published!==false,status:x.status||((x.published!==false)?'published':'draft'),featured:!!x.featured,favorite:!!x.favorite,order:x.order??i};}
function migrate(raw){const d=clone(defaults);if(!raw)return d;for(const k of ['projects','videos','images','restorations','reviews','leads','ideas','campaigns'])if(Array.isArray(raw[k]))d[k]=raw[k];if(Array.isArray(raw.media)){d.videos=raw.media.filter(x=>x.type==='video');d.images=raw.media.filter(x=>x.type==='image')}d.settings={...d.settings,...(raw.settings||{})};d.projects=d.projects.map(normalizeItem);d.videos=d.videos.map(normalizeItem);d.images=d.images.map(normalizeItem);d.restorations=d.restorations.map(normalizeItem);return d}
function load(){return STATE||migrate(null)}
async function loadRemote(){
 try{const r=await fetch('/api/state',{credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha ao carregar');STATE=migrate(j.state||null)}
 catch(err){console.error(err);STATE=migrate(null)}
 return STATE;
}
function mediaUrl(id){return id?'/api/media/'+encodeURIComponent(id):''}
async function assetSrc(item){if(item.assetId)return mediaUrl(item.assetId);return item.url||item.image||''}
function youtubeId(url=''){const m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);return m?m[1]:''}
function setWhatsapp(a,number,text='Olá! Conheci a Frame X Studio pelo site e gostaria de conversar sobre um projeto.'){if(a)a.href=`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function screenshotUrl(url=''){if(!/^https?:\/\//i.test(url))return '';return `https://image.thum.io/get/fullpage/noanimate/width/1600/${encodeURIComponent(url)}`}
let selectedCategory='Todos',projectLimit=4,videoIndex=0,imageIndex=0;

async function render(){const s=load(),x=s.settings;const words=(x.heroTitle||defaults.settings.heroTitle).split(' '),cut=Math.ceil(words.length*.55);$('#heroTitle').innerHTML=`${esc(words.slice(0,cut).join(' '))} <em>${esc(words.slice(cut).join(' '))}</em>`;$('#heroText').textContent=x.heroText;['topWhatsapp','heroWhatsapp','contactWhatsapp','floatingWhatsapp'].forEach(id=>setWhatsapp($('#'+id),x.whatsapp));setWhatsapp($('#modelWhatsapp'),x.whatsapp,'Olá! Quero saber mais sobre a criação de uma modelo virtual para TikTok Shop.');$('#contactPhone').textContent=x.phone;$('#contactLocation').innerHTML=esc(x.location).replace(/\n/g,'<br>');$('#contactSocial').textContent=x.socialLabel;const socials=[];if(x.instagramPersonal)socials.push(`<a href="${esc(x.instagramPersonal)}" target="_blank" rel="noopener">Instagram Caio ↗</a>`);if(x.instagramFrameX)socials.push(`<a href="${esc(x.instagramFrameX)}" target="_blank" rel="noopener">Instagram Frame X ↗</a>`);$('#socialLinks').innerHTML=socials.join('');$('#footerSocials').innerHTML=socials.join('');renderProjectFilters(s);await renderProjects(s);await renderVideos(s);await renderImages(s);await renderRestorations(s);renderReviews(s)}
function renderProjectFilters(s){const cats=['Todos',...new Set(s.projects.filter(x=>x.published!==false&&x.status!=='draft').map(x=>x.category).filter(Boolean))];$('#projectFilters').innerHTML=cats.map(c=>`<button class="${c===selectedCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');$$('[data-cat]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.cat;projectLimit=4;render()})}
async function renderProjects(s){
 const all=s.projects.filter(p=>p.published!==false&&p.status!=='draft'&&(selectedCategory==='Todos'||p.category===selectedCategory)).sort((a,b)=>(Number(b.featured)-Number(a.featured))||((a.order||0)-(b.order||0))),list=all.slice(0,projectLimit),grid=$('#projectGrid');
 const cards=[];
 for(const p of list){
   let media='';
   const mode=p.previewMode==='auto'?'live':(p.previewMode||'live');
   if(mode==='image'){
     let src=await assetSrc(p); if(!src&&p.image)src=p.image;
     media=src?`<img src="${esc(src)}" alt="Prévia de ${esc(p.name)}" loading="lazy">`:`<div class="previewMissing"><b>Adicione uma screenshot</b><span>Este projeto está em modo imagem.</span></div>`;
   }else{
     const live=/^https?:\/\//i.test(p.url||'')?p.url:'';
     media=live?`<iframe class="siteFrame" src="${esc(live)}" title="Prévia ao vivo de ${esc(p.name)}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer-when-downgrade"></iframe>`:`<div class="previewMissing"><b>Link inválido</b><span>Informe uma URL completa no painel.</span></div>`;
   }
   cards.push(`<article class="project ${p.featured?'featured':''}"><div class="browser"><div class="browserbar"><i></i><i></i><i></i><span>FRAME X · PROJETO</span></div><div class="screen ${mode==='live'?'liveScreen':''}">${media}<a class="viewSiteOverlay" href="${esc(p.url||'#')}" target="_blank" rel="noopener">VER SITE ↗</a></div></div><div class="projectInfo"><div><span>${esc(p.category||'Projeto')}</span><h3>${esc(p.name||'Projeto')}</h3><p>${esc(p.description||'')}</p></div><a class="roundArrow" href="${esc(p.url||'#')}" target="_blank" rel="noopener">↗</a></div></article>`)
 }
 grid.innerHTML=cards.join('');$('#emptyProjects').classList.toggle('hidden',!!all.length);$('#moreProjects').style.display=all.length>projectLimit?'inline-flex':'none';
}
async function buildVideo(v){
 const yt=youtubeId(v.url),src=await assetSrc(v),ratio=v.ratio||'vertical';
 if(yt){return `<article class="coverItem ratio-${esc(ratio)} videoCard" data-youtube="${esc(yt)}" data-title="${esc(v.title||'Vídeo')}"><div class="coverMedia"><img src="https://i.ytimg.com/vi/${esc(yt)}/hqdefault.jpg" alt="Miniatura de ${esc(v.title||'Vídeo')}" loading="lazy"><span class="videoPreviewBadge">▶ VER VÍDEO</span></div><div class="coverMeta"><small>${esc(v.category||'VÍDEO')}</small><b>${esc(v.title||'Vídeo')}</b></div></article>`}
 return `<article class="coverItem ratio-${esc(ratio)} videoCard" data-src="${esc(src)}" data-title="${esc(v.title||'Vídeo')}"><div class="coverMedia">${src?`<video src="${esc(src)}" muted loop preload="metadata" playsinline></video><span class="videoPreviewBadge">▶ ABRIR PLAYER</span>`:'<div class="emptyState">Sem mídia</div>'}</div><div class="coverMeta"><small>${esc(v.category||'VÍDEO')}</small><b>${esc(v.title||'Vídeo')}</b></div></article>`
}
async function renderVideos(s){
 const list=s.videos.filter(v=>v.published!==false&&v.status!=='draft').sort((a,b)=>(Number(b.featured)-Number(a.featured))||((a.order||0)-(b.order||0)));$('#emptyVideos').style.display=list.length?'none':'block';if(!list.length){$('#videoTrack').innerHTML='';return}videoIndex=Math.min(videoIndex,list.length-1);const html=[];for(const v of list)html.push(await buildVideo(v));$('#videoTrack').innerHTML=html.join('');setupCoverflow('video',list.length);setupVideoPreviews();
}
async function renderImages(s){
 const list=s.images.filter(v=>v.published!==false&&v.status!=='draft').sort((a,b)=>(Number(b.featured)-Number(a.featured))||((a.order||0)-(b.order||0)));$('#emptyImages').style.display=list.length?'none':'block';if(!list.length){$('#imageTrack').innerHTML='';return}imageIndex=Math.min(imageIndex,list.length-1);const html=[];for(const v of list){const src=await assetSrc(v),ratio=v.ratio||'vertical';html.push(`<button class="coverItem ratio-${esc(ratio)}" data-src="${esc(src)}" data-title="${esc(v.title||'Imagem')}" data-desc="${esc(v.description||'')}"><img src="${esc(src)}" alt="${esc(v.title||'Imagem')}"><div class="coverMeta"><small>${esc(v.category||'IMAGEM')}</small><b>${esc(v.title||'Imagem')}</b></div></button>`)}$('#imageTrack').innerHTML=html.join('');setupCoverflow('image',list.length);$$('#imageTrack .coverItem').forEach(el=>el.onclick=()=>openImage(el.dataset.src,el.dataset.title,el.dataset.desc))
}
async function blobSrc(id,url=''){return id?mediaUrl(id):(url||'')}
async function renderRestorations(s){
 const list=s.restorations.filter(x=>x.published!==false&&x.status!=='draft').sort((a,b)=>(Number(b.featured)-Number(a.featured))||((a.order||0)-(b.order||0)));
 const grid=$('#restorationGrid'), empty=$('#emptyRestorations'); if(!grid||!empty)return; empty.style.display=list.length?'none':'block'; if(!list.length){grid.innerHTML='';return}
 const html=[];
 for(const r of list){const before=await blobSrc(r.beforeAssetId,r.beforeUrl),after=await blobSrc(r.afterAssetId,r.afterUrl),ratio=r.ratio||'horizontal';html.push(`<article class="restorationCard glass ${r.featured?'featured':''}"><div class="compareWrap ratio-${esc(ratio)}" style="--pos:50%" tabindex="0" aria-label="Comparação antes e depois de ${esc(r.title||'foto restaurada')}"><img class="afterImg" src="${esc(after)}" alt="Depois da restauração"><div class="beforeClip"><img class="beforeImg" src="${esc(before)}" alt="Antes da restauração"></div><div class="compareLine"><span>↔</span></div><span class="compareLabel beforeLabel">ANTES</span><span class="compareLabel afterLabel">DEPOIS</span></div><div class="restorationMeta"><small>${esc(r.category||'RESTAURAÇÃO')}</small><h3>${esc(r.title||'Restauração de foto')}</h3><p>${esc(r.description||'')}</p></div></article>`)}
 grid.innerHTML=html.join(''); setupCompareSliders();
}
function setupCompareSliders(){$$('.compareWrap').forEach(el=>{let active=false;const set=e=>{const r=el.getBoundingClientRect();const x=Math.max(0,Math.min(r.width,e.clientX-r.left));el.style.setProperty('--pos',`${(x/r.width)*100}%`)};el.addEventListener('pointerdown',e=>{active=true;el.setPointerCapture?.(e.pointerId);set(e)});el.addEventListener('pointermove',e=>{if(active)set(e)});el.addEventListener('pointerup',()=>active=false);el.addEventListener('pointercancel',()=>active=false);el.addEventListener('click',set);el.addEventListener('keydown',e=>{let v=parseFloat(getComputedStyle(el).getPropertyValue('--pos'))||50;if(e.key==='ArrowLeft')v-=5;if(e.key==='ArrowRight')v+=5;el.style.setProperty('--pos',`${Math.max(0,Math.min(100,v))}%`)})})}
function setupVideoPreviews(){
 const hoverOK=window.matchMedia('(hover:hover) and (pointer:fine)').matches;
 $$('#videoTrack .videoCard').forEach(card=>{
   const video=card.querySelector('video');
   if(video&&hoverOK){card.addEventListener('mouseenter',()=>{video.currentTime=0;video.play().catch(()=>{})});card.addEventListener('mouseleave',()=>{video.pause();video.currentTime=0})}
   card.addEventListener('click',()=>openVideo(card.dataset.src||'',card.dataset.youtube||'',card.dataset.title||'Vídeo'));
 })
}
function openVideo(src,youtube,title){
 const body=youtube?`<iframe class="playerFrame" src="https://www.youtube.com/embed/${esc(youtube)}?autoplay=1&rel=0" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`:`<video class="playerVideo" src="${esc(src)}" controls autoplay playsinline></video>`;
 $('#lightboxContent').innerHTML=`<div class="videoPlayerModal">${body}<h3>${esc(title)}</h3></div>`;$('#lightbox').classList.remove('hidden')
}
function setupCoverflow(type,len){const track=$(`#${type}Track`),flow=track.closest('.coverflow');function paint(){const idx=type==='video'?videoIndex:imageIndex;[...track.children].forEach((el,i)=>{const d=i-idx;el.classList.toggle('active',d===0);el.classList.toggle('near',Math.abs(d)===1);el.style.transform=d===0?'scale(1)':Math.abs(d)===1?`translateX(${d*2}%) scale(.88) rotateY(${d<0?12:-12}deg)`:`scale(.72)`});const active=track.children[idx];if(active)active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}flow.querySelector('.prev').onclick=()=>{if(type==='video')videoIndex=(videoIndex-1+len)%len;else imageIndex=(imageIndex-1+len)%len;paint()};flow.querySelector('.next').onclick=()=>{if(type==='video')videoIndex=(videoIndex+1)%len;else imageIndex=(imageIndex+1)%len;paint()};let start=0;track.onpointerdown=e=>start=e.clientX;track.onpointerup=e=>{const dx=e.clientX-start;if(Math.abs(dx)>40)(dx<0?flow.querySelector('.next'):flow.querySelector('.prev')).click()};paint()}
function openImage(src,title,desc){$('#lightboxContent').innerHTML=`<img src="${esc(src)}" alt="${esc(title)}"><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;$('#lightbox').classList.remove('hidden')}
function renderReviews(s){const list=s.reviews.filter(r=>r.approved);$('#reviewGrid').innerHTML=list.map(r=>`<article class="review glass"><div class="stars">${'★'.repeat(r.rating||5)}</div><p>“${esc(r.text)}”</p><div class="person"><span>${esc((r.name||'?')[0])}</span><div><b>${esc(r.name)}</b>${r.role?`<small>${esc(r.role)}</small>`:''}</div></div></article>`).join('')}
async function submitLead(form){
 const fd=new FormData(form),lead={name:fd.get('name'),whatsapp:fd.get('whatsapp'),email:fd.get('email'),service:fd.get('service'),idea:fd.get('idea')};
 try{const r=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(lead)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha ao enviar');form.reset();toast('Recebi sua ideia. Vou falar com você pelo WhatsApp!')}
 catch(err){toast('Não consegui enviar agora. Tente pelo WhatsApp.')}
}
loadRemote().then(()=>render()).finally(()=>setTimeout(()=>$('#pageLoader')?.classList.add('hidden'),120));$('#moreProjects').onclick=()=>{projectLimit+=4;render()};$('#menuBtn').onclick=()=>document.querySelector('nav').classList.toggle('open');$('#quickLeadForm').onsubmit=e=>{e.preventDefault();submitLead(e.currentTarget)};$('.lightboxClose').onclick=()=>$('#lightbox').classList.add('hidden');$('#lightbox').onclick=e=>{if(e.target.id==='lightbox')$('#lightbox').classList.add('hidden')};
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.08});$$('.reveal').forEach(el=>io.observe(el));let counted=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!counted){counted=true;$$('[data-count]').forEach(el=>{const end=+el.dataset.count,t0=performance.now();function tick(t){const p=Math.min(1,(t-t0)/900);el.textContent=Math.round(end*p)+(end===100?'%':'');if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)})}}),{threshold:.3}).observe($('#stats'));
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--mx',`${e.clientX}px`);document.documentElement.style.setProperty('--my',`${e.clientY}px`);$$('.glass,.service,.review').forEach(el=>{const r=el.getBoundingClientRect();el.style.setProperty('--cx',`${e.clientX-r.left}px`);el.style.setProperty('--cy',`${e.clientY-r.top}px`)})},{passive:true})}
