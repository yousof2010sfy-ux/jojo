// =========================================================
// Refresh - Referral Program Page Logic (referral.js)
// =========================================================

async function populateReferralData() {
    const authReq = document.getElementById('referralAuthRequired');
    const mainContent = document.getElementById('referralMainContent');

    if (!window.currentUser) {
        if (authReq) authReq.classList.remove('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        return;
    }

    if (authReq) authReq.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');

    const code = window.currentUser.referralCode || '-';
    const link = `${window.location.origin}/index.html?ref=${code}`;

    const codeEl = document.getElementById('myReferralCode');
    if (codeEl) codeEl.textContent = code;

    const linkEl = document.getElementById('myReferralLink');
    if (linkEl) linkEl.value = link;

    try {
        const stats = await window.db.fetchReferralStats();
        if (stats) {
            const friendsEl = document.getElementById('referralStatsFriends');
            if (friendsEl) friendsEl.textContent = (stats.total_friends || 0).toLocaleString();

            const activeEl = document.getElementById('referralStatsActive');
            if (activeEl) activeEl.textContent = (stats.activated_friends || 0).toLocaleString();

            const earnEl = document.getElementById('referralStatsEarnings');
            if (earnEl) earnEl.textContent = `${(stats.total_earned_egp || 0).toFixed(2)} ${window.currentLang === 'en' ? 'EGP' : 'جنيه'}`;

            const tierEl = document.getElementById('referralStatsTier');
            if (tierEl) tierEl.textContent = `${stats.current_rate_percent || 5}%`;
        }
    } catch (e) {
        console.error("fetchReferralStats error:", e);
    }

    loadReferralFriends();
    loadReferralEarnings();
}

async function loadReferralFriends() {
    const container = document.getElementById('referralFriendsList');
    if (!container) return;

    try {
        const friends = await window.db.fetchReferralFriends();
        if (!friends || friends.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-center py-4">${window.currentLang === 'en' ? 'No invited friends yet' : 'لم تقم بدعوة أصدقاء بعد'}</p>`;
            return;
        }

        container.innerHTML = friends.map(f => `
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <div>
                    <div class="font-semibold text-sm">${esc(f.name || f.username || (window.currentLang === 'en' ? 'Friend' : 'صديق'))}</div>
                    <div class="text-xs text-slate-400">${f.created_at ? new Date(f.created_at).toLocaleDateString(window.currentLang === 'ar' ? 'ar-EG' : 'en-US') : ''}</div>
                </div>
                <div>
                    ${f.activated
                        ? `<span class="badge badge-success">${window.currentLang === 'en' ? 'Active' : 'مفعّل'}</span>`
                        : `<span class="badge badge-warning">${window.currentLang === 'en' ? 'Registered' : 'مسجل'}</span>`}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("loadReferralFriends error:", err);
    }
}

async function loadReferralEarnings() {
    const container = document.getElementById('referralEarningsList');
    if (!container) return;

    try {
        const earnings = await window.db.fetchReferralEarnings();
        if (!earnings || earnings.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-center py-4">${window.currentLang === 'en' ? 'No earnings recorded yet' : 'لا توجد أرباح مسجلة بعد'}</p>`;
            return;
        }

        container.innerHTML = earnings.map(item => `
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                <div>
                    <div class="font-semibold text-sm text-green-400">+${(item.amount_egp || 0).toFixed(2)} ${window.currentLang === 'en' ? 'EGP' : 'جنيه'}</div>
                    <div class="text-xs text-slate-400">${item.description || (window.currentLang === 'en' ? 'Commission from referral' : 'عمولة من دعوة')} - ${item.created_at ? new Date(item.created_at).toLocaleDateString(window.currentLang === 'ar' ? 'ar-EG' : 'en-US') : ''}</div>
                </div>
                <span class="badge badge-info">${(item.rate_percent || 5)}%</span>
            </div>
        `).join('');
    } catch (err) {
        console.error("loadReferralEarnings error:", err);
    }
}

function copyReferralCode() {
    const code = window.currentUser ? window.currentUser.referralCode : '';
    if (code) {
        copyToClipboard(code, document.getElementById('copyRefCodeBtn'));
    }
}
window.copyReferralCode = copyReferralCode;

function copyReferralLink() {
    const linkEl = document.getElementById('myReferralLink');
    if (linkEl && linkEl.value) {
        copyToClipboard(linkEl.value, document.getElementById('copyRefLinkBtn'));
    }
}
window.copyReferralLink = copyReferralLink;

window.addEventListener('userDataLoaded', () => {
    populateReferralData();
});

document.addEventListener('DOMContentLoaded', () => {
    populateReferralData();
});
