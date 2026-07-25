// ============================================================
//  BOMBERMAN PVP — сервер (Node.js, ws)
//  З підтримкою друзів, груп, чату та вибором карти
//  ДИНАМІЧНІ РОЗМІРИ КАРТИ
//  ЛОКАЛЬНИЙ + ЗОВНІШНІЙ ДОСТУП (адмінка ТІЛЬКИ ЛОКАЛЬНО)
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const ACCOUNTS_FILE = path.join(__dirname, 'data', 'accounts.json');
const BANNED_FILE = path.join(__dirname, 'data', 'banned.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAPS_FILE = path.join(__dirname, 'maps', 'maps.json');
const MAPS_DIR = path.join(__dirname, 'maps');

// ------------------------------------------------------------
// Акаунти
// ------------------------------------------------------------
function loadAccounts() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}
function saveAccounts() {
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function loadBanned() {
  try {
    return JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function saveBanned() {
  fs.mkdirSync(path.dirname(BANNED_FILE), { recursive: true });
  fs.writeFileSync(BANNED_FILE, JSON.stringify(bannedUsers, null, 2));
}

function loadMaps() {
  try {
    const data = fs.readFileSync(MAPS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Помилка завантаження списку карт:', e.message);
    return [];
  }
}

// ============================================================
//  ДИНАМІЧНІ РОЗМІРИ КАРТИ
// ============================================================
let COLS = 19;
let ROWS = 17;
const TILE = 40;
const PLAYER_RADIUS = TILE * 0.65;
const PLAYER_SPEED = 5.0;

// ============================================================
//  ОБРОБКА КАРТИ CLASSIC - З ВИПАДКОВОЮ ГЕНЕРАЦІЄЮ ЦЕГЛИ
// ============================================================
function processClassicGrid(grid) {
  const newGrid = grid.map(row => [...row]);
  
  for (let y = 0; y < newGrid.length; y++) {
    for (let x = 0; x < newGrid[y].length; x++) {
      const cell = newGrid[y][x];
      
      if (cell === 1) continue;
      if (cell === 'X' || cell === 'x') {
        newGrid[y][x] = 0;
        continue;
      }
      if (cell === 3) {
        newGrid[y][x] = 0;
        continue;
      }
      if (cell === 0) {
        newGrid[y][x] = Math.random() < 0.70 ? 2 : 0;
        continue;
      }
      if (cell === 2) continue;
    }
  }
  
  return newGrid;
}

function loadMapGrid(mapId) {
  const maps = loadMaps();
  const mapInfo = maps.find(m => m.id === mapId);
  if (!mapInfo) return null;

  const mapFilePath = path.join(MAPS_DIR, mapInfo.file);
  try {
    const data = fs.readFileSync(mapFilePath, 'utf8');
    let grid = JSON.parse(data);

    if (Array.isArray(grid) && grid.length > 0 && grid.every(row => row.length === grid[0].length)) {
      const rows = grid.length;
      const cols = grid[0].length;
      
      ROWS = rows;
      COLS = cols;
      
      if (mapId === 'classic' || mapId === 'Classic') {
        grid = processClassicGrid(grid);
        console.log(`✅ Classic карта ${cols}x${rows} згенерована з випадковою цеглою`);
      }
      return grid;
    } else {
      console.warn(`Карта ${mapId} має неправильний формат.`);
      return null;
    }
  } catch (e) {
    console.error(`Помилка завантаження карти ${mapId}:`, e.message);
    return null;
  }
}

let accounts = loadAccounts();
let bannedUsers = loadBanned();
const selectedMap = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id;
  let attempts = 0;
  do {
    id = '';
    for (let i = 0; i < 10; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (Object.values(accounts).some(acc => acc.userId === id) && attempts < 100);
  return id;
}

const activeUsernames = new Map();

const RANKS = [
  { num: 1, min: 0, max: 19, name: 'Солдат' },
  { num: 2, min: 20, max: 49, name: 'Старший солдат' },
  { num: 3, min: 50, max: 99, name: 'Молодший сержант' },
  { num: 4, min: 100, max: 199, name: 'Сержант' },
  { num: 5, min: 200, max: 349, name: 'Старший сержант' },
  { num: 6, min: 350, max: 549, name: 'Головний сержант' },
  { num: 7, min: 550, max: 799, name: 'Штаб-сержант' },
  { num: 8, min: 800, max: 1099, name: 'Майстер-сержант' },
  { num: 9, min: 1100, max: 1499, name: 'Старший майстер-сержант' },
  { num: 10, min: 1500, max: 1999, name: 'Головний майстер-сержант' },
  { num: 11, min: 2000, max: 2499, name: 'Молодший лейтенант' },
  { num: 12, min: 2500, max: 2999, name: 'Лейтенант' },
  { num: 13, min: 3000, max: 4199, name: 'Старший лейтенант' },
  { num: 14, min: 4200, max: 5499, name: 'Капітан' },
  { num: 15, min: 5500, max: 6999, name: 'Майор' },
  { num: 16, min: 7000, max: 8499, name: 'Підполковник' },
  { num: 17, min: 8500, max: 9999, name: 'Полковник' },
  { num: 18, min: 10000, max: 14999, name: 'Бригадний генерал' },
  { num: 19, min: 15000, max: 19999, name: 'Генерал-майор' },
  { num: 20, min: 20000, max: 29999, name: 'Генерал-лейтенант' },
  { num: 21, min: 30000, max: Infinity, name: 'Генерал' },
];

const BASE_BOMBS = 1;
const LOBBY_WAIT_SECONDS = 3;
const MAX_PLAYERS = 5;

const GEN_MODE = process.env.GEN_MODE || 'full';

function getRank(kills) {
  return RANKS.find((r) => kills >= r.min && kills <= r.max) || RANKS[RANKS.length - 1];
}

// ============================================================
//  ФУНКЦІЯ ДЛЯ ПЕРЕВІРКИ ЛОКАЛЬНОГО ДОСТУПУ
// ============================================================
function isLocalRequest(req) {
  const ip = req.socket.remoteAddress;
  const cleanIp = ip ? ip.replace('::ffff:', '') : '';
  
  return cleanIp === '127.0.0.1' || 
         cleanIp === '::1' || 
         cleanIp === 'localhost' ||
         cleanIp.startsWith('192.168.') ||
         cleanIp.startsWith('10.') ||
         cleanIp.startsWith('172.16.') ||
         cleanIp.startsWith('172.17.') ||
         cleanIp.startsWith('172.18.') ||
         cleanIp.startsWith('172.19.') ||
         cleanIp.startsWith('172.20.') ||
         cleanIp.startsWith('172.21.') ||
         cleanIp.startsWith('172.22.') ||
         cleanIp.startsWith('172.23.') ||
         cleanIp.startsWith('172.24.') ||
         cleanIp.startsWith('172.25.') ||
         cleanIp.startsWith('172.26.') ||
         cleanIp.startsWith('172.27.') ||
         cleanIp.startsWith('172.28.') ||
         cleanIp.startsWith('172.29.') ||
         cleanIp.startsWith('172.30.') ||
         cleanIp.startsWith('172.31.');
}

// ------------------------------------------------------------
// Статичний файловий сервер
// ------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  
  // ============================================================
  //  АДМІНКА - ДОСТУП ТІЛЬКИ З ЛОКАЛЬНОЇ МЕРЕЖІ
  // ============================================================
  if (urlPath === '/X7kM9pL2wR4nQ8vF3tY6bH1jS5.html') {
    if (!isLocalRequest(req)) {
      res.writeHead(403);
      res.end('🚫 Доступ заборонено! Адмін-панель доступна тільки з локального комп\'ютера або локальної мережі.');
      return;
    }
    
    const filePath = path.join(__dirname, 'public', 'X7kM9pL2wR4nQ8vF3tY6bH1jS5.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  
  // ============================================================
  //  КАРТИ
  // ============================================================
  if (urlPath.startsWith('/maps/')) {
    const mapFilePath = path.join(__dirname, urlPath);
    if (!mapFilePath.startsWith(path.join(__dirname, 'maps'))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(mapFilePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(mapFilePath);
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
    return;
  }
  
  // ============================================================
  //  ВСІ ІНШІ СТАТИЧНІ ФАЙЛИ (з папки public)
  // ============================================================
  const filePath = path.join(__dirname, 'public', urlPath);
  
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// ------------------------------------------------------------
// Константи гри
// ------------------------------------------------------------
const ROUND_SECONDS = 300;
const BOMB_FUSE_MS = 3000;

const PLAYER_COLOR_NAMES = ['white', 'black', 'red', 'blue', 'green'];
const COLORS = ['#f4f4f4', '#3a3a3a', '#e04b3b', '#4d7dff', '#4ce06a'];

// ------------------------------------------------------------
// ЧАТ
// ------------------------------------------------------------
let chatHistory = {
  world: [],
  group: []
};
const CHAT_HISTORY_LIMIT = 100;

function sendChatMessage(from, channel, text, target = null) {
  const msg = {
    type: 'chat_message',
    from: from,
    channel: channel,
    text: text,
    time: new Date().toISOString()
  };

  if (channel === 'world') {
    chatHistory.world.push({ from, text, time: msg.time });
    if (chatHistory.world.length > CHAT_HISTORY_LIMIT) {
      chatHistory.world.shift();
    }
    broadcastToAll(msg);
  } else if (channel === 'group') {
    const groupInfo = getGroupByMember(from);
    if (groupInfo) {
      chatHistory.group.push({ from, text, time: msg.time });
      if (chatHistory.group.length > CHAT_HISTORY_LIMIT) {
        chatHistory.group.shift();
      }
      broadcastToGroup(groupInfo.id, msg);
    } else {
      sendToUser(from, { type: 'chat_error', message: 'Ви не в групі!' });
    }
  } else if (channel === 'private') {
    if (target && accounts[target]) {
      sendToUser(from, msg);
      sendToUser(target, msg);
    } else {
      sendToUser(from, { type: 'chat_error', message: 'Користувача не знайдено!' });
    }
  }
}

function sendGroupSystemMessage(groupId, text) {
  const group = getGroupById(groupId);
  if (!group) return;

  const msg = {
    type: 'chat_message',
    channel: 'group',
    from: 'system',
    text: text,
    time: new Date().toISOString()
  };

  chatHistory.group.push({ from: 'system', text, time: msg.time });
  if (chatHistory.group.length > CHAT_HISTORY_LIMIT) {
    chatHistory.group.shift();
  }

  broadcastToGroup(groupId, msg);
}

function broadcastToAll(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ------------------------------------------------------------
// Лобі
// ------------------------------------------------------------
let lobbies = [];

function createLobby() {
  const lobby = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    players: [],
    timer: LOBBY_WAIT_SECONDS,
    started: false,
    gameData: null,
    timerInterval: null,
    matchEnding: false,
    matchEndTimer: null,
    groupId: null,
    _gameInterval: null,
    _timerInterval: null,
    mapName: null,
    mapId: null,
    cols: 19,
    rows: 17,
  };
  
  if (GEN_MODE === 'empty') {
    for (let i = 0; i < 2; i++) {
      lobby.players.push({
        ws: null,
        username: '',
        slot: i,
        isBot: true
      });
    }
  }
  
  lobbies.push(lobby);
  return lobby;
}

function getMapNameForLobby(lobby) {
  if (lobby.mapName) return lobby.mapName;
  
  const maps = loadMaps();
  
  if (lobby.mapId) {
    const mapInfo = maps.find(m => m.id === lobby.mapId);
    if (mapInfo) {
      lobby.mapName = mapInfo.name;
      return mapInfo.name;
    }
  }
  
  const mapCounts = new Map();
  
  for (const player of lobby.players) {
    if (player.username && selectedMap.has(player.username)) {
      const mapId = selectedMap.get(player.username);
      const mapInfo = maps.find(m => m.id === mapId);
      if (mapInfo) {
        mapCounts.set(mapId, (mapCounts.get(mapId) || 0) + 1);
        lobby.mapId = mapId;
        lobby.mapName = mapInfo.name;
        return mapInfo.name;
      }
    }
  }
  
  if (maps.length > 0) {
    lobby.mapId = maps[0].id;
    lobby.mapName = maps[0].name;
    return maps[0].name;
  }
  
  lobby.mapName = 'Classic';
  lobby.mapId = 'classic';
  return 'Classic';
}

function updateLobbyMap(lobby) {
  const mapName = getMapNameForLobby(lobby);
  broadcastToLobby(lobby, {
    type: 'lobby_update',
    players: lobby.players.map((p) => ({ 
      username: p.username, 
      slot: p.slot + 1,
      color: COLORS[p.slot],
      colorName: PLAYER_COLOR_NAMES[p.slot]
    })),
    count: lobby.players.length,
    max: MAX_PLAYERS,
    timer: lobby.timer,
    started: lobby.started,
    mapName: mapName
  });
}

function removeLobby(lobbyId) {
  lobbies = lobbies.filter(l => l.id !== lobbyId);
}

function getLobbyByPlayer(username) {
  for (const lobby of lobbies) {
    if (lobby.players.some(p => p.username === username)) {
      return lobby;
    }
  }
  return null;
}

function getLobbyByWs(ws) {
  for (const lobby of lobbies) {
    if (lobby.players.some(p => p.ws === ws)) {
      return lobby;
    }
  }
  return null;
}

function getAvailableSlot(lobby) {
  const usedSlots = lobby.players.map(p => p.slot);
  for (let i = 0; i < MAX_PLAYERS; i++) {
    if (!usedSlots.includes(i)) return i;
  }
  return -1;
}

function broadcastToLobby(lobby, obj) {
  const msg = JSON.stringify(obj);
  for (const p of lobby.players) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msg);
    }
  }
}

// ============================================================
//  СИСТЕМА ГРУП
// ============================================================
let groups = new Map();

function createGroup(leaderUsername) {
  const groupId = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  groups.set(groupId, {
    leader: leaderUsername,
    members: new Map([
      [leaderUsername, { status: 'leader' }]
    ]),
    invites: new Map(),
  });
  return groupId;
}

function getGroupByMember(username) {
  for (const [id, group] of groups) {
    if (group.members.has(username)) return { id, ...group };
  }
  return null;
}

function getGroupById(groupId) {
  return groups.get(groupId) || null;
}

function getGroupInvitesForUser(username) {
  const invites = [];
  for (const [groupId, group] of groups) {
    if (group.invites.has(username)) {
      invites.push({
        groupId,
        from: group.invites.get(username),
      });
    }
  }
  return invites;
}

function removeGroup(groupId) {
  groups.delete(groupId);
}

function sendToUser(username, obj) {
  const ws = activeUsernames.get(username);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcastToGroup(groupId, obj, exclude = null) {
  const group = groups.get(groupId);
  if (!group) return;
  for (const username of group.members.keys()) {
    if (username === exclude) continue;
    sendToUser(username, obj);
  }
}

function groupInvite(leaderUsername, targetUsername) {
  const groupInfo = getGroupByMember(leaderUsername);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (group.leader !== leaderUsername) {
    return { error: 'Тільки лідер може запрошувати' };
  }
  
  if (group.members.size >= 5) {
    return { error: 'Група повна (макс. 5)' };
  }
  
  if (!accounts[targetUsername]) {
    return { error: 'Гравця не знайдено' };
  }
  
  if (group.members.has(targetUsername)) {
    return { error: 'Вже в групі' };
  }
  
  if (getGroupByMember(targetUsername)) {
    return { error: 'Гравець вже в іншій групі' };
  }
  
  group.invites.set(targetUsername, leaderUsername);
  
  sendToUser(targetUsername, {
    type: 'group_invite_notify',
    from: leaderUsername,
    groupId: groupInfo.id,
  });
  
  return { success: true };
}

function groupJoin(username, groupId) {
  const group = getGroupById(groupId);
  if (!group) return { error: 'Групу не знайдено' };
  
  if (group.members.has(username)) {
    return { error: 'Ви вже в групі' };
  }
  
  if (group.members.size >= 5) {
    return { error: 'Група повна (макс. 5)' };
  }
  
  if (!group.invites.has(username)) {
    return { error: 'Ви не були запрошені' };
  }
  
  group.invites.delete(username);
  group.members.set(username, { status: 'pending' });
  
  sendGroupSystemMessage(groupId, `${username} приєднався до групи`);
  
  broadcastToGroup(groupId, {
    type: 'group_update',
    groupId: groupId,
    members: Array.from(group.members.entries()).map(([u, data]) => ({
      username: u,
      status: data.status,
      isLeader: u === group.leader,
      isOnline: activeUsernames.has(u),
    })),
    leader: group.leader,
  });
  
  return { success: true };
}

function groupDeny(username, from) {
  for (const [groupId, group] of groups) {
    if (group.invites.has(username) && group.invites.get(username) === from) {
      group.invites.delete(username);
      sendToUser(from, { type: 'group_invite_denied', username });
      return { success: true };
    }
  }
  return { error: 'Запрошення не знайдено' };
}

function groupSetReady(username, ready) {
  const groupInfo = getGroupByMember(username);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (username === group.leader) {
    return { error: 'Лідер завжди готовий' };
  }
  
  const member = group.members.get(username);
  if (!member) return { error: 'Ви не в групі' };
  
  member.status = ready ? 'ready' : 'pending';
  
  broadcastToGroup(groupInfo.id, {
    type: 'group_update',
    groupId: groupInfo.id,
    members: Array.from(group.members.entries()).map(([u, data]) => ({
      username: u,
      status: data.status,
      isLeader: u === group.leader,
      isOnline: activeUsernames.has(u),
    })),
    leader: group.leader,
  });
  
  return { success: true };
}

function groupPromote(leaderUsername, targetUsername) {
  const groupInfo = getGroupByMember(leaderUsername);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (group.leader !== leaderUsername) {
    return { error: 'Тільки лідер може передавати лідерство' };
  }
  
  if (!group.members.has(targetUsername)) {
    return { error: 'Гравця немає в групі' };
  }
  
  if (targetUsername === leaderUsername) {
    return { error: 'Ви вже лідер' };
  }
  
  const oldLeader = group.leader;
  group.leader = targetUsername;
  
  const oldLeaderData = group.members.get(oldLeader);
  if (oldLeaderData) oldLeaderData.status = 'pending';
  
  const newLeaderData = group.members.get(targetUsername);
  if (newLeaderData) newLeaderData.status = 'leader';
  
  sendGroupSystemMessage(groupInfo.id, `👑 Лідерство передано ${targetUsername}`);
  
  broadcastToGroup(groupInfo.id, {
    type: 'group_update',
    groupId: groupInfo.id,
    members: Array.from(group.members.entries()).map(([u, data]) => ({
      username: u,
      status: data.status,
      isLeader: u === group.leader,
      isOnline: activeUsernames.has(u),
    })),
    leader: group.leader,
  });
  
  sendToUser(targetUsername, { type: 'group_promoted', from: oldLeader });
  
  return { success: true };
}

function groupKick(leaderUsername, targetUsername) {
  const groupInfo = getGroupByMember(leaderUsername);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (group.leader !== leaderUsername) {
    return { error: 'Тільки лідер може виганяти' };
  }
  
  if (targetUsername === leaderUsername) {
    return { error: 'Лідер не може вигнати себе' };
  }
  
  if (!group.members.has(targetUsername)) {
    return { error: 'Гравця немає в групі' };
  }
  
  sendGroupSystemMessage(groupInfo.id, `${targetUsername} був вигнаний з групи`);
  
  group.members.delete(targetUsername);
  
  if (group.members.size === 0) {
    removeGroup(groupInfo.id);
    return { success: true };
  }
  
  broadcastToGroup(groupInfo.id, {
    type: 'group_update',
    groupId: groupInfo.id,
    members: Array.from(group.members.entries()).map(([u, data]) => ({
      username: u,
      status: data.status,
      isLeader: u === group.leader,
      isOnline: activeUsernames.has(u),
    })),
    leader: group.leader,
  });
  
  sendToUser(targetUsername, { type: 'group_kicked', from: leaderUsername });
  
  return { success: true };
}

function groupLeave(username) {
  const groupInfo = getGroupByMember(username);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  
  sendGroupSystemMessage(groupInfo.id, `${username} покинув групу`);
  
  group.members.delete(username);
  
  if (group.leader === username && group.members.size > 0) {
    const newLeader = Array.from(group.members.keys())[0];
    group.leader = newLeader;
    const memberData = group.members.get(newLeader);
    if (memberData) memberData.status = 'leader';
  }
  
  if (group.members.size === 0) {
    removeGroup(groupInfo.id);
  } else {
    broadcastToGroup(groupInfo.id, {
      type: 'group_update',
      groupId: groupInfo.id,
      members: Array.from(group.members.entries()).map(([u, data]) => ({
        username: u,
        status: data.status,
        isLeader: u === group.leader,
        isOnline: activeUsernames.has(u),
      })),
      leader: group.leader,
    });
  }
  
  return { success: true };
}

function groupDismiss(leaderUsername) {
  const groupInfo = getGroupByMember(leaderUsername);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (group.leader !== leaderUsername) {
    return { error: 'Тільки лідер може розформувати групу' };
  }
  
  broadcastToGroup(groupInfo.id, { 
    type: 'group_dismissed', 
    message: 'Групу розформовано' 
  });
  
  removeGroup(groupInfo.id);
  return { success: true };
}

function groupStartBattle(leaderUsername) {
  const groupInfo = getGroupByMember(leaderUsername);
  if (!groupInfo) return { error: 'Ви не в групі' };
  
  const group = getGroupById(groupInfo.id);
  if (group.leader !== leaderUsername) {
    return { error: 'Тільки лідер може почати бій' };
  }
  
  if (group.members.size < 2) {
    return { error: 'Потрібно мінімум 2 гравці для бою' };
  }
  
  let allReady = true;
  let notReady = [];
  for (const [username, data] of group.members) {
    if (username !== group.leader && data.status !== 'ready') {
      allReady = false;
      notReady.push(username);
    }
  }
  
  if (!allReady) {
    return { error: `Не готові: ${notReady.join(', ')}` };
  }
  
  const offlineMembers = [];
  for (const username of group.members.keys()) {
    if (!activeUsernames.has(username)) {
      offlineMembers.push(username);
    }
  }
  
  if (offlineMembers.length > 0) {
    return { error: `Офлайн: ${offlineMembers.join(', ')}` };
  }
  
  let lobby = null;
  for (const l of lobbies) {
    if (!l.started && l.players.length < MAX_PLAYERS && l.groupId === null) {
      lobby = l;
      break;
    }
  }
  
  if (!lobby) {
    lobby = createLobby();
  }
  
  lobby.groupId = groupInfo.id;
  
  const mapName = getMapNameForLobby(lobby);
  
  for (const username of group.members.keys()) {
    const wsMember = activeUsernames.get(username);
    if (!wsMember || wsMember.readyState !== WebSocket.OPEN) continue;
    
    const slot = getAvailableSlot(lobby);
    if (slot === -1) break;
    
    lobby.players.push({ ws: wsMember, username, slot });
    wsMember.lobbyId = lobby.id;
  }
  
  broadcastToLobby(lobby, {
    type: 'lobby_update',
    players: lobby.players.map((p) => ({ 
      username: p.username, 
      slot: p.slot + 1,
      color: COLORS[p.slot],
      colorName: PLAYER_COLOR_NAMES[p.slot]
    })),
    count: lobby.players.length,
    max: MAX_PLAYERS,
    timer: lobby.timer,
    started: lobby.started,
    mapName: mapName
  });
  
  if (lobby.players.length >= 2 && !lobby.started) {
    startLobbyTimer(lobby);
  }
  
  removeGroup(groupInfo.id);
  
  return { success: true };
}

// ============================================================
//  ДРУЗІ
// ============================================================
function getFriendStatus(username, friend) {
  if (!accounts[friend]) return 'unknown';
  return activeUsernames.has(friend) ? 'online' : 'offline';
}

function getFriendListWithStatus(username) {
  const acc = accounts[username];
  if (!acc) return [];
  return (acc.friends || []).map(f => ({
    username: f,
    status: getFriendStatus(username, f),
  }));
}

function getFriendRequests(username) {
  const acc = accounts[username];
  if (!acc) return [];
  return acc.friendRequests || [];
}

function getSentRequests(username) {
  const sent = [];
  for (const [target, acc] of Object.entries(accounts)) {
    if ((acc.friendRequests || []).includes(username)) {
      sent.push({ target, type: 'friend' });
    }
  }
  return sent;
}

function sendFriendRequest(from, to) {
  if (!accounts[to]) return { error: 'Гравця не знайдено' };
  if (from === to) return { error: 'Не можна додати самого себе' };
  
  const fromAcc = accounts[from];
  const toAcc = accounts[to];
  
  if ((fromAcc.friends || []).includes(to)) return { error: 'Вже у друзях' };
  if ((toAcc.friendRequests || []).includes(from)) return { error: 'Запит вже відправлено' };
  
  if (!toAcc.friendRequests) toAcc.friendRequests = [];
  toAcc.friendRequests.push(from);
  saveAccounts();
  
  sendToUser(to, { type: 'friend_request_notify', from });
  return { success: true };
}

function acceptFriendRequest(username, from) {
  const acc = accounts[username];
  if (!acc) return { error: 'Акаунт не знайдено' };
  
  if (!acc.friendRequests || !acc.friendRequests.includes(from)) {
    return { error: 'Запит не знайдено' };
  }
  
  acc.friendRequests = acc.friendRequests.filter(f => f !== from);
  if (!acc.friends) acc.friends = [];
  acc.friends.push(from);
  
  const fromAcc = accounts[from];
  if (!fromAcc.friends) fromAcc.friends = [];
  if (!fromAcc.friends.includes(username)) {
    fromAcc.friends.push(username);
  }
  saveAccounts();
  
  sendToUser(username, { type: 'friend_accepted', username: from });
  sendToUser(from, { type: 'friend_accepted', username });
  return { success: true };
}

function denyFriendRequest(username, from) {
  const acc = accounts[username];
  if (!acc) return { error: 'Акаунт не знайдено' };
  acc.friendRequests = (acc.friendRequests || []).filter(f => f !== from);
  saveAccounts();
  return { success: true };
}

function removeFriend(username, friend) {
  const acc = accounts[username];
  if (!acc) return { error: 'Акаунт не знайдено' };
  acc.friends = (acc.friends || []).filter(f => f !== friend);
  
  const friendAcc = accounts[friend];
  if (friendAcc) {
    friendAcc.friends = (friendAcc.friends || []).filter(f => f !== username);
  }
  saveAccounts();
  
  sendToUser(friend, { type: 'friend_removed', username });
  return { success: true };
}

function cancelFriendRequest(username, target) {
  const acc = accounts[username];
  if (!acc) return { error: 'Акаунт не знайдено' };
  
  const targetAcc = accounts[target];
  if (!targetAcc) return { error: 'Гравця не знайдено' };
  
  if (!targetAcc.friendRequests || !targetAcc.friendRequests.includes(username)) {
    return { error: 'Запит не знайдено' };
  }
  
  targetAcc.friendRequests = targetAcc.friendRequests.filter(f => f !== username);
  saveAccounts();
  
  sendToUser(target, { type: 'friend_request_cancelled', from: username });
  return { success: true };
}

// ============================================================
//  ЛОГІКА ГРИ
// ============================================================
function getSpawns(count, cols, rows) {
  const spawns = [];
  const defaultSpawns = [
    { x: 1, y: 1 },
    { x: cols - 2, y: 1 },
    { x: 1, y: rows - 2 },
    { x: cols - 2, y: rows - 2 },
    { x: Math.floor(cols / 2), y: 1 },
    { x: Math.floor(cols / 2), y: rows - 2 },
    { x: 1, y: Math.floor(rows / 2) },
    { x: cols - 2, y: Math.floor(rows / 2) },
  ];
  
  for (let i = 0; i < count; i++) {
    spawns.push(defaultSpawns[i % defaultSpawns.length]);
  }
  return spawns;
}

function chooseMapForLobby(lobby) {
  const mapCounts = new Map();
  const maps = loadMaps();
  
  if (maps.length === 0) return 'classic';
  
  for (const player of lobby.players) {
    if (player.username && selectedMap.has(player.username)) {
      const mapId = selectedMap.get(player.username);
      mapCounts.set(mapId, (mapCounts.get(mapId) || 0) + 1);
    }
  }
  
  if (mapCounts.size > 0) {
    let maxCount = 0;
    let selectedMapId = null;
    for (const [mapId, count] of mapCounts) {
      if (count > maxCount) {
        maxCount = count;
        selectedMapId = mapId;
      }
    }
    return selectedMapId;
  }
  
  if (maps.length > 0) {
    return maps[0].id;
  }
  return 'classic';
}

function overlapsBombTile(px, py, r, bombTx, bombTy) {
  const half = r * 0.7;
  const left   = px - half;
  const right  = px + half;
  const top    = py - half;
  const bottom = py + half;
  const tileLeft   = bombTx * TILE;
  const tileRight  = tileLeft + TILE;
  const tileTop    = bombTy * TILE;
  const tileBottom = tileTop + TILE;
  return !(right < tileLeft || left > tileRight || bottom < tileTop || top > tileBottom);
}

function solidAt(lobby, tx, ty, playerId) {
  const gd = lobby.gameData;
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  if (gd.grid[ty][tx] === 1 || gd.grid[ty][tx] === 2) return true;
  
  const bomb = gd.bombs.find((b) => b.x === tx && b.y === ty);
  if (bomb) {
    if (playerId && bomb.passableIds && bomb.passableIds.has(playerId)) {
      return false;
    }
    return true;
  }
  return false;
}

function collides(lobby, px, py, r, playerId) {
  const half = r * 0.7;
  const pts = [
    [px - half, py - half],
    [px + half, py - half],
    [px - half, py + half],
    [px + half, py + half],
  ];
  for (const [cx, cy] of pts) {
    if (solidAt(lobby, Math.floor(cx / TILE), Math.floor(cy / TILE), playerId)) return true;
  }
  return false;
}

function updatePlayers(lobby) {
  const gd = lobby.gameData;
  for (const id in gd.players) {
    const p = gd.players[id];
    if (!p.alive) continue;
    if (p.isBot) continue;

    let dx = 0, dy = 0;
    if (p.keys.left) dx -= 1;
    if (p.keys.right) dx += 1;
    if (p.keys.up) dy -= 1;
    if (p.keys.down) dy += 1;

    p.moving = dx !== 0 || dy !== 0;
    if (dx < 0) p.facing = 'left';
    else if (dx > 0) p.facing = 'right';
    else if (dy < 0) p.facing = 'up';
    else if (dy > 0) p.facing = 'down';

    const speed = PLAYER_SPEED;

    let oldX = p.x;
    let oldY = p.y;

    if (dx !== 0) {
      const nx = p.x + dx * speed;
      if (!collides(lobby, nx, p.y, PLAYER_RADIUS, p.id)) {
        p.x = nx;
      } else {
        const maxSlide = 15;
        for (let offset = 1.5; offset <= maxSlide; offset += 1.5) {
          if (!collides(lobby, nx, p.y + offset, PLAYER_RADIUS, p.id)) {
            p.y += offset * 0.5;
            p.x = nx;
            break;
          }
          if (!collides(lobby, nx, p.y - offset, PLAYER_RADIUS, p.id)) {
            p.y -= offset * 0.5;
            p.x = nx;
            break;
          }
        }
      }
    }

    if (dy !== 0) {
      const ny = p.y + dy * speed;
      if (!collides(lobby, p.x, ny, PLAYER_RADIUS, p.id)) {
        p.y = ny;
      } else {
        const maxSlide = 15;
        for (let offset = 1.5; offset <= maxSlide; offset += 1.5) {
          if (!collides(lobby, p.x + offset, ny, PLAYER_RADIUS, p.id)) {
            p.x += offset * 0.5;
            p.y = ny;
            break;
          }
          if (!collides(lobby, p.x - offset, ny, PLAYER_RADIUS, p.id)) {
            p.x -= offset * 0.5;
            p.y = ny;
            break;
          }
        }
      }
    }

    const movedX = p.x - oldX;
    const movedY = p.y - oldY;
    const totalDistance = Math.sqrt(movedX * movedX + movedY * movedY);

    if (totalDistance > speed + 0.1) {
      const limitFactor = speed / totalDistance;
      p.x = oldX + movedX * limitFactor;
      p.y = oldY + movedY * limitFactor;
    }

    for (const bomb of gd.bombs) {
      if (bomb.passableIds && bomb.passableIds.has(p.id)) {
        if (!overlapsBombTile(p.x, p.y, PLAYER_RADIUS, bomb.x, bomb.y)) {
          bomb.passableIds.delete(p.id);
        }
      }
    }

    const itemTx = Math.floor(p.x / TILE);
    const itemTy = Math.floor(p.y / TILE);
    const idx = gd.items.findIndex(it => it.x === itemTx && it.y === itemTy);
    if (idx >= 0) {
      const it = gd.items[idx];
      if (it.type === 'bomb') p.maxBombs += 1;
      else if (it.type === 'flame') p.radius += 1;
      gd.items.splice(idx, 1);
    }
  }
}

function updateBombs(lobby) {
  const gd = lobby.gameData;
  const now = Date.now();
  const ready = gd.bombs.filter((b) => now - b.placedAt >= BOMB_FUSE_MS);
  for (const b of ready) explodeBomb(lobby, b);
}

function explodeBomb(lobby, bomb) {
  const gd = lobby.gameData;
  gd.bombs = gd.bombs.filter((b) => b !== bomb);
  
  const cells = [{ x: bomb.x, y: bomb.y, kind: 'center' }];
  const dirs = [
    { dx: 1, dy: 0, mid: 'right-mid', end: 'right-end' },
    { dx: -1, dy: 0, mid: 'left-mid', end: 'left-end' },
    { dx: 0, dy: 1, mid: 'down-mid', end: 'down-end' },
    { dx: 0, dy: -1, mid: 'up-mid', end: 'up-end' },
  ];
  
  for (const { dx, dy, mid, end } of dirs) {
    const armCells = [];
    for (let i = 1; i <= bomb.radius; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
      if (gd.grid[y][x] === 1) break;
      armCells.push({ x, y });
      if (gd.grid[y][x] === 2) {
        gd.grid[y][x] = 0;
        if (Math.random() < 0.3) {
          gd.items.push({ x, y, type: Math.random() < 0.5 ? 'bomb' : 'flame' });
        }
        break;
      }
      const chained = gd.bombs.find((b) => b.x === x && b.y === y);
      if (chained) chained.placedAt = 0;
    }
    armCells.forEach((c, i) => {
      cells.push({ x: c.x, y: c.y, kind: i === armCells.length - 1 ? end : mid });
    });
  }

  const expireAt = Date.now() + 450;
  for (const c of cells) gd.explosions.push({ x: c.x, y: c.y, kind: c.kind, expireAt });

  const owner = gd.players[bomb.ownerId];
  for (const id in gd.players) {
    const p = gd.players[id];
    if (!p.alive) continue;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    if (cells.some((c) => c.x === tx && c.y === ty)) {
      killPlayer(lobby, p, owner);
    }
  }
}

function killPlayer(lobby, victim, killer) {
  const gd = lobby.gameData;
  if (!victim.alive) return;
  victim.alive = false;
  victim.deaths += 1;
  
  if (killer && killer.id !== victim.id && !killer.isBot) {
    killer.kills += 1;
  }
  
  const aliveCount = Object.values(gd.players).filter(p => p.alive).length;
  if (aliveCount <= 1) {
    if (!lobby.matchEndTimer) {
      lobby.matchEndTimer = setTimeout(() => {
        checkMatchEnd(lobby);
        lobby.matchEndTimer = null;
      }, 3500);
    }
  }
}

function checkMatchEnd(lobby) {
  const gd = lobby.gameData;
  if (gd.matchEnding) return;
  
  const total = gd.roundParticipants.size;
  if (total === 0) return;

  const aliveIds = Object.keys(gd.players).filter((id) => gd.players[id].alive);
  const timeUp = gd.roundTimer <= 0;
  
  if (aliveIds.length === 1 || aliveIds.length === 0 || timeUp) {
    gd.matchEnding = true;
    
    if (lobby.matchEndTimer) {
      clearTimeout(lobby.matchEndTimer);
      lobby.matchEndTimer = null;
    }
    
    const sortedPlayers = Object.values(gd.players)
      .filter(p => !p.isBot)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const winnerUsername = sortedPlayers.length > 0 ? sortedPlayers[0].username : null;
    
    const standings = Array.from(gd.roundParticipants)
      .filter(username => !accounts[username]?.isBot)
      .map((username) => {
        const live = Object.values(gd.players).find((p) => p.username === username);
        const acc = accounts[username] || { kills: 0, deaths: 0, wins: 0 };
        const kills = live ? live.kills : 0;
        const deaths = live ? live.deaths : 0;
        const wins = acc.wins || 0;
        return {
          username,
          colorName: live ? live.colorName : null,
          color: live ? live.color : null,
          kills,
          deaths,
          wins,
          alive: !!(live && live.alive),
          rank: getRank(kills).name,
          rankNum: getRank(kills).num,
        };
      })
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    
    broadcastToLobby(lobby, { type: 'match_over', standings, winnerUsername });
    
    setTimeout(() => {
      finishMatch(lobby);
    }, 5000);
  }
}

function finishMatch(lobby) {
  const gd = lobby.gameData;
  
  if (lobby._gameInterval) {
    clearInterval(lobby._gameInterval);
    lobby._gameInterval = null;
  }
  if (lobby._timerInterval) {
    clearInterval(lobby._timerInterval);
    lobby._timerInterval = null;
  }
  if (lobby.matchEndTimer) {
    clearTimeout(lobby.matchEndTimer);
    lobby.matchEndTimer = null;
  }
  
  if (gd) {
    for (const id in gd.players) {
      const player = gd.players[id];
      if (player && !player.isBot) {
        const acc = accounts[player.username] || { kills: 0, deaths: 0, wins: 0 };
        accounts[player.username] = { 
          ...acc, 
          kills: (acc.kills || 0) + player.kills,
          deaths: (acc.deaths || 0) + player.deaths,
          wins: (acc.wins || 0) + (player.kills > 0 ? 1 : 0)
        };
        saveAccounts();
      }
    }
  }
  
  for (const p of lobby.players) {
    if (p.ws) {
      p.ws.playerId = null;
      p.ws.send(JSON.stringify({ type: 'match_return_to_menu' }));
    }
  }
  
  removeLobby(lobby.id);
}

function updateExplosions(lobby) {
  const gd = lobby.gameData;
  const now = Date.now();
  gd.explosions = gd.explosions.filter((e) => e.expireAt > now);
}

function tryPlaceBomb(lobby, p) {
  const gd = lobby.gameData;
  if (!p.alive) return;
  if (p.isBot) return;

  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);

  const placedByMe = gd.bombs.filter((b) => b.ownerId === p.id).length;
  if (placedByMe >= p.maxBombs) return;
  if (gd.bombs.some((b) => b.x === tx && b.y === ty)) return;

  gd.bombs.push({
    x: tx,
    y: ty,
    ownerId: p.id,
    radius: p.radius,
    placedAt: Date.now(),
    passableIds: new Set([p.id])
  });
}

function startGame(lobby) {
  if (lobby.started) return;
  
  if (GEN_MODE === 'empty') {
    const bots = lobby.players.filter(p => p.isBot);
    if (bots.length === 0) {
      for (let i = 0; i < 2; i++) {
        const slot = getAvailableSlot(lobby);
        if (slot === -1) break;
        lobby.players.push({ 
          ws: null, 
          username: '', 
          slot: slot,
          isBot: true
        });
      }
    }
  }
  
  if (lobby.players.length < 2) {
    broadcastToLobby(lobby, { type: 'lobby_error', message: 'Недостатньо гравців для старту!' });
    return;
  }

  lobby.started = true;
  if (lobby.timerInterval) {
    clearInterval(lobby.timerInterval);
    lobby.timerInterval = null;
  }

  let mapId = chooseMapForLobby(lobby);
  
  if (!mapId) {
    mapId = 'classic';
  }

  let grid = loadMapGrid(mapId);
  if (!grid) {
    console.error(`Не вдалося завантажити карту ${mapId}, використовуємо classic`);
    const fallbackGrid = loadMapGrid('classic');
    if (fallbackGrid) {
      grid = fallbackGrid;
      mapId = 'classic';
    } else {
      grid = [];
      for (let y = 0; y < ROWS; y++) {
        const row = [];
        for (let x = 0; x < COLS; x++) {
          const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
          const pillar = x % 2 === 0 && y % 2 === 0;
          row.push(border || pillar ? 1 : 0);
        }
        grid.push(row);
      }
      mapId = 'classic';
    }
  }

  lobby.cols = COLS;
  lobby.rows = ROWS;

  const maps = loadMaps();
  const mapInfo = maps.find(m => m.id === mapId);
  const mapName = mapInfo ? mapInfo.name : 'Classic';
  
  lobby.mapName = mapName;
  lobby.mapId = mapId;

  broadcastToLobby(lobby, {
    type: 'lobby_map_info',
    mapName: mapName,
    mapId: mapId,
    cols: COLS,
    rows: ROWS
  });

  const spawns = getSpawns(lobby.players.length, COLS, ROWS);

  const gamePlayers = {};
  for (let i = 0; i < lobby.players.length; i++) {
    const p = lobby.players[i];
    const spawn = spawns[i] || { x: 1, y: 1 };
    
    const id = 'p' + Math.random().toString(36).slice(2, 10);
    const isBot = p.isBot || false;
    const isInvisible = GEN_MODE === 'empty';
    
    gamePlayers[id] = {
      id,
      username: isInvisible ? '' : p.username,
      slot: p.slot,
      color: isInvisible ? 'rgba(0,0,0,0)' : COLORS[p.slot],
      colorName: isInvisible ? 'white' : PLAYER_COLOR_NAMES[p.slot],
      x: spawn.x * TILE + TILE / 2,
      y: spawn.y * TILE + TILE / 2,
      spawn,
      alive: true,
      keys: {},
      keyOrder: [],
      facing: 'down',
      moving: false,
      kills: 0,
      deaths: 0,
      wins: 0,
      maxBombs: BASE_BOMBS,
      radius: 1,
      isBot: isBot,
      isInvisible: isInvisible,
    };
  }

  lobby.gameData = {
    players: gamePlayers,
    grid: grid,
    bombs: [],
    explosions: [],
    items: [],
    roundTimer: ROUND_SECONDS,
    matchEnding: false,
    roundParticipants: new Set(lobby.players.map(p => p.username)),
    mapId: mapId,
    mapName: mapName,
    cols: COLS,
    rows: ROWS,
  };

  broadcastToLobby(lobby, {
    type: 'game_map_info',
    mapId: mapId,
    mapName: mapName,
    cols: COLS,
    rows: ROWS
  });

  for (const p of lobby.players) {
    if (!p.ws) continue;
    const playerId = Object.keys(gamePlayers).find(id => gamePlayers[id].username === p.username);
    if (playerId) {
      p.ws.playerId = playerId;
      p.ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        cols: COLS,
        rows: ROWS,
        tile: TILE,
      }));
    }
  }

  startGameLoop(lobby);
}

function startGameLoop(lobby) {
  const interval = setInterval(() => {
    if (!lobby.gameData) {
      clearInterval(interval);
      return;
    }

    const gd = lobby.gameData;
    if (!gd.matchEnding) {
      updatePlayers(lobby);
      updateBombs(lobby);
      updateExplosions(lobby);
    }

    broadcastToLobby(lobby, {
      type: 'state',
      players: publicPlayers(lobby),
      grid: gd.grid,
      bombs: publicBombs(lobby),
      explosions: gd.explosions,
      items: gd.items,
      roundTimer: Math.ceil(Math.max(0, gd.roundTimer)),
      cols: COLS,
      rows: ROWS,
    });
  }, 33);

  const timerInterval = setInterval(() => {
    if (!lobby.gameData) {
      clearInterval(timerInterval);
      return;
    }
    if (lobby.gameData.matchEnding) return;
    
    const gd = lobby.gameData;
    gd.roundTimer -= 1;
    if (gd.roundTimer <= 0) {
      gd.roundTimer = 0;
      checkMatchEnd(lobby);
    }
  }, 1000);

  lobby._gameInterval = interval;
  lobby._timerInterval = timerInterval;
}

function publicPlayers(lobby) {
  if (!lobby.gameData) return {};
  const out = {};
  const gd = lobby.gameData;
  for (const id in gd.players) {
    const p = gd.players[id];
    
    if (GEN_MODE === 'empty') {
      out[id] = {
        id,
        nickname: '',
        color: 'rgba(0,0,0,0)',
        colorName: 'white',
        x: p.x,
        y: p.y,
        facing: 'down',
        moving: false,
        alive: p.alive,
        kills: 0,
        deaths: 0,
        rank: '',
        rankNum: 1,
        maxBombs: p.maxBombs,
        radius: p.radius,
        isBot: p.isBot || false,
        isInvisible: true,
      };
      continue;
    }
    
    out[id] = {
      id,
      nickname: p.username,
      color: p.color,
      colorName: p.colorName,
      x: p.x,
      y: p.y,
      facing: p.facing,
      moving: p.moving,
      alive: p.alive,
      kills: p.kills,
      deaths: p.deaths,
      rank: getRank(p.kills).name,
      rankNum: getRank(p.kills).num,
      maxBombs: p.maxBombs,
      radius: p.radius,
    };
  }
  return out;
}

function publicBombs(lobby) {
  if (!lobby.gameData) return [];
  return lobby.gameData.bombs.map((b) => ({ x: b.x, y: b.y, radius: b.radius, placedAt: b.placedAt }));
}

function startLobbyTimer(lobby) {
  if (GEN_MODE === 'empty') {
    startGame(lobby);
    return;
  }
  
  if (lobby.timerInterval) return;
  
  lobby.timerInterval = setInterval(() => {
    if (lobby.started) {
      clearInterval(lobby.timerInterval);
      lobby.timerInterval = null;
      return;
    }
    
    lobby.timer -= 1;
    
    broadcastToLobby(lobby, {
      type: 'lobby_timer',
      timer: lobby.timer,
    });
    
    if (lobby.timer <= 0) {
      clearInterval(lobby.timerInterval);
      lobby.timerInterval = null;
      if (lobby.players.length >= 2) {
        startGame(lobby);
      } else {
        lobby.timer = LOBBY_WAIT_SECONDS;
        broadcastToLobby(lobby, {
          type: 'lobby_error',
          message: 'Недостатньо гравців для старту. Очікуємо...',
        });
        startLobbyTimer(lobby);
      }
    }
  }, 1000);
}

// ------------------------------------------------------------
// АДМІН
// ------------------------------------------------------------
function sendAdminPlayerList(ws) {
  const playersList = Object.entries(accounts).map(([username, acc]) => ({
    username,
    userId: acc.userId || '—',
    kills: acc.kills || 0,
    deaths: acc.deaths || 0,
    wins: acc.wins || 0,
    rank: getRank(acc.kills || 0).name,
    rankNum: getRank(acc.kills || 0).num,
    isOnline: activeUsernames.has(username),
    isBanned: bannedUsers.includes(username),
    lastSeen: acc.lastSeen || 'Ніколи',
    ip: acc.ip || 'unknown',
  }));
  
  ws.send(JSON.stringify({
    type: 'admin_players',
    players: playersList,
    totalPlayers: Object.keys(accounts).length,
    onlinePlayers: activeUsernames.size,
    bannedCount: bannedUsers.length,
    isRestarting,
    restartCountdown: isRestarting ? restartCountdown : 0,
  }));
}

function createBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `accounts_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(accounts, null, 2));
  return backupFile;
}

function restoreBackup(backupFile) {
  try {
    const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    accounts = data;
    saveAccounts();
    return true;
  } catch (e) {
    return false;
  }
}

function getBackupList() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter(f => f.startsWith('accounts_backup_') && f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: f.replace('accounts_backup_', '').replace('.json', '').replace(/-/g, ':')
    }));
}

let restartTimer = null;
let restartCountdown = 0;
let isRestarting = false;

function scheduleRestart(seconds) {
  if (isRestarting) return;
  isRestarting = true;
  restartCountdown = seconds;
  
  broadcast({ type: 'admin_restart', message: `⚠️ Сервер перезавантажиться через ${seconds} секунд!`, countdown: seconds });
  
  restartTimer = setInterval(() => {
    restartCountdown--;
    if (restartCountdown > 0) {
      broadcast({ type: 'admin_restart_countdown', countdown: restartCountdown });
    } else {
      clearInterval(restartTimer);
      restartTimer = null;
      performRestart();
    }
  }, 1000);
}

function performRestart() {
  isRestarting = false;
  broadcast({ type: 'admin_restart_force', message: '🔄 Сервер перезавантажується...' });
  
  setTimeout(() => {
    for (const lobby of lobbies) {
      if (lobby._gameInterval) clearInterval(lobby._gameInterval);
      if (lobby._timerInterval) clearInterval(lobby._timerInterval);
      if (lobby.matchEndTimer) {
        clearTimeout(lobby.matchEndTimer);
        lobby.matchEndTimer = null;
      }
    }
    lobbies = [];
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'admin_restart_force', message: '🔄 Сервер перезавантажено! Оновіть сторінку.' }));
        setTimeout(() => {
          client.close(1000, 'Server restart');
        }, 500);
      }
    });
    
    setTimeout(() => {
      broadcast({ type: 'admin_restart', message: '✅ Сервер перезавантажено! Можете заходити.' });
      setTimeout(() => {
        broadcast({ type: 'admin_restart', message: null });
      }, 3000);
    }, 2000);
  }, 1000);
}

function performWipe() {
  createBackup();
  accounts = {};
  saveAccounts();
  bannedUsers = [];
  saveBanned();
  for (const lobby of lobbies) {
    if (lobby._gameInterval) clearInterval(lobby._gameInterval);
    if (lobby._timerInterval) clearInterval(lobby._timerInterval);
    if (lobby.matchEndTimer) {
      clearTimeout(lobby.matchEndTimer);
      lobby.matchEndTimer = null;
    }
  }
  lobbies = [];
  broadcast({ type: 'admin_wipe', message: '🧹 Всі дані очищено! (бекап створено)' });
  setTimeout(() => {
    broadcast({ type: 'admin_wipe', message: null });
  }, 5000);
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function accountPublicStats(username) {
  const acc = accounts[username];
  if (!acc) return null;
  const rank = getRank(acc.kills || 0);
  return {
    username,
    userId: acc.userId || '—',
    kills: acc.kills || 0,
    deaths: acc.deaths || 0,
    wins: acc.wins || 0,
    rank: rank.name,
    rankNum: rank.num,
    rankBombs: BASE_BOMBS,
  };
}

function getLeaderboard(limit = 100, currentUsername = null) {
  const fullSorted = Object.entries(accounts)
    .map(([username, acc]) => ({
      username,
      userId: acc.userId || '—',
      kills: acc.kills || 0,
      deaths: acc.deaths || 0,
      wins: acc.wins || 0,
      rank: getRank(acc.kills || 0).name,
      rankNum: getRank(acc.kills || 0).num,
      lastSeen: acc.lastSeen || null,
      ip: acc.ip || null,
    }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

  const list = fullSorted.slice(0, limit);

  let playerEntry = null;
  if (currentUsername) {
    const idx = fullSorted.findIndex((p) => p.username === currentUsername);
    if (idx !== -1) {
      playerEntry = { ...fullSorted[idx], position: idx + 1 };
    }
  }

  return { list, playerEntry };
}

function removePlayerFromLobby(lobby, username) {
  const idx = lobby.players.findIndex(p => p.username === username);
  if (idx === -1) return;

  const player = lobby.players[idx];
  
  if (lobby.started && lobby.gameData) {
    const gd = lobby.gameData;
    const playerId = Object.keys(gd.players).find(id => gd.players[id].username === username);
    if (playerId) {
      const p = gd.players[playerId];
      delete gd.players[playerId];
      const aliveCount = Object.values(gd.players).filter(p => p.alive).length;
      if (aliveCount <= 1 && !lobby.matchEndTimer) {
        lobby.matchEndTimer = setTimeout(() => {
          checkMatchEnd(lobby);
          lobby.matchEndTimer = null;
        }, 3000);
      }
    }
  }

  lobby.players.splice(idx, 1);
  
  if (lobby.players.length === 0) {
    if (lobby._gameInterval) clearInterval(lobby._gameInterval);
    if (lobby._timerInterval) clearInterval(lobby._timerInterval);
    if (lobby.matchEndTimer) {
      clearTimeout(lobby.matchEndTimer);
      lobby.matchEndTimer = null;
    }
    removeLobby(lobby.id);
    return;
  }

  if (!lobby.started) {
    const mapName = getMapNameForLobby(lobby);
    broadcastToLobby(lobby, {
      type: 'lobby_update',
      players: lobby.players.map((p) => ({ 
        username: p.username, 
        slot: p.slot + 1,
        color: COLORS[p.slot],
        colorName: PLAYER_COLOR_NAMES[p.slot]
      })),
      count: lobby.players.length,
      max: MAX_PLAYERS,
      timer: lobby.timer,
      started: lobby.started,
      mapName: mapName
    });
  }
}

function removePlayerFromAllLobbies(username) {
  for (const lobby of lobbies) {
    removePlayerFromLobby(lobby, username);
  }
}

// ------------------------------------------------------------
// WebSocket
// ------------------------------------------------------------
const ADMIN_PASSWORD = 'admin785612';

wss.on('connection', (ws, req) => {
  ws.playerId = null;
  ws.username = null;
  ws.isAdmin = false;
  ws.ip = req.socket.remoteAddress || 'unknown';
  ws.lobbyId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === 'admin_auth') {
      if (msg.password === ADMIN_PASSWORD) {
        ws.isAdmin = true;
        ws.send(JSON.stringify({ type: 'admin_auth_ok' }));
        sendAdminPlayerList(ws);
      } else {
        ws.send(JSON.stringify({ type: 'admin_auth_error', message: 'Невірний пароль!' }));
      }
      return;
    }

    if (msg.type === 'admin_get_players') {
      if (!ws.isAdmin) return;
      sendAdminPlayerList(ws);
      return;
    }

    if (msg.type === 'admin_ban') {
      if (!ws.isAdmin) return;
      const username = msg.username;
      if (username && accounts[username]) {
        if (!bannedUsers.includes(username)) {
          bannedUsers.push(username);
          saveBanned();
          removePlayerFromAllLobbies(username);
          broadcast({ type: 'admin_ban_notify', username, message: `🚫 ${username} забанений!` });
          sendAdminPlayerList(ws);
        }
      }
      return;
    }

    if (msg.type === 'admin_unban') {
      if (!ws.isAdmin) return;
      const username = msg.username;
      bannedUsers = bannedUsers.filter(u => u !== username);
      saveBanned();
      broadcast({ type: 'admin_unban_notify', username, message: `✅ ${username} розбанений!` });
      sendAdminPlayerList(ws);
      return;
    }

    if (msg.type === 'admin_kick') {
      if (!ws.isAdmin) return;
      const username = msg.username;
      if (username && accounts[username]) {
        removePlayerFromAllLobbies(username);
        const targetWs = activeUsernames.get(username);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: 'admin_kicked', message: `👢 Вас вигнали з сервера!` }));
          targetWs.close();
        }
        broadcast({ type: 'admin_kick_notify', username, message: `👢 ${username} вигнаний з сервера!` });
        sendAdminPlayerList(ws);
      }
      return;
    }

    if (msg.type === 'admin_delete') {
      if (!ws.isAdmin) return;
      const username = msg.username;
      if (username && accounts[username]) {
        removePlayerFromAllLobbies(username);
        const targetWs = activeUsernames.get(username);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: 'admin_kicked', message: `🗑️ Ваш акаунт видалено!` }));
          targetWs.close();
        }
        delete accounts[username];
        saveAccounts();
        bannedUsers = bannedUsers.filter(u => u !== username);
        saveBanned();
        broadcast({ type: 'admin_delete_notify', username, message: `🗑️ ${username} видалений з сервера!` });
        sendAdminPlayerList(ws);
      }
      return;
    }

    if (msg.type === 'admin_restart') {
      if (!ws.isAdmin) return;
      const seconds = msg.seconds || 60;
      scheduleRestart(seconds);
      sendAdminPlayerList(ws);
      return;
    }

    if (msg.type === 'admin_cancel_restart') {
      if (!ws.isAdmin) return;
      if (restartTimer) {
        clearInterval(restartTimer);
        restartTimer = null;
        isRestarting = false;
        broadcast({ type: 'admin_restart', message: '❌ Перезавантаження скасовано!', countdown: 0 });
        setTimeout(() => {
          broadcast({ type: 'admin_restart', message: null });
        }, 3000);
        sendAdminPlayerList(ws);
      }
      return;
    }

    if (msg.type === 'admin_wipe') {
      if (!ws.isAdmin) return;
      performWipe();
      sendAdminPlayerList(ws);
      return;
    }

    if (msg.type === 'admin_backup') {
      if (!ws.isAdmin) return;
      const file = createBackup();
      ws.send(JSON.stringify({ type: 'admin_backup_done', file: path.basename(file) }));
      sendAdminPlayerList(ws);
      return;
    }

    if (msg.type === 'admin_get_backups') {
      if (!ws.isAdmin) return;
      const backups = getBackupList();
      ws.send(JSON.stringify({ type: 'admin_backup_list', backups }));
      return;
    }

    if (msg.type === 'admin_delete_backup') {
      if (!ws.isAdmin) return;
      const fileName = msg.file;
      const backupPath = path.join(BACKUP_DIR, fileName);
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        ws.send(JSON.stringify({ type: 'admin_backup_deleted', file: fileName }));
        const backups = getBackupList();
        ws.send(JSON.stringify({ type: 'admin_backup_list', backups }));
        sendAdminPlayerList(ws);
      } else {
        ws.send(JSON.stringify({ type: 'admin_error', message: 'Файл бекапу не знайдено!' }));
      }
      return;
    }

    if (msg.type === 'admin_restore_backup') {
      if (!ws.isAdmin) return;
      const fileName = msg.file;
      const backupPath = path.join(BACKUP_DIR, fileName);
      if (fs.existsSync(backupPath)) {
        if (restoreBackup(backupPath)) {
          for (const lobby of lobbies) {
            if (lobby._gameInterval) clearInterval(lobby._gameInterval);
            if (lobby._timerInterval) clearInterval(lobby._timerInterval);
            if (lobby.matchEndTimer) {
              clearTimeout(lobby.matchEndTimer);
              lobby.matchEndTimer = null;
            }
          }
          lobbies = [];
          broadcast({ type: 'admin_restore_done', message: `📂 Відновлено з бекапу: ${fileName}` });
          sendAdminPlayerList(ws);
        } else {
          ws.send(JSON.stringify({ type: 'admin_error', message: 'Помилка відновлення бекапу!' }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'admin_error', message: 'Файл бекапу не знайдено!' }));
      }
      return;
    }

    if (msg.type === 'chat_history') {
      if (msg.channel === 'world') {
        const history = chatHistory.world.slice(-20);
        ws.send(JSON.stringify({
          type: 'chat_history',
          channel: 'world',
          messages: history
        }));
      }
      return;
    }

    // --- ВИБІР КАРТИ ---
    if (msg.type === 'get_maps') {
      if (!ws.username) return;
      const maps = loadMaps();
      ws.send(JSON.stringify({ type: 'maps_list', maps }));
      return;
    }

    if (msg.type === 'select_map') {
      if (!ws.username) return;
      const mapId = msg.mapId;
      const maps = loadMaps();
      const mapExists = maps.some(m => m.id === mapId);
      if (mapExists) {
        selectedMap.set(ws.username, mapId);
        ws.send(JSON.stringify({ type: 'map_selected', mapId }));
        
        const lobby = getLobbyByPlayer(ws.username);
        if (lobby && !lobby.started) {
          const mapInfo = maps.find(m => m.id === mapId);
          if (mapInfo) {
            lobby.mapName = mapInfo.name;
            lobby.mapId = mapInfo.id;
            updateLobbyMap(lobby);
          }
        }
      } else {
        ws.send(JSON.stringify({ type: 'map_error', message: 'Карту не знайдено' }));
      }
      return;
    }

    if (msg.type === 'auth') {
      const username = (msg.username || '').toString().trim().slice(0, 16);
      const password = (msg.password || '').toString();

      if (username.length < 2) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Логін має бути щонайменше 2 символи.' }));
        return;
      }
      if (password.length < 3) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Пароль має бути щонайменше 3 символи.' }));
        return;
      }

      if (bannedUsers.includes(username)) {
        ws.send(JSON.stringify({ type: 'auth_error', message: '❌ Ви забанені на цьому сервері!' }));
        return;
      }

      if (activeUsernames.has(username)) {
        ws.send(JSON.stringify({ type: 'auth_error', message: `Акаунт "${username}" вже в грі.` }));
        return;
      }

      if (!accounts[username]) {
        const salt = crypto.randomBytes(16).toString('hex');
        const userId = generateUserId();
        accounts[username] = {
          salt,
          passwordHash: hashPassword(password, salt),
          userId: userId,
          kills: 0,
          deaths: 0,
          wins: 0,
          friends: [],
          friendRequests: [],
          lastSeen: new Date().toISOString(),
          ip: ws.ip,
        };
        saveAccounts();
      } else {
        const acc = accounts[username];
        const hash = hashPassword(password, acc.salt);
        if (hash !== acc.passwordHash) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Невірний пароль.' }));
          return;
        }
        accounts[username].lastSeen = new Date().toISOString();
        accounts[username].ip = ws.ip;
        saveAccounts();
      }

      activeUsernames.set(username, ws);
      ws.username = username;
      
      const stats = accountPublicStats(username);
      
      ws.send(JSON.stringify({ 
        type: 'auth_ok', 
        stats: stats,
        friendRequests: accounts[username].friendRequests || [],
        sentRequests: getSentRequests(username),
      }));
      
      const acc = accounts[username];
      if (acc.friends) {
        for (const friend of acc.friends) {
          sendToUser(friend, { type: 'friend_status_update', username, status: 'online' });
        }
      }

      const history = chatHistory.world.slice(-20);
      ws.send(JSON.stringify({
        type: 'chat_history',
        channel: 'world',
        messages: history
      }));

      return;
    }

    if (msg.type === 'chat_message') {
      if (!ws.username) return;
      
      const channel = msg.channel || 'world';
      const text = (msg.text || '').toString().trim();
      
      if (!text || text.length === 0) {
        return;
      }
      
      if (text.length > 500) {
        sendToUser(ws.username, { type: 'chat_error', message: 'Повідомлення занадто довге (макс. 500 символів)' });
        return;
      }
      
      if (channel === 'private') {
        const target = msg.target;
        if (!target) {
          sendToUser(ws.username, { type: 'chat_error', message: 'Вкажіть отримувача' });
          return;
        }
        sendChatMessage(ws.username, 'private', text, target);
      } else if (channel === 'group') {
        sendChatMessage(ws.username, 'group', text);
      } else {
        sendChatMessage(ws.username, 'world', text);
      }
      return;
    }

    if (msg.type === 'friends_get') {
      if (!ws.username) return;
      const friends = getFriendListWithStatus(ws.username);
      const requests = getFriendRequests(ws.username);
      const groupRequests = getGroupInvitesForUser(ws.username);
      ws.send(JSON.stringify({
        type: 'friends_list',
        friends,
        requests,
        groupRequests,
      }));
      return;
    }

    if (msg.type === 'friends_search') {
      const query = (msg.query || '').toString().trim().toLowerCase();
      if (!query || query.length < 1) {
        ws.send(JSON.stringify({ type: 'friends_search_result', results: [] }));
        return;
      }
      
      const results = [];
      for (const [username, acc] of Object.entries(accounts)) {
        const userId = (acc.userId || '').toLowerCase();
        const nameLower = username.toLowerCase();
        if ((nameLower.includes(query) || userId.includes(query)) && username !== ws.username) {
          results.push({
            username,
            userId: acc.userId || '—',
            isOnline: activeUsernames.has(username),
            isFriend: (accounts[ws.username].friends || []).includes(username),
            hasRequest: (accounts[ws.username].friendRequests || []).includes(username),
          });
        }
        if (results.length >= 20) break;
      }
      ws.send(JSON.stringify({ type: 'friends_search_result', results }));
      return;
    }

    if (msg.type === 'friends_add') {
      if (!ws.username) return;
      const target = msg.username;
      const result = sendFriendRequest(ws.username, target);
      ws.send(JSON.stringify({ type: 'friends_add_result', ...result, target }));
      return;
    }

    if (msg.type === 'friends_accept') {
      if (!ws.username) return;
      const from = msg.username;
      const result = acceptFriendRequest(ws.username, from);
      ws.send(JSON.stringify({ type: 'friends_accept_result', ...result, from }));
      sendToUser(ws.username, { type: 'friends_refresh' });
      sendToUser(from, { type: 'friends_refresh' });
      return;
    }

    if (msg.type === 'friends_deny') {
      if (!ws.username) return;
      const from = msg.username;
      const result = denyFriendRequest(ws.username, from);
      ws.send(JSON.stringify({ type: 'friends_deny_result', ...result, from }));
      sendToUser(ws.username, { type: 'friends_refresh' });
      return;
    }

    if (msg.type === 'friends_remove') {
      if (!ws.username) return;
      const friend = msg.username;
      const result = removeFriend(ws.username, friend);
      ws.send(JSON.stringify({ type: 'friends_remove_result', ...result, friend }));
      sendToUser(ws.username, { type: 'friends_refresh' });
      sendToUser(friend, { type: 'friends_refresh' });
      return;
    }

    if (msg.type === 'friends_cancel_request') {
      if (!ws.username) return;
      const target = msg.username;
      const result = cancelFriendRequest(ws.username, target);
      ws.send(JSON.stringify({ type: 'friends_cancel_result', ...result, target }));
      sendToUser(ws.username, { type: 'friends_refresh' });
      return;
    }

    if (msg.type === 'group_create') {
      if (!ws.username) return;
      
      if (getGroupByMember(ws.username)) {
        ws.send(JSON.stringify({ type: 'group_error', message: 'Ви вже в групі' }));
        return;
      }
      
      const groupId = createGroup(ws.username);
      ws.send(JSON.stringify({ type: 'group_created', groupId }));
      
      const group = getGroupById(groupId);
      ws.send(JSON.stringify({
        type: 'group_update',
        groupId,
        members: Array.from(group.members.entries()).map(([u, data]) => ({
          username: u,
          status: data.status,
          isLeader: u === group.leader,
          isOnline: activeUsernames.has(u),
        })),
        leader: group.leader,
      }));
      return;
    }

    if (msg.type === 'group_invite') {
      if (!ws.username) return;
      const target = msg.username;
      const result = groupInvite(ws.username, target);
      ws.send(JSON.stringify({ type: 'group_invite_result', ...result, target }));
      return;
    }

    if (msg.type === 'group_join') {
      if (!ws.username) return;
      const groupId = msg.groupId;
      const result = groupJoin(ws.username, groupId);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_joined', groupId }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_deny') {
      if (!ws.username) return;
      const from = msg.username;
      const result = groupDeny(ws.username, from);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_deny_done', from }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_ready') {
      if (!ws.username) return;
      const ready = msg.ready === true;
      const result = groupSetReady(ws.username, ready);
      if (!result.success) {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_promote') {
      if (!ws.username) return;
      const target = msg.username;
      const result = groupPromote(ws.username, target);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_promote_done', target }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_kick') {
      if (!ws.username) return;
      const target = msg.username;
      const result = groupKick(ws.username, target);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_kick_result', success: true, target }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_leave') {
      if (!ws.username) return;
      const result = groupLeave(ws.username);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_left' }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_dismiss') {
      if (!ws.username) return;
      const result = groupDismiss(ws.username);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_dismiss_done' }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_battle') {
      if (!ws.username) return;
      const result = groupStartBattle(ws.username);
      if (result.success) {
        ws.send(JSON.stringify({ type: 'group_battle_started' }));
      } else {
        ws.send(JSON.stringify({ type: 'group_error', message: result.error }));
      }
      return;
    }

    if (msg.type === 'group_get_info') {
      if (!ws.username) return;
      const groupInfo = getGroupByMember(ws.username);
      if (!groupInfo) {
        ws.send(JSON.stringify({ type: 'group_not_in' }));
        return;
      }
      
      const group = getGroupById(groupInfo.id);
      ws.send(JSON.stringify({
        type: 'group_info',
        groupId: groupInfo.id,
        members: Array.from(group.members.entries()).map(([u, data]) => ({
          username: u,
          status: data.status,
          isLeader: u === group.leader,
          isOnline: activeUsernames.has(u),
        })),
        leader: group.leader,
      }));
      return;
    }

    if (msg.type === 'get_leaderboard') {
      const requestedUsername = typeof msg.username === 'string' ? msg.username : (ws.username || null);
      const { list, playerEntry } = getLeaderboard(100, requestedUsername);
      ws.send(JSON.stringify({ type: 'leaderboard', list, playerEntry }));
      return;
    }

    if (msg.type === 'get_stats') {
      if (ws.username && accounts[ws.username]) {
        ws.send(JSON.stringify({ type: 'auth_ok', stats: accountPublicStats(ws.username) }));
      }
      return;
    }

    if (msg.type === 'enter_arena') {
      if (!ws.username) return;
      
      const existingLobby = getLobbyByPlayer(ws.username);
      if (existingLobby) {
        if (existingLobby.started) {
          removePlayerFromLobby(existingLobby, ws.username);
          ws.send(JSON.stringify({ type: 'lobby_left' }));
        } else {
          const mapName = getMapNameForLobby(existingLobby);
          ws.send(JSON.stringify({ 
            type: 'lobby_status', 
            players: existingLobby.players.map((p) => ({ 
              username: p.username, 
              slot: p.slot + 1,
              color: COLORS[p.slot],
              colorName: PLAYER_COLOR_NAMES[p.slot]
            })), 
            timer: existingLobby.timer,
            count: existingLobby.players.length,
            max: MAX_PLAYERS,
            mapName: mapName
          }));
          return;
        }
      }

      let playerMapId = null;
      let playerMapName = null;
      if (ws.username && selectedMap.has(ws.username)) {
        playerMapId = selectedMap.get(ws.username);
        const maps = loadMaps();
        const mapInfo = maps.find(m => m.id === playerMapId);
        if (mapInfo) {
          playerMapName = mapInfo.name;
        }
      }

      let availableLobbies = [];
      for (const l of lobbies) {
        if (!l.started && l.players.length < MAX_PLAYERS) {
          availableLobbies.push(l);
        }
      }

      let selectedLobby = null;

      if (playerMapId) {
        const sameMapLobbies = availableLobbies.filter(l => l.mapId === playerMapId);
        
        if (sameMapLobbies.length > 0) {
          sameMapLobbies.sort((a, b) => {
            if (a.players.length !== b.players.length) {
              return b.players.length - a.players.length;
            }
            return a.id.localeCompare(b.id);
          });
          selectedLobby = sameMapLobbies[0];
        }
      } else {
        if (availableLobbies.length > 0) {
          availableLobbies.sort((a, b) => {
            if (a.players.length !== b.players.length) {
              return b.players.length - a.players.length;
            }
            return a.id.localeCompare(b.id);
          });
          selectedLobby = availableLobbies[0];
        }
      }

      if (!selectedLobby) {
        selectedLobby = createLobby();
        if (playerMapId) {
          selectedLobby.mapId = playerMapId;
          selectedLobby.mapName = playerMapName || 'Classic';
        }
        if (GEN_MODE === 'empty') {
          const slot = getAvailableSlot(selectedLobby);
          if (slot !== -1) {
            selectedLobby.players.push({ ws, username: ws.username, slot });
            ws.lobbyId = selectedLobby.id;
            startGame(selectedLobby);
          }
          return;
        }
        startLobbyTimer(selectedLobby);
      }

      const slot = getAvailableSlot(selectedLobby);
      if (slot === -1) {
        ws.send(JSON.stringify({ type: 'full' }));
        return;
      }

      selectedLobby.players.push({ ws, username: ws.username, slot });
      ws.lobbyId = selectedLobby.id;

      const mapName = getMapNameForLobby(selectedLobby);

      broadcastToLobby(selectedLobby, {
        type: 'lobby_update',
        players: selectedLobby.players.map((p) => ({ 
          username: p.username, 
          slot: p.slot + 1,
          color: COLORS[p.slot],
          colorName: PLAYER_COLOR_NAMES[p.slot]
        })),
        count: selectedLobby.players.length,
        max: MAX_PLAYERS,
        timer: selectedLobby.timer,
        started: selectedLobby.started,
        mapName: mapName
      });

      if (selectedLobby.players.length >= MAX_PLAYERS) {
        startGame(selectedLobby);
      }

      return;
    }

    if (msg.type === 'leave_lobby' || msg.type === 'leave_arena') {
      const lobby = getLobbyByWs(ws);
      if (lobby) {
        removePlayerFromLobby(lobby, ws.username);
        ws.send(JSON.stringify({ type: 'lobby_left' }));
      }
      return;
    }

    const lobby = getLobbyByWs(ws);
    if (!lobby || !lobby.gameData) return;

    const gd = lobby.gameData;
    const p = gd.players[ws.playerId];
    if (!p) return;

    if (msg.type === 'input') {
      p.keys = msg.keys || {};
    } else if (msg.type === 'bomb') {
      tryPlaceBomb(lobby, p);
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      const lobby = getLobbyByPlayer(ws.username);
      if (lobby) {
        removePlayerFromLobby(lobby, ws.username);
      }
      
      const acc = accounts[ws.username];
      if (acc && acc.friends) {
        for (const friend of acc.friends) {
          sendToUser(friend, { type: 'friend_status_update', username: ws.username, status: 'offline' });
        }
      }
      
      activeUsernames.delete(ws.username);
    }
  });
});

// Створюємо необхідні папки
fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(MAPS_DIR, { recursive: true });

const modeText = GEN_MODE === 'empty' ? 'EMPTY (без цегли, гравці НЕВИДИМІ)' : 'FULL (з цеглою)';

// ============================================================
//  ЗАПУСК СЕРВЕРА - СЛУХАЄМО ВСІ ІНТЕРФЕЙСИ
//  АДМІНКА ДОСТУПНА ТІЛЬКИ З ЛОКАЛЬНОЇ МЕРЕЖІ
// ============================================================
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log(`  Bomberman PvP сервер запущено!`);
  console.log(`  Режим: ЛОКАЛЬНИЙ + ЗОВНІШНІЙ`);
  console.log(`  Режим карти: ${modeText}`);
  console.log(`  Локальний доступ: http://127.0.0.1:${PORT}`);
  console.log(`  Зовнішній доступ: http://188.163.115.185:${PORT}`);
  console.log(`  Адмінка (ТІЛЬКИ ЛОКАЛЬНО): http://127.0.0.1:${PORT}/X7kM9pL2wR4nQ8vF3tY6bH1jS5.html`);
  console.log(`  Пароль адміна: ${ADMIN_PASSWORD}`);
  console.log('====================================================');
  console.log('');
  console.log('🔒 Адмін-панель захищена від зовнішнього доступу!');
  console.log('   Спробу відкрити адмінку ззовні отримаєте помилку 403.');
  console.log('====================================================');
});