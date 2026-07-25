// ============================================================
//  BOMBERMAN PVP — клієнт
//  З підтримкою друзів, груп, чату, неонового лобі та вибором карти
// ============================================================

const loginScreen = document.getElementById('loginScreen');
const statsScreen = document.getElementById('statsScreen');
const ranksScreen = document.getElementById('ranksScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const gameEl = document.getElementById('game');
const lobbyScreen = document.getElementById('lobbyScreen');
const friendsScreen = document.getElementById('friendsScreen');

const loginInput = document.getElementById('loginInput');
const passInput = document.getElementById('passInput');
const loginBtn = document.getElementById('loginBtn');
const loginMsg = document.getElementById('loginMsg');

const openRanksLink = document.getElementById('openRanksLink');
const openLeaderboardLink = document.getElementById('openLeaderboardLink');
const openLeaderboardLink2 = document.getElementById('openLeaderboardLink2');
const ranksBackBtn = document.getElementById('ranksBackBtn');
const leaderboardBackBtn = document.getElementById('leaderboardBackBtn');
const ranksTableBody = document.getElementById('ranksTableBody');
const leaderboardBody = document.getElementById('leaderboardBody');

const matchOverScreen = document.getElementById('matchOverScreen');
const matchOverTitle = document.getElementById('matchOverTitle');
const matchOverStandings = document.getElementById('matchOverStandings');
const matchOverCountdown = document.getElementById('matchOverCountdown');

const statsUsername = document.getElementById('statsUsername');
const statsUserId = document.getElementById('statsUserId');
const statsRank = document.getElementById('statsRank');
const statsKills = document.getElementById('statsKills');
const statsDeaths = document.getElementById('statsDeaths');
const statsWins = document.getElementById('statsWins');
const statsBombs = document.getElementById('statsBombs');
const enterArenaBtn = document.getElementById('enterArenaBtn');
const statsMsg = document.getElementById('statsMsg');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const playerListEl = document.getElementById('playerList');
const deathBanner = document.getElementById('deathBanner');

const restartBanner = document.getElementById('restartBanner');

const lobbyPlayersList = document.getElementById('lobbyPlayersList');
const lobbyTimer = document.getElementById('lobbyTimer');
const lobbyCount = document.getElementById('lobbyCount');
const lobbyMax = document.getElementById('lobbyMax');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');

const exitGameBtn = document.getElementById('exitGameBtn');

const openFriendsBtn = document.getElementById('openFriendsBtn');
const friendsBackBtn = document.getElementById('friendsBackBtn');
const friendSearchInput = document.getElementById('friendSearchInput');
const friendSearchBtn = document.getElementById('friendSearchBtn');
const friendSearchResults = document.getElementById('friendSearchResults');
const friendsList = document.getElementById('friendsList');
const friendCount = document.getElementById('friendCount');
const friendRequestsList = document.getElementById('friendRequestsList');

const groupStatusBar = document.getElementById('groupStatusBar');
const groupStatusList = document.getElementById('groupStatusList');
const groupStatusCount = document.getElementById('groupStatusCount');

const groupCreateBtn = document.getElementById('groupCreateBtn');
const groupInviteSelectedBtn = document.getElementById('groupInviteSelectedBtn');

const groupContextMenu = document.getElementById('groupContextMenu');
const ctxPromote = document.getElementById('ctxPromote');
const ctxKick = document.getElementById('ctxKick');
const ctxLeave = document.getElementById('ctxLeave');

// ============================================================
//  ЗМІННІ ДЛЯ ВИБОРУ КАРТИ
// ============================================================
let selectedMap = null; // { id, name, file, preview }
let mapsList = [];
let lobbyMapName = 'Classic'; // Зберігає назву карти в лобі

// ============================================================
//  НОВА СИСТЕМА ЧАТУ
// ============================================================
const chatTabsContainer = document.getElementById('chatTabs');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// Стан чату
const chatState = {
  world: { messages: [], unread: false },
  group: { messages: [], unread: false, visible: false },
  private: {}, // { username: { messages: [], unread: false, online: false } }
  activeTab: 'world'
};

// Контекстне меню чату
const chatContextMenu = document.getElementById('chatContextMenu');
let chatContextTarget = null;

// ============================================================
//  ФУНКЦІЇ ЧАТУ
// ============================================================

function getPrivateTabId(username) {
  return `private_${username}`;
}

function getUsernameFromTab(tabId) {
  if (tabId.startsWith('private_')) {
    return tabId.replace('private_', '');
  }
  return null;
}

function getChatTabData(tabId) {
  if (tabId === 'world') return chatState.world;
  if (tabId === 'group') return chatState.group;
  if (tabId.startsWith('private_')) {
    const username = getUsernameFromTab(tabId);
    if (username && chatState.private[username]) {
      return chatState.private[username];
    }
  }
  return null;
}

function getTabDisplayName(tabId) {
  if (tabId === 'world') return '🌍 Світ';
  if (tabId === 'group') return '👥 Група';
  if (tabId.startsWith('private_')) {
    return getUsernameFromTab(tabId) || '?';
  }
  return tabId;
}

function isPrivateTab(tabId) {
  return tabId.startsWith('private_');
}

function formatChatTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function renderChatMessages(tabId) {
  const tab = getChatTabData(tabId);
  if (!tab) {
    chatMessages.innerHTML = '<div style="color:#555; text-align:center; padding:20px 0;">Невідома вкладка</div>';
    return;
  }

  if (!tab.messages || tab.messages.length === 0) {
    chatMessages.innerHTML = '<div style="color:#555; text-align:center; padding:20px 0;">Немає повідомлень</div>';
    return;
  }

  chatMessages.innerHTML = tab.messages.map(msg => {
    if (msg.type === 'system') {
      return `<div class="chat-system-msg">${escapeHtml(msg.text)}</div>`;
    }

    const isMe = msg.from === currentUsername;
    const fromDisplay = isMe ? 'Ви' : escapeHtml(msg.from);
    const time = formatChatTime(msg.time);

    return `<div class="chat-msg">
      <span style="color:#555; font-size:10px; flex-shrink:0;">${time}</span>
      <span class="chat-username" data-username="${escapeHtml(msg.from)}" style="color:#23d3c5; font-weight:bold; cursor:pointer;">${fromDisplay}:</span>
      <span style="color:#d8e2ec; word-break:break-word;">${escapeHtml(msg.text)}</span>
    </div>`;
  }).join('');

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Знімаємо індикатор непрочитаних
  if (tab.unread) {
    tab.unread = false;
    updateChatTabBadge(tabId);
  }
}

function updateChatTabBadge(tabId) {
  const tab = getChatTabData(tabId);
  if (!tab) return;

  const tabElement = document.querySelector(`.chat-tab[data-tab="${tabId}"]`);
  if (!tabElement) return;

  const badge = tabElement.querySelector('.tab-badge');

  // Тільки для групи та приватних чатів (не для світу)
  if (tabId !== 'world' && tab.unread) {
    if (!badge) {
      const newBadge = document.createElement('span');
      newBadge.className = 'tab-badge';
      newBadge.textContent = '!';
      tabElement.appendChild(newBadge);
    }
  } else {
    if (badge) badge.remove();
  }
}

function updateChatTabOnline(tabId) {
  if (!isPrivateTab(tabId)) return;
  const username = getUsernameFromTab(tabId);
  if (!username || !chatState.private[username]) return;

  const tabElement = document.querySelector(`.chat-tab[data-tab="${tabId}"]`);
  if (!tabElement) return;

  const dot = tabElement.querySelector('.online-dot');
  if (dot) {
    dot.className = `online-dot ${chatState.private[username].online ? 'online' : 'offline'}`;
  }
}

function switchChatTab(tabId) {
  if (chatState.activeTab === tabId) return;

  // Оновлюємо вигляд вкладок
  document.querySelectorAll('.chat-tab').forEach(el => {
    el.classList.remove('active');
    el.style.background = '#2c3a4d';
    el.style.color = '#93a1b0';
  });

  const targetTab = document.querySelector(`.chat-tab[data-tab="${tabId}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.background = '#23d3c5';
    targetTab.style.color = '#0d1117';
  }

  chatState.activeTab = tabId;
  renderChatMessages(tabId);
}

function addChatMessage(tabId, from, text, type = 'message', time = null) {
  const tab = getChatTabData(tabId);
  if (!tab) return;

  const msg = {
    from,
    text,
    time: time || new Date().toISOString(),
    type
  };

  if (!tab.messages) tab.messages = [];
  tab.messages.push(msg);

  // Ліміт повідомлень
  if (tab.messages.length > 100) {
    tab.messages.shift();
  }

  // Якщо це не активна вкладка, показуємо індикатор (крім світу)
  if (chatState.activeTab !== tabId && tabId !== 'world') {
    tab.unread = true;
    updateChatTabBadge(tabId);
  } else if (chatState.activeTab === tabId) {
    renderChatMessages(tabId);
  }
}

function addSystemMessage(tabId, text) {
  addChatMessage(tabId, 'system', text, 'system');
}

function createPrivateChat(username) {
  if (chatState.private[username]) {
    const tabId = getPrivateTabId(username);
    switchChatTab(tabId);
    return;
  }

  const isOnline = friendsData.friends.some(f => f.username === username && f.status === 'online');
  chatState.private[username] = {
    messages: [],
    unread: false,
    online: isOnline
  };

  const tabId = getPrivateTabId(username);

  // Додаємо вкладку
  const tabHtml = `
    <div class="chat-tab" data-tab="${tabId}" onclick="switchChatTab('${tabId}')" style="display:flex; align-items:center; gap:4px; padding:4px 8px; background:#2c3a4d; color:#93a1b0; border-radius:4px 4px 0 0; cursor:pointer; font-size:12px; font-weight:bold; white-space:nowrap; border:none; flex-shrink:0;">
      <span class="online-dot ${isOnline ? 'online' : 'offline'}"></span>
      <span>${escapeHtml(username)}</span>
      <span class="tab-close" onclick="event.stopPropagation(); closePrivateChat('${username}')" style="cursor:pointer; color:#93a1b0; font-size:14px; line-height:1; padding:0 2px;">×</span>
    </div>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = tabHtml.trim();
  const tabElement = tempDiv.firstChild;

  // Вставляємо перед кнопкою "Група" або в кінець
  const groupTab = chatTabsContainer.querySelector('.chat-tab.group-tab');
  if (groupTab) {
    chatTabsContainer.insertBefore(tabElement, groupTab);
  } else {
    chatTabsContainer.appendChild(tabElement);
  }

  switchChatTab(tabId);
}

function closePrivateChat(username) {
  if (!chatState.private[username]) return;

  const tabId = getPrivateTabId(username);

  // Видаляємо вкладку
  const tabElement = document.querySelector(`.chat-tab[data-tab="${tabId}"]`);
  if (tabElement) tabElement.remove();

  delete chatState.private[username];

  // Перемикаємося на світ, якщо закрили активну вкладку
  if (chatState.activeTab === tabId) {
    switchChatTab('world');
  }
}

function showGroupChatTab(show) {
  const groupTab = document.querySelector('.chat-tab.group-tab');
  if (groupTab) {
    if (show) {
      groupTab.style.display = 'flex';
      chatState.group.visible = true;
      // Якщо група з'явилася і це активна вкладка - оновлюємо
      if (chatState.activeTab === 'group') {
        renderChatMessages('group');
      }
    } else {
      groupTab.style.display = 'none';
      chatState.group.visible = false;
      // Якщо група зникла і ми на ній - перемикаємо на світ
      if (chatState.activeTab === 'group') {
        switchChatTab('world');
      }
    }
  }
}

// ============================================================
//  ОБРОБКА КЛІКІВ ПО НІКУ В ЧАТІ
// ============================================================

document.addEventListener('click', function(e) {
  const usernameEl = e.target.closest('.chat-username');
  if (!usernameEl) return;

  const username = usernameEl.dataset.username;
  if (!username || username === currentUsername) return;

  chatContextTarget = username;
  const menu = document.getElementById('chatContextMenu');
  if (!menu) return;

  menu.classList.remove('hidden');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 170) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 100) + 'px';

  // Закриваємо меню при кліку поза ним
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e2) {
      if (!e2.target.closest('#chatContextMenu')) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
});

function chatContextAction(action) {
  const username = chatContextTarget;
  if (!username) return;

  const menu = document.getElementById('chatContextMenu');
  if (menu) menu.classList.add('hidden');

  if (action === 'friend') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'friends_add', username }));
    }
  } else if (action === 'private') {
    createPrivateChat(username);
  }
}

// ============================================================
//  ІНШІ ЗМІННІ ТА ФУНКЦІЇ
// ============================================================

let ws = null;
let myId = null;
let TILE = 40, COLS = 15, ROWS = 13;
let latestState = null;
let wasAlive = true;
let currentUsername = null;
let currentUserId = null;
let isInLobby = false;

const RENDER_DELAY = 100;
let stateBuffer = [];

let friendsData = { friends: [], requests: [], sentRequests: [], groupRequests: [] };
let currentGroupId = null;
let groupMembers = [];
let selectedFriends = new Set();
let contextTargetUsername = null;

// ============================================================
//  Список звань
// ============================================================
const RANKS_DISPLAY = [
  [1, '0 – 19', 'Солдат'],
  [2, '20', 'Старший солдат'],
  [3, '50', 'Молодший сержант'],
  [4, '100', 'Сержант'],
  [5, '200', 'Старший сержант'],
  [6, '350', 'Головний сержант'],
  [7, '550', 'Штаб-сержант'],
  [8, '800', 'Майстер-сержант'],
  [9, '1 100', 'Старший майстер-сержант'],
  [10, '1 500', 'Головний майстер-сержант'],
  [11, '2 000', 'Молодший лейтенант'],
  [12, '2 500', 'Лейтенант'],
  [13, '3 000', 'Старший лейтенант'],
  [14, '4 200', 'Капітан'],
  [15, '5 500', 'Майор'],
  [16, '7 000', 'Підполковник'],
  [17, '8 500', 'Полковник'],
  [18, '10 000', 'Бригадний генерал'],
  [19, '15 000', 'Генерал-майор'],
  [20, '20 000', 'Генерал-лейтенант'],
  [21, '30 000', 'Генерал'],
];

// ============================================================
//  Допоміжні функції
// ============================================================
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    info: '#23d3c5',
    error: '#e04b3b',
    warning: '#e0b23b',
    success: '#4ce06a'
  };
  toast.style.cssText = `
    position:fixed;
    bottom:20px;
    right:20px;
    background:#161d29;
    border:2px solid ${colors[type] || colors.info};
    border-radius:8px;
    padding:15px 25px;
    max-width:400px;
    z-index:1000;
    color:#eee;
    font-family:'Courier New',monospace;
    font-size:14px;
    animation:slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function showScreen(el) {
  [loginScreen, statsScreen, ranksScreen, leaderboardScreen, matchOverScreen, gameEl, lobbyScreen, friendsScreen].forEach((s) => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

function renderRanksTable() {
  ranksTableBody.innerHTML = RANKS_DISPLAY.map(
    ([num, lvl, name]) => `
      <div class="rank-row">
        <img class="rank-badge" src="ranks/rank_${num}.png" alt="" onerror="this.style.visibility='hidden'" />
        <span>${lvl}</span>
        <span>${escapeHtml(name)}</span>
      </div>`
  ).join('');
}

openRanksLink.addEventListener('click', (e) => {
  e.preventDefault();
  renderRanksTable();
  showScreen(ranksScreen);
});
ranksBackBtn.addEventListener('click', () => showScreen(loginScreen));

let leaderboardReturnScreen = loginScreen;

openLeaderboardLink.addEventListener('click', (e) => {
  e.preventDefault();
  leaderboardReturnScreen = loginScreen;
  showScreen(leaderboardScreen);
  fetchLeaderboard(false);
});
openLeaderboardLink2.addEventListener('click', (e) => {
  e.preventDefault();
  leaderboardReturnScreen = statsScreen;
  showScreen(leaderboardScreen);
  fetchLeaderboard(true);
});
leaderboardBackBtn.addEventListener('click', () => showScreen(leaderboardReturnScreen));

function fetchLeaderboard(fromStats = false) {
  leaderboardBody.innerHTML = '<div class="lb-msg">Завантаження...</div>';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const tempWs = new WebSocket(`${proto}://${location.host}`);
  tempWs.onopen = () => {
    tempWs.send(JSON.stringify({
      type: 'get_leaderboard',
      username: fromStats ? currentUsername : null,
    }));
  };
  tempWs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'leaderboard') {
        renderLeaderboard(msg.list, fromStats, msg.playerEntry);
        tempWs.close();
      }
    } catch (e) {}
  };
  tempWs.onerror = () => {
    leaderboardBody.innerHTML = '<div class="lb-msg">Не вдалося завантажити статистику.</div>';
  };
  setTimeout(() => {
    if (tempWs.readyState === WebSocket.OPEN || tempWs.readyState === WebSocket.CONNECTING) {
      tempWs.close();
      leaderboardBody.innerHTML = '<div class="lb-msg">Таймаут завантаження.</div>';
    }
  }, 5000);
}

function renderLeaderboard(list, fromStats = false, playerEntry = null) {
  if (!list || list.length === 0) {
    leaderboardBody.innerHTML = '<div class="lb-msg">Поки що немає жодного гравця.</div>';
    return;
  }
  let playerRank = fromStats && playerEntry ? playerEntry.position : -1;
  let displayList = list.slice(0, 100);
  let showPlayerRow = false;
  let playerData = null;
  if (fromStats && playerEntry && playerRank > 100) {
    showPlayerRow = true;
    playerData = playerEntry;
  }
  const header = `<div class="lb-row header"><span>#</span><span>Нік</span><span></span><span>Звання</span><span>Вбивств</span><span>Смертей</span><span>🏆</span></div>`;
  let rows = displayList.map((p, i) => {
    const rank = i + 1;
    const isPlayer = fromStats && p.username === currentUsername;
    return `<div class="lb-row${isPlayer ? ' player-row' : ''}">
      <span class="lb-rank-num">${rank}</span>
      <span class="lb-name">${escapeHtml(p.username)}</span>
      <img class="lb-badge" src="ranks/rank_${p.rankNum}.png" alt="" onerror="this.style.visibility='hidden'" />
      <span>${escapeHtml(p.rank)}</span>
      <span class="lb-kills">${p.kills}</span>
      <span class="lb-deaths">${p.deaths}</span>
      <span class="lb-wins">${p.wins || 0}</span>
    </div>`;
  }).join('');
  if (showPlayerRow && playerData) {
    rows += `<div class="lb-row player-row" style="border-top: 2px solid #ffd166; margin-top: 4px; padding-top: 8px;">
      <span class="lb-rank-num">${playerRank}</span>
      <span class="lb-name">${escapeHtml(playerData.username)}</span>
      <img class="lb-badge" src="ranks/rank_${playerData.rankNum}.png" alt="" onerror="this.style.visibility='hidden'" />
      <span>${escapeHtml(playerData.rank)}</span>
      <span class="lb-kills">${playerData.kills}</span>
      <span class="lb-deaths">${playerData.deaths}</span>
      <span class="lb-wins">${playerData.wins || 0}</span>
    </div>`;
  }
  leaderboardBody.innerHTML = `
    <div style="text-align:center; font-size:20px; font-weight:bold; margin-bottom:8px; color:#eee;">
      Топ 100 <span style="color:#ff5555;">PVP</span> гравців
    </div>
    <div class="leaderboard-container">
      <div id="leaderboardScrollContent" class="leaderboard-scroll-content">${header + rows}</div>
      <div id="leaderboardScrollIndicator" class="leaderboard-scroll-indicator">
        <div id="leaderboardScrollThumb" class="scroll-thumb"></div>
      </div>
    </div>
  `;
}

// ============================================================
//  ГРУПА
// ============================================================
function getGroupByMember(username) {
  return groupMembers.some(m => m.username === username);
}

function updateGroupStatusBar() {
  if (!groupStatusBar || !groupStatusList || !groupStatusCount) return;
  if (!currentGroupId || groupMembers.length === 0) {
    groupStatusBar.classList.add('hidden');
    showGroupChatTab(false);
    return;
  }
  groupStatusBar.classList.remove('hidden');
  showGroupChatTab(true);
  groupStatusCount.textContent = `${groupMembers.length}/5`;
  const isLeader = groupMembers.some(m => m.isLeader && m.username === currentUsername);
  groupStatusList.innerHTML = groupMembers.map((m, index) => {
    const isLeaderMember = m.isLeader;
    const isMe = m.username === currentUsername;
    const isReady = m.status === 'ready';
    const isOnline = m.isOnline !== false;
    let statusText = '';
    let statusClass = '';
    if (isLeaderMember) { statusText = '👑 Лідер'; statusClass = 'leader'; }
    else if (isReady) { statusText = '✅ Готово'; statusClass = 'ready'; }
    else { statusText = '⏳ Очікуємо'; statusClass = 'waiting'; }
    return `<div class="group-member-mini" data-username="${escapeHtml(m.username)}">
      <div class="mini-name">
        <span style="color:${isOnline ? '#7fdcd1' : '#555'};">${index + 1}.</span>
        ${isLeaderMember ? '<span class="crown">👑</span>' : ''}
        <span style="color:${isOnline ? '#fff' : '#555'};">${escapeHtml(m.username)}</span>
        ${isMe ? '<span style="color:#23d3c5; font-size:11px;">(ви)</span>' : ''}
      </div>
      <span class="mini-status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');
  updateEnterButton();
}

function createGroup() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'group_create' }));
  }
}

function leaveGroup() {
  if (!confirm('Вийти з групи?')) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'group_leave' }));
  }
}

function toggleReady() {
  const member = groupMembers.find(m => m.username === currentUsername);
  if (!member) return;
  const isReady = member.status === 'ready';
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'group_ready', ready: !isReady }));
  }
}

function promoteToLeader(username) {
  if (!confirm(`Передати лідерство "${username}"?`)) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'group_promote', username }));
  }
}

function kickFromGroup(username) {
  if (!confirm(`Вигнати "${username}" з групи?`)) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'group_kick', username }));
  }
}

// ============================================================
//  ДРУЗІ
// ============================================================
function refreshFriendsData() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'friends_get' }));
  }
}

function openFriends() {
  showScreen(friendsScreen);
  refreshFriendsData();
  renderFriends();
}

function renderFriends() {
  const list = friendsList;
  const count = friendCount;
  const requestsList = friendRequestsList;
  count.textContent = friendsData.friends.length;
  const isInGroup = currentGroupId !== null;
  const isLeader = isInGroup && groupMembers.some(m => m.isLeader && m.username === currentUsername);
  if (friendsData.friends.length === 0) {
    list.innerHTML = '<div style="color:#555; text-align:center; padding:16px 0; font-size:14px;">У вас немає друзів</div>';
    if (groupInviteSelectedBtn) groupInviteSelectedBtn.disabled = true;
    renderRequests();
    renderSentRequests();
    updateGroupButtons();
    return;
  }
  list.innerHTML = friendsData.friends.map(f => {
    const isChecked = selectedFriends.has(f.username);
    const isOnline = f.status === 'online';
    const isInMyGroup = groupMembers.some(m => m.username === f.username);
    const isGroupLeader = isInMyGroup && groupMembers.some(m => m.isLeader && m.username === f.username);
    const canSelect = isOnline && !isInMyGroup && isInGroup && isLeader;
    return `<div class="friend-item" data-username="${escapeHtml(f.username)}">
      <div style="display:flex; align-items:center; gap:8px; flex:1;">
        ${isInGroup && isLeader ? `<input type="checkbox" class="friend-checkbox" ${isChecked ? 'checked' : ''} 
               onchange="toggleSelectFriend('${f.username}', this.checked)" ${canSelect ? '' : 'disabled'} />` : ''}
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${isOnline ? '#4ce06a' : '#555'};"></span>
        <span style="font-weight:bold; color:${isOnline ? '#7fdcd1' : '#93a1b0'};">${escapeHtml(f.username)}</span>
        ${isGroupLeader ? '<span style="color:#ffd166; font-size:14px;">👑</span>' : ''}
        ${isInMyGroup && !isGroupLeader ? '<span style="color:#ffd166; font-size:10px;">(в групі)</span>' : ''}
      </div>
      <div style="display:flex; gap:4px;">
        <button onclick="removeFriend('${f.username}')" class="friend-remove-btn" title="Видалити з друзів">✕</button>
      </div>
    </div>`;
  }).join('');
  const hasSelected = Array.from(selectedFriends).some(u => friendsData.friends.some(f => f.username === u && f.status === 'online'));
  if (groupInviteSelectedBtn) {
    groupInviteSelectedBtn.disabled = !hasSelected || !currentGroupId || !isLeader;
    groupInviteSelectedBtn.onclick = () => {
      if (!currentGroupId || !isLeader) return;
      const selected = Array.from(selectedFriends).filter(u => 
        friendsData.friends.some(f => f.username === u && f.status === 'online')
      );
      for (const u of selected) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'group_invite', username: u }));
        }
      }
      selectedFriends.clear();
      renderFriends();
    };
  }
  renderRequests();
  renderSentRequests();
  updateGroupButtons();
  updateGroupStatusBar();

  // Оновлюємо статуси онлайн у приватних чатах
  for (const [username, data] of Object.entries(chatState.private)) {
    const friend = friendsData.friends.find(f => f.username === username);
    if (friend) {
      data.online = friend.status === 'online';
      updateChatTabOnline(getPrivateTabId(username));
    }
  }
}

function updateGroupButtons() {
  const isInGroup = currentGroupId !== null;
  const isLeader = isInGroup && groupMembers.some(m => m.isLeader && m.username === currentUsername);
  if (groupCreateBtn) {
    if (isInGroup) {
      groupCreateBtn.textContent = isLeader ? '👑 Ви лідер' : '👥 Ви в групі';
      groupCreateBtn.disabled = true;
    } else {
      groupCreateBtn.textContent = '➕ Створити групу';
      groupCreateBtn.disabled = false;
    }
  }
  if (groupInviteSelectedBtn) {
    if (isLeader && isInGroup) {
      groupInviteSelectedBtn.textContent = '📩 Запросити обраних';
      groupInviteSelectedBtn.style.display = 'block';
      groupInviteSelectedBtn.disabled = !(selectedFriends.size > 0);
    } else if (isInGroup && !isLeader) {
      groupInviteSelectedBtn.textContent = '🚪 Вийти з групи';
      groupInviteSelectedBtn.style.display = 'block';
      groupInviteSelectedBtn.disabled = false;
      groupInviteSelectedBtn.onclick = leaveGroup;
    } else {
      groupInviteSelectedBtn.style.display = 'none';
    }
  }
}

function toggleSelectFriend(username, checked) {
  if (checked) selectedFriends.add(username);
  else selectedFriends.delete(username);
  renderFriends();
}

function renderRequests() {
  const requestsList = friendRequestsList;
  const allRequests = [];
  for (const from of (friendsData.requests || [])) {
    allRequests.push({ from, type: 'friend', status: 'pending' });
  }
  for (const req of (friendsData.groupRequests || [])) {
    allRequests.push({ from: req.from, type: 'group', status: 'pending', groupId: req.groupId });
  }
  if (allRequests.length === 0) {
    requestsList.innerHTML = '<div style="color:#555; text-align:center; padding:8px 0; font-size:13px;">Немає запитів</div>';
    return;
  }
  requestsList.innerHTML = allRequests.map(req => {
    const typeLabel = req.type === 'friend' ? 'Друзі' : 'Група';
    const typeClass = req.type === 'friend' ? 'friend' : 'group';
    if (req.type === 'group') {
      return `<div class="request-item">
        <span class="request-from">${escapeHtml(req.from)}</span>
        <span class="request-type ${typeClass}">${typeLabel}</span>
        <span class="request-status">⏳ Очікується...</span>
        <div class="request-actions">
          <button class="accept" onclick="acceptGroupRequest('${req.from}', '${req.groupId}')">✓</button>
          <button class="deny" onclick="denyGroupRequest('${req.from}')">✕</button>
        </div>
      </div>`;
    }
    return `<div class="request-item">
      <span class="request-from">${escapeHtml(req.from)}</span>
      <span class="request-type ${typeClass}">${typeLabel}</span>
      <span class="request-status">⏳ Очікується...</span>
      <div class="request-actions">
        <button class="accept" onclick="acceptFriendRequest('${req.from}')">✓</button>
        <button class="deny" onclick="denyFriendRequest('${req.from}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderSentRequests() {
  const sentList = document.getElementById('sentRequestsList');
  const sentSection = document.getElementById('sentRequestsSection');
  if (!sentList || !sentSection) return;
  const sent = friendsData.sentRequests || [];
  if (sent.length === 0) {
    sentList.innerHTML = '';
    sentSection.style.display = 'none';
    return;
  }
  sentSection.style.display = 'block';
  sentList.innerHTML = sent.map(item => {
    const typeLabel = item.type === 'friend' ? 'Друзі' : 'Група';
    const typeClass = item.type === 'friend' ? 'friend' : 'group';
    return `<div class="request-item">
      <span class="request-from">${escapeHtml(item.target)}</span>
      <span class="request-type ${typeClass}">${typeLabel}</span>
      <span class="request-status">⏳ Очікується...</span>
      <div class="request-actions">
        <button class="deny" onclick="cancelSentRequest('${item.target}', '${item.type}')" style="padding:4px 12px; border:none; border-radius:4px; background:#e04b3b; color:#fff; cursor:pointer; font-family:inherit; font-size:12px;">✕ Відкликати</button>
      </div>
    </div>`;
  }).join('');
}

function acceptFriendRequest(from) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_accept', username: from }));
}

function denyFriendRequest(from) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_deny', username: from }));
}

function acceptGroupRequest(from, groupId) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_join', groupId }));
}

function denyGroupRequest(from) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_deny', username: from }));
}

function cancelSentRequest(target, type) {
  if (!confirm(`Відкликати запит до "${target}"?`)) return;
  if (type === 'friend') {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_cancel_request', username: target }));
  }
}

function addFriend(username) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'friends_add', username }));
  }
}

function removeFriend(username) {
  if (!confirm(`Видалити ${username} з друзів?`)) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'friends_remove', username }));
  }
}

function updateFriendBadge() {
  if (openFriendsBtn) {
    const incomingCount = (friendsData.requests || []).length + (friendsData.groupRequests || []).length;
    if (incomingCount > 0) {
      openFriendsBtn.textContent = `👥 Друзі (${incomingCount})`;
      openFriendsBtn.style.background = '#2c3a4d';
      openFriendsBtn.style.color = '#4ce06a';
      openFriendsBtn.style.border = '2px solid #4ce06a';
    } else {
      openFriendsBtn.textContent = '👥 Друзі';
      openFriendsBtn.style.background = '#2c3a4d';
      openFriendsBtn.style.color = '#fff';
      openFriendsBtn.style.border = 'none';
    }
  }
}

// ============================================================
//  ВИБІР КАРТИ
// ============================================================
function openMapSelector() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'get_maps' }));
  }
}

function renderMapSelector(maps) {
  let modal = document.getElementById('mapSelectorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mapSelectorModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content map-selector-content">
        <button class="close" onclick="closeMapSelector()">&times;</button>
        <div id="mapGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:16px; margin-top:16px; max-height:55vh; overflow-y:auto; padding:4px;">
        </div>
        <button id="mapSelectorBackBtn" style="
          width:100%; 
          padding:12px; 
          margin-top:16px; 
          border:2px solid #2c3a4d; 
          border-radius:6px; 
          background:transparent; 
          color:#93a1b0; 
          font-weight:bold; 
          font-size:13px; 
          letter-spacing:1px; 
          cursor:pointer; 
          font-family:inherit; 
          transition:all 0.2s;
        " onmouseover="this.style.borderColor='#23d3c5'; this.style.color='#23d3c5'; this.style.background='rgba(35,211,197,0.05)';" 
        onmouseout="this.style.borderColor='#2c3a4d'; this.style.color='#93a1b0'; this.style.background='transparent';">← НАЗАД</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('mapSelectorBackBtn').addEventListener('click', closeMapSelector);
  }

  const grid = document.getElementById('mapGrid');
  grid.innerHTML = maps.map(map => `
    <div class="map-card" data-map-id="${map.id}" onclick="selectMap('${map.id}')" style="
      background:#0d1117; border:2px solid #2c3a4d; 
      border-radius:8px; padding:8px; text-align:center; cursor:pointer; transition:all 0.2s;
    ">
      <img src="/maps/${map.preview}" alt="${map.name}" style="width:100%; height:auto; aspect-ratio:19/17; object-fit:cover; border-radius:4px; background:#1c2531; image-rendering:pixelated;" onerror="this.style.display='none'">
      <div style="margin-top:6px; font-weight:bold; color:#fff; font-size:14px;">${map.name}</div>
    </div>
  `).join('');

  modal.classList.remove('hidden');

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeMapSelector();
  });
}

function closeMapSelector() {
  const modal = document.getElementById('mapSelectorModal');
  if (modal) modal.classList.add('hidden');
}

function selectMap(mapId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'select_map', mapId }));
  }
  closeMapSelector();
}

function updateMapButton() {
  const btn = document.getElementById('selectMapBtn');
  if (selectedMap) {
    btn.textContent = `${selectedMap.name}`;
    btn.style.borderColor = '#4ce06a';
    btn.style.color = '#4ce06a';
  } else {
    btn.textContent = 'Обрати мапу';
    btn.style.borderColor = '#23d3c5';
    btn.style.color = '#23d3c5';
  }
}

// ============================================================
//  КНОПКА "У БІЙ!"
// ============================================================
function updateEnterButton() {
  if (!currentGroupId || groupMembers.length === 0) {
    enterArenaBtn.textContent = '⚔️ У БІЙ!';
    enterArenaBtn.style.background = '#ffd166';
    enterArenaBtn.style.color = '#0d1117';
    return;
  }
  const isLeader = groupMembers.some(m => m.isLeader && m.username === currentUsername);
  if (isLeader) {
    const allReady = groupMembers.every(m => m.isLeader || m.status === 'ready');
    const hasEnough = groupMembers.length >= 2;
    if (allReady && hasEnough) {
      enterArenaBtn.textContent = '⚔️ БІЙ!';
      enterArenaBtn.style.background = '#ffd166';
      enterArenaBtn.style.color = '#0d1117';
    } else {
      enterArenaBtn.textContent = '⏳ Очікуйте готовності...';
      enterArenaBtn.style.background = '#2c3a4d';
      enterArenaBtn.style.color = '#93a1b0';
    }
  } else {
    const member = groupMembers.find(m => m.username === currentUsername);
    const isReady = member?.status === 'ready';
    enterArenaBtn.textContent = isReady ? '✅ Готово' : '❌ Готовий?';
    enterArenaBtn.style.background = isReady ? '#4ce06a' : '#2c3a4d';
    enterArenaBtn.style.color = isReady ? '#0d1117' : '#93a1b0';
  }
}

enterArenaBtn.addEventListener('click', function() {
  refreshFriendsData();
  
  if (currentGroupId) {
    const isLeader = groupMembers.some(m => m.isLeader && m.username === currentUsername);
    if (isLeader) {
      const allReady = groupMembers.every(m => m.isLeader || m.status === 'ready');
      const hasEnough = groupMembers.length >= 2;
      if (!hasEnough) {
        showToast('Потрібно мінімум 2 гравці для бою', 'warning');
        return;
      }
      if (allReady) {
        if (confirm('Всі готові? Починаємо бій!')) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'group_battle' }));
          }
        }
        return;
      } else {
        showToast('Не всі готові до бою!', 'warning');
        return;
      }
    } else {
      toggleReady();
      return;
    }
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    statsMsg.textContent = 'З\'єднання втрачено. Перезаходимо...';
    reconnectAndShowStats();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN && currentUsername) {
        statsMsg.textContent = '';
        enterArenaBtn.disabled = true;
        enterArenaBtn.textContent = 'ВХІД...';
        ws.send(JSON.stringify({ type: 'enter_arena' }));
      }
    }, 1000);
    return;
  }
  statsMsg.textContent = '';
  enterArenaBtn.disabled = true;
  enterArenaBtn.textContent = 'ВХІД...';
  ws.send(JSON.stringify({ type: 'enter_arena' }));
});

// ============================================================
//  ЛОБІ
// ============================================================
function updateLobbyUI(msg) {
  if (lobbyCount) lobbyCount.textContent = msg.count || (msg.players || []).length;
  if (lobbyMax) lobbyMax.textContent = msg.max || 5;
  if (lobbyTimer) lobbyTimer.textContent = `⏱ ${msg.timer || 30}с`;

  if (!lobbyPlayersList) return;

  // ОНОВЛЮЄМО НАЗВУ КАРТИ
  if (msg.mapName) {
    lobbyMapName = msg.mapName;
  }
  
  const titleEl = document.querySelector('#lobbyScreen h1');
  if (titleEl) {
    titleEl.innerHTML = `
      Готові до гри!
      <span style="display:block; font-size:18px; color:#4ce06a; font-weight:500; margin-top:8px;">${lobbyMapName}</span>
    `;
    titleEl.style.color = '#7fdcd1';
  }

  let html = '';
  const players = msg.players || [];
  
  if (players.length === 0) {
    html = `<div class="lobby-empty">Очікуємо гравців...</div>`;
  } else {
    players.forEach((player, i) => {
      const displayName = typeof player === 'object' ? player.username : player;
      const isMe = displayName === currentUsername;
      const isFriend = friendsData.friends.some(f => f.username === displayName && f.status === 'online');
      
      let nameColor = '#ffffff';
      if (isMe) nameColor = '#ffd166';
      else if (isFriend) nameColor = '#4ce06a';
      
      html += `
        <div class="lobby-player-item">
          <span class="lobby-player-num">${i + 1}.</span>
          <span class="lobby-player-name" style="color:${nameColor};">${escapeHtml(displayName)}</span>
        </div>`;
    });
  }

  lobbyPlayersList.innerHTML = html;
}

// ============================================================
//  ЛОГІН
// ============================================================
function login() {
  const username = loginInput.value.trim();
  const password = passInput.value;
  loginMsg.textContent = '';

  if (!username || !password) {
    loginMsg.textContent = 'Введи логін і пароль.';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'З\'ЄДНАННЯ...';

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', username, password }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);

      if (msg.type === 'auth_error') {
        loginMsg.textContent = msg.message;
        loginBtn.disabled = false;
        loginBtn.textContent = 'УВІЙТИ';
        ws.close();
        return;
      }

      if (msg.type === 'auth_ok') {
        currentUsername = username;      
        updateMapButton();
        
        if (msg.stats) {
          currentUserId = msg.stats.userId || '—';
        }
        if (msg.friendRequests) {
          friendsData.requests = msg.friendRequests || [];
        }
        if (msg.sentRequests) {
          friendsData.sentRequests = msg.sentRequests || [];
        }
        updateFriendBadge();
        showStats(msg.stats);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'group_get_info' }));
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat_history', channel: 'world' }));
        }
        refreshFriendsData();
        return;
      }

      // ---------- ЧАТ ----------
      if (msg.type === 'chat_message') {
        if (msg.channel === 'world') {
          addChatMessage('world', msg.from, msg.text);
        } else if (msg.channel === 'group') {
          addChatMessage('group', msg.from, msg.text);
        } else if (msg.channel === 'private') {
          const from = msg.from;
          if (!chatState.private[from]) {
            createPrivateChat(from);
          }
          addChatMessage(getPrivateTabId(from), msg.from, msg.text);
        }
        return;
      }

      if (msg.type === 'chat_history') {
        if (msg.channel === 'world' && msg.messages) {
          chatState.world.messages = msg.messages;
          if (chatState.activeTab === 'world') {
            renderChatMessages('world');
          }
        }
        return;
      }

      // ---------- ІНФОРМАЦІЯ ПРО КАРТУ В ЛОБІ ----------
      if (msg.type === 'lobby_map_info') {
        lobbyMapName = msg.mapName;
        const titleEl = document.querySelector('#lobbyScreen h1');
        if (titleEl) {
          titleEl.innerHTML = `
            Готові до гри!
            <span style="display:block; font-size:18px; color:#4ce06a; font-weight:500; margin-top:4px;">${lobbyMapName}</span>
          `;
          titleEl.style.color = '#7fdcd1';
        }
        return;
      }

      // Системні повідомлення групи
      if (msg.type === 'group_joined') {
        addSystemMessage('group', `${msg.username || 'Гравець'} приєднався до групи`);
      }

      if (msg.type === 'group_left' || msg.type === 'group_kicked') {
        addSystemMessage('group', `${msg.username || 'Гравець'} покинув групу`);
      }

      if (msg.type === 'group_promote_done') {
        addSystemMessage('group', `👑 Лідерство передано ${msg.target}`);
      }

      // ---------- ДРУЗІ ----------
      if (msg.type === 'friends_list') {
        friendsData.friends = msg.friends || [];
        friendsData.requests = msg.requests || [];
        friendsData.groupRequests = msg.groupRequests || [];
        renderFriends();
        updateFriendBadge();
        return;
      }

      if (msg.type === 'friends_add_result') {
        if (msg.success) {
          showToast(`Запит надіслано ${msg.target}`, 'success');
          if (!friendsData.sentRequests.some(r => r.target === msg.target && r.type === 'friend')) {
            friendsData.sentRequests.push({ target: msg.target, type: 'friend' });
          }
          friendSearchInput.value = '';
          friendSearchResults.style.display = 'none';
        } else {
          showToast(msg.error, 'error');
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friends_accept_result') {
        if (msg.success) {
          showToast(`✅ ${msg.from} тепер у друзях!`, 'success');
          friendsData.sentRequests = friendsData.sentRequests.filter(r => !(r.target === msg.from && r.type === 'friend'));
          friendsData.requests = friendsData.requests.filter(u => u !== msg.from);
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        updateFriendBadge();
        return;
      }

      if (msg.type === 'friends_deny_result') {
        if (msg.success) {
          showToast(`Запит від ${msg.from} відхилено`, 'info');
          friendsData.sentRequests = friendsData.sentRequests.filter(r => !(r.target === msg.from && r.type === 'friend'));
          friendsData.requests = friendsData.requests.filter(u => u !== msg.from);
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        updateFriendBadge();
        return;
      }

      if (msg.type === 'friends_remove_result') {
        if (msg.success) {
          showToast(`${msg.friend} видалено з друзів`, 'info');
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friends_cancel_result') {
        if (msg.success) {
          showToast(`Запит до ${msg.target} відкликано`, 'info');
          friendsData.sentRequests = friendsData.sentRequests.filter(r => !(r.target === msg.target && r.type === 'friend'));
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friends_refresh') {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friend_request_notify') {
        if (!friendsData.sentRequests.some(r => r.target === msg.from && r.type === 'friend')) {
          showToast(`📩 ${msg.from} хоче додати вас у друзі!`, 'warning');
          if (!friendsData.requests.includes(msg.from)) {
            friendsData.requests.push(msg.from);
          }
          updateFriendBadge();
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friend_request_cancelled') {
        showToast(`${msg.from} відкликав запит у друзі`, 'info');
        friendsData.requests = friendsData.requests.filter(u => u !== msg.from);
        friendsData.sentRequests = friendsData.sentRequests.filter(r => r.target !== msg.from);
        updateFriendBadge();
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friend_accepted') {
        showToast(`✅ ${msg.username} тепер у друзях!`, 'success');
        friendsData.sentRequests = friendsData.sentRequests.filter(r => r.target !== msg.username);
        friendsData.requests = friendsData.requests.filter(u => u !== msg.username);
        updateFriendBadge();
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friend_removed') {
        showToast(`${msg.username} видалив вас з друзів`, 'info');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'friends_get' }));
        renderFriends();
        return;
      }

      if (msg.type === 'friend_status_update') {
        const friend = friendsData.friends.find(f => f.username === msg.username);
        if (friend) {
          friend.status = msg.status;
          renderFriends();
        }
        return;
      }

      // ---------- ГРУПИ ----------
      if (msg.type === 'group_created') {
        currentGroupId = msg.groupId;
        showToast('Групу створено!', 'success');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_get_info' }));
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_update') {
        currentGroupId = msg.groupId;
        groupMembers = msg.members || [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_info') {
        currentGroupId = msg.groupId || null;
        groupMembers = msg.members || [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_not_in') {
        currentGroupId = null;
        groupMembers = [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_invite_notify') {
        const groupId = msg.groupId;
        const from = msg.from;
        if (confirm(`📩 ${from} запрошує вас у групу! Приєднатися?`)) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'group_join', groupId }));
          }
        } else {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'group_deny', username: from }));
          }
        }
        return;
      }

      if (msg.type === 'group_invite_result') {
        if (msg.success) {
          showToast(`Запрошення надіслано ${msg.target}`, 'success');
          if (!friendsData.sentRequests.some(r => r.target === msg.target && r.type === 'group')) {
            friendsData.sentRequests.push({ target: msg.target, type: 'group' });
          }
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        renderFriends();
        return;
      }

      if (msg.type === 'group_joined') {
        currentGroupId = msg.groupId;
        showToast('Ви приєдналися до групи!', 'success');
        friendsData.requests = friendsData.requests.filter(u => u !== msg.from);
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_get_info' }));
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_left') {
        currentGroupId = null;
        groupMembers = [];
        showToast('Ви вийшли з групи', 'info');
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_kick_result') {
        if (msg.success) {
          showToast(`${msg.target} вигнано з групи`, 'warning');
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_get_info' }));
        } else {
          showToast(msg.error || 'Помилка', 'error');
        }
        return;
      }

      if (msg.type === 'group_kicked') {
        showToast(`Вас вигнали з групи`, 'error');
        currentGroupId = null;
        groupMembers = [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_promote_done') {
        showToast(`Лідерство передано ${msg.target}`, 'success');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_get_info' }));
        return;
      }

      if (msg.type === 'group_promoted') {
        showToast(`Ви стали лідером групи! 👑`, 'success');
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'group_get_info' }));
        return;
      }

      if (msg.type === 'group_dismiss_done') {
        showToast('Групу розформовано', 'info');
        currentGroupId = null;
        groupMembers = [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_dismissed') {
        showToast('Групу розформовано лідером', 'info');
        currentGroupId = null;
        groupMembers = [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_battle_started') {
        showToast('⚔️ Бій розпочинається!', 'success');
        currentGroupId = null;
        groupMembers = [];
        updateGroupStatusBar();
        renderFriends();
        return;
      }

      if (msg.type === 'group_error') {
        showToast('❌ ' + msg.message, 'error');
        return;
      }

      // ---------- ВИБІР КАРТИ ----------
      if (msg.type === 'maps_list') {
        mapsList = msg.maps;
        renderMapSelector(msg.maps);
        return;
      }

      if (msg.type === 'map_selected') {
  const map = mapsList.find(m => m.id === msg.mapId);
  if (map) {
    selectedMap = map;
    updateMapButton();
    // Повідомлення вимкнено
  }
  return;
}

      if (msg.type === 'map_error') {
        showToast('❌ ' + msg.message, 'error');
        return;
      }

     if (msg.type === 'game_map_info') {
  // showToast(`🗺️ Карта: ${msg.mapName}`, 'info');  // ЗАКОМЕНТУВАТИ
  return;
}

      // ---------- ЛОБІ ----------
      if (msg.type === 'lobby_update') {
        isInLobby = true;
        showScreen(lobbyScreen);
        updateLobbyUI(msg);
        return;
      }

      if (msg.type === 'lobby_timer') {
        if (lobbyTimer) {
          lobbyTimer.textContent = `⏱ ${msg.timer}с`;
        }
        return;
      }

      if (msg.type === 'lobby_status') {
        showScreen(lobbyScreen);
        isInLobby = true;
        updateLobbyUI(msg);
        return;
      }

      if (msg.type === 'lobby_error') {
        showToast(msg.message, 'error');
        return;
      }

      if (msg.type === 'lobby_return') {
        isInLobby = false;
        showScreen(statsScreen);
        enterArenaBtn.disabled = false;
        enterArenaBtn.textContent = '⚔️ У БІЙ!';
        showToast('Повернення в меню', 'info');
        return;
      }

      if (msg.type === 'lobby_left') {
        isInLobby = false;
        showScreen(statsScreen);
        enterArenaBtn.disabled = false;
        enterArenaBtn.textContent = '⚔️ У БІЙ!';
        return;
      }

      // ---------- ГРА ----------
      if (msg.type === 'init') {
        myId = msg.id;
        TILE = msg.tile;
        COLS = msg.cols;
        ROWS = msg.rows;
        canvas.width = COLS * TILE;
        canvas.height = ROWS * TILE;
        showScreen(gameEl);
        requestAnimationFrame(render);
        return;
      }

      if (msg.type === 'full') {
        statsMsg.textContent = 'Арена заповнена (максимум 8 гравців). Спробуй пізніше.';
        enterArenaBtn.disabled = false;
        enterArenaBtn.textContent = '⚔️ У БІЙ!';
        return;
      }

      if (msg.type === 'state') {
        latestState = msg;
        stateBuffer.push({ t: performance.now(), players: msg.players });
        if (stateBuffer.length > 20) stateBuffer.shift();
        updateTopbar(msg);
      }

      if (msg.type === 'match_over') {
        handleMatchOver(msg.standings, msg.winnerUsername);
      }

      if (msg.type === 'match_return_to_menu') {
        if (!matchOverScreen.classList.contains('hidden')) return;
        myId = null;
        latestState = null;
        stateBuffer = [];
        isInLobby = false;
        showScreen(statsScreen);
        enterArenaBtn.disabled = false;
        enterArenaBtn.textContent = '⚔️ У БІЙ!';
        showToast('Матч завершено! Повернення в меню.', 'info');
        return;
      }

    } catch (e) {
      console.error('Error parsing message:', e);
    }
  };

  ws.onclose = () => {
    if (!gameEl.classList.contains('hidden')) {
      if (matchOverScreen.classList.contains('hidden')) {
        showScreen(loginScreen);
        loginBtn.disabled = false;
        loginBtn.textContent = 'УВІЙТИ';
      }
    } else if (statsScreen.classList.contains('hidden') && loginScreen.classList.contains('hidden') === false) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'УВІЙТИ';
    }
    isInLobby = false;
  };
}

// Вихід з лобі
if (leaveLobbyBtn) {
  leaveLobbyBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave_lobby' }));
    }
  });
}

if (friendsBackBtn) friendsBackBtn.addEventListener('click', () => showScreen(statsScreen));
if (friendSearchBtn) friendSearchBtn.addEventListener('click', searchFriends);
if (friendSearchInput) {
  friendSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchFriends();
  });
}
if (groupCreateBtn) groupCreateBtn.addEventListener('click', createGroup);
if (openFriendsBtn) openFriendsBtn.addEventListener('click', openFriends);

// Кнопки контекстного меню чату
document.getElementById('ctxAddFriend')?.addEventListener('click', () => chatContextAction('friend'));
document.getElementById('ctxPrivateChat')?.addEventListener('click', () => chatContextAction('private'));

// Кнопка вибору карти
document.getElementById('selectMapBtn').addEventListener('click', function() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    openMapSelector();
  } else {
    showToast('❌ Немає з\'єднання з сервером', 'error');
  }
});

// Відправка повідомлення в чаті
function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  let channel = 'world';
  let target = null;

  if (chatState.activeTab === 'group') {
    channel = 'group';
  } else if (isPrivateTab(chatState.activeTab)) {
    channel = 'private';
    target = getUsernameFromTab(chatState.activeTab);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat_message', channel, text, target }));
  }
  chatInput.value = '';
}

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

function searchFriends() {
  const query = friendSearchInput.value.trim();
  if (!query || query.length < 1) {
    friendSearchResults.style.display = 'none';
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'friends_search', query }));
  }
}

function renderSearchResults(results) {
  const container = friendSearchResults;
  if (!results || results.length === 0) {
    container.innerHTML = '<div style="color:#555; padding:8px 0; text-align:center;">Нічого не знайдено</div>';
    container.style.display = 'block';
    return;
  }
  container.innerHTML = results.map(r => {
    const isInMyGroup = groupMembers.some(m => m.username === r.username);
    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #1c2531;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${r.isOnline ? '#4ce06a' : '#555'};"></span>
        <div>
          <span style="color:${r.isOnline ? '#7fdcd1' : '#93a1b0'}; font-weight:bold;">${escapeHtml(r.username)}</span>
          <span style="font-size:10px; color:#555; margin-left:6px;">#${escapeHtml(r.userId)}</span>
        </div>
      </div>
      ${r.isFriend ? '<span style="color:#4ce06a; font-size:12px;">✓ У друзях</span>' : 
        r.hasRequest ? '<span style="color:#ffd166; font-size:12px;">⏳ Запит надіслано</span>' :
        `<button onclick="addFriend('${r.username}')" style="padding:4px 12px; border:none; border-radius:4px; background:#23d3c5; color:#0d1117; cursor:pointer; font-family:inherit; font-size:12px; font-weight:bold;">Додати</button>`
      }
      ${isInMyGroup ? '<span style="color:#ffd166; font-size:10px; margin-left:4px;">(в групі)</span>' : ''}
    </div>`;
  }).join('');
  container.style.display = 'block';
}

// ============================================================
//  ВИХІД З ГРИ
// ============================================================
if (exitGameBtn) {
  exitGameBtn.addEventListener('click', () => {
    if (confirm('Ви впевнені, що хочете вийти з гри?')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_arena' }));
      }
      myId = null;
      latestState = null;
      stateBuffer = [];
      isInLobby = false;
      showScreen(statsScreen);
      enterArenaBtn.disabled = false;
      enterArenaBtn.textContent = '⚔️ У БІЙ!';
      showToast('Ви вийшли з гри', 'info');
    }
  });
}

// ============================================================
//  СТАТИСТИКА
// ============================================================
function showStats(stats) {
  statsUsername.textContent = stats.username;
  statsUserId.textContent = stats.userId || '—';
  
  document.getElementById('statsRankBadge').src = `ranks/rank_${stats.rankNum}.png`;
  document.getElementById('statsRankName').textContent = stats.rank;
  document.getElementById('statsKills').textContent = stats.kills;
  document.getElementById('statsDeaths').textContent = stats.deaths;
  document.getElementById('statsWins').textContent = stats.wins || 0;
  
  showScreen(statsScreen);
  updateEnterButton();
  renderChatMessages('world');
}

function reconnectAndShowStats() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    if (currentUsername) {
      ws.send(JSON.stringify({ type: 'auth', username: currentUsername, password: '' }));
    }
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'auth_error') {
        showScreen(loginScreen);
        loginBtn.disabled = false;
        loginBtn.textContent = 'УВІЙТИ';
        return;
      }
      if (msg.type === 'auth_ok') {
        showStats(msg.stats);
      }
    } catch (e) {}
  };
  ws.onerror = () => {
    showScreen(loginScreen);
    loginBtn.disabled = false;
    loginBtn.textContent = 'УВІЙТИ';
  };
}

loginBtn.addEventListener('click', login);
passInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});
loginInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') passInput.focus();
});

// ============================================================
//  Керування в грі
// ============================================================
const keyState = { up: false, down: false, left: false, right: false };
let keyOrder = [];
let lastSentKeys = '';

function sendKeys() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const s = JSON.stringify({ keyState, keyOrder });
  if (s !== lastSentKeys) {
    lastSentKeys = s;
    ws.send(JSON.stringify({ type: 'input', keys: keyState, order: keyOrder }));
  }
}

const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  if (gameEl.classList.contains('hidden')) return;
  if (KEY_MAP[e.code]) {
    const dir = KEY_MAP[e.code];
    keyState[dir] = true;
    keyOrder = keyOrder.filter((k) => k !== dir);
    keyOrder.push(dir);
    sendKeys();
    e.preventDefault();
  } else if (e.code === 'Space') {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'bomb' }));
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  if (KEY_MAP[e.code]) {
    const dir = KEY_MAP[e.code];
    keyState[dir] = false;
    keyOrder = keyOrder.filter((k) => k !== dir);
    sendKeys();
    e.preventDefault();
  }
});

// ============================================================
//  Верхня панель
// ============================================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTopbar(msg) {
  timerEl.textContent = formatTime(msg.roundTimer);
  const players = Object.values(msg.players);
  playerListEl.innerHTML = '';
  players.forEach((p) => {
    const isMe = p.id === myId;
    const isFriend = friendsData.friends.some(f => f.username === p.nickname && f.status === 'online');
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (p.alive ? '' : ' dead');
    
    const nameColor = isFriend ? '#4ce06a' : '#ffffff';
    
    chip.innerHTML = `
      <div class="chip-color" style="background:${p.color}"></div>
      <span style="color:${nameColor}; font-weight:bold;">${escapeHtml(p.nickname)}</span>
      <div class="chip-kills">☠ ${p.kills}</div>
      ${isMe ? '<span style="margin-left:3px; font-size:10px; color:#ffd166;">(ти)</span>' : ''}
    `;
    playerListEl.appendChild(chip);
  });
  const me = msg.players[myId];
  if (me) {
    if (wasAlive && !me.alive) {
      const totalPlayers = Object.values(msg.players).length;
      if (totalPlayers >= 3) {
        deathBanner.classList.remove('hidden');
      } else {
        deathBanner.classList.add('hidden');
      }
    } else if (!wasAlive && me.alive) {
      deathBanner.classList.add('hidden');
    }
    wasAlive = me.alive;
  }
}

// ============================================================
//  Матч завершено
// ============================================================
let matchOverTimer = null;
let matchOverActive = false;

function handleMatchOver(standings, winnerUsername) {
  if (matchOverTimer) {
    clearInterval(matchOverTimer);
    matchOverTimer = null;
  }
  matchOverActive = true;
  
  const sortedStandings = [...standings].sort((a, b) => {
    if (a.username === winnerUsername) return -1;
    if (b.username === winnerUsername) return 1;
    return b.kills - a.kills || a.deaths - b.deaths;
  });
  
  matchOverTitle.textContent = winnerUsername ? `🏆 Переможець: ${winnerUsername}` : '🏆 Матч завершено';
  
  const header = `<div class="lb-row header"><span>#</span><span>Нік</span><span></span><span>Звання</span><span>Вбивств</span><span>Смертей</span><span>🏆</span></div>`;
  
  const rows = sortedStandings.map((p, i) => {
    const isWinner = p.username === winnerUsername;
    const isFriend = friendsData && friendsData.friends && 
                      friendsData.friends.some(f => f.username === p.username && f.status === 'online');
    
    let nameColor = '#d8e2ec';
    if (isWinner) {
      nameColor = '#ffd166';
    } else if (isFriend) {
      nameColor = '#4ce06a';
    }
    
    return `<div class="lb-row${isWinner ? ' winner' : ''}">
      <span class="lb-rank-num">${i + 1}</span>
      <span class="lb-name" style="color:${nameColor};">${escapeHtml(p.username)}${isWinner ? ' 🏆' : ''}</span>
      <img class="lb-badge" src="ranks/rank_${p.rankNum}.png" alt="" />
      <span>${escapeHtml(p.rank)}</span>
      <span class="lb-kills">${p.kills}</span>
      <span class="lb-deaths">${p.deaths}</span>
      <span class="lb-wins">${p.wins || 0}</span>
    </div>`;
  }).join('');
  
  matchOverStandings.innerHTML = header + rows;
  showScreen(matchOverScreen);
  
  let timeLeft = 10;
  matchOverCountdown.textContent = `Повернення через ${timeLeft} секунд...`;
  
  const oldButtons = matchOverScreen.querySelectorAll('.back-btn');
  oldButtons.forEach(btn => btn.remove());
  
  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.textContent = '⬅️ Повернутися в меню зараз';
  backBtn.style.marginTop = '12px';
  backBtn.onclick = () => {
    if (matchOverTimer) {
      clearInterval(matchOverTimer);
      matchOverTimer = null;
    }
    matchOverActive = false;
    returnToStats();
  };
  matchOverScreen.querySelector('.menu-box').appendChild(backBtn);
  
  matchOverTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      matchOverCountdown.textContent = `Повернення через ${timeLeft} секунд...`;
    } else {
      clearInterval(matchOverTimer);
      matchOverTimer = null;
      matchOverActive = false;
      returnToStats();
    }
  }, 1000);
}

function returnToStats() {
  myId = null;
  latestState = null;
  stateBuffer = [];
  isInLobby = false;
  matchOverActive = false;
  showScreen(statsScreen);
  enterArenaBtn.disabled = false;
  enterArenaBtn.textContent = '⚔️ У БІЙ!';
  if (ws && ws.readyState === WebSocket.OPEN && currentUsername) {
    ws.send(JSON.stringify({ type: 'leave_arena' }));
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN && currentUsername) {
        ws.send(JSON.stringify({ type: 'get_stats' }));
      }
    }, 100);
    return;
  }
  reconnectAndShowStats();
}

// ============================================================
//  Ігровий рендеринг
// ============================================================
const spriteImages = {};
if (typeof PLAYER_SPRITES !== 'undefined') {
  for (const color in PLAYER_SPRITES) {
    spriteImages[color] = {};
    for (const dir in PLAYER_SPRITES[color]) {
      spriteImages[color][dir] = PLAYER_SPRITES[color][dir].map((src) => {
        const img = new Image();
        img.src = src;
        return img;
      });
    }
  }
}

const deathSpriteImages = {};
if (typeof PLAYER_DEATH_SPRITES !== 'undefined') {
  for (const color in PLAYER_DEATH_SPRITES) {
    deathSpriteImages[color] = PLAYER_DEATH_SPRITES[color].map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
  }
}

function loadImgArray(arr) {
  return (arr || []).map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
}

const tileImages = {
  solidWall: typeof SOLID_WALL_FRAMES !== 'undefined' ? loadImgArray(SOLID_WALL_FRAMES) : [],
  brick: typeof BRICK_FRAMES !== 'undefined' ? loadImgArray(BRICK_FRAMES) : [],
  floor: typeof FLOOR_FRAMES !== 'undefined' ? loadImgArray(FLOOR_FRAMES) : [],
  bomb: typeof BOMB_FRAMES !== 'undefined' ? loadImgArray(BOMB_FRAMES) : [],
  flameCenter: typeof FLAME_CENTER !== 'undefined' ? loadImgArray(FLAME_CENTER) : [],
  flameMid: typeof FLAME_MID !== 'undefined' ? loadImgArray(FLAME_MID) : [],
  flameEnd: typeof FLAME_END !== 'undefined' ? loadImgArray(FLAME_END) : [],
  itemBomb: null,
  itemFlame: null,
};
if (typeof ITEM_SPRITES !== 'undefined') {
  tileImages.itemBomb = new Image();
  tileImages.itemBomb.src = ITEM_SPRITES.bomb;
  tileImages.itemFlame = new Image();
  tileImages.itemFlame.src = ITEM_SPRITES.flame;
}

function imgReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

function cycleFrame(frameCount, periodMs, offset = 0) {
  if (frameCount <= 0) return 0;
  return Math.floor((Date.now() + offset) / periodMs) % frameCount;
}

let prevGrid = null;
const brickBreakAnims = {};
const BRICK_BREAK_DURATION = 550;
const MAX_SIMULTANEOUS_BREAKS = 8;

function updateBrickBreakAnims(grid, explosions) {
  if (prevGrid) {
    const explodedKeys = new Set((explosions || []).map((e) => `${e.x},${e.y}`));
    const changed = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (prevGrid[y] && prevGrid[y][x] === 2 && grid[y][x] !== 2 && explodedKeys.has(`${x},${y}`)) {
          changed.push(`${x},${y}`);
        }
      }
    }
    if (changed.length > 0 && changed.length <= MAX_SIMULTANEOUS_BREAKS) {
      const now = Date.now();
      for (const key of changed) brickBreakAnims[key] = now;
    }
  }
  prevGrid = grid.map((row) => row.slice());
  const now = Date.now();
  for (const key in brickBreakAnims) {
    if (now - brickBreakAnims[key] > BRICK_BREAK_DURATION) delete brickBreakAnims[key];
  }
}

const playerDeathAnims = {};
const prevAlive = {};
const DEATH_ANIM_DURATION = 700;

function getInterpolatedPlayers() {
  if (stateBuffer.length === 0) return {};
  const renderTime = performance.now() - RENDER_DELAY;
  let before = stateBuffer[0];
  let after = stateBuffer[stateBuffer.length - 1];
  for (let i = 0; i < stateBuffer.length - 1; i++) {
    if (stateBuffer[i].t <= renderTime && stateBuffer[i + 1].t >= renderTime) {
      before = stateBuffer[i];
      after = stateBuffer[i + 1];
      break;
    }
  }
  const span = after.t - before.t;
  const frac = span > 0 ? Math.min(1, Math.max(0, (renderTime - before.t) / span)) : 1;
  const latest = latestState.players;
  const out = {};
  for (const id in latest) {
    const a = before.players[id];
    const b = after.players[id];
    const meta = latest[id];
    if (a && b) {
      out[id] = { ...meta, x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    } else if (b) {
      out[id] = { ...meta, x: b.x, y: b.y };
    } else {
      out[id] = meta;
    }
  }
  return out;
}

let lastRenderedPlayers = {};

function render() {
  requestAnimationFrame(render);
  if (!latestState) return;
  const { grid, bombs, explosions, items } = latestState;
  const players = getInterpolatedPlayers();
  updateBrickBreakAnims(grid, explosions);
  Object.values(players).forEach((p) => {
    const wasAliveP = prevAlive[p.id];
    if (wasAliveP && !p.alive) {
      playerDeathAnims[p.id] = { startTime: Date.now(), x: p.x, y: p.y, colorName: p.colorName };
    }
    prevAlive[p.id] = p.alive;
  });
  const now = Date.now();
  for (const id in playerDeathAnims) {
    if (now - playerDeathAnims[id].startTime > DEATH_ANIM_DURATION) delete playerDeathAnims[id];
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3d8b40';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFloor();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = grid[y][x];
      if (t === 1) drawSolidWall(x, y);
      else if (t === 2) drawBrick(x, y);
    }
  }
  drawBrickBreakOverlays();
  items.forEach((it) => drawItem(it));
  bombs.forEach((b) => drawBomb(b));
  explosions.forEach((e) => drawExplosion(e));
  Object.values(players).forEach((p) => {
    if (p.alive) drawPlayer(p);
  });
  Object.values(playerDeathAnims).forEach((anim) => drawPlayerDeath(anim));
  lastRenderedPlayers = players;
}

function drawFloor() {
  const img = tileImages.floor[0];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE, py = y * TILE;
      if (imgReady(img)) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, px, py, TILE, TILE);
      } else {
        ctx.fillStyle = 'transparent';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
}

function drawSolidWall(x, y) {
  const px = x * TILE, py = y * TILE;
  const variant = (x * 7 + y * 13) % tileImages.solidWall.length;
  const img = tileImages.solidWall[variant];
  if (imgReady(img)) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px, py, TILE, TILE);
    return;
  }
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = '#6e6e6e';
  ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = '#a5a5a5';
  ctx.fillRect(px + 3, py + 3, TILE - 6, 5);
  ctx.fillRect(px + 3, py + 3, 5, TILE - 6);
}

function drawBrick(x, y) {
  const px = x * TILE, py = y * TILE;
  const img = tileImages.brick[0];
  if (imgReady(img)) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px, py, TILE, TILE);
    return;
  }
  ctx.fillStyle = '#c47a3d';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = '#8a4f22';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
}

function drawBrickBreakOverlays() {
  for (const key in brickBreakAnims) {
    const [xs, ys] = key.split(',');
    const x = parseInt(xs, 10), y = parseInt(ys, 10);
    const t = Date.now() - brickBreakAnims[key];
    const stageCount = tileImages.brick.length - 1;
    const idx = 1 + Math.min(stageCount - 1, Math.floor((t / BRICK_BREAK_DURATION) * stageCount));
    const img = tileImages.brick[idx];
    if (imgReady(img)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE);
    }
  }
}

function drawItem(it) {
  const px = it.x * TILE, py = it.y * TILE;
  const img = it.type === 'bomb' ? tileImages.itemBomb : tileImages.itemFlame;
  if (imgReady(img)) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px, py, TILE, TILE);
    return;
  }
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (it.type === 'bomb') {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 2, TILE * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBomb(b) {
  const px = b.x * TILE, py = b.y * TILE;
  const frameIdx = cycleFrame(tileImages.bomb.length, 200);
  const img = tileImages.bomb[frameIdx];
  if (imgReady(img)) {
    const size = TILE * 0.9;
    const off = (TILE - size) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px + off, py + off, size, size);
    return;
  }
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const pulse = 1 + 0.06 * Math.sin(Date.now() / 120);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(0, 3, TILE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosion(e) {
  const cx = e.x * TILE + TILE / 2;
  const cy = e.y * TILE + TILE / 2;
  const half = TILE / 2;
  if (!e.kind || e.kind === 'center') {
    const frameIdx = cycleFrame(tileImages.flameCenter.length, 90);
    const img = tileImages.flameCenter[frameIdx];
    if (imgReady(img)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cx - half, cy - half, TILE, TILE);
      return;
    }
    drawFlameCenterFallback(cx, cy, half);
    return;
  }
  let angle = 0;
  if (e.kind.startsWith('left')) angle = Math.PI;
  else if (e.kind.startsWith('down')) angle = Math.PI / 2;
  else if (e.kind.startsWith('up')) angle = -Math.PI / 2;
  const isMid = e.kind.endsWith('mid');
  const set = isMid ? tileImages.flameMid : tileImages.flameEnd;
  const frameIdx = cycleFrame(set.length, 90);
  const img = set[frameIdx];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (imgReady(img)) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -half, -half, TILE, TILE);
  } else if (isMid) {
    drawFlameMidFallback(half);
  } else {
    drawFlameEndFallback(half);
  }
  ctx.restore();
}

function drawFlameCenterFallback(cx, cy, half) {
  ctx.save();
  ctx.translate(cx, cy);
  const r = half * 0.92;
  const layers = [
    [r, '#c2200a'],
    [r * 0.74, '#ff7a1a'],
    [r * 0.46, '#ffce4d'],
    [r * 0.22, '#fff6d0'],
  ];
  for (const [w, color] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlameMidFallback(half) {
  const h = half * 0.86;
  const layers = [
    [h, '#c2200a'],
    [h * 0.74, '#ff7a1a'],
    [h * 0.46, '#ffce4d'],
    [h * 0.22, '#fff6d0'],
  ];
  for (const [w, color] of layers) {
    ctx.fillStyle = color;
    ctx.fillRect(-half - 1, -w / 2, half * 2 + 2, w);
  }
}

function drawFlameEndFallback(half) {
  const h = half * 0.86;
  const layers = [
    [h, '#c2200a'],
    [h * 0.74, '#ff7a1a'],
    [h * 0.46, '#ffce4d'],
    [h * 0.22, '#fff6d0'],
  ];
  for (const [w, color] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-half - 1, -w / 2);
    ctx.lineTo(half * 0.35, -w / 2);
    ctx.quadraticCurveTo(half * 1.05, 0, half * 0.35, w / 2);
    ctx.lineTo(-half - 1, w / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function pickFrame(p) {
  const dirFrames = spriteImages[p.colorName] || spriteImages.white;
  if (!dirFrames) return null;
  const dir = p.facing || 'down';
  const frames = dirFrames[dir] || dirFrames.down;
  if (!frames) return null;
  if (!p.moving) return { img: frames[1] };
  const step = Math.floor(Date.now() / 130) % 4;
  const walkSeq = [0, 1, 2, 1];
  return { img: frames[walkSeq[step]] };
}

const PLAYER_RENDER_H = TILE * 1.35;
const PLAYER_FOOT_Y = TILE * 0.55;

function drawPlayer(p) {
  const cx = p.x;
  const cy = p.y;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + PLAYER_FOOT_Y, TILE * 0.26, TILE * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  const chosen = pickFrame(p);
  if (chosen && imgReady(chosen.img)) {
    const img = chosen.img;
    const renderH = PLAYER_RENDER_H;
    const renderW = renderH * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    ctx.translate(cx, cy + PLAYER_FOOT_Y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -renderW / 2, -renderH, renderW, renderH);
    ctx.restore();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // НІК НАД ГРАВЦЕМ
  const nicknameY = cy + PLAYER_FOOT_Y - PLAYER_RENDER_H - 6;
  ctx.font = '11px Courier New';
  ctx.textAlign = 'center';
  
  const isFriend = friendsData.friends.some(f => f.username === p.nickname && f.status === 'online');
  const nickColor = isFriend ? '#4ce06a' : '#ffffff';
  
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(p.nickname, cx, nicknameY);
  
  ctx.fillStyle = nickColor;
  ctx.fillText(p.nickname, cx, nicknameY);
}

function drawPlayerDeath(anim) {
  const frames = deathSpriteImages[anim.colorName] || deathSpriteImages.white;
  if (!frames) return;
  const t = Date.now() - anim.startTime;
  const frameIdx = Math.min(frames.length - 1, Math.floor((t / DEATH_ANIM_DURATION) * frames.length));
  const img = frames[frameIdx];
  if (!imgReady(img)) return;
  const cx = anim.x, cy = anim.y;
  const renderH = PLAYER_RENDER_H;
  const renderW = renderH * (img.naturalWidth / img.naturalHeight);
  const fade = 1 - t / DEATH_ANIM_DURATION;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fade));
  ctx.translate(cx, cy + PLAYER_FOOT_Y);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -renderW / 2, -renderH, renderW, renderH);
  ctx.restore();
}