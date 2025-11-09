
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, get, set, serverTimestamp, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// --- PASTE YOUR FIREBASE CONFIGURATION HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyAnic5UEHFBXfPhstPO8h-LrgAwSUp0VgQ",
  authDomain: "tournament-app-d063c.firebaseapp.com",
  databaseURL: "https://tournament-app-d063c-default-rtdb.firebaseio.com",
  projectId: "tournament-app-d063c",
  storageBucket: "tournament-app-d063c.firebasestorage.app",
  messagingSenderId: "631111532581",
  appId: "1:631111532581:web:17a12f819a9d3e611abfcc",
  measurementId: "G-KZL2ZY4X8K"
};
// ---------------------------------------------

// Fix: Declare Swiper and bootstrap as global variables
declare var Swiper: any;
declare var bootstrap: any;

interface UserProfile {
    name: string;
    email: string;
    wallet: { balance: number };
    winnings: number;
}
interface Transaction {
    description: string;
    timestamp: number;
    type: 'credit' | 'debit';
    amount: number;
}
interface Tournament {
    id: string;
    name: string;
    schedule: number;
    entryFee: number;
    prizePool: number;
    gameId: string;
    status: string;
}
interface LeaderboardUser {
    name: string;
    winnings?: number;
}

let app, db, auth;
let appModalInstance: any;
let currentUser: any = null;
// Fix: Use Partial<UserProfile> for userProfile to avoid property does not exist errors
let userProfile: Partial<UserProfile> = {};
let currentSection = 'login-section';

const getElement = (id: string) => document.getElementById(id);
const showLoader = (show: boolean) => (getElement('globalLoaderEl') as HTMLElement).style.display = show ? 'flex' : 'none';

function showStatusMessage(elementId: string, message: string, type = 'danger') {
    const element = getElement(elementId);
    if (!element) return;
    element.innerHTML = message;
    element.className = `alert alert-${type} mt-3`;
    element.style.display = 'block';
    setTimeout(() => { if(element) element.style.display = 'none' }, 5000);
}

// --- PAGE RENDERING ---
function renderPageContent(sectionId: string) {
    const section = getElement(sectionId);
    if (!section || section.innerHTML.trim() !== '') return;
    let content = '';
    switch (sectionId) {
        case 'login-section':
            content = `
                <div class="container" style="max-width: 450px; margin-top: 5vh;">
                    <div class="text-center mb-4"><img src="https://img.icons8.com/bubbles/100/000000/controller.png" alt="Logo" style="width: 100px;"></div>
                    <div class="card custom-card"> <div class="card-body p-4">
                        <form id="emailLoginForm">
                            <h2 class="card-title text-center mb-4 text-white">Login</h2>
                            <div class="mb-3"><input type="email" class="form-control" id="loginEmailInputEl" placeholder="Email" required></div>
                            <div class="mb-3"><input type="password" class="form-control" id="loginPasswordInputEl" placeholder="Password" required></div>
                            <div id="loginStatusMessageEl" class="alert mt-3" style="display: none;"></div>
                            <div class="d-grid"><button type="submit" class="btn" style="background-color: var(--accent-red); color: white;">Login</button></div>
                            <button type="button" id="showSignupToggleBtnEl" class="btn btn-link d-block text-center mt-2" style="color: var(--accent-secondary); text-decoration: none;">Need an account? Sign Up</button>
                        </form>
                        <form id="emailSignupForm" style="display: none;">
                            <h2 class="card-title text-center mb-4 text-white">Sign Up</h2>
                            <div class="mb-3"><input type="text" class="form-control" id="signupNameInputEl" placeholder="Full Name" required></div>
                            <div class="mb-3"><input type="email" class="form-control" id="signupEmailInputEl" placeholder="Email" required></div>
                            <div class="mb-3"><input type="password" class="form-control" id="signupPasswordInputEl" placeholder="Password (min. 6 characters)" required></div>
                            <div id="signupStatusMessageEl" class="alert mt-3" style="display: none;"></div>
                            <div class="d-grid"><button type="submit" class="btn" style="background-color: var(--accent-secondary); color: var(--bg-primary);">Sign Up</button></div>
                            <button type="button" id="showLoginToggleBtnEl" class="btn btn-link d-block text-center mt-2" style="color: var(--accent-secondary); text-decoration: none;">Already have an account? Login</button>
                        </form>
                    </div></div>
                </div>`;
            break;
        case 'home-section':
            content = `
                <div id="promotionSlider" class="swiper">
                    <div class="swiper-wrapper" id="promotionSliderWrapper"></div>
                    <div class="swiper-pagination"></div>
                </div>
                <div class="my-contests">
                    <div class="section-header"><h2>My Contests</h2><p>Your Tournament Journey</p></div>
                    <div class="contest-categories">
                        <div class="category-card" data-status-target="ongoing"><div class="icon"><i class="fas fa-play-circle"></i></div><span>ONGOING</span></div>
                        <div class="category-card" data-status-target="upcoming"><div class="icon"><i class="fas fa-arrow-clockwise"></i></div><span>UPCOMING</span></div>
                        <div class="category-card" data-status-target="completed"><div class="icon"><i class="fas fa-check-circle"></i></div><span>RESULTS</span></div>
                    </div>
                </div>
                <div class="exclusive-tournaments">
                    <div class="section-header"><h2>Game Categories</h2><p>Select a game to see matches</p></div>
                    <div class="game-list" id="gamesListEl"></div>
                </div>`;
            break;
        case 'profile-section':
            content = `
                <div class="profile-card">
                    <div class="profile-avatar" id="profileCardAvatar"></div>
                    <div class="profile-info">
                        <h3 id="profileCardName">Username</h3>
                        <p id="profileCardEmail">email@example.com</p>
                    </div>
                </div>
                <div class="profile-menu">
                    <a href="#" class="menu-item" data-section="wallet-section"><i class="icon fa-solid fa-wallet"></i><span>My Wallet</span><i class="chevron fa-solid fa-chevron-right"></i></a>
                    <a href="#" class="menu-item" data-section="history-section"><i class="icon fa-solid fa-gamepad"></i><span>My Matches</span><i class="chevron fa-solid fa-chevron-right"></i></a>
                </div>
                <button class="logout-btn" id="logoutBtn">Logout</button>`;
            break;
        case 'wallet-section':
            content = `
                <div class="wallet-summary custom-card text-center">
                    <p class="text-secondary mb-1">Total Balance</p>
                    <h1 class="display-4 fw-bold" id="walletBalanceEl">₹0.00</h1>
                    <div class="d-flex justify-content-center gap-2 mt-3">
                        <button class="btn btn-success flex-grow-1" id="addCashBtn"><i class="fas fa-plus-circle me-1"></i> Add Cash</button>
                        <button class="btn btn-warning flex-grow-1" id="withdrawBtn"><i class="fas fa-paper-plane me-1"></i> Withdraw</button>
                    </div>
                </div>
                <div class="transaction-history mt-4">
                    <h4 class="mb-3">Transaction History</h4>
                    <div id="transactionListContainerEl"><p class="text-secondary text-center">No transactions yet.</p></div>
                </div>`;
            break;
        case 'tournaments-section':
            content = `
                <div class="tournament-tabs">
                    <button class="tab-item active" data-status="upcoming">Upcoming</button>
                    <button class="tab-item" data-status="ongoing">Ongoing</button>
                    <button class="tab-item" data-status="completed">Results</button>
                </div>
                <div id="tournamentsListContainerEl"></div>`;
            break;
        default:
            content = `<div class="text-center p-5"><h2 class="text-white">${sectionId.replace('-section', '').toUpperCase()}</h2><p class="text-secondary">This page is under construction.</p></div>`;
    }
    section!.innerHTML = content;
}

// --- NAVIGATION ---
// Fix: Add types for sectionId and data parameters
function showSection(sectionId: string, data: { gameId?: string } = {}) {
    currentSection = sectionId;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    renderPageContent(sectionId);
    getElement(sectionId)!.classList.add('active');

    const isHomePage = sectionId === 'home-section';
    const isLoginPage = sectionId === 'login-section';

    (getElement('headerUserInfo') as HTMLElement).style.display = isLoginPage ? 'none' : 'flex';
    (getElement('headerPageTitle') as HTMLElement).style.display = !isHomePage && !isLoginPage ? 'block' : 'none';
    (getElement('headerBackBtn') as HTMLElement).style.display = !isHomePage && !isLoginPage ? 'block' : 'none';
    getElement('headerPageTitle')!.textContent = sectionId.replace('-section', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

    document.querySelectorAll('.nav-item').forEach(item => {
        // Fix: Cast item to HTMLElement to access dataset
        item.classList.toggle('active', (item as HTMLElement).dataset.section === sectionId);
    });

    // Page specific logic
    if (sectionId === 'login-section') {
        attachAuthFormListeners();
    } else if (sectionId === 'home-section') {
        loadHomePageData();
    } else if (sectionId === 'profile-section') {
        loadProfileData();
    } else if (sectionId === 'wallet-section') {
        loadWalletData();
    } else if (sectionId === 'tournaments-section') {
        // Fix: Check if gameId exists before using it
        if (data.gameId) {
            loadTournaments(data.gameId, 'upcoming');
            attachTournamentTabListeners(data.gameId);
        }
    } else if (sectionId === 'history-section') {
        loadUserMatches();
    } else if (sectionId === 'leaderboard-section') {
        loadLeaderboard();
    }
}

// --- DATA HANDLING & UI UPDATES ---

function updateHeader(profile: Partial<UserProfile>) {
    const initials = profile.name ? profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GU';
    getElement('headerAvatar')!.textContent = initials;
    getElement('headerWelcomeText')!.textContent = `Welcome,`;
    getElement('headerUserGreeting')!.textContent = profile.name || 'Guest';
    getElement('headerChipBalance')!.textContent = profile.wallet ? profile.wallet.balance.toFixed(2) : '0.00';
}

function loadHomePageData() {
    // Load promotions
    const promoRef = ref(db, 'settings/promotions');
    get(promoRef).then(snapshot => {
        if (snapshot.exists()) {
            const promotions = snapshot.val();
            const wrapper = getElement('promotionSliderWrapper');
            wrapper!.innerHTML = promotions.map((p: any) => `<div class="swiper-slide"><img src="${p.imageUrl}" alt="Promotion"></div>`).join('');
            new Swiper('#promotionSlider', { loop: true, pagination: { el: '.swiper-pagination' }, autoplay: { delay: 3000 } });
        }
    });

    // Load games
    const gamesRef = ref(db, 'games');
    get(gamesRef).then(snapshot => {
        if (snapshot.exists()) {
            const games = snapshot.val();
            const container = getElement('gamesListEl');
            container!.innerHTML = Object.keys(games).map(key => `
                <div class="game-card" data-game-id="${key}">
                    <img src="${games[key].imageUrl}" alt="${games[key].name}">
                    <div class="game-title">${games[key].name}</div>
                </div>`).join('');
        }
    });
}

function loadProfileData() {
    // Fix: Check if userProfile and userProfile.name exist
    if(!userProfile || !userProfile.name || !currentUser) return;
    getElement('profileCardAvatar')!.textContent = userProfile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    getElement('profileCardName')!.textContent = userProfile.name;
    getElement('profileCardEmail')!.textContent = currentUser.email;
}

function loadWalletData() {
    // Fix: Use optional chaining for wallet and provide a default value
    getElement('walletBalanceEl')!.textContent = `₹${userProfile.wallet?.balance.toFixed(2) || '0.00'}`;
    loadTransactions();
}

function loadTransactions() {
    const txRef = ref(db, `transactions/${currentUser.uid}`);
    onValue(txRef, (snapshot) => {
        const container = getElement('transactionListContainerEl');
        if (snapshot.exists()) {
            // Fix: Type transactions to handle properties correctly
            const transactions: Transaction[] = Object.values(snapshot.val()).sort((a: any, b: any) => b.timestamp - a.timestamp);
            container!.innerHTML = transactions.map(tx => `
                <div class="custom-card d-flex justify-content-between align-items-center">
                    <div>
                        <p class="mb-0 fw-bold">${tx.description}</p>
                        <p class="mb-0 text-secondary small">${new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                    <h5 class="fw-bold text-${tx.type === 'credit' ? 'success' : 'danger'}">
                        ${tx.type === 'credit' ? '+' : '-'}₹${tx.amount.toFixed(2)}
                    </h5>
                </div>
            `).join('');
        } else {
            container!.innerHTML = '<p class="text-secondary text-center">No transactions yet.</p>';
        }
    });
}

function loadTournaments(gameId: string, status: string) {
    const container = getElement('tournamentsListContainerEl');
    container!.innerHTML = '<div class="fancy-spinner mx-auto mt-5"></div>'; // Show loader
    const tournamentsRef = ref(db, 'tournaments');
    get(tournamentsRef).then(snapshot => {
        if (snapshot.exists()) {
            const allTournaments = snapshot.val();
            // Fix: Type the tournament object to handle properties correctly
            const filtered: Tournament[] = Object.values(allTournaments).filter((t: any) => t.gameId === gameId && t.status === status);
            if(filtered.length > 0) {
                 container!.innerHTML = filtered.map(t => `
                    <div class="tournament-card">
                        <h5>${t.name}</h5>
                        <p class="text-secondary">${new Date(t.schedule).toLocaleString()}</p>
                        <div class="d-flex justify-content-between">
                            <span>Entry Fee: ₹${t.entryFee}</span>
                            <span>Prize Pool: ₹${t.prizePool}</span>
                        </div>
                         <button class="btn btn-sm mt-3" style="background-color:var(--accent-secondary); color: var(--bg-primary)" onclick="window.joinTournament('${t.id}', ${t.entryFee})">Join Now</button>
                    </div>
                `).join('');
            } else {
                container!.innerHTML = `<p class="text-secondary text-center mt-4">No ${status} tournaments found for this game.</p>`
            }
        } else {
             container!.innerHTML = `<p class="text-secondary text-center mt-4">No tournaments available right now.</p>`
        }
    });
}

function loadUserMatches() {
    const container = getElement('history-section');
    container!.innerHTML = '<div class="fancy-spinner mx-auto mt-5"></div>'; // Show loader
    const registrationsRef = ref(db, `registrations/${currentUser.uid}`);
    get(registrationsRef).then(async regSnapshot => {
        if (regSnapshot.exists()) {
            const tournamentIds = Object.keys(regSnapshot.val());
            const tournamentPromises = tournamentIds.map(id => get(ref(db, `tournaments/${id}`)));
            const tournamentSnapshots = await Promise.all(tournamentPromises);
            const tournaments = tournamentSnapshots.map(s => s.val());
            container!.innerHTML = `
                <h4 class="mb-3">My Matches</h4>
                ${tournaments.length > 0 ? tournaments.map(t => `
                    <div class="tournament-card">
                        <h5>${t.name}</h5>
                        <p class="text-secondary">${new Date(t.schedule).toLocaleString()}</p>
                        <div class="d-flex justify-content-between">
                            <span>Status: <span class="badge" style="background-color: var(--accent-red)">${t.status.toUpperCase()}</span></span>
                            <span>Entry: ₹${t.entryFee}</span>
                        </div>
                    </div>`).join('') : '<p class="text-secondary text-center">You haven\'t joined any matches yet.</p>'
                }`;
        } else {
            container!.innerHTML = '<h4 class="mb-3">My Matches</h4><p class="text-secondary text-center">You haven\'t joined any matches yet.</p>';
        }
    });
}

function loadLeaderboard() {
    const container = getElement('leaderboard-section');
    container!.innerHTML = '<div class="fancy-spinner mx-auto mt-5"></div>'; // Show loader
    const usersRef = ref(db, 'users');
    get(usersRef).then(snapshot => {
        if (snapshot.exists()) {
            // Fix: Type users to handle properties correctly
            const users: LeaderboardUser[] = Object.values(snapshot.val());
            const sortedUsers = users.sort((a, b) => (b.winnings || 0) - (a.winnings || 0)).slice(0, 20);
            container!.innerHTML = `
                <h4 class="mb-3">Top Players</h4>
                <div class="list-group">
                    ${sortedUsers.map((user, index) => `
                        <div class="list-group-item d-flex justify-content-between align-items-center custom-card">
                           <div>
                             <span class="badge bg-warning me-2">${index + 1}</span>
                             ${user.name}
                           </div>
                           <span class="fw-bold">₹${(user.winnings || 0).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container!.innerHTML = '<p class="text-secondary text-center">Leaderboard is empty.</p>';
        }
    });
}

// --- ACTIONS & TRANSACTIONS ---

async function handleAddCash() {
    // Fix: Cast element to HTMLInputElement to access value property
    const amountStr = (getElement('addCashAmount') as HTMLInputElement).value;
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }
    showLoader(true);
    const userWalletRef = ref(db, `users/${currentUser.uid}/wallet/balance`);
    try {
        await runTransaction(userWalletRef, (currentBalance) => (currentBalance || 0) + amount);
        const txId = new Date().getTime();
        await set(ref(db, `transactions/${currentUser.uid}/${txId}`), {
            id: txId,
            amount,
            type: 'credit',
            description: 'Added cash to wallet',
            timestamp: serverTimestamp()
        });
        appModalInstance.hide();
    } catch (error) {
        console.error("Failed to add cash:", error);
        alert('Error adding cash. Please try again.');
    } finally {
        showLoader(false);
    }
}


async function handleWithdraw() {
    // Fix: Cast elements to HTMLInputElement to access value property
    const amountStr = (getElement('withdrawAmount') as HTMLInputElement).value;
    const method = (getElement('withdrawMethod') as HTMLInputElement).value;
    const amount = parseFloat(amountStr);
    
    if (!amount || amount <= 0 || !method) {
        alert('Please enter a valid amount and method details.');
        return;
    }
    // Fix: Check if wallet exists before accessing balance
    if (!userProfile.wallet || amount > userProfile.wallet.balance) {
        alert('Insufficient balance.');
        return;
    }

    showLoader(true);
    const userWalletRef = ref(db, `users/${currentUser.uid}/wallet/balance`);
    try {
        await runTransaction(userWalletRef, (currentBalance) => {
            if (currentBalance < amount) return; // Abort
            return currentBalance - amount;
        });

        const txId = new Date().getTime();
        await set(ref(db, `transactions/${currentUser.uid}/${txId}`), {
            id: txId,
            amount,
            type: 'debit',
            description: `Withdrawal request`,
            timestamp: serverTimestamp()
        });
        await set(ref(db, `withdraw_requests/${currentUser.uid}/${txId}`), {
             amount,
             method,
             status: 'pending',
             timestamp: serverTimestamp()
        });
        
        appModalInstance.hide();
        alert('Withdrawal request submitted successfully!');
    } catch (error) {
        console.error("Withdrawal failed:", error);
        alert('Error submitting request. Please try again.');
    } finally {
        showLoader(false);
    }
}

// Fix: Attach joinTournament to window object to be accessible from inline onclick handler
(window as any).joinTournament = async (tournamentId: string, entryFee: number) => {
     // Fix: Check if wallet exists before accessing balance
    if (!userProfile.wallet || entryFee > userProfile.wallet.balance) {
        alert('Insufficient balance to join. Please add cash to your wallet.');
        return;
    }
    if(!confirm(`This will deduct ₹${entryFee} from your wallet. Do you want to join?`)) return;

    showLoader(true);
    const userWalletRef = ref(db, `users/${currentUser.uid}/wallet/balance`);
    const registrationRef = ref(db, `registrations/${currentUser.uid}/${tournamentId}`);
    try {
        await runTransaction(userWalletRef, (currentBalance) => {
            if (currentBalance < entryFee) return; // Abort
            return currentBalance - entryFee;
        });

        const txId = new Date().getTime();
        await set(ref(db, `transactions/${currentUser.uid}/${txId}`), {
            id: txId,
            amount: entryFee,
            type: 'debit',
            description: `Entry for tournament ${tournamentId}`,
            timestamp: serverTimestamp()
        });
        await set(registrationRef, { joinedAt: serverTimestamp() });
        alert('Successfully joined tournament!');
        showSection('history-section');

    } catch (error)_ {
        console.error("Join tournament failed:", error);
        alert('Error joining tournament. Please try again.');
    } finally {
        showLoader(false);
    }
}

// --- EVENT LISTENERS ---
function attachAuthFormListeners() {
    getElement('emailLoginForm')!.addEventListener('submit', (e) => {
        e.preventDefault();
        // Fix: Cast elements to HTMLInputElement to access value property
        const email = (getElement('loginEmailInputEl') as HTMLInputElement).value;
        const password = (getElement('loginPasswordInputEl') as HTMLInputElement).value;
        showLoader(true);
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => showStatusMessage('loginStatusMessageEl', error.message))
            .finally(() => showLoader(false));
    });
    getElement('emailSignupForm')!.addEventListener('submit', (e) => {
        e.preventDefault();
        // Fix: Cast elements to HTMLInputElement to access value property
        const name = (getElement('signupNameInputEl') as HTMLInputElement).value;
        const email = (getElement('signupEmailInputEl') as HTMLInputElement).value;
        const password = (getElement('signupPasswordInputEl') as HTMLInputElement).value;
        showLoader(true);
        createUserWithEmailAndPassword(auth, email, password)
            .then(userCredential => {
                const user = userCredential.user;
                const userRef = ref(db, 'users/' + user.uid);
                set(userRef, {
                    name: name,
                    email: email,
                    createdAt: serverTimestamp(),
                    wallet: { balance: 0 },
                    winnings: 0
                });
            })
            .catch(error => showStatusMessage('signupStatusMessageEl', error.message))
            .finally(() => showLoader(false));
    });
    getElement('showSignupToggleBtnEl')!.addEventListener('click', () => {
        (getElement('emailLoginForm') as HTMLElement).style.display = 'none';
        (getElement('emailSignupForm') as HTMLElement).style.display = 'block';
    });
    getElement('showLoginToggleBtnEl')!.addEventListener('click', () => {
        (getElement('emailLoginForm') as HTMLElement).style.display = 'block';
        (getElement('emailSignupForm') as HTMLElement).style.display = 'none';
    });
}

function attachGlobalListeners() {
    // Bottom Nav
    document.querySelector('.bottom-nav')!.addEventListener('click', (e) => {
        // Fix: Cast e.target to Element to use closest
        const navItem = (e.target as Element).closest('.nav-item');
        if (navItem && (navItem as HTMLElement).dataset.section) {
            e.preventDefault();
            showSection((navItem as HTMLElement).dataset.section!);
        }
    });

    // Header Wallet Button
    getElement('headerWalletChip')!.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('wallet-section');
    });

    // Back button
    getElement('headerBackBtn')!.addEventListener('click', () => {
        // Simple back logic, can be improved with a history stack
        if(currentSection === 'tournaments-section') showSection('home-section');
        else showSection('home-section');
    });

    // Dynamic content listeners
    document.body.addEventListener('click', (e) => {
        // Fix: Cast e.target to Element to use closest
        const categoryCard = (e.target as Element).closest('.category-card');
        if (categoryCard) {
            showSection('history-section'); // Simplified: goes to match history
        }
        
        const gameCard = (e.target as Element).closest('.game-card');
        if (gameCard && (gameCard as HTMLElement).dataset.gameId) {
            showSection('tournaments-section', { gameId: (gameCard as HTMLElement).dataset.gameId });
        }
        
        const menuItem = (e.target as Element).closest('.menu-item');
        if (menuItem && (menuItem as HTMLElement).dataset.section) {
            showSection((menuItem as HTMLElement).dataset.section!);
        }

        // Fix: Cast e.target to HTMLElement to access id
        if ((e.target as HTMLElement).id === 'logoutBtn') {
            signOut(auth);
        }
        
        if ((e.target as HTMLElement).id === 'addCashBtn') {
            getElement('appModalLabel')!.textContent = 'Add Cash to Wallet';
            getElement('appModalBody')!.innerHTML = `
                <div class="form-group">
                  <label for="addCashAmount" class="form-label">Amount (₹)</label>
                  <input type="number" class="form-control" id="addCashAmount" placeholder="e.g., 100">
                </div>
                <p class="text-secondary small mt-2">This is a simulation. No real payment gateway is integrated.</p>
                <button class="btn btn-success w-100 mt-3" id="confirmAddCashBtn">Add Money</button>`;
            appModalInstance.show();
        }

        if ((e.target as HTMLElement).id === 'withdrawBtn') {
             getElement('appModalLabel')!.textContent = 'Withdraw Balance';
             getElement('appModalBody')!.innerHTML = `
                <div class="form-group mb-3">
                  <label for="withdrawAmount" class="form-label">Amount (₹)</label>
                  <input type="number" class="form-control" id="withdrawAmount" placeholder="e.g., 500">
                </div>
                <div class="form-group">
                  <label for="withdrawMethod" class="form-label">Withdrawal Method (UPI/Bank)</label>
                  <input type="text" class="form-control" id="withdrawMethod" placeholder="Enter your UPI ID or Account No.">
                </div>
                <p class="text-secondary small mt-2">Withdrawal requests are processed within 24 hours.</p>
                <button class="btn btn-warning w-100 mt-3" id="confirmWithdrawBtn">Request Withdrawal</button>`;
            appModalInstance.show();
        }
        
        if ((e.target as HTMLElement).id === 'confirmAddCashBtn') {
            handleAddCash();
        }

        if ((e.target as HTMLElement).id === 'confirmWithdrawBtn') {
            handleWithdraw();
        }
    });
}

function attachTournamentTabListeners(gameId: string) {
    const tabsContainer = document.querySelector('.tournament-tabs');
    if(tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            // Fix: Cast e.target to Element to use closest
            const tabItem = (e.target as Element).closest('.tab-item');
            if (tabItem && (tabItem as HTMLElement).dataset.status) {
                tabsContainer.querySelector('.active')!.classList.remove('active');
                tabItem.classList.add('active');
                loadTournaments(gameId, (tabItem as HTMLElement).dataset.status!);
            }
        });
    }
}


// --- INITIALIZATION ---
function initApp() {
    try {
        app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        auth = getAuth(app);
        appModalInstance = new bootstrap.Modal(getElement('appModal'));
        attachGlobalListeners();

        onAuthStateChanged(auth, user => {
            showLoader(true);
            if (user) {
                currentUser = user;
                const userRef = ref(db, 'users/' + user.uid);
                onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        userProfile = snapshot.val();
                        updateHeader(userProfile);
                        if (currentSection === 'login-section') {
                            showSection('home-section');
                        }
                    }
                    showLoader(false);
                });
            } else {
                currentUser = null;
                userProfile = {};
                showSection('login-section');
                showLoader(false);
            }
        });
    } catch (error: any) {
        document.body.innerHTML = `<div style="padding:20px; color:red; background: white;">Firebase initialization error: ${error.message}. Please check your firebaseConfig object.</div>`;
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', initApp);
