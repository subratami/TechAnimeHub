const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setTheme(mode) {
  if (mode === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
  localStorage.setItem('theme', mode);
}
setTheme(localStorage.getItem('theme') || 'dark');
$('#themeBtn').addEventListener('click', () => {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});
$('#themeBtnMobile').addEventListener('click', () => {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

const drawer = $('#drawer');
const backdrop = $('#backdrop');
$('#menuBtn').addEventListener('click', () => {
  drawer.classList.add('open');
  backdrop.classList.add('open');
});
window.closeDrawer = () => {
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
};

$$('.tab').forEach(btn => btn.addEventListener('click', () => navigateToTab(btn.dataset.tab)));
$$('aside a').forEach(a => a.addEventListener('click', (e) => {
  e.preventDefault();
  const tab = a.getAttribute('onclick').match(/'(.*?)'/)[1];
  navigateToTab(tab);
  closeDrawer();
}));

function navigateToTab(tab) {
  history.pushState({ tab }, '', `#/${tab}`);
  activateTab(tab);
}

window.activateTab = function(tab) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.remove('active'));
  const panel = $('#panel-' + tab);
  if (panel) panel.classList.add('active');

  if (tab === 'videos') {
    $('#video-grid').style.display = 'grid';
    $('#video-player-container').style.display = 'none';
    $('#playlistSearch').style.display = 'block';
    initVideosOnce();
  } else {
    const player = $('#player');
    if (player.src) player.src = '';
    $('#playlistSearch').style.display = 'none';
  }

  if (tab === 'tech') fetchNews('tech', '#tech-grid');
  if (tab === 'anime') fetchNews('anime', '#anime-grid');
  if (tab === 'movies') fetchNews('movies', '#movies-grid');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const progress = $('#progress');
function startProgress() { progress.style.width = '10%'; setTimeout(() => { progress.style.width = '40%'; }, 100); }
function endProgress() { progress.style.width = '100%'; setTimeout(() => { progress.style.width = '0%'; }, 250); }

$('#refreshBtn').addEventListener('click', async () => {
  try {
    startProgress();
    await fetch('/api/refresh', { method: 'POST' });
    const active = document.querySelector('.tab.active').dataset.tab;
    if (active === 'tech') fetchNews('tech', '#tech-grid', true);
    if (active === 'anime') fetchNews('anime', '#anime-grid', true);
    if (active === 'movies') fetchNews('movies', '#movies-grid', true);
  } finally {
    setTimeout(endProgress, 400);
  }
});

function showSkeletons(containerSel, count = 8) {
  const el = document.querySelector(containerSel);
  el.innerHTML = '';
  for (let i = 0; i < count; i++) { const sk = document.createElement('div'); sk.className = 'skeleton'; el.appendChild(sk); }
}

async function fetchNews(cat, containerSel) {
  showSkeletons(containerSel);
  startProgress();
  try {
    const res = await fetch(`/api/news/${cat}`);
    const data = await res.json();
    renderNews(data.items, containerSel, cat);
  } catch (e) {
    document.querySelector(containerSel).innerHTML = `<div class="meta">Failed to load ${cat} news.</div>`;
    console.error(e);
  } finally {
    endProgress();
  }
}

function renderNews(items, containerSel, cat) {
  const el = document.querySelector(containerSel);
  el.innerHTML = '';
  for (const item of items) {
    const img = item.image || `/placeholders/${cat}.svg`;
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `<img src="${img}" loading="lazy" alt=""><div class="p"><div class="title">${item.title}</div><div class="meta">${new Date(item.pubDate || Date.now()).toLocaleString()}</div><button class="btn small read-btn">Read</button></div>`;
    card.querySelector('.read-btn').addEventListener('click', () => openArticle(item.link));
    el.appendChild(card);
  }
}

const articleSidebar = $('#article-sidebar');
const sidebarTitle = $('#sidebar-title');
const sidebarBody = $('#sidebar-body');
const closeSidebarBtn = $('#close-sidebar-btn');
const sidebarBackdrop = $('#sidebar-backdrop');

function closeSidebar() {
  articleSidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
  closeSidebarBtn.classList.remove('mobile-close-btn');
}

closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

async function openArticle(url) {
  articleSidebar.classList.add('open');
  sidebarBackdrop.classList.add('open');
  if (window.innerWidth <= 768) {
    closeSidebarBtn.classList.add('mobile-close-btn');
  }
  sidebarTitle.textContent = 'Loading...';
  sidebarBody.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
    const article = await res.json();
    sidebarTitle.innerHTML = `<h2 class="sidebar-title">${article.title}</h2>`;
    sidebarBody.innerHTML = article.content;
  } catch (err) {
    sidebarTitle.textContent = 'Error';
    sidebarBody.innerHTML = 'Failed to load article. Please try again later.';
    console.error('Failed to extract article:', err);
  }
}

let videosInit = false;
let fullPlaylist = [];

function renderVideoGrid(items) {
  const grid = $('#video-grid');
  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `<img src="${item.thumbnail}" loading="lazy" alt=""><div class="p"><div class="title">${item.title}</div></div>`;
    card.addEventListener('click', () => {
      history.pushState({ videoId: item.videoId }, '', `#/${item.videoId}`);
      showVideoPlayer(item.videoId, item.title);
    });
    grid.appendChild(card);
  }
}

function showVideoPlayer(videoId, title) {
  $('#video-grid').style.display = 'none';
  $('#playlistSearch').style.display = 'none';
  const playerContainer = $('#video-player-container');
  playerContainer.style.display = 'block';
  const player = $('#player');
  player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  $('#nowTitle').textContent = title;
  localStorage.setItem('lastPlayedVideo', videoId);
  player.onerror = () => alert('Failed to load video.');
}

function filterPlaylist(term) {
  const filtered = fullPlaylist.filter(v => v.title.toLowerCase().includes(term.toLowerCase()));
  renderVideoGrid(filtered);
}

async function initVideosOnce() {
  if (videosInit) return;
  videosInit = true;
  startProgress();
  try {
    const res = await fetch('/api/playlist');
    fullPlaylist = await res.json();
    renderVideoGrid(fullPlaylist);
    $('#playlistSearch').addEventListener('input', (e) => filterPlaylist(e.target.value));
  } catch (e) {
    $('#video-grid').innerHTML = '<div class="meta">Failed to load playlist.</div>';
    console.error(e);
  } finally {
    endProgress();
  }
}

window.addEventListener('popstate', (event) => {
  if (event.state?.tab) {
    activateTab(event.state.tab);
  } else if (event.state?.videoId) {
    const video = fullPlaylist.find(v => v.videoId === event.state.videoId);
    if (video) {
      showVideoPlayer(video.videoId, video.title);
    }
  } else {
    activateTab('tech');
  }
});

const scrollTopBtn = $('#scrollTopBtn');
window.addEventListener('scroll', () => {
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    scrollTopBtn.style.display = 'block';
  } else {
    scrollTopBtn.style.display = 'none';
  }
});
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});


// Initial load
const path = window.location.hash.slice(2);
if (path.match(/^[a-zA-Z0-9_-]{11}$/)) {
  // Looks like a video ID
  activateTab('videos');
  initVideosOnce().then(() => {
    const video = fullPlaylist.find(v => v.videoId === path);
    if (video) showVideoPlayer(video.videoId, video.title);
  });
} else {
  const tab = path || 'tech';
  activateTab(tab);
}
