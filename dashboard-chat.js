(function () {
  const style = document.createElement('style');
  style.textContent = `
    .wa-chat{border:none;border-radius:16px;overflow:hidden;background:#fff;box-shadow: 0 10px 40px rgba(0,0,0,0.08);}
    .wa-layout{display:grid;grid-template-columns:280px 1fr;min-height:620px}
    .wa-sidebar{border-right:1px solid #f0f0f0;background:#fff;display:flex;flex-direction:column;min-width:0}
    .wa-title{padding:20px;background: #fcfcfd;}
    .wa-title h2{font-size:1.1rem; color: #064e3b; margin:0;}
    .wa-search{padding:0 15px 15px;}
    .wa-search .form-control{border-radius:10px; border: 1px solid #eee; background: #f9f9f9; font-size: 0.9rem;}
    .wa-conversations{overflow:auto; flex: 1;}
    .wa-conversation{width:100%;border:0;background:#fff;text-align:left;padding:15px;display:flex;gap:12px;align-items:center;transition: 0.2s;}
    .wa-conversation:hover{background:#f8faf9}
    .wa-conversation.active{background:#f0f7f4; border-right: 4px solid #146c43;}
    .wa-avatar{width:44px;height:44px;border-radius:12px;background: linear-gradient(135deg, #064e3b, #146c43);color:#fff;display:grid;place-items:center;font-weight:700;flex:0 0 auto; box-shadow: 0 4px 10px rgba(6,78,59,0.2);}
    .wa-conversation-meta{min-width:0;flex:1}
    .wa-conversation-name{font-weight:600;font-size:0.95rem; color:#1a202c; white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wa-conversation-subtitle{font-size:.8rem;color:#718096;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wa-main{display:flex;flex-direction:column;min-width:0;background:#fcfdfd}
    .wa-header{background:#fff;padding:15px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .wa-header-info{display:flex;align-items:center;gap:10px;min-width:0}
    .wa-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .wa-icon-btn{border:1px solid #edf2f7;background:#fff;border-radius:10px;min-width:40px;height:40px;padding:0 12px;font-weight:600;color:#4a5568;transition:0.2s;}
    .wa-icon-btn:hover{background:#f7fafc; color:#146c43; border-color:#cbd5e0;}
    .wa-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px}
    .wa-empty{margin:auto;text-align:center;color:#6c757d}
    .wa-bubble{max-width:min(80%,560px);border:none;border-radius:18px;padding:12px 16px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.03); position:relative;}
    .wa-bubble.mine{align-self:flex-end;background:#146c43;color:#fff; border-bottom-right-radius:4px;}
    .wa-bubble.mine .wa-time, .wa-bubble.mine .wa-sender{color:rgba(255,255,255,0.85)}
    .wa-bubble.theirs{align-self:flex-start; background: #edf2f7; border-bottom-left-radius:4px; color:#2d3748;}
    .wa-sender{font-size:.72rem;font-weight:700;color:#b38b59;margin-bottom:4px; text-transform:uppercase; letter-spacing:0.02em;}
    .wa-text{white-space:pre-wrap;overflow-wrap:anywhere}
    .wa-time{font-size:.68rem;color:#a0aec0;text-align:right;margin-top:6px}
    .wa-attachment{margin-top:8px}
    .wa-attachment img{max-width:260px;border-radius:8px;display:block}
    .wa-attachment audio,.wa-attachment video{max-width:100%;display:block}
    .wa-file{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(0,0,0,0.05);border-radius:10px;padding:8px 12px;background:rgba(255,255,255,0.1);color:inherit;text-decoration:none}
    .wa-reply{border-left:3px solid #b38b59;background:rgba(0,0,0,0.03);padding:6px 10px;border-radius:6px;margin-bottom:8px;font-size:.78rem;color:inherit; opacity:0.9;}
    .wa-reactions{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
    .wa-reaction{border:1px solid #eee;background:#fff;border-radius:20px;font-size:.75rem;padding:2px 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); color: #1a202c;}
    .wa-composer{background:#fff;border-top:1px solid #f0f0f0;padding:16px 20px;display:grid;grid-template-columns:auto auto 1fr auto;gap:12px;align-items:end}
    .wa-composer textarea{resize:none;max-height:120px}
    .wa-replying{grid-column:1 / -1;background:#eef7f2;border-radius:6px;padding:8px 10px;display:none;justify-content:space-between;gap:8px}
    .wa-recording{grid-column:1 / -1;display:none;align-items:center;justify-content:space-between;background:#fff3cd;border-radius:6px;padding:8px 10px}
    .wa-file-input{display:none}
    .wa-menu{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
    .wa-menu button{border:0;background:transparent;color:#146c43;font-size:.78rem;padding:0}
    .wa-call-modal{position:fixed;inset:0;background:rgba(10,25,49,.72);display:none;align-items:center;justify-content:center;z-index:2000;padding:18px}
    .wa-call-card{width:min(760px,100%);background:#111827;color:#fff;border-radius:8px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35)}
    .wa-call-stage{background:#020812;min-height:320px;display:grid;place-items:center}
    .wa-call-stage video{width:100%;max-height:440px;object-fit:cover;background:#020812}
    .wa-call-controls{padding:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .wa-call-controls button{border-radius:6px}
    @media (max-width: 800px){
      .wa-layout{grid-template-columns:1fr;min-height:680px}
      .wa-sidebar{border-right:0;border-bottom:1px solid #dfe7ef;max-height:250px}
      .wa-bubble{max-width:92%}
      .wa-composer{grid-template-columns:auto auto 1fr}
      .wa-composer button[type="submit"]{grid-column:1 / -1}
    }
  `;
  document.head.appendChild(style);

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function getApiBase() {
    return window.location.protocol.startsWith('http') ? '' : 'http://localhost:3000';
  }

  window.initDashboardChat = function initDashboardChat(options) {
    const mount = document.getElementById(options.mountId);
    if (!mount) return;

    const apiBase = getApiBase();
    const tokenKey = options.tokenKey;
    let conversations = [];
    let activeConversationId = 'group:main';
    let messages = [];
    let pollTimer = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStartedAt = null;
    let replyTo = null;
    let editingMessageId = null;
    let callStream = null;
    let callStartedAt = null;
    let activeCallKind = 'voice';

    mount.innerHTML = `
      <section class="wa-chat" aria-label="Dashboard chat">
        <div class="wa-layout">
          <aside class="wa-sidebar">
            <div class="wa-title">
              <h2 class="h4 fw-bold mb-1">Chats</h2>
              <div class="text-muted small">Group and private conversations</div>
            </div>
            <div class="wa-search">
              <input id="${options.mountId}Search" class="form-control" placeholder="Search chats or messages">
            </div>
            <div id="${options.mountId}Conversations" class="wa-conversations"></div>
          </aside>
          <div class="wa-main">
            <header class="wa-header">
              <div class="wa-header-info">
                <div id="${options.mountId}Avatar" class="wa-avatar">MG</div>
                <div class="min-w-0">
                  <div id="${options.mountId}Name" class="fw-bold text-truncate">Ministry Group</div>
                  <div id="${options.mountId}Subtitle" class="small text-muted text-truncate">All admins and registered members</div>
                </div>
              </div>
              <div class="wa-actions">
                <button id="${options.mountId}VoiceCall" class="wa-icon-btn" type="button" title="Start voice call">Call</button>
                <button id="${options.mountId}VideoCall" class="wa-icon-btn" type="button" title="Start video call">Video</button>
                <button id="${options.mountId}Refresh" class="wa-icon-btn" type="button" title="Refresh messages">Sync</button>
                <button id="${options.mountId}DeleteChat" class="wa-icon-btn text-danger" type="button" title="Delete conversation history">Clear</button>
              </div>
            </header>
            <div id="${options.mountId}Feedback" class="alert d-none m-3 mb-0" role="alert"></div>
            <div id="${options.mountId}Messages" class="wa-messages"></div>
            <form id="${options.mountId}Form" class="wa-composer">
              <div id="${options.mountId}Replying" class="wa-replying">
                <span id="${options.mountId}ReplyingText"></span>
                <button id="${options.mountId}CancelReply" class="btn btn-sm btn-outline-secondary" type="button">Cancel</button>
              </div>
              <div id="${options.mountId}Editing" class="wa-replying">
                <span id="${options.mountId}EditingText"></span>
                <button id="${options.mountId}CancelEdit" class="btn btn-sm btn-outline-secondary" type="button">Cancel</button>
              </div>
              <div id="${options.mountId}Recording" class="wa-recording">
                <span id="${options.mountId}RecordingText">Recording voice note...</span>
                <button id="${options.mountId}StopRecording" class="btn btn-sm btn-warning" type="button">Send voice note</button>
              </div>
              <button id="${options.mountId}Attach" class="wa-icon-btn" type="button" title="Attach file">+</button>
              <button id="${options.mountId}Record" class="wa-icon-btn" type="button" title="Record voice note">Mic</button>
              <textarea id="${options.mountId}Text" class="form-control" rows="1" placeholder="Type a message"></textarea>
              <button class="btn btn-success" type="submit">Send</button>
              <input id="${options.mountId}File" class="wa-file-input" type="file" accept="image/*,audio/*,video/mp4,video/webm,application/pdf,text/plain">
            </form>
          </div>
        </div>
      </section>
      <div id="${options.mountId}CallModal" class="wa-call-modal" role="dialog" aria-modal="true">
        <div class="wa-call-card">
          <div class="p-3 d-flex justify-content-between align-items-center">
            <div>
              <div id="${options.mountId}CallTitle" class="fw-bold">Voice call</div>
              <div id="${options.mountId}CallStatus" class="small text-white-50">Connecting with your microphone</div>
            </div>
            <button id="${options.mountId}EndCallTop" class="btn btn-sm btn-outline-light" type="button">End</button>
          </div>
          <div class="wa-call-stage">
            <video id="${options.mountId}CallVideo" autoplay muted playsinline></video>
            <div id="${options.mountId}AudioOnly" class="text-center">
              <div class="display-6 fw-bold mb-2">Voice Call</div>
              <div class="text-white-50">Microphone is active on this device.</div>
            </div>
          </div>
          <div class="wa-call-controls">
            <button id="${options.mountId}MuteCall" class="btn btn-outline-light" type="button">Mute</button>
            <button id="${options.mountId}CameraCall" class="btn btn-outline-light" type="button">Camera</button>
            <button id="${options.mountId}EndCall" class="btn btn-danger" type="button">End Call</button>
          </div>
        </div>
      </div>
    `;

    const els = {
      conversations: document.getElementById(`${options.mountId}Conversations`),
      messages: document.getElementById(`${options.mountId}Messages`),
      feedback: document.getElementById(`${options.mountId}Feedback`),
      search: document.getElementById(`${options.mountId}Search`),
      name: document.getElementById(`${options.mountId}Name`),
      subtitle: document.getElementById(`${options.mountId}Subtitle`),
      avatar: document.getElementById(`${options.mountId}Avatar`),
      form: document.getElementById(`${options.mountId}Form`),
      text: document.getElementById(`${options.mountId}Text`),
      attach: document.getElementById(`${options.mountId}Attach`),
      file: document.getElementById(`${options.mountId}File`),
      record: document.getElementById(`${options.mountId}Record`),
      recording: document.getElementById(`${options.mountId}Recording`),
      recordingText: document.getElementById(`${options.mountId}RecordingText`),
      stopRecording: document.getElementById(`${options.mountId}StopRecording`),
      replying: document.getElementById(`${options.mountId}Replying`),
      replyingText: document.getElementById(`${options.mountId}ReplyingText`),
      cancelReply: document.getElementById(`${options.mountId}CancelReply`),
      editing: document.getElementById(`${options.mountId}Editing`),
      editingText: document.getElementById(`${options.mountId}EditingText`),
      cancelEdit: document.getElementById(`${options.mountId}CancelEdit`),
      refresh: document.getElementById(`${options.mountId}Refresh`),
      deleteChat: document.getElementById(`${options.mountId}DeleteChat`),
      voiceCall: document.getElementById(`${options.mountId}VoiceCall`),
      videoCall: document.getElementById(`${options.mountId}VideoCall`),
      callModal: document.getElementById(`${options.mountId}CallModal`),
      callTitle: document.getElementById(`${options.mountId}CallTitle`),
      callStatus: document.getElementById(`${options.mountId}CallStatus`),
      callVideo: document.getElementById(`${options.mountId}CallVideo`),
      audioOnly: document.getElementById(`${options.mountId}AudioOnly`),
      muteCall: document.getElementById(`${options.mountId}MuteCall`),
      cameraCall: document.getElementById(`${options.mountId}CameraCall`),
      endCall: document.getElementById(`${options.mountId}EndCall`),
      endCallTop: document.getElementById(`${options.mountId}EndCallTop`)
    };

    function token() {
      return localStorage.getItem(tokenKey);
    }

    function showFeedback(message, type = 'danger') {
      els.feedback.className = `alert alert-${type} m-3 mb-0`;
      els.feedback.textContent = message;
    }

    async function api(path, apiOptions = {}) {
      const headers = apiOptions.headers || {};
      if (token()) headers.Authorization = `Bearer ${token()}`;
      const response = await fetch(`${apiBase}${path}`, { ...apiOptions, headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Chat request failed.');
      return data;
    }

    function currentConversation() {
      return conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
    }

    function renderConversations() {
      const query = els.search.value.trim().toLowerCase();
      const visible = conversations.filter((conversation) => {
        const last = conversation.lastMessage?.message || '';
        return `${conversation.name} ${conversation.subtitle} ${last}`.toLowerCase().includes(query);
      });

      els.conversations.innerHTML = visible.map((conversation) => `
        <button class="wa-conversation ${conversation.id === activeConversationId ? 'active' : ''}" data-conversation-id="${escapeHtml(conversation.id)}" type="button">
          <span class="wa-avatar">${escapeHtml(conversation.avatar || conversation.name.slice(0, 2).toUpperCase())}</span>
          <span class="wa-conversation-meta">
            <span class="wa-conversation-name">${escapeHtml(conversation.name)}</span>
            <span class="wa-conversation-subtitle">${escapeHtml(conversation.lastMessage?.message || conversation.subtitle || '')}</span>
          </span>
        </button>
      `).join('');
    }

    function updateHeader() {
      const conversation = currentConversation();
      if (!conversation) return;
      els.name.textContent = conversation.name;
      els.subtitle.textContent = conversation.subtitle || '';
      els.avatar.textContent = conversation.avatar || conversation.name.slice(0, 2).toUpperCase();
    }

    function findReplyText(id) {
      const message = messages.find((item) => item.id === id);
      if (!message) return '';
      return `${message.senderName}: ${message.message || message.attachment?.name || message.type}`;
    }

    function renderAttachment(message) {
      const attachment = message.attachment;
      if (!attachment) return '';
      if (attachment.type === 'image') {
        return `<div class="wa-attachment"><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name)}"></div>`;
      }
      if (attachment.type === 'audio') {
        return `<div class="wa-attachment"><audio controls src="${escapeHtml(attachment.url)}"></audio></div>`;
      }
      if (attachment.type === 'video') {
        return `<div class="wa-attachment"><video controls src="${escapeHtml(attachment.url)}"></video></div>`;
      }
      return `<div class="wa-attachment"><a class="wa-file" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">File ${escapeHtml(attachment.name)}</a></div>`;
    }

    function renderCall(message) {
      if (message.type !== 'call' || !message.call) return '';
      const label = message.call.kind === 'video' ? 'Video call' : 'Voice call';
      return `<div class="wa-text"><strong>${label}</strong> ${escapeHtml(message.call.status || 'started')}${message.call.duration ? ` - ${escapeHtml(message.call.duration)}` : ''}</div>`;
    }

    function renderMessages() {
      const participantId = options.role === 'admin' ? 'admin' : options.userId;
      const query = els.search.value.trim().toLowerCase();
      const visible = query
        ? messages.filter((message) => `${message.senderName} ${message.message} ${message.attachment?.name || ''}`.toLowerCase().includes(query))
        : messages;

      if (!visible.length) {
        els.messages.innerHTML = '<div class="wa-empty">No messages here yet.</div>';
        return;
      }

      els.messages.innerHTML = visible.map((message) => {
        const mine = message.senderId === participantId || (options.role === 'admin' && message.senderRole === 'admin');
        const reactions = Array.isArray(message.reactions) ? message.reactions : [];
        return `
          <article class="wa-bubble ${mine ? 'mine' : 'theirs'}" data-message-id="${escapeHtml(message.id)}">
            ${!mine ? `<div class="wa-sender">${escapeHtml(message.senderName)}${message.senderRole === 'admin' ? ' (Admin)' : ''}</div>` : ''}
            ${message.replyTo ? `<div class="wa-reply">${escapeHtml(findReplyText(message.replyTo))}</div>` : ''}
            ${renderCall(message)}
            ${message.message ? `<div class="wa-text">${escapeHtml(message.message)}</div>` : ''}
            ${message.isEdited ? `<small class="opacity-50" style="font-size:0.6rem">(edited)</small>` : ''}
            ${renderAttachment(message)}
            ${reactions.length ? `<div class="wa-reactions">${reactions.map((reaction) => `<span class="wa-reaction">${escapeHtml(reaction.emoji)}</span>`).join('')}</div>` : ''}
            <div class="wa-time">${new Date(message.createdAt).toLocaleString()} ${mine ? 'Sent' : ''}</div>
            <div class="wa-menu">
              <button type="button" data-reply="${escapeHtml(message.id)}">Reply</button>
              ${mine ? `<button type="button" data-edit="${escapeHtml(message.id)}">Edit</button>` : ''}
              ${mine || options.role === 'admin' ? `<button type="button" data-delete="${escapeHtml(message.id)}">Delete</button>` : ''}
              <button type="button" data-react="${escapeHtml(message.id)}" data-emoji="Thanks">Thanks</button>
              <button type="button" data-react="${escapeHtml(message.id)}" data-emoji="Praying">Praying</button>
            </div>
          </article>
        `;
      }).join('');
      els.messages.scrollTop = els.messages.scrollHeight;
    }

    async function loadConversations() {
      conversations = await api('/api/chat/conversations');
      if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
        activeConversationId = conversations[0]?.id || 'group:main';
      }
      renderConversations();
      updateHeader();
    }

    async function loadMessages() {
      messages = await api(`/api/chat/messages?conversationId=${encodeURIComponent(activeConversationId)}`);
      renderMessages();
    }

    async function refresh() {
      if (!token()) return;
      try {
        await loadConversations();
        await loadMessages();
      } catch (error) {
        showFeedback(error.message || 'Could not load chat.');
      }
    }

    async function sendMessage({ text = '', file = null, type = 'text', call = null } = {}) {
      const formData = new FormData();
      formData.append('conversationId', activeConversationId);

      if (editingMessageId && !file && type === 'text') {
        await api(`/api/chat/messages/${editingMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        editingMessageId = null;
        els.editing.style.display = 'none';
        els.text.value = '';
        await refresh();
        return;
      }

      formData.append('message', text);
      formData.append('type', type);
      if (replyTo) formData.append('replyTo', replyTo);
      if (file) formData.append('attachment', file);
      if (call) {
        formData.append('callKind', call.kind);
        formData.append('callStatus', call.status);
        formData.append('duration', call.duration || '');
      }

      await api('/api/chat/messages', {
        method: 'POST',
        body: formData
      });
      replyTo = null;
      els.replying.style.display = 'none';
      els.text.value = '';
      await refresh();
    }

    async function startRecording() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        showFeedback('Voice notes are not supported in this browser.', 'warning');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      recordingStartedAt = Date.now();
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) recordedChunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        els.recording.style.display = 'none';
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        await sendMessage({ text: `Voice note (${seconds}s)`, file, type: 'audio' });
      };
      mediaRecorder.start();
      els.recording.style.display = 'flex';
    }

    async function startCall(kind) {
      if (!navigator.mediaDevices?.getUserMedia) {
        showFeedback('Calls need a browser with camera and microphone support.', 'warning');
        return;
      }
      activeCallKind = kind;
      callStartedAt = Date.now();
      callStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      els.callTitle.textContent = kind === 'video' ? 'Video call' : 'Voice call';
      els.callStatus.textContent = `Calling ${currentConversation()?.name || 'conversation'} from this device`;
      els.callModal.style.display = 'flex';
      els.audioOnly.style.display = kind === 'video' ? 'none' : 'block';
      els.callVideo.style.display = kind === 'video' ? 'block' : 'none';
      els.cameraCall.style.display = kind === 'video' ? 'inline-block' : 'none';
      els.callVideo.srcObject = callStream;
      await sendMessage({ type: 'call', text: `${kind === 'video' ? 'Video' : 'Voice'} call started`, call: { kind, status: 'started' } });
    }

    async function endCall() {
      if (!callStream) {
        els.callModal.style.display = 'none';
        return;
      }
      const seconds = Math.max(1, Math.round((Date.now() - callStartedAt) / 1000));
      callStream.getTracks().forEach((track) => track.stop());
      callStream = null;
      els.callVideo.srcObject = null;
      els.callModal.style.display = 'none';
      await sendMessage({
        type: 'call',
        text: `${activeCallKind === 'video' ? 'Video' : 'Voice'} call ended`,
        call: { kind: activeCallKind, status: 'ended', duration: `${seconds}s` }
      });
    }

    els.conversations.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-conversation-id]');
      if (!button) return;
      activeConversationId = button.dataset.conversationId;
      renderConversations();
      updateHeader();
      await loadMessages();
    });

    els.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = els.text.value.trim();
      if (!text) return;
      await sendMessage({ text });
    });

    els.attach.addEventListener('click', () => els.file.click());
    els.file.addEventListener('change', async () => {
      const file = els.file.files[0];
      if (!file) return;
      await sendMessage({ text: file.name, file });
      els.file.value = '';
    });

    els.record.addEventListener('click', () => {
      startRecording().catch((error) => showFeedback(error.message || 'Could not start recording.'));
    });
    els.stopRecording.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    });

    els.messages.addEventListener('click', async (event) => {
      const replyButton = event.target.closest('button[data-reply]');
      const reactButton = event.target.closest('button[data-react]');
      const editButton = event.target.closest('button[data-edit]');
      const deleteButton = event.target.closest('button[data-delete]');

      if (replyButton) {
        replyTo = replyButton.dataset.reply;
        els.replyingText.textContent = findReplyText(replyTo);
        els.replying.style.display = 'flex';
      }

      if (editButton) {
        const id = editButton.dataset.edit;
        const msg = messages.find(m => m.id === id);
        if (msg) {
          editingMessageId = id;
          els.text.value = msg.message;
          els.editingText.textContent = `Editing: ${msg.message.substring(0, 30)}...`;
          els.editing.style.display = 'flex';
          els.replying.style.display = 'none';
          replyTo = null;
          els.text.focus();
        }
      }

      if (deleteButton) {
        if (confirm('Are you sure you want to delete this message?')) {
          await api(`/api/chat/messages/${deleteButton.dataset.delete}`, {
            method: 'DELETE'
          });
          await refresh();
        }
      }

      if (reactButton) {
        await api(`/api/chat/messages/${encodeURIComponent(reactButton.dataset.react)}/reactions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji: reactButton.dataset.emoji })
        });
        await loadMessages();
      }
    });

    els.cancelReply.addEventListener('click', () => {
      replyTo = null;
      els.replying.style.display = 'none';
    });
    els.cancelEdit.addEventListener('click', () => {
      editingMessageId = null;
      els.editing.style.display = 'none';
      els.text.value = '';
    });
    els.search.addEventListener('input', () => {
      renderConversations();
      renderMessages();
    });
    els.deleteChat.addEventListener('click', async () => {
      const conversation = currentConversation();
      if (!confirm(`Are you sure you want to delete all messages in "${conversation.name}"? This cannot be undone.`)) return;
      
      try {
        await api(`/api/chat/conversations/${encodeURIComponent(activeConversationId)}`, { method: 'DELETE' });
        await refresh();
      } catch (error) {
        showFeedback(error.message || 'Could not clear chat.');
      }
    });
    els.refresh.addEventListener('click', refresh);
    els.voiceCall.addEventListener('click', () => startCall('voice').catch((error) => showFeedback(error.message || 'Could not start call.')));
    els.videoCall.addEventListener('click', () => startCall('video').catch((error) => showFeedback(error.message || 'Could not start video.')));
    els.endCall.addEventListener('click', () => endCall().catch((error) => showFeedback(error.message || 'Could not end call.')));
    els.endCallTop.addEventListener('click', () => endCall().catch((error) => showFeedback(error.message || 'Could not end call.')));
    els.muteCall.addEventListener('click', () => {
      const audioTrack = callStream?.getAudioTracks()[0];
      if (!audioTrack) return;
      audioTrack.enabled = !audioTrack.enabled;
      els.muteCall.textContent = audioTrack.enabled ? 'Mute' : 'Unmute';
    });
    els.cameraCall.addEventListener('click', () => {
      const videoTrack = callStream?.getVideoTracks()[0];
      if (!videoTrack) return;
      videoTrack.enabled = !videoTrack.enabled;
      els.cameraCall.textContent = videoTrack.enabled ? 'Camera' : 'Camera Off';
    });

    refresh();
    pollTimer = setInterval(refresh, 5000);
    return {
      refresh,
      destroy() {
        clearInterval(pollTimer);
        if (callStream) callStream.getTracks().forEach((track) => track.stop());
      }
    };
  };
}());
