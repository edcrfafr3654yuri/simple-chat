// Simple Chat – Firebase Compat version

const firebaseConfig = {
  apiKey: "AIzaSyC5zz1wlTu_jQSh0lt-m4M72Dewi8j4KnM",
  authDomain: "facetime-c5405.firebaseapp.com",
  databaseURL: "https://facetime-c5405-default-rtdb.firebaseio.com",
  projectId: "facetime-c5405",
  storageBucket: "facetime-c5405.firebasestorage.app",
  messagingSenderId: "7501689325",
  appId: "1:7501689325:web:c23dc30879fa7a1589b7e4",
  measurementId: "G-WGET3KGQ7J"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const OWNER_USERNAME = "Jake";
const OWNER_PASSWORD = "Twins4612!";

// ---------- UI helpers ----------
function show(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function isOwner() {
  return localStorage.getItem("chat_user") === OWNER_USERNAME;
}

// ---------- Ensure owner exists ----------
function ensureOwner() {
  return db.ref("users/" + OWNER_USERNAME).once("value").then(snap => {
    if (!snap.exists()) {
      return db.ref("users/" + OWNER_USERNAME).set({
        password: OWNER_PASSWORD,
        muted: false,
        isOwner: true
      });
    }
  });
}

// ---------- Login ----------
function tryLogin() {
  const username = $("login-username").value.trim();
  const password = $("login-password").value;

  if (!username || !password) {
    alert("Enter username and password");
    return;
  }

  setStatus("Checking...");
  db.ref("users/" + username).once("value")
    .then(snap => {
      if (!snap.exists() || snap.val().password !== password) {
        alert("Invalid username or password");
        setStatus("");
        return;
      }
      localStorage.setItem("chat_user", username);
      enterChat(username);
    })
    .catch(err => {
      console.error(err);
      alert("Connection error. Check Firebase rules / internet.");
      setStatus("");
    });
}

function enterChat(username) {
  show("chat-screen");
  $("logged-in-as").textContent = "Logged in as " + username;
  $("gear-btn").classList.toggle("hidden", username !== OWNER_USERNAME);
  setStatus("");
  startListeningToMessages();
  checkMuteStatus(username);
  $("msg-input").focus();
}

// Check mute and disable input if muted
function checkMuteStatus(username) {
  db.ref("users/" + username).on("value", snap => {
    if (!snap.exists()) return;
    const muted = snap.val().muted === true;
    $("msg-input").disabled = muted;
    $("send-btn").disabled = muted;
    if (muted) {
      $("msg-input").placeholder = "You are muted";
    } else {
      $("msg-input").placeholder = "Type a message...";
    }
  });
}

// ---------- Request Account ----------
function showRequestScreen() {
  show("request-screen");
  $("req-username").value = "";
  $("req-password").value = "";
}

function submitRequest() {
  const username = $("req-username").value.trim();
  const password = $("req-password").value;

  if (!username || !password) {
    alert("Enter both username and password");
    return;
  }
  if (username.length < 2) {
    alert("Username too short");
    return;
  }

  db.ref("users/" + username).once("value")
    .then(userSnap => {
      if (userSnap.exists()) {
        alert("Username already exists");
        return;
      }

      return db.ref("requests").once("value").then(reqSnap => {
        if (reqSnap.exists()) {
          const reqs = reqSnap.val();
          for (const key in reqs) {
            if (reqs[key].username === username) {
              alert("A request for this username is already pending");
              return;
            }
          }
        }

        return db.ref("requests").push({ username, password }).then(() => {
          alert("Request submitted! Wait for the owner to approve.");
          show("login-screen");
        });
      });
    })
    .catch(err => {
      console.error(err);
      alert("Could not submit request. Check connection / Firebase rules.");
    });
}

// ---------- Messages ----------
let messagesListener = null;

function startListeningToMessages() {
  if (messagesListener) {
    db.ref("messages").off("value", messagesListener);
  }

  messagesListener = db.ref("messages").on("value", snapshot => {
    const data = snapshot.val() || {};
    const list = Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .sort((a, b) => a.time - b.time);

    const box = $("messages");
    box.innerHTML = "";
    const owner = isOwner();

    list.forEach(m => {
      const div = document.createElement("div");
      div.className = "message";

      const time = new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const userSpan = document.createElement("span");
      userSpan.className = "user";
      userSpan.textContent = m.user + " ";

      const textNode = document.createTextNode(m.text);

      const timeSpan = document.createElement("span");
      timeSpan.className = "time";
      timeSpan.textContent = " " + time;

      div.appendChild(userSpan);
      div.appendChild(textNode);
      div.appendChild(timeSpan);

      // Owner can delete individual messages
      if (owner) {
        const delBtn = document.createElement("button");
        delBtn.className = "msg-delete";
        delBtn.textContent = "×";
        delBtn.title = "Delete message";
        delBtn.onclick = function () {
          deleteMessage(m.id);
        };
        div.appendChild(delBtn);
      }

      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

function sendMessage() {
  const text = $("msg-input").value.trim();
  if (!text) return;

  const username = localStorage.getItem("chat_user");
  if (!username) return;

  db.ref("users/" + username).once("value")
    .then(userSnap => {
      if (!userSnap.exists()) {
        alert("Account not found");
        return;
      }
      if (userSnap.val().muted === true) {
        alert("You are muted and cannot send messages.");
        $("msg-input").disabled = true;
        $("send-btn").disabled = true;
        $("msg-input").placeholder = "You are muted";
        return;
      }

      return db.ref("messages").push({
        user: username,
        text: text,
        time: Date.now()
      }).then(() => {
        $("msg-input").value = "";
      });
    })
    .catch(err => {
      console.error(err);
      alert("Could not send message.");
    });
}

function deleteMessage(id) {
  if (!isOwner()) return;
  if (!confirm("Delete this message?")) return;

  db.ref("messages/" + id).remove()
    .then(() => {
      // success - the listener will update the UI
    })
    .catch(err => {
      console.error(err);
      alert("Failed to delete message. Check Firebase rules.");
    });
}

function clearChat() {
  if (!isOwner()) return;
  if (!confirm("Clear ALL messages? This cannot be undone.")) return;

  db.ref("messages").remove()
    .then(() => {
      alert("Chat cleared");
    })
    .catch(err => {
      console.error(err);
      alert("Failed to clear chat. Check Firebase rules.");
    });
}

// ---------- Owner menu ----------
function openOwnerMenu() {
  renderRequests();
  renderUsers();
  $("owner-modal").classList.remove("hidden");
}

function closeOwnerMenu() {
  $("owner-modal").classList.add("hidden");
}

function renderRequests() {
  const list = $("requests-list");
  list.innerHTML = "<div class='empty'>Loading...</div>";

  db.ref("requests").once("value").then(snapshot => {
    list.innerHTML = "";
    const data = snapshot.val();
    if (!data) {
      list.innerHTML = '<div class="empty">No pending requests</div>';
      return;
    }

    Object.keys(data).forEach(key => {
      const req = data[key];
      const div = document.createElement("div");
      div.className = "request-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = req.username;
      div.appendChild(nameSpan);

      const accept = document.createElement("button");
      accept.textContent = "Accept";
      accept.className = "small-btn";
      accept.onclick = function () {
        acceptRequest(key, req);
      };

      const deny = document.createElement("button");
      deny.textContent = "Deny";
      deny.className = "small-btn secondary";
      deny.onclick = function () {
        denyRequest(key);
      };

      div.appendChild(accept);
      div.appendChild(deny);
      list.appendChild(div);
    });
  });
}

function acceptRequest(key, req) {
  db.ref("users/" + req.username).set({
    password: req.password,
    muted: false,
    isOwner: false
  })
  .then(() => db.ref("requests/" + key).remove())
  .then(() => {
    renderRequests();
    renderUsers();
  })
  .catch(err => {
    console.error(err);
    alert("Failed to accept");
  });
}

function denyRequest(key) {
  db.ref("requests/" + key).remove()
    .then(() => renderRequests())
    .catch(err => {
      console.error(err);
      alert("Failed to deny");
    });
}

function renderUsers() {
  const list = $("users-list");
  list.innerHTML = "<div class='empty'>Loading...</div>";

  db.ref("users").once("value").then(snapshot => {
    list.innerHTML = "";
    const data = snapshot.val() || {};
    const names = Object.keys(data).filter(u => u !== OWNER_USERNAME);

    if (names.length === 0) {
      list.innerHTML = '<div class="empty">No other users yet</div>';
      return;
    }

    names.forEach(name => {
      const u = data[name];
      const div = document.createElement("div");
      div.className = "user-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = name + (u.muted ? " (muted)" : "");
      div.appendChild(nameSpan);

      // Mute / Unmute
      const muteBtn = document.createElement("button");
      muteBtn.className = "small-btn secondary";
      if (u.muted) {
        muteBtn.textContent = "Unmute";
        muteBtn.onclick = function () {
          setMute(name, false);
        };
      } else {
        muteBtn.textContent = "Mute";
        muteBtn.onclick = function () {
          setMute(name, true);
        };
      }

      // Delete account
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "small-btn secondary";
      delBtn.onclick = function () {
        deleteAccount(name);
      };

      div.appendChild(muteBtn);
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  });
}

function setMute(username, muted) {
  db.ref("users/" + username).update({ muted: muted })
    .then(() => {
      renderUsers();
    })
    .catch(err => {
      console.error(err);
      alert("Failed to update mute");
    });
}

function deleteAccount(username) {
  if (!confirm('Delete account "' + username + '"? They will no longer be able to log in.')) return;

  db.ref("users/" + username).remove()
    .then(() => {
      renderUsers();
      alert("Account deleted");
    })
    .catch(err => {
      console.error(err);
      alert("Failed to delete account. Check Firebase rules.");
    });
}

// ---------- Logout ----------
function logout() {
  localStorage.removeItem("chat_user");
  if (messagesListener) {
    db.ref("messages").off("value", messagesListener);
    messagesListener = null;
  }
  $("login-username").value = "";
  $("login-password").value = "";
  $("msg-input").disabled = false;
  $("send-btn").disabled = false;
  show("login-screen");
}

// ---------- Event listeners ----------
$("login-btn").addEventListener("click", tryLogin);
$("login-password").addEventListener("keydown", e => {
  if (e.key === "Enter") tryLogin();
});
$("request-btn").addEventListener("click", showRequestScreen);
$("submit-request-btn").addEventListener("click", submitRequest);
$("back-to-login").addEventListener("click", () => show("login-screen"));
$("send-btn").addEventListener("click", sendMessage);
$("msg-input").addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
$("logout-btn").addEventListener("click", logout);
$("gear-btn").addEventListener("click", openOwnerMenu);
$("close-modal").addEventListener("click", closeOwnerMenu);

// Clear Chat button - attach directly
$("clear-chat-btn").addEventListener("click", clearChat);

// ---------- Init ----------
ensureOwner()
  .then(() => {
    const current = localStorage.getItem("chat_user");
    if (current) {
      return db.ref("users/" + current).once("value").then(snap => {
        if (snap.exists()) {
          enterChat(current);
          return true;
        }
      });
    }
  })
  .then(loggedIn => {
    if (!loggedIn) show("login-screen");
  })
  .catch(err => {
    console.error(err);
    setStatus("Could not connect to Firebase. Check rules / internet.");
    show("login-screen");
  });
