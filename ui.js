// ==========================================
// 🍋 LIME MESSAGE UI
// ==========================================

const core = new LimeMessageCore();
const terminal = new TerminalProcessor(core);

// DOM элементы
const authScreen = document.getElementById('auth-screen');
const mainInterface = document.getElementById('main-interface');
const terminalOverlay = document.getElementById('terminal-overlay');
const newChatModal = document.getElementById('new-chat-modal');
const callToast = document.getElementById('call-toast');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    core.init();
    setupEventListeners();
});

function setupEventListeners() {
    // Авторизация
    document.getElementById('btn-enter').addEventListener('click', handleLogin);
    document.getElementById('pass').addEventListener('keypress', e => {
        if (e.key === 'Enter') handleLogin();
    });

    // Выход
    document.getElementById('btn-logout').addEventListener('click', () => core.logout());

    // Отправка сообщения
    document.getElementById('btn-send').addEventListener('click', handleSendMessage);
    document.getElementById('msg-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // Терминал
    document.getElementById('btn-terminal').addEventListener('click', () => {
        terminalOverlay.style.display = 'flex';
        document.getElementById('terminal-input').focus();
    });

    document.querySelector('.close-terminal').addEventListener('click', () => {
        terminalOverlay.style.display = 'none';
    });

    document.getElementById('terminal-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const cmd = e.target.value.trim();
            if (cmd) {
                terminal.history.push(cmd);
                terminal.histIdx = terminal.history.length;
                terminal.execute(cmd);
                e.target.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            if (terminal.histIdx > 0) {
                terminal.histIdx--;
                e.target.value = terminal.history[terminal.histIdx];
            }
        } else if (e.key === 'ArrowDown') {
            if (terminal.histIdx < terminal.history.length - 1) {
                terminal.histIdx++;
                e.target.value = terminal.history[terminal.histIdx];
            } else {
                terminal.histIdx = terminal.history.length;
                e.target.value = '';
            }
        }
    });

    // Новый чат
    document.getElementById('btn-new-chat').addEventListener('click', openNewChatModal);
    document.getElementById('btn-cancel-chat').addEventListener('click', () => {
        newChatModal.style.display = 'none';
    });
    document.getElementById('btn-create-chat').addEventListener('click', createChat);

    // Звонки
    document.getElementById('btn-call').addEventListener('click', () => {
        const target = prompt('Call user (login):');
        if (target) core.startCall(target);
    });

    document.getElementById('btn-accept-call').addEventListener('click', () => {
        const callData = window.pendingCallData;
        if (callData) {
            core.acceptCall(callData.id, callData);
            callToast.style.display = 'none';
        }
    });

    document.getElementById('btn-reject-call').addEventListener('click', () => {
        const callData = window.pendingCallData;
        if (callData) {
            core.rejectCall(callData.id);
            callToast.style.display = 'none';
        }
    });
}

async function handleLogin() {
    const login = document.getElementById('login').value.trim();
    const pass = document.getElementById('pass').value.trim();
    const status = document.getElementById('auth-status');
    
    try {
        status.textContent = 'Authenticating...';
        status.style.color = '#00d4ff';
        await core.login(login, pass);
    } catch (error) {
        status.textContent = error.message;
        status.style.color = '#ec4899';
    }
}

function handleSendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (text) {
        core.sendMessage(text);
        input.value = '';
    }
}

function openNewChatModal() {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    
    core.db.ref('users').once('value').then(snap => {
        snap.forEach(child => {
            const l = child.key;
            if (l !== core.currentUser.login) {
                const label = document.createElement('label');
                label.className = 'user-chk-item';
                label.innerHTML = `<input type="checkbox" value="${l}"> ${l}`;
                userList.appendChild(label);
            }
        });
    });
    
    newChatModal.style.display = 'flex';
}

function createChat() {
    const name = document.getElementById('new-chat-name').value.trim();
    if (!name) return alert('Enter chat name');
    
    const checks = document.querySelectorAll('#user-list input:checked');
    if (checks.length === 0) return alert('Select participants');
    
    const participants = Array.from(checks).map(c => c.value);
    core.createChat(name, participants);
    
    newChatModal.style.display = 'none';
    document.getElementById('new-chat-name').value = '';
}

// Подключение событий ядра к UI
core.events.onAuth = (user) => {
    authScreen.style.display = 'none';
    mainInterface.style.display = 'flex';
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role;
};

core.events.onLogout = () => {
    authScreen.style.display = 'flex';
    mainInterface.style.display = 'none';
    document.getElementById('login').value = '';
    document.getElementById('pass').value = '';
    document.getElementById('auth-status').textContent = '';
};

core.events.onChatsLoaded = (chats) => {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item' + (chat.id === core.currentChatId ? ' active' : '');
        div.innerHTML = `
            <div class="chat-avatar">💬</div>
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-last" id="last-${chat.id}">Loading...</div>
            </div>
        `;
        div.onclick = () => {
            core.switchChat(chat.id);
            document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
        };
        chatList.appendChild(div);
    });
};

core.events.onMessage = (msg, chatId) => {
    const container = document.getElementById('messages');
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const isMe = msg.author === core.currentUser.login;
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
    
    let content = '';
    if (msg.type === 'image') {
        content = `<img src="${msg.image}" style="max-width:200px; border-radius:8px;">`;
    } else {
        content = `<div class="msg-text">${core.decrypt(msg.text)}</div>`;
    }
    
    div.innerHTML = `
        ${!isMe ? `<div class="msg-author">${msg.author}</div>` : ''}
        ${content}
        <div class="msg-meta">${time}</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    const lastEl = document.getElementById('last-' + chatId);
    if (lastEl) {
        lastEl.textContent = msg.author + ': ' + (msg.type === 'text' ? core.decrypt(msg.text).substring(0, 20) : '📷 Photo');
    }
};

core.events.onCall = (data, type) => {
    if (type === 'incoming') {
        window.pendingCallData = data;
        document.getElementById('caller-name').textContent = data.from;
        callToast.style.display = 'block';
    } else if (type === 'ended') {
        callToast.style.display = 'none';
    }
};

core.events.onNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: '🍋' });
    }
};

core.events.onTerminal = (text, color) => {
    const output = document.getElementById('terminal-output');
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = text;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

core.events.onTerminalClear = () => {
    document.getElementById('terminal-output').innerHTML = '';
};
