// =========================================================
// Refresh - Contact / Support Page Logic (contact.js)
// =========================================================

let userMessages = [];

function ticketStatusBadge(m) {
    if (m.status === 'updated_after_resolution') {
        return `<span class="text-xs px-2 py-1 rounded-full" style="background:rgba(168,85,247,0.2); color:#a855f7;">${window.currentLang === 'en' ? '🔄 Updated after resolution' : '🔄 تم تحديثها بعد الحل'}</span>`;
    }
    if (m.status === 'completed') {
        return `<span class="text-xs px-2 py-1 rounded-full" style="background:rgba(16,185,129,0.2); color:#10b981;">${window.currentLang === 'en' ? '✅ Resolved' : '✅ تم الحل'}</span>`;
    }
    const adminHasReplied = m.startedByAdmin || (m.replies && m.replies.some(r => r.from === 'admin'));
    if (adminHasReplied) {
        return `<span class="text-xs px-2 py-1 rounded-full" style="background:rgba(59,130,246,0.2); color:#3b82f6;">${window.currentLang === 'en' ? '🟢 Active' : '🟢 نشط'}</span>`;
    }
    return `<span class="text-xs px-2 py-1 rounded-full" style="background:rgba(251,191,36,0.2); color:#fbbf24;">${window.currentLang === 'en' ? '⏳ Pending' : '⏳ قيد الانتظار'}</span>`;
}

function renderTicketThread(m) {
    return `
        <div class="message-thread">
            ${m.startedByAdmin
                ? `<div class="admin-reply"><div class="message-header text-xs opacity-70 mb-1">${window.currentLang === 'en' ? 'Support Team' : 'الدعم الفني'} - ${esc(m.timestamp)}</div><p>${esc(m.content)}</p></div>`
                : `<div class="user-message"><div class="message-header text-xs opacity-70 mb-1">${esc(m.name || m.phone)} - ${esc(m.timestamp)}</div><p>${esc(m.content)}</p></div>`}
            ${(m.replies || []).map(r => r.from === 'admin'
                ? `<div class="admin-reply"><div class="message-header text-xs opacity-70 mb-1">${window.currentLang === 'en' ? 'Support Team' : 'الدعم الفني'} - ${esc(r.timestamp)}</div><p>${esc(r.content)}</p></div>`
                : `<div class="user-message"><div class="message-header text-xs opacity-70 mb-1">${esc(m.name || m.phone)} - ${esc(r.timestamp)}</div><p>${esc(r.content)}</p></div>`
            ).join('')}
        </div>`;
}

async function loadContactPage() {
    const nameEl = document.getElementById('contactUserName');
    const phoneEl = document.getElementById('contactUserPhone');

    if (window.currentUser) {
        if (nameEl) nameEl.textContent = window.currentLang === 'en' ? `User: ${window.currentUser.name}` : `المستخدم: ${window.currentUser.name}`;
        if (phoneEl) phoneEl.textContent = window.currentLang === 'en' ? `Phone: ${window.currentUser.phone}` : `رقم الهاتف: ${window.currentUser.phone}`;
        loadPreviousMessages();
    } else {
        if (nameEl) nameEl.textContent = window.currentLang === 'en' ? 'User: Not logged in' : 'المستخدم: غير مسجل دخول';
        if (phoneEl) phoneEl.textContent = '';
        const prevContainer = document.getElementById('previousMessages');
        if (prevContainer) {
            prevContainer.innerHTML = `
                <div class="text-center py-6">
                    <p class="text-slate-400">${window.currentLang === 'en' ? 'Please log in to view your support tickets' : 'سجل دخول لعرض تذاكر الدعم الفني السابقة'}</p>
                </div>`;
        }
    }

    if (!window.allFaqs || !window.allFaqs.length) {
        try {
            window.allFaqs = await window.db.fetchFaqs();
        } catch (e) { /* ignore */ }
    }
}

async function loadPreviousMessages() {
    const container = document.getElementById('previousMessages');
    if (!container || !window.currentUser) return;

    try {
        const raw = await window.db.fetchMyMessages(window.currentUser.id);
        userMessages = (raw || []).map(mapMessage);

        if (userMessages.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <div class="text-4xl mb-4">📨</div>
                    <p class="text-slate-400">${t('no_previous_conversations')}</p>
                </div>`;
            return;
        }

        container.innerHTML = userMessages.map(msg => `
            <div class="message-thread bg-slate-800/60 p-4 rounded-xl border border-slate-700 mb-4">
                <div class="flex justify-between items-start mb-3 flex-wrap gap-2">
                    <h4 class="font-semibold text-lg">${esc(msg.subject)}</h4>
                    <div class="flex items-center gap-2">
                        ${ticketStatusBadge(msg)}
                        <span class="text-slate-400 text-xs">${esc(msg.timestamp)}</span>
                    </div>
                </div>
                ${renderTicketThread(msg)}
                <div class="flex gap-2 mt-3">
                    <input type="text" id="ticketReplyInput-${msg.id}" class="form-input w-full" placeholder="${window.currentLang === 'en' ? 'Type a follow-up reply...' : 'اكتب ردًا إضافيًا على نفس التذكرة...'}">
                    <button onclick="sendTicketFollowUp('${msg.id}')" class="btn-primary px-5 py-2">${window.currentLang === 'en' ? 'Send' : 'إرسال'}</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("loadPreviousMessages error:", err);
    }
}

async function sendTicketFollowUp(id) {
    const input = document.getElementById(`ticketReplyInput-${id}`);
    const content = input ? input.value.trim() : '';
    if (!content) return;

    try {
        await window.db.clientReplyMessage(id, content);
        input.value = '';
        showNotification(td('تم إرسال رسالتك، هنرد عليك في أقرب وقت'), 'success');
        loadPreviousMessages();
    } catch (err) {
        showNotification(td(err.message) || td('حصل خطأ، حاول تاني'), 'error');
    }
}
window.sendTicketFollowUp = sendTicketFollowUp;

async function handleContactForm(e) {
    e.preventDefault();
    if (!window.currentUser) {
        showNotification(td('يجب تسجيل الدخول أولاً لإرسال رسالة'), 'error');
        showLoginModal();
        return;
    }

    const submitBtn = document.getElementById('contactSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
    }

    try {
        const subject = document.getElementById('contactSubject').value.trim();
        const content = document.getElementById('contactMessage').value.trim();

        await window.db.createMessage(subject, content);
        showNotification(td('تم إرسال رسالتك بنجاح! سنتواصل معك قريباً'), 'success');
        e.target.reset();
        loadPreviousMessages();
    } catch (err) {
        showNotification(td(err.message) || td('حصل خطأ، حاول تاني'), 'error');
    } finally {
        if (submitBtn) {
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-disabled');
            }, 2000);
        }
    }
}

function handleFaqSearch() {
    const input = document.getElementById('faqSearchInput');
    const query = input ? input.value.trim() : '';
    const resultBox = document.getElementById('faqSearchResult');
    if (!resultBox) return;

    if (query.length < 2) {
        resultBox.classList.add('hidden');
        return;
    }

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    let best = null;
    let bestScore = 0;

    (window.allFaqs || []).forEach(faq => {
        const kws = (faq.keywords || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
        let score = 0;
        kws.forEach(kw => {
            if (kw && (query.toLowerCase().includes(kw) || queryWords.some(w => kw.includes(w)))) {
                score++;
            }
        });
        if (score > bestScore) {
            bestScore = score;
            best = faq;
        }
    });

    if (best && bestScore > 0) {
        resultBox.innerHTML = `
            <div class="admin-card border-green-500 bg-slate-800/80 p-4 rounded-xl border">
                <div class="font-bold text-green-400 mb-2 text-base">${esc(best.question)}</div>
                <p class="text-slate-200 text-sm leading-relaxed">${esc(best.answer)}</p>
                <p class="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-700">${window.currentLang === 'en' ? 'Still need help? Submit a ticket below 👇' : 'لسه محتاج مساعدة؟ ابعت تذكرة دعم من تحت 👇'}</p>
            </div>`;
    } else {
        resultBox.innerHTML = `
            <div class="text-sm text-slate-400 text-center py-3 bg-slate-800/30 rounded-lg border border-slate-700">
                ${window.currentLang === 'en' ? "No ready answer found — send your message below and we'll reply soon." : 'مفيش إجابة جاهزة لسؤالك — ابعته كتذكرة دعم من الفورم تحت وهنرد عليك أول ما نقدر.'}
            </div>`;
    }
    resultBox.classList.remove('hidden');
}
window.handleFaqSearch = handleFaqSearch;

window.addEventListener('userDataLoaded', () => {
    loadContactPage();
});

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) contactForm.addEventListener('submit', handleContactForm);
    loadContactPage();
});
