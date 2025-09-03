const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setTheme(mode){ if(mode==='light') document.documentElement.classList.add('light'); else document.documentElement.classList.remove('light'); localStorage.setItem('theme', mode); }
setTheme(localStorage.getItem('theme') || 'dark');
$('#themeBtn').addEventListener('click',()=>{ const isLight=document.documentElement.classList.toggle('light'); localStorage.setItem('theme', isLight?'light':'dark'); });

const drawer=$('#drawer'); const backdrop=$('#backdrop');
$('#menuBtn').addEventListener('click',()=>{ drawer.classList.add('open'); backdrop.classList.add('open'); });
window.closeDrawer=()=>{ drawer.classList.remove('open'); backdrop.classList.remove('open'); };
window.openSearch=()=>{ activateTab('search'); $('#searchInput').focus(); };

$$('.tab').forEach(btn=>btn.addEventListener('click',()=>activateTab(btn.dataset.tab)));
function activateTab(tab){
  $$('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  $$('.panel').forEach(p=>p.classList.remove('active'));
  const panel=$('#panel-'+tab); if(panel) panel.classList.add('active');
  if(tab==='videos') initVideosOnce();
  if(tab==='tech') fetchNews('tech','#tech-grid');
  if(tab==='anime') fetchNews('anime','#anime-grid');
  if(tab==='movies') fetchNews('movies','#movies-grid');
  window.scrollTo({top:0,behavior:'smooth'});
}

const progress=$('#progress');
function startProgress(){ progress.style.width='10%'; setTimeout(()=>{progress.style.width='40%';},100); }
function endProgress(){ progress.style.width='100%'; setTimeout(()=>{progress.style.width='0%';},250); }

$('#refreshBtn').addEventListener('click', async ()=>{
  try{ startProgress(); await fetch('/api/refresh',{method:'POST'}); const active=document.querySelector('.tab.active').dataset.tab;
    if(active==='tech') fetchNews('tech','#tech-grid',true);
    if(active==='anime') fetchNews('anime','#anime-grid',true);
    if(active==='movies') fetchNews('movies','#movies-grid',true);
  } finally { setTimeout(endProgress, 400); }
});

function showSkeletons(containerSel,count=8){ const el=document.querySelector(containerSel); el.innerHTML=''; for(let i=0;i<count;i++){ const sk=document.createElement('div'); sk.className='skeleton'; el.appendChild(sk);} }

async function fetchNews(cat, containerSel){
  showSkeletons(containerSel);
  startProgress();
  try{
    const res = await fetch(`/api/news/${cat}`);
    const data = await res.json();
    renderNews(data.items, containerSel, cat);
  } catch(e){
    document.querySelector(containerSel).innerHTML = `<div class="meta">Failed to load ${cat} news.</div>`;
    console.error(e);
  } finally { endProgress(); }
}
function renderNews(items, containerSel, cat){
  const el=document.querySelector(containerSel); el.innerHTML='';
  for(const item of items){
    const img=item.image || `/placeholders/${cat}.svg`;
    const card=document.createElement('article'); card.className='card';
    card.innerHTML=`<img src="${img}" loading="lazy" alt=""><div class="p"><div class="title">${item.title}</div><div class="meta">${new Date(item.pubDate||Date.now()).toLocaleString()}</div><a class="link" href="${item.link}" target="_blank" rel="noopener">Read →</a></div>`;
    el.appendChild(card);
  }
}

$('#searchForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); const q=$('#searchInput').value.trim(); if(!q) return;
  activateTab('search'); startProgress(); const grid=$('#search-grid'); showSkeletons('#search-grid',6);
  try{
    const res=await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data=await res.json(); grid.innerHTML='';
    for(const item of data.items){
      const cat=item.category || 'tech'; const img=item.image || `/placeholders/${cat}.svg`;
      const card=document.createElement('article'); card.className='card';
      card.innerHTML=`<img src="${img}" loading="lazy" alt=""><div class="p"><div class="title">${item.title}</div><div class="meta">${new Date(item.pubDate||Date.now()).toLocaleString()} • ${cat.toUpperCase()}</div><a class="link" href="${item.link}" target="_blank" rel="noopener">Read →</a></div>`;
      grid.appendChild(card);
    }
    if(data.items.length===0){ grid.innerHTML='<div class="meta">No results.</div>'; }
  } finally { endProgress(); }
});

let videosInit=false; let fullPlaylist=[];
function filterPlaylist(term){
  const listEl=$('#list'); const player=$('#player'); const nowTitle=$('#nowTitle');
  const errorMsg = $('#playerError');
  const saved=localStorage.getItem('lastPlayedVideo');
  const currentId = saved && fullPlaylist.some(v=>v.videoId===saved) ? saved : (fullPlaylist[0]?.videoId || '');
  const items = term ? fullPlaylist.filter(v=>v.title.toLowerCase().includes(term.toLowerCase())) : fullPlaylist;
  listEl.innerHTML='';
  items.forEach(v=>{
    const li=document.createElement('li'); li.className='item'+(v.videoId===currentId?' active':'');
    li.innerHTML=`<img class="thumb" src="${v.thumbnail}" loading="lazy" alt=""><div class="meta"><p class="title">${v.title}</p></div>`;
    li.addEventListener('click', ()=>{
      player.src=`https://www.youtube.com/embed/${v.videoId}?autoplay=1&rel=0`;
      nowTitle.textContent=v.title;
      if(errorMsg) errorMsg.textContent = '';
      localStorage.setItem('lastPlayedVideo', v.videoId);
      $$('#list .item').forEach(el=>el.classList.remove('active'));
      li.classList.add('active');
    });
    listEl.appendChild(li);
  });
}
async function initVideosOnce(){
  if(videosInit) return; videosInit=true; startProgress();
  try{
    const res=await fetch('/api/playlist'); fullPlaylist=await res.json();
    const saved=localStorage.getItem('lastPlayedVideo');
    let initial=fullPlaylist[0]; if(saved){ const f=fullPlaylist.find(v=>v.videoId===saved); if(f) initial=f; }
    if(initial){ $('#player').src=`https://www.youtube.com/embed/${initial.videoId}?autoplay=1&rel=0`; $('#nowTitle').textContent=initial.title; }
      // Add error message element below player if not exists
      if(!$('#playerError')){
        const errDiv = document.createElement('div');
        errDiv.id = 'playerError';
        errDiv.style = 'color:red;margin-top:8px;text-align:center;';
        $('#player').parentNode.appendChild(errDiv);
      }
      // Add error handling for iframe
      $('#player').addEventListener('error', ()=>{
        const errorMsg = $('#playerError');
        if(errorMsg) errorMsg.textContent = 'Unable to play this video. It may be unavailable or restricted.';
      });
      $('#player').addEventListener('load', ()=>{
        const errorMsg = $('#playerError');
        if(errorMsg) errorMsg.textContent = '';
      });
    filterPlaylist('');
    $('#playlistSearch').addEventListener('input', (e)=>filterPlaylist(e.target.value));
  } finally { endProgress(); }
}

activateTab('tech');
fetchNews('tech', '#tech-grid');
