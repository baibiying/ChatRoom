// 聊天室前端逻辑
let page = 1; // This might become less relevant with before_id, but keep for initial load fallback
let loading = false;
let hasMoreOlderMessages = true; // Indicates if there are more *older* messages to load
let lastMessageId = 0; // 记录当前已加载的最新消息ID (用于获取新消息)
const chatHistory = document.getElementById("chat-history");
const sendBtn = document.getElementById("send-btn");
const nicknameInput = document.getElementById("nickname");
const emailInput = document.getElementById("email");
const messageInput = document.getElementById("message");
const emojiBtn = document.getElementById("emoji-btn");
const room = window.CHAT_ROOM;

// localStorage 自动填充
window.addEventListener("DOMContentLoaded", () => {
  const savedNick = localStorage.getItem("chat_nick");
  const savedEmail = localStorage.getItem("chat_email");
  if (savedNick) nicknameInput.value = savedNick;
  if (savedEmail) emailInput.value = savedEmail;

  // 只插入一次按钮组
  let chatMsgRow = document.querySelector('.chat-message-row');
  if (!chatMsgRow.querySelector('.chat-action-btns')) {
    // 创建横向按钮组
    const actionBtnsWrap = document.createElement('div');
    actionBtnsWrap.className = 'chat-action-btns';
    actionBtnsWrap.style.display = 'flex';
    actionBtnsWrap.style.alignItems = 'flex-end';
    actionBtnsWrap.style.gap = '8px';
    // 创建录音提示容器
    const voiceBtnWrap = document.createElement('div');
    voiceBtnWrap.style.display = 'flex';
    voiceBtnWrap.style.flexDirection = 'column';
    voiceBtnWrap.style.alignItems = 'center';
    voiceBtnWrap.style.justifyContent = 'flex-end';
    // 创建录音提示元素
    let recordTip = document.createElement('span');
    recordTip.id = 'record-tip';
    recordTip.textContent = '正在录音...';
    recordTip.style.display = 'none';
    recordTip.style.color = '#e74c3c';
    recordTip.style.fontSize = '0.98em';
    recordTip.style.marginBottom = '4px';
    recordTip.style.fontWeight = 'bold';
    voiceBtnWrap.appendChild(recordTip);
    // 创建语音按钮
    const voiceBtn = document.createElement('button');
    voiceBtn.id = 'voice-btn';
    voiceBtn.title = '发送语音';
    // 麦克风SVG图标（深灰色）
    voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" fill="#333" stroke="#333" stroke-width="1.5"/><path d="M19 12v1a7 7 0 0 1-14 0v-1" stroke="#333" stroke-width="1.5"/><path d="M12 20v-2" stroke="#333" stroke-width="1.5" stroke-linecap="round"/></svg>';
    voiceBtnWrap.appendChild(voiceBtn);
    actionBtnsWrap.appendChild(voiceBtnWrap);
    // 插入到textarea前
    chatMsgRow.insertBefore(actionBtnsWrap, chatMsgRow.querySelector('#message'));

    // 语音按钮事件绑定
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    voiceBtn.addEventListener('click', async () => {
      if (!isRecording) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('当前浏览器不支持语音录制');
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new window.MediaRecorder(stream);
          audioChunks = [];
          mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
          };
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob, `audio_${Date.now()}.webm`);
            voiceBtn.disabled = true;
            // 结束后也恢复麦克风图标
            voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" fill="#333" stroke="#333" stroke-width="1.5"/><path d="M19 12v1a7 7 0 0 1-14 0v-1" stroke="#333" stroke-width="1.5"/><path d="M12 20v-2" stroke="#333" stroke-width="1.5" stroke-linecap="round"/></svg>';
            try {
              const res = await fetch(`/${room}/upload_audio`, { method: 'POST', body: formData });
              let data;
              try {
                data = await res.json();
              } catch (e) {
                const text = await res.text();
                alert('音频上传出错（非JSON响应）\n' + text);
                return;
              }
              if (data.success && data.url) {
                await sendAudioMessage(data.url);
              } else {
                alert('音频上传失败\n' + (data.error || '') + '\n' + (data.trace || ''));
              }
            } catch (e) {
              alert('音频上传出错\n' + (e && e.message ? e.message : e));
            }
            voiceBtn.disabled = false;
            voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" fill="#333" stroke="#333" stroke-width="1.5"/><path d="M19 12v1a7 7 0 0 1-14 0v-1" stroke="#333" stroke-width="1.5"/><path d="M12 20v-2" stroke="#333" stroke-width="1.5" stroke-linecap="round"/></svg>';
            // 隐藏录音提示
            recordTip.style.display = 'none';
          };
          mediaRecorder.start();
          isRecording = true;
          // 录音中也显示深灰色麦克风图标
          voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" fill="#333" stroke="#333" stroke-width="1.5"/><path d="M19 12v1a7 7 0 0 1-14 0v-1" stroke="#333" stroke-width="1.5"/><path d="M12 20v-2" stroke="#333" stroke-width="1.5" stroke-linecap="round"/></svg>';
          // 显示录音提示
          recordTip.style.display = '';
        } catch (e) {
          alert('无法访问麦克风');
          // 失败也恢复麦克风图标
          voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="none"/><path d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" fill="#333" stroke="#333" stroke-width="1.5"/><path d="M19 12v1a7 7 0 0 1-14 0v-1" stroke="#333" stroke-width="1.5"/><path d="M12 20v-2" stroke="#333" stroke-width="1.5" stroke-linecap="round"/></svg>';
          // 隐藏录音提示
          recordTip.style.display = 'none';
        }
      } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          isRecording = false;
        }
      }
    });
  }

  // 确保sendAudioMessage在此作用域内
  async function sendAudioMessage(audioUrl) {
    const nickname = nicknameInput.value.trim();
    const email = emailInput.value.trim();
    if (!nickname || !email) {
      alert('请填写昵称和邮箱');
      return;
    }
    localStorage.setItem('chat_nick', nickname);
    localStorage.setItem('chat_email', email);
    sendBtn.disabled = true;
    try {
      const res = await fetch(`/${encodeURIComponent(room)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, content: '', audio_url: audioUrl })
      });
      const data = await res.json();
      if (!data.success) {
        alert('发送语音消息失败');
      }
    } catch (e) {
      alert('发送语音消息出错');
    }
    sendBtn.disabled = false;
  }
});
nicknameInput.addEventListener("change", () => {
  localStorage.setItem("chat_nick", nicknameInput.value.trim());
});
emailInput.addEventListener("change", () => {
  localStorage.setItem("chat_email", emailInput.value.trim());
});

// 表情插入
const emojis = [
  // 马卡龙风可爱表情
  "😊", "😄", "😍", "🥰", "😘", "😇", "😋", "😜", "🤗", "🤩",
  // 彩色爱心
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🤎", "🖤",
  // 动物
  "🐱", "🐶", "🐰", "🐻", "🦄", "🐥", "🐧", "🐼", "🐸", "🐢",
  // 食物
  "🍰", "🧁", "🍦", "🍩", "🍬", "🍭", "🍓", "🍉", "🍒", "🍑",
  // 生活
  "🌸", "🌈", "⭐", "✨", "🎀", "🎉", "🎈", "🎶", "🪐", "☁️",
  // 手势
  "👍", "👏", "🙏", "🤙", "👌", "🤞", "✌️", "🤟", "🫶", "👐",
  // 其他
  "😂", "😭", "🥳", "😎", "🤔", "😅", "😳", "😏", "😢", "😆"
];
let emojiPanel;
emojiBtn.addEventListener("click", (e) => {
  if (!emojiPanel) {
    emojiPanel = document.createElement("div");
    emojiPanel.className = "emoji-panel";
    emojis.forEach((emo) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-item";
      btn.textContent = emo;
      btn.onclick = () => {
        insertAtCursor(messageInput, emo);
        emojiPanel.style.display = "none";
        messageInput.focus();
      };
      emojiPanel.appendChild(btn);
    });
    emojiBtn.parentNode.appendChild(emojiPanel);
  }
  emojiPanel.style.display =
    emojiPanel.style.display === "block" ? "none" : "block";
  e.stopPropagation();
});
document.addEventListener("click", () => {
  if (emojiPanel) emojiPanel.style.display = "none";
});
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function stringToColor(str) {
  // 生成明亮色彩
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 75%, 65%)`;
}
function getAvatarHtml(nickname, email) {
  const base = email || nickname || "?";
  const color = stringToColor(base);
  const letter = (nickname || email || "?").trim()[0] || "?";
  return `<span class="chat-avatar" style="background:${color}">${letter.toUpperCase()}</span>`;
}

// 在输入区添加语音和表情按钮的包裹容器
// 删除全局作用域下actionBtnsWrap/voiceBtn插入和事件绑定的所有代码...

// 渲染消息时支持音频
function renderMessages(messages, prepend = false) {
  const fragment = document.createDocumentFragment();
  messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = "chat-message neon-animate";
    div.dataset.messageId = msg.id;
    const html = DOMPurify.sanitize(marked.parse(msg.content || ""));
    const avatarHtml = getAvatarHtml(msg.nickname, msg.email);
    let audioHtml = '';
    if (msg.audio_url) {
      audioHtml = `<audio controls style="margin-top:8px;max-width:90%;border-radius:8px;outline:none;background:#fff6e0;"><source src="${msg.audio_url}" type="audio/webm">您的浏览器不支持音频播放</audio>`;
    }
    div.innerHTML = `
      <div class=\"chat-meta\">${avatarHtml}<span class=\"message-number\">#${msg.id}</span><span class=\"chat-nick\">${msg.nickname}</span><span class=\"chat-email\">&lt;${msg.email}&gt;</span><span class=\"chat-time\">${new Date(msg.timestamp + " UTC").toLocaleString()}</span></div>
      <div class=\"chat-content\">${html}${audioHtml}</div>
    `;
    fragment.appendChild(div);
    div.addEventListener('animationend', () => {
      div.classList.remove('neon-animate');
    });
  });
  if (prepend) {
    chatHistory.insertBefore(fragment, chatHistory.firstChild);
  } else {
    chatHistory.appendChild(fragment);
  }
}

async function loadMessages({
  type = "initial",
  sinceId = 0,
  beforeId = 0,
} = {}) {
  // Only prevent loading for 'initial' and 'older' types if already loading
  if (loading && (type === "initial" || type === "older")) return;

  // Capture scroll state BEFORE fetching/rendering
  const oldScrollHeight = chatHistory.scrollHeight;
  const isUserAtBottomBeforeFetch = chatHistory.scrollHeight - chatHistory.scrollTop <= chatHistory.clientHeight + 50; // 50px threshold

  // Set loading to true only for 'initial' and 'older' types
  if (type === "initial" || type === "older") {
      loading = true;
  }

  let url = `/${encodeURIComponent(room)}/history`;
  if (type === "new") {
    url += `?since_id=${sinceId}`;
    console.log(`Fetching new messages since ID: ${sinceId}`); // Debug log
  } else if (type === "older") {
    url += `?before_id=${beforeId}`;
    console.log(`Fetching older messages before ID: ${beforeId}`); // Debug log
  } else { // type === 'initial'
    url += `?page=1`; // Initial load still uses page 1 for the newest batch
    console.log(`Fetching initial messages (page 1)`); // Debug log
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      console.log(`Fetched messages (${type}):`, data.messages.map(msg => msg.id)); // Debug log
      if (type === "older") {
        // For older messages, they are fetched in desc order, reverse to prepend in asc order
        renderMessages(data.messages.reverse(), true); // Prepend
        hasMoreOlderMessages = data.has_next; // Update hasMoreOlderMessages for older messages

        // Restore scroll position after prepending
        requestAnimationFrame(() => {
          chatHistory.scrollTop = chatHistory.scrollHeight - oldScrollHeight;
        });

      } else { // 'initial' or 'new'
        let msgsToRender = data.messages;
        if (type === "initial") {
          // For initial load, messages are fetched newest first (desc),
          // but we want to render them oldest first to appear at the bottom correctly.
          msgsToRender = msgsToRender.reverse();
          console.log("Initial messages (rendered order):", msgsToRender.map(msg => msg.id)); // Debug log
        }

        renderMessages(msgsToRender, false); // Append

        // Update lastMessageId only for 'initial' and 'new' fetches
        // lastMessageId should be the ID of the absolute newest message fetched
        if (data.messages.length > 0) {
          lastMessageId = data.messages[data.messages.length - 1].id; // Use original data.messages for newest ID
          console.log("Updated lastMessageId:", lastMessageId); // Debug log
        }

        // Scroll logic AFTER rendering
        if (type === "initial") {
          // Always scroll to bottom on initial load
          requestAnimationFrame(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
          });
        } else if (type === "new" && isUserAtBottomBeforeFetch) {
          // Scroll to bottom for new messages ONLY if user was at bottom before fetch
           requestAnimationFrame(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
          });
        }
      }
    } else {
      console.log(`No messages fetched for type: ${type}`); // Debug log
      if (type === "older") {
        hasMoreOlderMessages = false; // No more older messages
      }
    }
  } catch (e) {
    console.error(`加载消息失败 (${type}):`, e);
  } finally {
    // Always set loading to false for 'initial' and 'older' types
    if (type === "initial" || type === "older") {
        loading = false;
    }
  }
}

// 获取新消息 (轮询) - Now uses loadMessages
async function fetchNewMessages() {
  loadMessages({ type: "new", sinceId: lastMessageId });
}

// 滚动监听，上拉加载 - Now uses loadMessages with before_id
chatHistory.addEventListener("scroll", () => {
  // 恢复到精确顶部触发，并尝试修复滚动位置恢复问题
  //console.log(chatHistory.scrollTop, hasMoreOlderMessages, loading); // Debug log
  if (chatHistory.scrollTop === 0 && hasMoreOlderMessages && !loading) {
    const oldHeight = chatHistory.scrollHeight;
    // Get the ID of the oldest message currently displayed
    const oldestMessageElement = chatHistory.querySelector(".chat-message");
    if (oldestMessageElement) {
      const oldestMessageId = parseInt(
        oldestMessageElement.dataset.messageId,
        10
      );
      if (!isNaN(oldestMessageId)) {
        loadMessages({ type: "older", beforeId: oldestMessageId }).then(() => {
          // Keep scroll position - try setTimeout 0ms
          setTimeout(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight - oldHeight;
          }, 0);
        });
      }
    } else {
      // If no messages are displayed, maybe load the first page of history?
      // This case should ideally not happen if initial load works.
      console.warn(
        "No message elements found to determine oldest ID for history load."
      );
      // Fallback to loading page 1 if no messages are present? Or just stop?
      // Let's assume initial load always puts some messages.
    }
  }
});

// 发送消息
function validateEmail(email) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}
async function sendMessage() {
  const nickname = nicknameInput.value.trim();
  const email = emailInput.value.trim();
  const content = messageInput.value.trim();
  if (!nickname || !email || !content) {
    alert("请填写昵称、邮箱和消息");
    return;
  }
  if (!validateEmail(email)) {
    alert("邮箱格式不正确");
    emailInput.focus();
    return;
  }
  localStorage.setItem("chat_nick", nickname);
  localStorage.setItem("chat_email", email);
  sendBtn.disabled = true;
  try {
    const res = await fetch(`/${encodeURIComponent(room)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, email, content }),
    });
    const data = await res.json();
    if (data.success) {
      // renderMessages([data.message], false, true); // 不再立即渲染发送的消息
      messageInput.value = "";
    } else {
      alert(data.error || "发送失败");
    }
  } catch (e) {
    alert("网络错误");
  }
  sendBtn.disabled = false;
}


// 发送按钮事件
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 生成唯一client_id（每个页面唯一，刷新/新开页不同）
function getClientId() {
  let cid = sessionStorage.getItem("chat_client_id");
  if (!cid) {
    // Use timestamp + random number to ensure uniqueness
    cid = Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem("chat_client_id", cid);
  }
  return cid;
}

// 初始加载和定时刷新
window.addEventListener("DOMContentLoaded", async () => {
  // 首次加载最新一批历史消息 (page 1)
  await loadMessages({ type: "initial" }); // 使用新的loadMessages函数


  // 心跳包定时器
  const client_id = getClientId();
  fetch(`/${encodeURIComponent(room)}/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id }),
  });
  setInterval(() => {
    fetch(`/${encodeURIComponent(room)}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id }),
    });
  }, 10000);

  // 新消息轮询定时器 (每1秒检查一次新消息)
  setInterval(fetchNewMessages, 1000);
});
