class LimeMessageCore {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.currentChatId = 'general';
        this.blockedUsers = [];
        this.replyTo = null;
        this.msgListener = null;
        this.callListener = null;
        this.recaptchaVerifier = null;
        this.confirmationResult = null;
        
        this.localStream = null;
        this.peerConnection = null;
        this.callId = null;
        this.callTimerInterval = null;
        this.callSeconds = 0;
        this.ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

        this.events = {
            onAuth: null, onLogout: null, onChatsLoaded: null,
            onMessage: null, onCall: null, onNotification: null,
            onTerminal: null, onTerminalClear: null
        };

        this.ENCODED_USERS = [
            { l: 'TE1VU1NT', p: 'MjlJN28yMjBP', r: 'root', n: 'Kirill (Creator)' },
            { l: 'R0VORVJBTCBESVJFQ1RPUg==', p: 'YzVndjFhMm4zaTRhNQ==', r: 'admin', n: 'Vanya (Director)' },
            { l: '0KXQvtC80L7QvNC4', p: 'MDEyMzU=', r: 'user', n: 'Алексей' },
            { l: '0JrQvtC80LXQvdC+0LvQvtGA0L7QvNC4', p: 'ODc2NQ==', r: 'user', n: 'Ковалёв' },
            { l: 'Uk9C', p: 'Nzg5ODg=', r: 'user', n: 'ROB' },
            { l: '0JLQvtC80LXQvdC+0LvQvg==', p: 'MTcwMjIwMTQ=', r: 'user', n: 'Ваня' },
            { l: '0JDQvNC40YDQvtGA0L3QuNC5', p: 'ODgwMDM1NTM1', r: 'user', n: 'ОБСОС' }
        ];

        // ✅ ТВОЯ КОНФИГУРАЦИЯ FIREBASE
        this.firebaseConfig = {
            apiKey: "AIzaSyDvTqTH65dIuFEqJEFoKLMLKaKMVwMQ95s",
            authDomain: "limessage-c6259.firebaseapp.com",
            databaseURL: "https://limessage-c6259-default-rtdb.firebaseio.com",
            projectId: "limessage-c6259",
            storageBucket: "limessage-c6259.firebasestorage.app",
            messagingSenderId: "520598610250",
            appId: "1:520598610250:web:c9abb38454c0001e44e1b3",
            measurementId: "G-YJDTHHN4HB"
        };
    }

    init() {
        if (!firebase.apps.length) firebase.initializeApp(this.firebaseConfig);
        this.db = firebase.database();
        this.auth = firebase.auth();
        this._initDB();
        this.checkSavedSession();
    }

    async _initDB() {
        try {
            for (const u of this.ENCODED_USERS) {
                const login = atob(u.l);
                const pass = atob(u.p);
                const snap = await this.db.ref('users/' + login).once('value');
                if (!snap.exists()) {
                    await this.db.ref('users/' + login).set({
                        password: this.encrypt(pass),
                        role: u.r,
                        displayName: u.n,
                        created: Date.now()
                    });
                }
            }
            const gen = await this.db.ref('chats/general').once('value');
            if (!gen.exists()) {
                const participants = {};
                this.ENCODED_USERS.forEach(u => participants[atob(u.l)] = true);
                await this.db.ref('chats/general').set({
                    name: 'Общий чат',
                    created: Date.now(),
                    participants: participants
                });
            }
        } catch (error) {
            console.error('Ошибка инициализации БД:', error);
        }
    }

    encrypt(text) {
        if (!text) return "";
        let res = "";
        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);
            if (c >= 65 && c <= 90) res += String.fromCharCode(((c - 65 + 3) % 26 + 26) % 26 + 65);
            else if (c >= 97 && c <= 122) res += String.fromCharCode(((c - 97 + 3) % 26 + 26) % 26 + 97);
            else if (c >= 1040 && c <= 1071) res += String.fromCharCode(((c - 1040 + 3) % 32 + 32) % 32 + 1040);
            else if (c >= 1072 && c <= 1103) res += String.fromCharCode(((c - 1072 + 3) % 32 + 32) % 32 + 1072);
            else if (c === 1025) res += String.fromCharCode(((0 + 3) % 32 + 32) % 32 + 1040);
            else if (c === 1105) res += String.fromCharCode(((0 + 3) % 32 + 32) % 32 + 1072);
            else if (c >= 48 && c <= 57) res += String.fromCharCode(((c - 48 + 3) % 10 + 10) % 10 + 48);
            else res += text[i];
        }
        return res;
    }

    decrypt(text) {
        if (!text) return "";
        let res = "";
        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);
            if (c >= 65 && c <= 90) res += String.fromCharCode(((c - 65 - 3) % 26 + 26) % 26 + 65);
            else if (c >= 97 && c <= 122) res += String.fromCharCode(((c - 97 - 3) % 26 + 26) % 26 + 97);
            else if (c >= 1040 && c <= 1071) res += String.fromCharCode(((c - 1040 - 3) % 32 + 32) % 32 + 1040);
            else if (c >= 1072 && c <= 1103) res += String.fromCharCode(((c - 1072 - 3) % 32 + 32) % 32 + 1072);
            else if (c === 1025) res += String.fromCharCode(((0 - 3) % 32 + 32) % 32 + 1040);
            else if (c === 1105) res += String.fromCharCode(((0 - 3) % 32 + 32) % 32 + 1072);
            else if (c >= 48 && c <= 57) res += String.fromCharCode(((c - 48 - 3) % 10 + 10) % 10 + 48);
            else res += text[i];
        }
        return res;
    }

    // ===== FIREBASE PHONE AUTH =====
    async sendSmsCode(phoneNumber) {
        if (this.recaptchaVerifier) this.recaptchaVerifier.clear();
        
        this.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            size: 'invisible',
            callback: () => {}
        });

        try {
            this.confirmationResult = await this.auth.signInWithPhoneNumber(phoneNumber, this.recaptchaVerifier);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async verifySmsCode(code) {
        if (!this.confirmationResult) return { success: false, error: 'No SMS sent' };

        try {
            const result = await this.confirmationResult.confirm(code);
            const phone = result.user.phoneNumber;
            const snap = await this.db.ref('users/' + phone).once('value');
            
            if (!snap.exists()) {
                await this.db.ref('users/' + phone).set({
                    password: this.encrypt(phone),
                    role: 'user',
                    displayName: 'User_' + phone.slice(-4),
                    phone: phone,
                    created: Date.now(),
                    uid: result.user.uid
                });
            }

            return { success: true, user: { login: phone, role: 'user', name: 'User_' + phone.slice(-4) } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async loginWithPhone(phone) {
        const snap = await this.db.ref('users/' + phone).once('value');
        if (!snap.exists()) throw new Error('User not found');
        
        this.currentUser = { login: phone, role: snap.val().role, name: snap.val().displayName || phone };
        localStorage.setItem('lime_user', JSON.stringify(this.currentUser));
        this._startApp();
        if (this.events.onAuth) this.events.onAuth(this.currentUser);
    }

    // ===== ОБЫЧНЫЙ ВХОД =====
    async login(l, p) {
        if (!l || !p) throw new Error('Введите данные');
        const snap = await this.db.ref('users/' + l).once('value');
        if (!snap.exists()) throw new Error('Пользователь не найден');
        
        if (snap.val().password === this.encrypt(p)) {
            this.currentUser = { login: l, role: snap.val().role, name: snap.val().displayName || l };
            localStorage.setItem('lime_user', JSON.stringify(this.currentUser));
            this._startApp();
            if (this.events.onAuth) this.events.onAuth(this.currentUser);
        } else {
            throw new Error('Неверный пароль');
        }
    }

    logout() {
        localStorage.removeItem('lime_user');
        this.currentUser = null;
        if (this.events.onLogout) this.events.onLogout();
    }

    checkSavedSession() {
        const saved = localStorage.getItem('lime_user');
        if (saved) { 
            try { 
                this.currentUser = JSON.parse(saved); 
                this._startApp();
                if (this.events.onAuth) this.events.onAuth(this.currentUser);
            } catch(e) { 
                localStorage.removeItem('lime_user'); 
            } 
        }
    }

    _startApp() {
        this.loadChatsList();
        this.switchChat('general');
        this.listenForCalls();
        this._listenForNewMessages();
        this.requestNotifPermission();
    }

    requestNotifPermission() {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    _showNotif(author, role, text) {
        if ("Notification" in window && Notification.permission === "granted") {
            const preview = text.length > 15 ? text.substring(0, 15) + '...' : text;
            const roleTag = role && role !== 'user' ? ` (${role})` : '';
            if (this.events.onNotification) this.events.onNotification(`${author}${roleTag}`, preview);
        }
    }

    _listenForNewMessages() {
        this.db.ref('messages').limitToLast(1).on('child_added', snap => {
            const data = snap.val();
            if (data.author !== this.currentUser.login && data.type === 'text' && this.currentChatId !== snap.ref.parent.key) {
                const rawText = this.decrypt(data.text).replace(/\n/g, ' ').trim();
                this._showNotif(data.author, data.role, rawText);
            }
        });
    }

    loadChatsList() {
        this.db.ref('chats').on('value', snap => {
            const chats = [];
            snap.forEach(child => {
                const chat = child.val();
                if (chat.participants && chat.participants[this.currentUser.login]) {
                    chats.push({ id: child.key, ...chat });
                }
            });
            if (this.events.onChatsLoaded) this.events.onChatsLoaded(chats);
        });
    }

    switchChat(chatId) {
        this.currentChatId = chatId;
        this.loadMessages(chatId);
    }

    loadMessages(chatId) {
        if (this.msgListener) this.db.ref('messages/' + this.currentChatId).off('child_added', this.msgListener);
        this.msgListener = this.db.ref('messages/' + chatId).limitToLast(60).on('child_added', snap => {
            const data = snap.val();
            if (this.blockedUsers.includes(data.author)) return;
            if (this.events.onMessage) this.events.onMessage({ key: snap.key, ...data }, chatId);
        });
    }

    sendMessage(text, forceAuthor = null) {
        if (!this.currentUser || !this.currentChatId) return;
        if (!text) return;
        if (text.length > 200) text = text.substring(0, 200);
        const lines = text.match(/.{1,20}/g) || [];
        const finalText = lines.join('\n');
        
        let author = this.currentUser.login;
        if ((this.currentUser.role === 'root' || this.currentUser.role === 'admin') && forceAuthor) {
           author = forceAuthor;
        }

        const messageData = {
            author, text: this.encrypt(finalText), timestamp: Date.now(), type: 'text', role: this.currentUser.role
        };
        
        if (this.replyTo) {
            messageData.replyTo = { key: this.replyTo.key, author: this.replyTo.author, text: this.replyTo.text };
            this.replyTo = null;
        }

        this.db.ref('messages/' + this.currentChatId).push(messageData);
    }

    setReply(msgKey, author, text) { this.replyTo = { key: msgKey, author, text }; }
    cancelReply() { this.replyTo = null; }

    deleteMsg(chatId, key) { 
        if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'root') return; 
        this.db.ref('messages/' + chatId + '/' + key).remove(); 
    }

    createChat(name, participantsLogins) {
        const parts = { [this.currentUser.login]: true }; 
        participantsLogins.forEach(l => parts[l] = true);
        const ref = this.db.ref('chats').push();
        ref.set({ name, created: Date.now(), participants: parts });
        return ref.key;
    }

    deleteChat(chatId) {
        this.db.ref('chats/' + chatId).remove(); 
        this.db.ref('messages/' + chatId).remove(); 
    }

    blockUser(login) {
        this.db.ref('blocked/' + this.currentUser.login + '/' + login).set(true);
        this.blockedUsers.push(login);
        this.loadMessages(this.currentChatId);
    }

    listenForCalls() {
        if (this.callListener) this.db.ref('calls').off('child_added', this.callListener);
        this.callListener = this.db.ref('calls').orderByChild('to').equalTo(this.currentUser.login).on('child_added', snap => {
            const d = snap.val();
            if (d.status === 'offering') {
                this._showNotif(d.from, '', 'Входящий звонок');
                if (this.events.onCall) this.events.onCall({ id: snap.key, ...d }, 'incoming');
            }
        });
    }

    async startCall(target) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.peerConnection = new RTCPeerConnection(this.ICE_SERVERS);
            this.localStream.getTracks().forEach(t => this.peerConnection.addTrack(t, this.localStream));
            this.peerConnection.ontrack = e => { if (this.events.onCall) this.events.onCall({ stream: e.streams[0] }, 'remote_stream'); this._startCallTimer(); };
            this.peerConnection.onicecandidate = e => { if (e.candidate) this.db.ref('calls/active/' + this.callId + '/candidates').push(this.encrypt(JSON.stringify(e.candidate.toJSON()))); };
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.callId = this.db.ref('calls').push().key;
            const activeId = this.db.ref('calls/active').push().key;
            this.db.ref('calls/' + this.callId).set({ from: this.currentUser.login, to: target, status: 'offering', activeRef: activeId });
            this.db.ref('calls/active/' + activeId).set({ type: 'offer', sdp: this.encrypt(offer.sdp), caller: this.currentUser.login });
            this.db.ref('calls/' + this.callId + '/status').on('value', snap => { if (snap.val() === 'ended' || snap.val() === 'rejected') this.endCall(); });
        } catch (err) { console.error('Микрофон: ' + err.message); }
    }

    async acceptCall(callId, data) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.peerConnection = new RTCPeerConnection(this.ICE_SERVERS);
            this.localStream.getTracks().forEach(t => this.peerConnection.addTrack(t, this.localStream));
            this.peerConnection.ontrack = e => { if (this.events.onCall) this.events.onCall({ stream: e.streams[0] }, 'remote_stream'); this._startCallTimer(); };
            this.peerConnection.onicecandidate = e => { if (e.candidate) this.db.ref('calls/active/' + data.activeRef + '/candidates').push(this.encrypt(JSON.stringify(e.candidate.toJSON()))); };
            const offerSdp = await this.db.ref('calls/active/' + data.activeRef + '/sdp').once('value').then(s => this.decrypt(s.val()));
            await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.db.ref('calls/active/' + data.activeRef).update({ answerSdp: this.encrypt(answer.sdp) });
            this.db.ref('calls/' + callId).update({ status: 'answered' });
            this.db.ref('calls/' + callId + '/status').on('value', snap => { if (snap.val() === 'ended' || snap.val() === 'rejected') this.endCall(); });
        } catch (err) { console.error('Ошибка звонка: ' + err.message); }
    }

    rejectCall(callId) { this.db.ref('calls/' + callId).update({ status: 'rejected' }); }

    endCall() {
        if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
        if (this.peerConnection) this.peerConnection.close();
        clearInterval(this.callTimerInterval);
        if (this.callId) this.db.ref('calls/' + this.callId).update({ status: 'ended' });
        this.callId = null;
        if (this.events.onCall) this.events.onCall(null, 'ended');
    }

    toggleMute() {
        if (this.localStream) {
            const track = this.localStream.getAudioTracks()[0];
            track.enabled = !track.enabled;
            return track.enabled;
        }
        return false;
    }

    _startCallTimer() {
        this.callSeconds = 0;
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = setInterval(() => {
            this.callSeconds++;
            if (this.events.onCall) {
                this.events.onCall({ timer: `${Math.floor(this.callSeconds/60).toString().padStart(2,'0')}:${(this.callSeconds%60).toString().padStart(2,'0')}` }, 'timer');
            }
        }, 1000);
    }
}

class TerminalProcessor {
    constructor(core) {
        this.core = core;
        this.history = [];
        this.histIdx = -1;
    }

    log(text, color = '#10b981') {
        if (this.core.events.onTerminal) this.core.events.onTerminal(text, color);
    }

    execute(cmdString) {
        const parts = cmdString.split(/\s+/);
        const c = parts[0].toLowerCase();
        const args = parts.slice(1);
        this.log(`root@lime:~# ${cmdString}`, '#10b981');

        switch(c) {
            case 'help':
            case '?':
                this.log("\n=== LIME TERMINAL COMMANDS ===", '#10b981');
                this.log("  help          - Show this help", '#a0a0b0');
                this.log("  status        - System status", '#a0a0b0');
                this.log("  listusers     - List all users", '#a0a0b0');
                this.log("  listchats     - List all chats", '#a0a0b0');
                this.log("  useradd <login> <pass> [role] - Add user", '#a0a0b0');
                this.log("  usermod <login> <role>        - Change role", '#a0a0b0');
                this.log("  nuke          - Delete all messages", '#a0a0b0');
                this.log("  clear         - Clear terminal", '#a0a0b0');
                this.log("  exit          - Logout", '#a0a0b0');
                break;

            case 'status':
                this.log("\n️ LIME MESSAGE v1.0", '#10b981');
                this.log(`   User: ${this.core.currentUser?.login} (${this.core.currentUser?.role})`, '#a0a0b0');
                this.log(`   Chat: ${this.core.currentChatId}`, '#a0a0b0');
                break;

            case 'listusers':
                this.core.db.ref('users').once('value').then(snap => {
                    const users = snap.val() || {};
                    this.log(`\n📋 Total: ${Object.keys(users).length}`, '#10b981');
                    Object.entries(users).forEach(([l, d]) => this.log(`   ${l} - ${d.role} (${d.displayName})`, '#a0a0b0'));
                });
                break;

            case 'listchats':
                this.core.db.ref('chats').once('value').then(snap => {
                    const chats = snap.val() || {};
                    this.log(`\n💬 Total: ${Object.keys(chats).length}`, '#10b981');
                    Object.entries(chats).forEach(([id, d]) => this.log(`   ${id} - ${d.name}`, '#a0a0b0'));
                });
                break;

            case 'useradd': {
                if (args.length < 2) return this.log("Usage: useradd <login> <pass> [role]", '#ec4899');
                const [login, pass, role = 'user'] = args;
                this.core.db.ref('users/' + login).set({
                    password: this.core.encrypt(pass),
                    role: role,
                    displayName: login,
                    created: Date.now()
                }).then(() => this.log(`✅ User '${login}' created with role '${role}'`, '#10b981'));
                break;
            }

            case 'usermod': {
                if (args.length < 2) return this.log("Usage: usermod <login> <role>", '#ec4899');
                const [login, role] = args;
                if (!['root', 'admin', 'user'].includes(role)) return this.log("Role must be: root/admin/user", '#ec4899');
                this.core.db.ref('users/' + login + '/role').set(role)
                    .then(() => this.log(`✅ Role of '${login}' set to '${role}'`, '#10b981'));
                break;
            }

            case 'nuke':
                if (confirm('⚠️ DELETE ALL MESSAGES?')) {
                    this.core.db.ref('messages').remove().then(() => this.log('💥 ALL DESTROYED', '#ec4899'));
                }
                break;

            case 'clear':
                if (this.core.events.onTerminalClear) this.core.events.onTerminalClear();
                break;

            case 'exit':
                this.core.logout();
                break;

            default: 
                this.log(`bash: ${c}: command not found. Type 'help'`, '#ec4899');
        }
    }
}
