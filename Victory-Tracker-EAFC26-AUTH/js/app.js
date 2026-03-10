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

// ===== INICIALIZAÇÃO =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== VARIÁVEIS GLOBAIS =====
let leagues = [];
let teams = [];
let matches = [];
let users = [];
let currentUser = null;
let userProfile = null;
let selectedChatUserId = null;
let selectedChatUser = null;
let chatListenerUnsubscribe = null;
let currentModalUserId = null;

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

    if (!email || !password) {
      showError("Preencha todos os campos!");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    clearAuthForms();
  } catch (error) {
    showError(getErrorMessage(error));
  }
};

window.register = async function() {
  try {
    const email = document.getElementById("regEmail").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

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

    // Validar se username já existe
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
    showError(getErrorMessage(error));
  }
};

window.logout = async function() {
  if (confirm("Deseja realmente sair?")) {
    try {
      await signOut(auth);
      clearAppData();
    } catch (error) {
      showError("Erro ao sair: " + error.message);
    }
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";
    
    await loadUserProfile();
    await loadLeagues();
    await loadUsers();
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
    }

    updateProfileUI();
    updateSidebarUserInfo();
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    showError("Erro ao carregar perfil: " + error.message);
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
    showError("Erro ao fazer upload da foto: " + error.message);
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
    showError("Erro ao atualizar perfil: " + error.message);
  }
};

// ===== USUÁRIOS E SEGUIDORES =====

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
  } catch (error) {
    showError("Erro ao carregar usuários: " + error.message);
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
    showError("Erro ao carregar usuário: " + error.message);
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
      userProfile.following.push(targetUser.uid);
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

    if (currentModalUserId) {
      await openUserModal(currentModalUserId);
    }
  } catch (error) {
    showError("Erro ao seguir/deixar de seguir: " + error.message);
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
            <p id="lastMsg-${userId}" class="last-message">Clique para conversar</p>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro ao carregar conversas:", error);
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
    showError("Erro ao enviar mensagem: " + error.message);
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
  } catch (error) {
    showError("Erro ao carregar ligas: " + error.message);
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
    showError("Erro ao criar liga: " + error.message);
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
    showError("Erro ao deletar liga: " + error.message);
  }
};

function updateLeagueSelects() {
  const leagueSelects = [
    document.getElementById("leagueSelect"),
    document.getElementById("matchLeagueSelect"),
    document.getElementById("rankingLeagueFilter")
  ];

  leagueSelects.forEach(select => {
    if (select) {
      const currentValue = select.value;
      select.innerHTML = select.id === "rankingLeagueFilter" 
        ? '<option value="">Todas as Ligas</option>' 
        : '<option value="">Selecione uma Liga</option>';
      
      leagues.forEach(league => {
        select.innerHTML += `<option value="${league.id}">${league.name}</option>`;
      });
      
      select.value = currentValue;
    }
  });
}

function updateLeaguesList() {
  const list = document.getElementById("leaguesList");
  
  if (leagues.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhuma liga criada ainda</p>';
    return;
  }

  list.innerHTML = leagues.map(league => {
    const leagueTeams = teams.filter(t => t.leagueId === league.id);
    const leagueMatches = matches.filter(m => m.leagueId === league.id);
    
    return `
      <div class="card league-card">
        <div class="league-header">
          <h3>${league.name}</h3>
          <button onclick="deleteLeague('${league.id}')" class="btn-delete-sm" title="Deletar Liga">🗑️</button>
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
    showError("Erro ao carregar times: " + error.message);
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
    showError("Erro ao criar time: " + error.message);
  }
};

window.deleteTeam = async function(teamId) {
  if (!confirm("Deseja realmente deletar este time?")) return;

  try {
    await deleteDoc(doc(db, "teams", teamId));
    showToast("🗑️ Time deletado!");
    loadTeams();
  } catch (error) {
    showError("Erro ao deletar time: " + error.message);
  }
};

// ===== PARTIDAS =====

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
    console.error("Erro ao carregar partidas:", error);
  }
}

window.registerMatch = async function() {
  try {
    const leagueId = document.getElementById("matchLeagueSelect").value;
    const homeId = document.getElementById("homeTeam").value;
    const awayId = document.getElementById("awayTeam").value;
    const homeGoals = parseInt(document.getElementById("homeGoals").value) || 0;
    const awayGoals = parseInt(document.getElementById("awayGoals").value) || 0;

    if (!leagueId) {
      showError("Selecione uma liga!");
      return;
    }

    if (!homeId || !awayId) {
      showError("Selecione ambos os times!");
      return;
    }

    if (homeId === awayId) {
      showError("Selecione times diferentes!");
      return;
    }

    const home = teams.find(t => t.id === homeId);
    const away = teams.find(t => t.id === awayId);

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (homeGoals < awayGoals) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }

    const batch = writeBatch(db);
    batch.update(doc(db, "teams", home.id), home);
    batch.update(doc(db, "teams", away.id), away);

    await addDoc(collection(db, "matches"), {
      leagueId,
      homeTeam: home.name,
      homeId: home.id,
      awayTeam: away.name,
      awayId: away.id,
      homeGoals,
      awayGoals,
      date: new Date().toISOString()
    });

    await batch.commit();

    document.getElementById("homeGoals").value = "";
    document.getElementById("awayGoals").value = "";

    showToast("✅ Partida registrada com sucesso!");
    loadTeams();
    loadMatches();
  } catch (error) {
    showError("Erro ao registrar partida: " + error.message);
  }
};

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
        <div class="match-result">${match.homeGoals} × ${match.awayGoals}</div>
        <strong>${match.awayTeam}</strong>
        <div class="match-date">${formatDate(match.date)}</div>
      </div>
    </div>
  `).join("");
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
};

document.addEventListener('DOMContentLoaded', () => {
  const leagueSelect = document.getElementById("leagueSelect");
  const matchLeagueSelect = document.getElementById("matchLeagueSelect");
  const rankingFilter = document.getElementById("rankingLeagueFilter");
  const bioInput = document.getElementById("bioInput");

  if (leagueSelect) {
    leagueSelect.addEventListener('change', updateTeamsUI);
  }

  if (matchLeagueSelect) {
    matchLeagueSelect.addEventListener('change', updateMatchTeamsUI);
  }

  if (rankingFilter) {
    rankingFilter.addEventListener('change', updateRanking);
  }

  if (bioInput) {
    bioInput.addEventListener('input', () => {
      document.getElementById("bioCounter").innerText = `${bioInput.value.length}/200`;
    });
  }
});

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

  list.innerHTML = leagueTeams.map(team => `
    <div class="card team-card">
      <h3>${team.name}</h3>
      <div class="team-stats">
        <p>🏆 ${team.points} pontos</p>
        <p>✅ ${team.wins}V | 🤝 ${team.draws}E | ❌ ${team.losses}D</p>
        <p>⚽ ${team.goalsFor} - ${team.goalsAgainst}</p>
      </div>
      <button onclick="deleteTeam('${team.id}')" class="btn-delete">🗑️ Deletar</button>
    </div>
  `).join("");
}

function updateMatchTeamsUI() {
  const leagueId = document.getElementById("matchLeagueSelect").value;
  const homeSelect = document.getElementById("homeTeam");
  const awaySelect = document.getElementById("awayTeam");

  homeSelect.innerHTML = '<option value="">Selecione um time</option>';
  awaySelect.innerHTML = '<option value="">Selecione um time</option>';

  if (!leagueId) {
    return;
  }

  const leagueTeams = teams.filter(t => t.leagueId === leagueId);

  leagueTeams.forEach(team => {
    homeSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    awaySelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
  });
}

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
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("regEmail").value = "";
  document.getElementById("regUsername").value = "";
  document.getElementById("regPassword").value = "";
  document.getElementById("regConfirmPassword").value = "";
  document.getElementById("errorMessage").style.display = "none";
}

function clearAppData() {
  leagues = [];
  teams = [];
  matches = [];
  users = [];
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
// ===== SIDEBAR TOGGLE =====

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

// Fechar sidebar ao clicar em um botão de navegação
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

  // Fechar sidebar em mobile após clicar
  closeSidebar();
};