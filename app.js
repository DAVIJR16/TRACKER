// ===== IMPORTAÇÕES FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  updateProfile as updateAuthProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ===== CONFIGURAÇÃO FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBJcuJl9CgUrxVKvW9ZAA_33lVpYo-Pjo8",
  authDomain: "victory-tracker-ed1f4.firebaseapp.com",
  projectId: "victory-tracker-ed1f4",
  storageBucket: "victory-tracker-ed1f4.firebasestorage.app",
  messagingSenderId: "165296314586",
  appId: "1:165296314586:web:8d79a9f2b0ac8a2b40ade3"
};

let app, auth, db, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("✅ Firebase inicializado com sucesso!");
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
}

// ===== VARIÁVEIS GLOBAIS =====
let leagues = [];
let teams = [];
let matches = [];
let users = [];
let tournaments = [];
let currentUser = null;
let userProfile = null;
let selectedChatUserId = null;
let selectedChatUser = null;
let chatListenerUnsubscribe = null;
let currentModalUserId = null;
let currentTheme = localStorage.getItem('theme') || 'light';

// ===== INICIALIZAÇÃO DO TEMA =====
window.initTheme = function() {
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeIcon();
  }
};

window.toggleTheme = function() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', currentTheme);
  document.body.classList.toggle('dark-mode');
  updateThemeIcon();
  showToast(currentTheme === 'dark' ? '🌙 Modo escuro ativado' : '☀️ Modo claro ativado');
};

function updateThemeIcon() {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.innerText = currentTheme === 'dark' ? '☀️' : '🌙';
  }
}

// ===== AUTENTICAÇÃO =====
window.toggleAuthForm = function(e) {
  e.preventDefault();
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const errorMessage = document.getElementById("errorMessage");
  
  loginForm.style.display = loginForm.style.display === "none" ? "block" : "none";
  registerForm.style.display = registerForm.style.display === "none" ? "block" : "none";
  errorMessage.style.display = "none";
};

window.login = async function() {
  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    console.log("Tentando login com:", email);

    if (!email || !password) {
      showError("Preencha todos os campos!");
      return;
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login bem-sucedido:", userCredential.user.email);
    clearAuthForms();
  } catch (error) {
    console.error("❌ Erro no login:", error);
    showError(getErrorMessage(error));
  }
};

window.register = async function() {
  try {
    const email = document.getElementById("regEmail").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    console.log("Tentando registrar:", username);

    if (!email || !username || !password || !confirmPassword) {
      showError("Preencha todos os campos!");
      return;
    }

    if (username.length < 3) {
      showError("Nome de usuário deve ter pelo menos 3 caracteres!");
      return;
    }

    if (username.length > 30) {
      showError("Nome de usuário não pode ter mais de 30 caracteres!");
      return;
    }

    const usernameQuery = query(
      collection(db, "userProfiles"),
      where("username", "==", username.toLowerCase())
    );
    const usernameSnapshot = await getDocs(usernameQuery);
    
    if (!usernameSnapshot.empty) {
      showError("Este nome de usuário já está em uso!");
      return;
    }

    if (password.length < 6) {
      showError("Senha deve ter pelo menos 6 caracteres!");
      return;
    }

    if (password !== confirmPassword) {
      showError("As senhas não conferem!");
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("✅ Usuário criado:", user.uid);

    await updateAuthProfile(user, {
      displayName: username
    });

    await addDoc(collection(db, "userProfiles"), {
      uid: user.uid,
      email: email,
      username: username.toLowerCase(),
      displayUsername: username,
      bio: "",
      photoURL: "https://via.placeholder.com/150",
      followers: [],
      following: [],
      createdAt: new Date().toISOString()
    });

    showToast("✅ Conta criada com sucesso!");
    clearAuthForms();
  } catch (error) {
    console.error("❌ Erro no registro:", error);
    showError(getErrorMessage(error));
  }
};

window.logout = async function() {
  if (confirm("Deseja realmente sair?")) {
    try {
      await signOut(auth);
      clearAppData();
      showToast("✅ Desconectado com sucesso!");
    } catch (error) {
      showError("Erro ao sair: " + error.message);
    }
  }
};

onAuthStateChanged(auth, async (user) => {
  console.log("🔄 Estado da autenticação mudou:", user ? user.email : "não autenticado");
  
  if (user) {
    currentUser = user;
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";
    
    try {
      await loadUserProfile();
      await loadLeagues();
      await loadUsers();
      
      setTimeout(() => {
        updateOpponentSelect();
        updateRankingOpponentSelect();
        updateLeagueSelects();
      }, 300);
      
      console.log("✅ Dados carregados com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    }
  } else {
    currentUser = null;
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("appScreen").style.display = "none";
  }
});

// ===== PERFIL DO USUÁRIO =====
async function loadUserProfile() {
  try {
    const profileQuery = query(
      collection(db, "userProfiles"),
      where("uid", "==", currentUser.uid)
    );
    const snapshot = await getDocs(profileQuery);
    
    if (!snapshot.empty) {
      userProfile = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      console.log("✅ Perfil encontrado:", userProfile.username);
    } else {
      const username = currentUser.displayName?.toLowerCase() || 
                      currentUser.email.split('@')[0].toLowerCase();
      const displayUsername = currentUser.displayName || 
                             currentUser.email.split('@')[0];

      const newDocRef = await addDoc(collection(db, "userProfiles"), {
        uid: currentUser.uid,
        email: currentUser.email,
        username: username,
        displayUsername: displayUsername,
        bio: "",
        photoURL: "https://via.placeholder.com/150",
        followers: [],
        following: [],
        createdAt: new Date().toISOString()
      });

      userProfile = {
        id: newDocRef.id,
        uid: currentUser.uid,
        email: currentUser.email,
        username: username,
        displayUsername: displayUsername,
        bio: "",
        photoURL: "https://via.placeholder.com/150",
        followers: [],
        following: [],
        createdAt: new Date().toISOString()
      };
      console.log("✅ Novo perfil criado:", username);
    }

    updateProfileUI();
    updateSidebarUserInfo();
  } catch (error) {
    console.error("❌ Erro ao carregar perfil:", error);
    showError("Erro ao carregar perfil");
  }
}

function updateSidebarUserInfo() {
  if (!userProfile) return;
  const username = userProfile.username || "usuário";
  const email = userProfile.email || "";
  document.getElementById("userName").innerText = `@${username}`;
  document.getElementById("userEmail").innerText = email;
}

function updateProfileUI() {
  if (!userProfile) return;
  const displayName = userProfile.displayUsername || userProfile.username || "Usuário";
  const username = userProfile.username || "desconhecido";
  const email = userProfile.email || "-";
  const bio = userProfile.bio || "";
  const photoURL = userProfile.photoURL || "https://via.placeholder.com/150";

  document.getElementById("profileName").innerText = displayName;
  document.getElementById("profileUsername").innerText = `@${username}`;
  document.getElementById("profileEmail").innerText = email;
  document.getElementById("profilePhoto").src = photoURL;
  document.getElementById("bioInput").value = bio;
  document.getElementById("bioCounter").innerText = `${bio.length}/200`;
  document.getElementById("followerCount").innerText = userProfile.followers?.length || 0;
  document.getElementById("followingCountProfile").innerText = userProfile.following?.length || 0;
  document.getElementById("followingCount").innerText = userProfile.following?.length || 0;
}

window.uploadProfilePhoto = async function(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;

    showToast("📤 Uploadando foto...");

    const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
    await uploadBytes(storageRef, file);
    const photoURL = await getDownloadURL(storageRef);

    userProfile.photoURL = photoURL;
    await updateDoc(doc(db, "userProfiles", userProfile.id), {
      photoURL: photoURL
    });

    document.getElementById("profilePhoto").src = photoURL;
    showToast("✅ Foto atualizada com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao fazer upload da foto:", error);
    showError("Erro ao fazer upload da foto");
  }
};

window.updateProfile = async function() {
  try {
    const bio = document.getElementById("bioInput").value.trim();

    if (bio.length > 200) {
      showError("Bio muito longa (máximo 200 caracteres)");
      return;
    }

    userProfile.bio = bio;
    await updateDoc(doc(db, "userProfiles", userProfile.id), {
      bio: bio
    });

    showToast("✅ Perfil atualizado com sucesso!");
    updateProfileUI();
  } catch (error) {
    console.error("❌ Erro ao atualizar perfil:", error);
    showError("Erro ao atualizar perfil");
  }
};

// ===== USUÁRIOS =====
async function loadUsers() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "userProfiles"), orderBy("displayUsername"))
    );
    users = [];
    snapshot.forEach((doc) => {
      if (doc.data().uid !== currentUser.uid) {
        users.push({ id: doc.id, ...doc.data() });
      }
    });
    updateUsersList();
    console.log("✅ Usuários carregados:", users.length);
  } catch (error) {
    console.error("❌ Erro ao carregar usuários:", error);
  }
}

function updateUsersList() {
  const list = document.getElementById("usersList");
  
  if (users.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum usuário encontrado</p>';
    return;
  }

  list.innerHTML = users.map(user => {
    const isFollowing = userProfile?.following?.includes(user.uid);
    return `
      <div class="card user-card">
        <img src="${user.photoURL}" alt="${user.displayUsername}" class="user-card-photo">
        <h3>@${user.username}</h3>
        <p class="user-card-name">${user.displayUsername}</p>
        <p class="user-card-bio">${user.bio || "Sem bio"}</p>
        <div class="user-card-stats">
          <span>👥 ${user.followers?.length || 0}</span>
          <span>📊 ${user.following?.length || 0}</span>
        </div>
        <div class="user-card-actions">
          <button onclick="openUserModal('${user.id}')" class="btn-secondary">👁️ Ver Perfil</button>
          <button onclick="toggleFollowUser('${user.id}')" class="btn-${isFollowing ? 'danger' : 'primary'}">
            ${isFollowing ? '✕ Deixar de Seguir' : '➕ Seguir'}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.searchUsers = function() {
  const searchTerm = document.getElementById("userSearch").value.toLowerCase();
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm) ||
    u.displayUsername.toLowerCase().includes(searchTerm)
  );

  const list = document.getElementById("usersList");
  
  if (filteredUsers.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum usuário encontrado</p>';
    return;
  }

  list.innerHTML = filteredUsers.map(user => {
    const isFollowing = userProfile?.following?.includes(user.uid);
    return `
      <div class="card user-card">
        <img src="${user.photoURL}" alt="${user.displayUsername}" class="user-card-photo">
        <h3>@${user.username}</h3>
        <p class="user-card-name">${user.displayUsername}</p>
        <p class="user-card-bio">${user.bio || "Sem bio"}</p>
        <div class="user-card-stats">
          <span>👥 ${user.followers?.length || 0}</span>
          <span>📊 ${user.following?.length || 0}</span>
        </div>
        <div class="user-card-actions">
          <button onclick="openUserModal('${user.id}')" class="btn-secondary">👁️ Ver Perfil</button>
          <button onclick="toggleFollowUser('${user.id}')" class="btn-${isFollowing ? 'danger' : 'primary'}">
            ${isFollowing ? '✕ Deixar de Seguir' : '➕ Seguir'}
          </button>
        </div>
      </div>
    `;
  }).join("");
};

window.openUserModal = async function(userId) {
  try {
    const userDoc = await getDoc(doc(db, "userProfiles", userId));
    const user = userDoc.data();

    currentModalUserId = userId;

    document.getElementById("modalUserPhoto").src = user.photoURL;
    document.getElementById("modalUserName").innerText = user.displayUsername;
    document.getElementById("modalUserUsername").innerText = `@${user.username}`;
    document.getElementById("modalUserEmail").innerText = user.email;
    document.getElementById("modalUserBio").innerText = user.bio || "-";
    document.getElementById("modalFollowerCount").innerText = user.followers?.length || 0;
    document.getElementById("modalFollowingCount").innerText = user.following?.length || 0;

    const isFollowing = userProfile?.following?.includes(user.uid);
    const followBtn = document.getElementById("followBtn");
    followBtn.innerText = isFollowing ? "✕ Deixar de Seguir" : "➕ Seguir";
    followBtn.className = isFollowing ? "btn-danger" : "btn-primary";

    document.getElementById("userProfileModal").style.display = "flex";
  } catch (error) {
    console.error("❌ Erro ao carregar usuário:", error);
    showError("Erro ao carregar usuário");
  }
};

window.closeUserModal = function() {
  document.getElementById("userProfileModal").style.display = "none";
  currentModalUserId = null;
};

window.toggleFollowUser = async function(userId) {
  try {
    if (!userId && !currentModalUserId) return;

    const targetUserId = userId || currentModalUserId;
    const targetUserDoc = await getDoc(doc(db, "userProfiles", targetUserId));
    const targetUser = targetUserDoc.data();

    const isFollowing = userProfile?.following?.includes(targetUser.uid);

    const batch = writeBatch(db);

    if (isFollowing) {
      userProfile.following = userProfile.following.filter(id => id !== targetUser.uid);
      targetUser.followers = targetUser.followers.filter(id => id !== currentUser.uid);
    } else {
      if (!userProfile.following) userProfile.following = [];
      userProfile.following.push(targetUser.uid);
      if (!targetUser.followers) targetUser.followers = [];
      targetUser.followers.push(currentUser.uid);
    }

    batch.update(doc(db, "userProfiles", userProfile.id), {
      following: userProfile.following
    });

    batch.update(doc(db, "userProfiles", targetUserId), {
      followers: targetUser.followers
    });

    await batch.commit();

    showToast(isFollowing ? "❌ Deixado de seguir!" : "✅ Seguindo agora!");
    await loadUsers();
    updateProfileUI();
    loadConversations();
    
    setTimeout(() => {
      updateOpponentSelect();
      updateRankingOpponentSelect();
    }, 300);

    if (currentModalUserId) {
      await openUserModal(currentModalUserId);
    }
  } catch (error) {
    console.error("❌ Erro ao seguir/deixar de seguir:", error);
    showError("Erro ao seguir/deixar de seguir");
  }
};

// ===== CHAT =====
async function loadConversations() {
  try {
    if (!userProfile?.following) return;

    const list = document.getElementById("conversationsList");
    
    if (userProfile.following.length === 0) {
      list.innerHTML = '<p class="empty-state">Siga usuários para conversar</p>';
      return;
    }

    list.innerHTML = userProfile.following.map(userId => {
      const followedUser = users.find(u => u.uid === userId);
      return `
        <div class="conversation-item" onclick="openChat('${userId}', '${followedUser?.displayUsername}')">
          <img src="${followedUser?.photoURL || 'https://via.placeholder.com/40'}" alt="${followedUser?.displayUsername}">
          <div class="conversation-info">
            <h4>@${followedUser?.username}</h4>
            <p>${followedUser?.displayUsername}</p>
            <p class="last-message">Clique para conversar</p>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("❌ Erro ao carregar conversas:", error);
  }
}

window.openChat = function(userId, username) {
  selectedChatUserId = userId;
  selectedChatUser = username;
  document.getElementById("conversationsList").style.display = "none";
  document.getElementById("chatWindow").style.display = "flex";
  document.getElementById("chatTitle").innerText = `💬 @${username}`;
  document.getElementById("messagesContainer").innerHTML = "";
  document.getElementById("messageInput").value = "";

  loadChatMessages();
};

window.closeChatWindow = function() {
  selectedChatUserId = null;
  selectedChatUser = null;
  document.getElementById("conversationsList").style.display = "block";
  document.getElementById("chatWindow").style.display = "none";
  
  if (chatListenerUnsubscribe) {
    chatListenerUnsubscribe();
  }
};

function loadChatMessages() {
  if (!selectedChatUserId) return;

  const conversationId = [currentUser.uid, selectedChatUserId].sort().join("_");

  if (chatListenerUnsubscribe) {
    chatListenerUnsubscribe();
  }

  chatListenerUnsubscribe = onSnapshot(
    query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "asc")
    ),
    (snapshot) => {
      const container = document.getElementById("messagesContainer");
      container.innerHTML = snapshot.docs.map(doc => {
        const msg = doc.data();
        const isOwn = msg.senderId === currentUser.uid;
        return `
          <div class="message ${isOwn ? 'own' : 'other'}">
            <p>${msg.text}</p>
            <small>${formatTime(msg.timestamp)}</small>
          </div>
        `;
      }).join("");

      container.scrollTop = container.scrollHeight;
    }
  );
}

window.sendMessage = async function() {
  try {
    const text = document.getElementById("messageInput").value.trim();
    
    if (!text || !selectedChatUserId) return;

    const conversationId = [currentUser.uid, selectedChatUserId].sort().join("_");

    await addDoc(collection(db, "messages"), {
      conversationId,
      senderId: currentUser.uid,
      senderName: userProfile?.displayUsername,
      text,
      timestamp: new Date().toISOString()
    });

    document.getElementById("messageInput").value = "";
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error);
    showError("Erro ao enviar mensagem");
  }
};

window.handleMessageKeyPress = function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
};

// ===== LIGAS =====
async function loadLeagues() {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, "leagues"), orderBy("name"))
    );
    leagues = [];
    querySnapshot.forEach((docSnapshot) => {
      leagues.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });
    loadTeams();
    updateLeagueSelects();
    updateLeaguesList();
    updateDashboard();
    console.log("✅ Ligas carregadas:", leagues.length);
  } catch (error) {
    console.error("❌ Erro ao carregar ligas:", error);
  }
}

window.createLeague = async function() {
  try {
    const name = document.getElementById("leagueName").value.trim();
    const description = document.getElementById("leagueDescription").value.trim();

    if (!name) {
      showError("Digite o nome da liga!");
      return;
    }

    if (name.length < 3) {
      showError("Nome da liga deve ter pelo menos 3 caracteres!");
      return;
    }

    const leagueExists = leagues.some(l => l.name.toLowerCase() === name.toLowerCase());
    if (leagueExists) {
      showError("Esta liga já existe!");
      return;
    }

    await addDoc(collection(db, "leagues"), {
      name,
      description: description || "",
      createdAt: new Date().toISOString()
    });

    document.getElementById("leagueName").value = "";
    document.getElementById("leagueDescription").value = "";
    showToast("🎯 Liga criada com sucesso!");
    loadLeagues();
  } catch (error) {
    console.error("❌ Erro ao criar liga:", error);
    showError("Erro ao criar liga");
  }
};

window.deleteLeague = async function(leagueId) {
  if (!confirm("Deseja realmente deletar esta liga? Todos os times serão removidos!")) return;

  try {
    const teamsSnapshot = await getDocs(
      query(collection(db, "teams"), where("leagueId", "==", leagueId))
    );
    
    const batch = writeBatch(db);
    teamsSnapshot.forEach((docSnapshot) => {
      batch.delete(doc(db, "teams", docSnapshot.id));
    });

    batch.delete(doc(db, "leagues", leagueId));
    await batch.commit();

    showToast("🗑️ Liga deletada!");
    loadLeagues();
  } catch (error) {
    console.error("❌ Erro ao deletar liga:", error);
    showError("Erro ao deletar liga");
  }
};

function updateLeagueSelects() {
  const leagueSelects = [
    document.getElementById("leagueSelect"),
    document.getElementById("rankingLeagueFilter"),
    document.getElementById("searchLeague")
  ];

  leagueSelects.forEach(select => {
    if (select) {
      const currentValue = select.value;
      select.innerHTML = select.id === "rankingLeagueFilter" 
        ? '<option value="">Todas as Ligas</option>' 
        : select.id === "searchLeague"
        ? '<option value="">Todas as Ligas</option>'
        : '<option value="">Selecione uma Liga</option>';
      
      leagues.forEach(league => {
        select.innerHTML += `<option value="${league.id}">${league.name}</option>`;
      });
      
      select.value = currentValue;
    }
  });

  const homeLeagueSelect = document.getElementById("homeLeagueSelect");
  if (homeLeagueSelect) {
    const currentValue = homeLeagueSelect.value;
    homeLeagueSelect.innerHTML = '<option value="">Selecione a Liga do Seu Time</option>';
    leagues.forEach(league => {
      homeLeagueSelect.innerHTML += `<option value="${league.id}">${league.name}</option>`;
    });
    homeLeagueSelect.value = currentValue;
  }
}

function updateLeaguesList() {
  const list = document.getElementById("leaguesList");
  
  if (leagues.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhuma liga criada ainda</p>';
    return;
  }

  list.innerHTML = leagues.map(league => {
    const leagueTeams = teams.filter(t => t.leagueId === league.id);
    const leagueMatches = matches.filter(m => m.homeLeagueId === league.id || m.awayLeagueId === league.id);
    
    return `
      <div class="card league-card">
        <div class="league-header">
          <h3>${league.name}</h3>
          <button onclick="deleteLeague('${league.id}')" class="btn-delete-sm" title="Deletar Liga">���️</button>
        </div>
        <p class="league-description">${league.description}</p>
        <div class="league-stats">
          <span>👥 ${leagueTeams.length} times</span>
          <span>⚽ ${leagueMatches.length} partidas</span>
        </div>
      </div>
    `;
  }).join("");
}

// ===== TIMES =====
async function loadTeams() {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, "teams"), orderBy("name"))
    );
    teams = [];
    querySnapshot.forEach((docSnapshot) => {
      teams.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });
    loadMatches();
  } catch (error) {
    console.error("❌ Erro ao carregar times:", error);
  }
}

window.createTeam = async function() {
  try {
    const leagueId = document.getElementById("leagueSelect").value;
    const name = document.getElementById("teamName").value.trim();

    if (!leagueId) {
      showError("Selecione uma liga!");
      return;
    }

    if (!name) {
      showError("Digite o nome do time!");
      return;
    }

    if (name.length < 3) {
      showError("Nome do time deve ter pelo menos 3 caracteres!");
      return;
    }

    const teamExists = teams.some(
      t => t.leagueId === leagueId && t.name.toLowerCase() === name.toLowerCase()
    );
    if (teamExists) {
      showError("Este time já existe nesta liga!");
      return;
    }

    const league = leagues.find(l => l.id === leagueId);

    await addDoc(collection(db, "teams"), {
      name,
      leagueId,
      leagueName: league.name,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      createdAt: new Date().toISOString()
    });

    document.getElementById("teamName").value = "";
    showToast("⚽ Time criado com sucesso!");
    loadTeams();
  } catch (error) {
    console.error("❌ Erro ao criar time:", error);
    showError("Erro ao criar time");
  }
};

window.deleteTeam = async function(teamId) {
  if (!confirm("Deseja realmente deletar este time?")) return;

  try {
    await deleteDoc(doc(db, "teams", teamId));
    showToast("🗑️ Time deletado!");
    loadTeams();
  } catch (error) {
    console.error("❌ Erro ao deletar time:", error);
    showError("Erro ao deletar time");
  }
};

// ===== PARTIDAS - NOVA VERSÃO =====
async function loadMatches() {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, "matches"), orderBy("date", "desc"))
    );
    matches = [];
    querySnapshot.forEach((docSnapshot) => {
      matches.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });
    updateUI();
    updateRanking();
    updateDashboard();
  } catch (error) {
    console.error("❌ Erro ao carregar partidas:", error);
  }
}

// Função para atualizar select de adversários
window.updateOpponentSelect = function() {
  const select = document.getElementById("opponentAwaySelect");
  if (!select) return;

  console.log("🔄 Atualizando adversários...");
  console.log("User Profile:", userProfile);
  console.log("Users:", users);

  if (!userProfile?.following || userProfile.following.length === 0) {
    select.innerHTML = '<option value="">Nenhum adversário seguido</option>';
    console.log("⚠️ Nenhum usuário seguido");
    return;
  }

  select.innerHTML = '<option value="">Escolha um adversário</option>';

  userProfile.following.forEach(userId => {
    const user = users.find(u => u.uid === userId);
    if (user) {
      select.innerHTML += `<option value="${user.uid}">${user.displayUsername} (@${user.username})</option>`;
      console.log("✅ Adversário adicionado:", user.displayUsername);
    }
  });
};

// Atualizar quando adversário é selecionado
window.updateAwayTeamsUI = function() {
  const opponentId = document.getElementById("opponentAwaySelect").value;
  const awayLeagueSelect = document.getElementById("awayLeagueSelect");
  const awayTeamSelect = document.getElementById("awayTeam");

  awayLeagueSelect.innerHTML = '<option value="">Selecione a Liga do Adversário</option>';
  awayTeamSelect.innerHTML = '<option value="">Selecione um time</option>';

  if (!opponentId) {
    return;
  }

  leagues.forEach(league => {
    awayLeagueSelect.innerHTML += `<option value="${league.id}">${league.name}</option>`;
  });
};

// Atualizar times do adversário quando liga é selecionada
window.updateAwayTeamsByLeague = function() {
  const leagueId = document.getElementById("awayLeagueSelect").value;
  const awayTeamSelect = document.getElementById("awayTeam");

  awayTeamSelect.innerHTML = '<option value="">Selecione um time</option>';

  if (!leagueId) {
    return;
  }

  const leagueTeams = teams.filter(t => t.leagueId === leagueId);

  leagueTeams.forEach(team => {
    awayTeamSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
  });
};

// Atualizar times do mandante por liga
window.updateHomeTeamsUI = function() {
  const leagueId = document.getElementById("homeLeagueSelect").value;
  const homeSelect = document.getElementById("homeTeam");

  homeSelect.innerHTML = '<option value="">Selecione um time</option>';

  if (!leagueId) {
    return;
  }

  const leagueTeams = teams.filter(t => t.leagueId === leagueId);

  leagueTeams.forEach(team => {
    homeSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
  });
};

// FUNÇÃO PRINCIPAL: Registrar partida com adversário
window.registerMatch = async function() {
  try {
    // TIME DE CASA (SEU TIME)
    const homeLeagueId = document.getElementById("homeLeagueSelect").value;
    const homeId = document.getElementById("homeTeam").value;
    const homeGoals = parseInt(document.getElementById("homeGoals").value) || 0;
    const homePenalties = parseInt(document.getElementById("homePenalties").value) || 0;

    // TIME DE FORA (ADVERSÁRIO)
    const opponentUserId = document.getElementById("opponentAwaySelect").value;
    const awayLeagueId = document.getElementById("awayLeagueSelect").value;
    const awayId = document.getElementById("awayTeam").value;
    const awayGoals = parseInt(document.getElementById("awayGoals").value) || 0;
    const awayPenalties = parseInt(document.getElementById("awayPenalties").value) || 0;

    // Validações
    if (!homeLeagueId) {
      showError("Selecione a liga do seu time!");
      return;
    }

    if (!homeId) {
      showError("Selecione seu time!");
      return;
    }

    if (!opponentUserId) {
      showError("Selecione um adversário!");
      return;
    }

    if (!awayLeagueId) {
      showError("Selecione a liga do adversário!");
      return;
    }

    if (!awayId) {
      showError("Selecione o time do adversário!");
      return;
    }

    if (homeId === awayId) {
      showError("Selecione times diferentes!");
      return;
    }

    // Obter dados dos times
    const home = teams.find(t => t.id === homeId);
    const away = teams.find(t => t.id === awayId);
    const homeLeague = leagues.find(l => l.id === homeLeagueId);
    const awayLeague = leagues.find(l => l.id === awayLeagueId);
    const opponentUser = users.find(u => u.uid === opponentUserId);

    // Atualizar estatísticas do time de casa
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    // Determinar resultado (considerando pênaltis se necessário)
    let homeWins = false;
    let awayWins = false;
    let isDraw = false;

    if (homeGoals > awayGoals) {
      homeWins = true;
    } else if (homeGoals < awayGoals) {
      awayWins = true;
    } else {
      // Se empate nos gols, ver pênaltis
      if (homePenalties > 0 || awayPenalties > 0) {
        if (homePenalties > awayPenalties) {
          homeWins = true;
        } else if (awayPenalties > homePenalties) {
          awayWins = true;
        } else {
          isDraw = true;
        }
      } else {
        isDraw = true;
      }
    }

    // Atualizar pontos
    if (homeWins) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (awayWins) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }

    // Salvar atualização dos times
    const batch = writeBatch(db);
    batch.update(doc(db, "teams", home.id), home);
    batch.update(doc(db, "teams", away.id), away);

    // Criar documento da partida
    const matchData = {
      homeLeagueId: homeLeagueId,
      homeLeague: homeLeague.name,
      awayLeagueId: awayLeagueId,
      awayLeague: awayLeague.name,
      homeTeam: home.name,
      homeId: home.id,
      awayTeam: away.name,
      awayId: away.id,
      homeGoals,
      awayGoals,
      homePenalties,
      awayPenalties,
      date: new Date().toISOString(),
      opponentUserId: opponentUserId,
      opponentUsername: opponentUser.displayUsername,
      opponentAvatar: opponentUser.photoURL,
      matchType: "vs_opponent"
    };

    await addDoc(collection(db, "matches"), matchData);
    await batch.commit();

    // Limpar campos
    document.getElementById("homeLeagueSelect").value = "";
    document.getElementById("homeTeam").value = "";
    document.getElementById("homeGoals").value = "";
    document.getElementById("homePenalties").value = "";
    document.getElementById("opponentAwaySelect").value = "";
    document.getElementById("awayLeagueSelect").value = "";
    document.getElementById("awayTeam").value = "";
    document.getElementById("awayGoals").value = "";
    document.getElementById("awayPenalties").value = "";

    showToast("✅ Partida registrada com sucesso!");
    loadTeams();
    loadMatches();
    updateHomeTeamsUI();
    updateAwayTeamsUI();
  } catch (error) {
    console.error("❌ Erro ao registrar partida:", error);
    showError("Erro ao registrar partida");
  }
};

// ===== FILTRO DE PARTIDAS =====
window.filterMatches = function(filter) {
  const now = new Date();
  let filtered = matches;

  if (filter === '7days') {
    filtered = matches.filter(m => {
      const matchDate = new Date(m.date);
      const daysAgo = (now - matchDate) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    });
  } else if (filter === '30days') {
    filtered = matches.filter(m => {
      const matchDate = new Date(m.date);
      const daysAgo = (now - matchDate) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    });
  }

  displayFilteredMatches(filtered);
};

function displayFilteredMatches(filtered) {
  const list = document.getElementById("matchesList");
  
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhuma partida encontrada</p>';
    return;
  }

  list.innerHTML = filtered.map(match => `
    <div class="card match-card">
      <div class="match-teams">
        <strong>${match.homeTeam}</strong>
        <div class="match-result">
          ${match.homeGoals} × ${match.awayGoals}
          ${match.homePenalties > 0 || match.awayPenalties > 0 ? 
            `<span style="font-size: 0.8rem; color: var(--warning);">(${match.homePenalties}p ${match.awayPenalties})</span>` 
            : ''}
        </div>
        <strong>${match.awayTeam}</strong>
        <div class="match-date">${formatDate(match.date)}</div>
        ${match.opponentUsername ? 
          `<div style="font-size: 0.75rem; color: var(--accent); margin-top: 4px;">⚔️ vs ${match.opponentUsername}</div>` 
          : ''}
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px;">
          ${match.homeLeague} vs ${match.awayLeague}
        </div>
      </div>
    </div>
  `).join("");
}

function updateMatchesList() {
  const list = document.getElementById("matchesList");
  
  if (matches.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhuma partida registrada</p>';
    return;
  }

  list.innerHTML = matches.map(match => `
    <div class="card match-card">
      <div class="match-teams">
        <strong>${match.homeTeam}</strong>
        <div class="match-result">
          ${match.homeGoals} × ${match.awayGoals}
          ${match.homePenalties > 0 || match.awayPenalties > 0 ? 
            `<span style="font-size: 0.8rem; color: var(--warning);">(${match.homePenalties}p ${match.awayPenalties})</span>` 
            : ''}
        </div>
        <strong>${match.awayTeam}</strong>
        <div class="match-date">${formatDate(match.date)}</div>
        ${match.opponentUsername ? 
          `<div style="font-size: 0.75rem; color: var(--accent); margin-top: 4px;">⚔️ vs ${match.opponentUsername}</div>` 
          : ''}
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px;">
          ${match.homeLeague} vs ${match.awayLeague}
        </div>
      </div>
    </div>
  `).join("");
}

// ===== BUSCA AVANÇADA DE PARTIDAS =====
window.advancedMatchSearch = function() {
  const leagueFilter = document.getElementById("searchLeague")?.value || '';
  const resultFilter = document.getElementById("searchResult")?.value || '';
  const periodFilter = document.getElementById("searchPeriod")?.value || '30days';

  let filtered = matches;

  if (leagueFilter) {
    filtered = filtered.filter(m => m.homeLeagueId === leagueFilter || m.awayLeagueId === leagueFilter);
  }

  if (resultFilter) {
    filtered = filtered.filter(m => {
      if (resultFilter === 'win') return m.homeGoals > m.awayGoals;
      if (resultFilter === 'draw') return m.homeGoals === m.awayGoals;
      if (resultFilter === 'loss') return m.homeGoals < m.awayGoals;
    });
  }

  const now = new Date();
  if (periodFilter !== 'all') {
    filtered = filtered.filter(m => {
      const matchDate = new Date(m.date);
      const daysAgo = (now - matchDate) / (1000 * 60 * 60 * 24);
      
      if (periodFilter === '7days') return daysAgo <= 7;
      if (periodFilter === '30days') return daysAgo <= 30;
      if (periodFilter === '90days') return daysAgo <= 90;
      return true;
    });
  }

  displayFilteredMatches(filtered);
};

// ===== EXPORT PARA CSV =====
window.exportMatchesCSV = function() {
  if (matches.length === 0) {
    showError("Nenhuma partida para exportar!");
    return;
  }

  let csv = "Data,Time Casa,Liga Casa,Gols Casa,Pênaltis Casa,Gols Fora,Pênaltis Fora,Time Visitante,Liga Visitante,Adversário\n";

  matches.forEach(match => {
    const date = formatDate(match.date).split(',')[0];
    const opponent = match.opponentUsername || "Liga";
    csv += `${date},"${match.homeTeam}","${match.homeLeague}",${match.homeGoals},${match.homePenalties},${match.awayGoals},${match.awayPenalties},"${match.awayTeam}","${match.awayLeague}","${opponent}"\n`;
  });

  downloadCSV(csv, 'partidas.csv');
  showToast("📥 Partidas exportadas!");
};

window.exportRankingCSV = function() {
  if (teams.length === 0) {
    showError("Nenhum time para exportar!");
    return;
  }

  let csv = "Posição,Time,Liga,Pontos,Vitórias,Empates,Derrotas,Gols Pró,Gols Contra,Saldo\n";

  const sorted = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
  });

  sorted.forEach((team, index) => {
    csv += `${index + 1},"${team.name}","${team.leagueName}",${team.points},${team.wins},${team.draws},${team.losses},${team.goalsFor},${team.goalsAgainst},${team.goalsFor - team.goalsAgainst}\n`;
  });

  downloadCSV(csv, 'ranking.csv');
  showToast("📥 Ranking exportado!");
};

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ===== BADGES/MEDALHAS =====
window.getBadges = function(teamId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return [];

  const badges = [];

  if (team.wins >= 10) badges.push('🏆 10 Vitórias');
  if (team.wins >= 20) badges.push('👑 20 Vitórias');
  if (team.points >= 30) badges.push('⭐ 30 Pontos');
  if (team.goalsFor >= 50) badges.push('⚽ 50 Gols');
  if (team.draws >= 5) badges.push('🤝 5 Empates');

  return badges;
};

// ===== TORNEIOS =====
async function loadTournaments() {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, "tournaments"), orderBy("createdAt", "desc"))
    );
    tournaments = [];
    querySnapshot.forEach((docSnapshot) => {
      tournaments.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });
    updateTournamentsUI();
    updateTournamentLeaguesCheckboxes();
  } catch (error) {
    console.error("❌ Erro ao carregar torneios:", error);
  }
}

function updateTournamentLeaguesCheckboxes() {
  const container = document.getElementById("tournamentLeaguesContainer");
  if (!container) return;

  container.innerHTML = leagues.map(league => {
    const leagueTeams = teams.filter(t => t.leagueId === league.id);
    return `
      <label style="display: flex; align-items: center; gap: 10px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; cursor: pointer; border: 2px solid rgba(0, 212, 255, 0.2); transition: var(--transition);">
        <input type="checkbox" class="tournament-league-checkbox" value="${league.id}" onchange="updateTournamentTeamsUI()">
        <span>${league.name} (${leagueTeams.length} times)</span>
      </label>
    `;
  }).join("");
}

window.updateTournamentTeamsUI = function() {
  const checkboxes = document.querySelectorAll(".tournament-league-checkbox:checked");
  let totalTeams = 0;

  checkboxes.forEach(checkbox => {
    const leagueId = checkbox.value;
    const leagueTeams = teams.filter(t => t.leagueId === leagueId);
    totalTeams += leagueTeams.length;
  });

  document.getElementById("tournamentTeamsCount").innerText = `Times disponíveis: ${totalTeams}`;
};

window.createTournament = async function() {
  try {
    const name = document.getElementById("tournamentName").value.trim();
    const format = document.getElementById("tournamentFormat").value;
    const system = document.getElementById("tournamentSystem").value;
    const teamsCount = parseInt(document.getElementById("tournamentMaxTeamsCount").value) || 4;
    const description = document.getElementById("tournamentDescription").value.trim();

    const checkboxes = document.querySelectorAll(".tournament-league-checkbox:checked");
    const selectedLeagues = Array.from(checkboxes).map(cb => cb.value);

    if (!name) {
      showError("Digite o nome do torneio!");
      return;
    }

    if (name.length < 3) {
      showError("Nome do torneio deve ter pelo menos 3 caracteres!");
      return;
    }

    if (selectedLeagues.length === 0) {
      showError("Selecione pelo menos uma liga!");
      return;
    }

    if (teamsCount < 2 || teamsCount > 32) {
      showError("Quantidade de times deve ser entre 2 e 32!");
      return;
    }

    const tournamentExists = tournaments.some(
      t => t.name.toLowerCase() === name.toLowerCase() && t.status === "pending"
    );

    if (tournamentExists) {
      showError("Já existe um torneio com este nome!");
      return;
    }

    const selectedLeaguesData = selectedLeagues.map(leagueId => {
      const league = leagues.find(l => l.id === leagueId);
      return { id: leagueId, name: league.name };
    });

    const tournamentTeams = teams.filter(t => selectedLeagues.includes(t.leagueId));

    if (tournamentTeams.length < teamsCount) {
      showError(`Não há ${teamsCount} times nas ligas selecionadas! Há apenas ${tournamentTeams.length} times.`);
      return;
    }

    await addDoc(collection(db, "tournaments"), {
      name,
      selectedLeagues: selectedLeaguesData,
      format,
      system,
      teamsCount,
      description,
      status: "pending",
      selectedTeams: [],
      brackets: [],
      winner: null,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid
    });

    document.getElementById("tournamentName").value = "";
    document.getElementById("tournamentFormat").value = "single";
    document.getElementById("tournamentSystem").value = "single";
    document.getElementById("tournamentMaxTeamsCount").value = "4";
    document.getElementById("tournamentDescription").value = "";
    document.querySelectorAll(".tournament-league-checkbox").forEach(cb => cb.checked = false);

    showToast("🏅 Torneio criado com sucesso!");
    loadTournaments();
  } catch (error) {
    console.error("❌ Erro ao criar torneio:", error);
    showError("Erro ao criar torneio");
  }
};

window.deleteTournament = async function(tournamentId) {
  if (!confirm("Deseja realmente deletar este torneio?")) return;

  try {
    await deleteDoc(doc(db, "tournaments", tournamentId));
    showToast("🗑️ Torneio deletado!");
    loadTournaments();
  } catch (error) {
    console.error("❌ Erro ao deletar torneio:", error);
    showError("Erro ao deletar torneio");
  }
};

window.openDrawModal = async function(tournamentId) {
  try {
    const tournament = tournaments.find(t => t.id === tournamentId);
    const selectedLeagueIds = tournament.selectedLeagues.map(l => l.id);
    const availableTeams = teams.filter(t => selectedLeagueIds.includes(t.leagueId));

    if (availableTeams.length < tournament.teamsCount) {
      showError(`Esta liga não tem ${tournament.teamsCount} times!`);
      return;
    }

    currentModalUserId = tournamentId;

    const modal = document.getElementById("userProfileModal");
    const modalContent = modal.querySelector(".modal-content");

    const drawHtml = `
      <button class="modal-close" onclick="closeDrawModal()">✕</button>
      <h2 style="text-align: center; margin-bottom: 20px; color: var(--accent);">🎲 Sorteio: ${tournament.name}</h2>
      
      <div class="draw-teams-container">
        ${availableTeams.slice(0, tournament.teamsCount).map(team => `
          <div class="draw-team-item">
            <h4>⚽ ${team.name}</h4>
            <p>${team.leagueName}</p>
          </div>
        `).join('')}
      </div>

      <button class="draw-spin-button" onclick="performDraw('${tournamentId}', ${tournament.teamsCount})">
        🎯 REALIZAR SORTEIO
      </button>
    `;

    modalContent.innerHTML = drawHtml;
    modal.style.display = "flex";
  } catch (error) {
    console.error("❌ Erro ao abrir sorteio:", error);
    showError("Erro ao abrir sorteio");
  }
};

window.performDraw = async function(tournamentId, teamsCount) {
  try {
    const tournament = tournaments.find(t => t.id === tournamentId);
    const selectedLeagueIds = tournament.selectedLeagues.map(l => l.id);
    const leagueTeams = teams.filter(t => selectedLeagueIds.includes(t.leagueId));
    
    const shuffled = [...leagueTeams.slice(0, teamsCount)].sort(() => Math.random() - 0.5);
    
    const brackets = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        brackets.push({
          team1: shuffled[i].name,
          team2: shuffled[i + 1].name,
          round: 1,
          result: null
        });
      }
    }

    await updateDoc(doc(db, "tournaments", tournamentId), {
      selectedTeams: shuffled.map(t => t.id),
      brackets: brackets,
      status: "in_progress"
    });

    showToast("🎲 Sorteio realizado com sucesso!");
    loadTournaments();
    closeDrawModal();
  } catch (error) {
    console.error("❌ Erro ao realizar sorteio:", error);
    showError("Erro ao realizar sorteio");
  }
};

window.closeDrawModal = function() {
  document.getElementById("userProfileModal").style.display = "none";
  currentModalUserId = null;
};

function updateTournamentsUI() {
  const list = document.getElementById("tournamentsList");

  if (tournaments.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum torneio criado ainda</p>';
    return;
  }

  list.innerHTML = tournaments.map(tournament => {
    const statusText = {
      "pending": "⏳ Pendente",
      "in_progress": "🎮 Em Andamento",
      "finished": "✅ Finalizado"
    };

    const leaguesText = tournament.selectedLeagues?.map(l => l.name).join(", ") || "Ligas";

    return `
      <div class="card tournament-card">
        <div class="tournament-status ${tournament.status}">${statusText[tournament.status]}</div>
        <h3>🏅 ${tournament.name}</h3>
        
        <div class="tournament-info">
          <p>📍 <strong>Ligas:</strong> ${leaguesText}</p>
          <p>👥 <strong>Times:</strong> ${tournament.selectedTeams?.length || 0}/${tournament.teamsCount}</p>
          ${tournament.description ? `<p>📝 ${tournament.description}</p>` : ''}
        </div>

        <div class="tournament-actions">
          ${tournament.status === "pending" ? `
            <button onclick="openDrawModal('${tournament.id}')" class="btn-draw">🎲 Realizar Sorteio</button>
          ` : ''}
          <button onclick="deleteTournament('${tournament.id}')" class="btn-delete-tournament">🗑️ Deletar</button>
        </div>
      </div>
    `;
  }).join("");
}

// ===== ESTATÍSTICAS AVANÇADAS =====
window.getTeamStats = function(teamId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;

  const teamMatches = matches.filter(m => m.homeId === teamId || m.awayId === teamId);
  const winRate = teamMatches.length > 0 ? ((team.wins / teamMatches.length) * 100).toFixed(1) : 0;
  const goalAverage = teamMatches.length > 0 ? (team.goalsFor / teamMatches.length).toFixed(2) : 0;

  return {
    matches: teamMatches.length,
    winRate,
    goalAverage,
    goalDifference: team.goalsFor - team.goalsAgainst
  };
};

window.showTeamStatistics = function(teamId) {
  const team = teams.find(t => t.id === teamId);
  const stats = getTeamStats(teamId);

  if (!stats) {
    showError("Time não encontrado!");
    return;
  }

  const statsHtml = `
    <div class="stats-modal">
      <h3>${team.name}</h3>
      <div class="stat-item">
        <span>Partidas Jogadas:</span>
        <strong>${stats.matches}</strong>
      </div>
      <div class="stat-item">
        <span>Taxa de Vitória:</span>
        <strong>${stats.winRate}%</strong>
      </div>
      <div class="stat-item">
        <span>Média de Gols:</span>
        <strong>${stats.goalAverage}</strong>
      </div>
      <div class="stat-item">
        <span>Saldo de Gols:</span>
        <strong>${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}</strong>
      </div>
    </div>
  `;

  const modal = document.getElementById("userProfileModal");
  const modalContent = modal.querySelector(".modal-content");
  modalContent.innerHTML = statsHtml + '<button class="btn-primary" onclick="closeUserModal()" style="margin-top: 20px; width: 100%;">Fechar</button>';
  modal.style.display = "flex";
};

// ===== RANKING =====
function updateRanking() {
  const table = document.getElementById("rankingTable");
  const leagueFilter = document.getElementById("rankingLeagueFilter").value;

  let filteredTeams = teams;

  if (leagueFilter) {
    filteredTeams = teams.filter(t => t.leagueId === leagueFilter);
  }

  const sorted = [...filteredTeams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffB = b.goalsFor - b.goalsAgainst;
    const diffA = a.goalsFor - a.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.goalsFor - a.goalsFor;
  });

  if (sorted.length === 0) {
    table.innerHTML = '<p class="empty-state">Nenhum time para exibir</p>';
    return;
  }

  table.innerHTML = sorted.map((team, index) => `
    <div class="card ranking-card">
      <div class="rank-position">${index + 1}º</div>
      <div class="rank-name">${team.name}</div>
      <div class="rank-league">${team.leagueName}</div>
      <div class="rank-stats">
        <div class="rank-stat">
          <div class="rank-stat-label">Pontos</div>
          <div class="rank-stat-value">${team.points}</div>
        </div>
        <div class="rank-stat">
          <div class="rank-stat-label">Vitórias</div>
          <div class="rank-stat-value">${team.wins}</div>
        </div>
        <div class="rank-stat">
          <div class="rank-stat-label">Empates</div>
          <div class="rank-stat-value">${team.draws}</div>
        </div>
        <div class="rank-stat">
          <div class="rank-stat-label">Derrotas</div>
          <div class="rank-stat-value">${team.losses}</div>
        </div>
        <div class="rank-stat">
          <div class="rank-stat-label">Saldo</div>
          <div class="rank-stat-value">${team.goalsFor - team.goalsAgainst}</div>
        </div>
      </div>
    </div>
  `).join("");
}

// Atualizar select de adversários no ranking
window.updateRankingOpponentSelect = function() {
  const select = document.getElementById("rankingOpponentSelect");
  const modeSelect = document.getElementById("rankingModeSelect");

  if (!select || !modeSelect) return;

  if (modeSelect.value === "opponent") {
    select.style.display = "block";

    if (!userProfile?.following || userProfile.following.length === 0) {
      select.innerHTML = '<option value="">Nenhum adversário seguido</option>';
      return;
    }

    select.innerHTML = '<option value="">Selecione um Adversário</option>';

    userProfile.following.forEach(userId => {
      const user = users.find(u => u.uid === userId);
      if (user) {
        select.innerHTML += `<option value="${user.uid}">${user.displayUsername} (@${user.username})</option>`;
      }
    });
  } else {
    select.style.display = "none";
  }
};

// ===== EQUIPE E UI =====
function updateTeamsUI() {
  const leagueId = document.getElementById("leagueSelect").value;
  const list = document.getElementById("teamsList");

  if (!leagueId) {
    list.innerHTML = '<p class="empty-state">Selecione uma liga para ver os times</p>';
    return;
  }

  const leagueTeams = teams.filter(t => t.leagueId === leagueId);

  if (leagueTeams.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum time nesta liga</p>';
    return;
  }

  list.innerHTML = leagueTeams.map(team => {
    const badges = getBadges(team.id);
    const badgesHtml = badges.map(b => `<span class="badge">${b}</span>`).join('');

    return `
      <div class="card team-card">
        <h3>${team.name}</h3>
        <div class="team-stats">
          <p>🏆 ${team.points} pontos</p>
          <p>✅ ${team.wins}V | 🤝 ${team.draws}E | ❌ ${team.losses}D</p>
          <p>⚽ ${team.goalsFor} - ${team.goalsAgainst}</p>
        </div>
        <div>${badgesHtml}</div>
        <button onclick="showTeamStatistics('${team.id}')" class="btn-secondary" style="margin-top: 12px; width: 100%;">📊 Ver Estatísticas</button>
        <button onclick="deleteTeam('${team.id}')" class="btn-delete" style="margin-top: 8px; width: 100%;">🗑️ Deletar</button>
      </div>
    `;
  }).join("");
}

// ===== DASHBOARD =====
function updateDashboard() {
  const totalLeagues = leagues.length;
  const totalTeams = teams.length;
  const totalMatches = matches.length;

  document.getElementById("totalLeagues").innerText = totalLeagues;
  document.getElementById("totalTeams").innerText = totalTeams;
  document.getElementById("totalMatches").innerText = totalMatches;
}

function updateUI() {
  updateMatchesList();
}

// ===== INTERFACE =====
window.showSection = function(sectionId, event) {
  if (event) {
    event.preventDefault();
  }
  
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }

  if (sectionId === 'chat') {
    loadConversations();
  }

  if (sectionId === 'tournaments') {
    loadTournaments();
  }

  closeSidebar();
};

// ===== SIDEBAR MOBILE =====
window.toggleSidebar = function() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const toggle = document.getElementById("sidebarToggle");
  
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
  toggle.classList.toggle("open");
};

window.closeSidebar = function() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const toggle = document.getElementById("sidebarToggle");
  
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
  toggle.classList.remove("open");
};

// ===== UTILITÁRIOS =====
function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  if (errorDiv && !currentUser) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }
  showToast(message, true);
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add("show");
  if (isError) toast.classList.add("error");
  
  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.remove("error");
  }, 3000);
}

function getErrorMessage(error) {
  const errorMap = {
    "auth/email-already-in-use": "Este email já está registrado!",
    "auth/weak-password": "Senha muito fraca!",
    "auth/user-not-found": "Usuário não encontrado!",
    "auth/wrong-password": "Senha incorreta!",
    "auth/invalid-email": "Email inválido!",
    "auth/operation-not-allowed": "Operação não permitida!",
    "auth/network-request-failed": "Erro de conexão!"
  };
  
  return errorMap[error.code] || error.message;
}

function clearAuthForms() {
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const regEmail = document.getElementById("regEmail");
  const regUsername = document.getElementById("regUsername");
  const regPassword = document.getElementById("regPassword");
  const regConfirmPassword = document.getElementById("regConfirmPassword");
  const errorMessage = document.getElementById("errorMessage");

  if (email) email.value = "";
  if (password) password.value = "";
  if (regEmail) regEmail.value = "";
  if (regUsername) regUsername.value = "";
  if (regPassword) regPassword.value = "";
  if (regConfirmPassword) regConfirmPassword.value = "";
  if (errorMessage) errorMessage.style.display = "none";
}

function clearAppData() {
  leagues = [];
  teams = [];
  matches = [];
  users = [];
  tournaments = [];
  currentUser = null;
  userProfile = null;
  selectedChatUserId = null;
  selectedChatUser = null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ===== MELHORES ATACANTES/DEFESAS =====
window.getTeamRankings = function() {
  const rankings = {
    bestAttack: [...teams].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5),
    bestDefense: [...teams].sort((a, b) => a.goalsAgainst - b.goalsAgainst).slice(0, 5),
    bestOverall: [...teams].sort((a, b) => b.points - a.points).slice(0, 5)
  };

  return rankings;
};

window.showTeamRankings = function() {
  const rankings = getTeamRankings();

  let html = `
    <div class="rankings-modal">
      <h2>🏆 Melhores Times</h2>
      
      <div class="ranking-category">
        <h3>⚽ Melhor Ataque</h3>
        <div class="ranking-list">
          ${rankings.bestAttack.map((team, idx) => `
            <div class="ranking-item">
              <span class="rank-num">${idx + 1}</span>
              <span class="rank-name">${team.name}</span>
              <span class="rank-value">${team.goalsFor} gols</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="ranking-category">
        <h3>🛡️ Melhor Defesa</h3>
        <div class="ranking-list">
          ${rankings.bestDefense.map((team, idx) => `
            <div class="ranking-item">
              <span class="rank-num">${idx + 1}</span>
              <span class="rank-name">${team.name}</span>
              <span class="rank-value">${team.goalsAgainst} gols sofridos</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="ranking-category">
        <h3>👑 Melhor Desempenho Geral</h3>
        <div class="ranking-list">
          ${rankings.bestOverall.map((team, idx) => `
            <div class="ranking-item">
              <span class="rank-num">${idx + 1}</span>
              <span class="rank-name">${team.name}</span>
              <span class="rank-value">${team.points} pts</span>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" onclick="closeUserModal()" style="width: 100%; margin-top: 20px;">Fechar</button>
    </div>
  `;

  const modal = document.getElementById("userProfileModal");
  const modalContent = modal.querySelector(".modal-content");
  modalContent.innerHTML = html;
  modal.style.display = "flex";
};

// ===== ESTATÍSTICAS GERAIS =====
window.getGeneralStats = function() {
  const totalMatches = matches.length;
  const totalGoals = matches.reduce((sum, m) => sum + m.homeGoals + m.awayGoals, 0);
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : 0;
  const totalTeams = teams.length;
  const totalLeagues = leagues.length;

  return {
    totalMatches,
    totalGoals,
    avgGoals,
    totalTeams,
    totalLeagues
  };
};

window.showGeneralStats = function() {
  const stats = getGeneralStats();

  const html = `
    <div class="general-stats">
      <h2>📊 Estatísticas Gerais</h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>⚽</h3>
          <p class="stat-label">Total de Partidas</p>
          <p class="stat-value">${stats.totalMatches}</p>
        </div>
        
        <div class="stat-card">
          <h3>🎯</h3>
          <p class="stat-label">Total de Gols</p>
          <p class="stat-value">${stats.totalGoals}</p>
        </div>
        
        <div class="stat-card">
          <h3>📈</h3>
          <p class="stat-label">Média de Gols/Partida</p>
          <p class="stat-value">${stats.avgGoals}</p>
        </div>
        
        <div class="stat-card">
          <h3>👥</h3>
          <p class="stat-label">Total de Times</p>
          <p class="stat-value">${stats.totalTeams}</p>
        </div>
        
        <div class="stat-card">
          <h3>🎯</h3>
          <p class="stat-label">Total de Ligas</p>
          <p class="stat-value">${stats.totalLeagues}</p>
        </div>
        
        <div class="stat-card">
          <h3>👤</h3>
          <p class="stat-label">Total de Usuários</p>
          <p class="stat-value">${users.length + 1}</p>
        </div>
      </div>

      <button class="btn-primary" onclick="closeUserModal()" style="width: 100%; margin-top: 20px;">Fechar</button>
    </div>
  `;

  const modal = document.getElementById("userProfileModal");
  const modalContent = modal.querySelector(".modal-content");
  modalContent.innerHTML = html;
  modal.style.display = "flex";
};

// ===== DOCUMENT READY =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  const leagueSelect = document.getElementById("leagueSelect");
  const homeLeagueSelect = document.getElementById("homeLeagueSelect");
  const bioInput = document.getElementById("bioInput");

  if (leagueSelect) {
    leagueSelect.addEventListener('change', updateTeamsUI);
  }

  if (homeLeagueSelect) {
    homeLeagueSelect.addEventListener('change', updateHomeTeamsUI);
  }

  if (bioInput) {
    bioInput.addEventListener('input', () => {
      document.getElementById("bioCounter").innerText = `${bioInput.value.length}/200`;
    });
  }

  setTimeout(() => {
    updateOpponentSelect();
    updateRankingOpponentSelect();
    updateLeagueSelects();
  }, 1000);
});

console.log("✅ app.js carregado com sucesso!");
