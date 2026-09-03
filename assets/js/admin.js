// =========================================================
// Refresh - Admin Dashboard Logic (admin.js)
// =========================================================

let allOrders = [];
let allBalanceReqs = [];
let allCustomers = [];
let allSupportMessages = [];
let allFaqs = [];
let allDiscounts = [];

function checkAdminAuth() {
    const authBox = document.getElementById('adminAuthError');
    const content = document.getElementById('adminMainContent');

    if (!window.currentUser || window.currentUser.role !== 'admin') {
        if (authBox) authBox.classList.remove('hidden');
        if (content) content.classList.add('hidden');
        return false;
    }

    if (authBox) authBox.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    return true;
}

async function loadAdminDashboard() {
    if (!checkAdminAuth()) return;

    loadAdminOverview();
    loadAdminOrders();
    loadAdminBalanceRequests();
    loadAdminCustomers();
    loadAdminMessages();
    loadAdminSettings();
}

async function loadAdminOverview() {
    try {
        const [totalOrders, completedToday, totalCust, onlineCount] = await Promise.all([
            window.db.fetchTotalOrdersCount().catch(() => 0),
            window.db.fetchCompletedTodayCount().catch(() => 0),
            window.db.fetchTotalCustomersCount().catch(() => 0),
            window.db.fetchOnlineUsersCount().catch(() => 1)
        ]);

        const totalOrdersEl = document.getElementById('statTotalOrders');
        if (totalOrdersEl) totalOrdersEl.textContent = (totalOrders || 0).toLocaleString();

        const compTodayEl = document.getElementById('statCompletedToday');
        if (compTodayEl) compTodayEl.textContent = (completedToday || 0).toLocaleString();

        const custEl = document.getElementById('statTotalCustomers');
        if (custEl) custEl.textContent = (totalCust || 0).toLocaleString();

        const onlineEl = document.getElementById('statOnlineUsers');
        if (onlineEl) onlineEl.textContent = (onlineCount || 1).toLocaleString();
    } catch (e) {
        console.error("Overview stats error:", e);
    }
}

// ---------------- ORDERS ----------------
async function loadAdminOrders() {
    const container = document.getElementById('adminOrdersTable');
    if (!container) return;

    try {
        const data = await window.db.fetchAllOrders();
        allOrders = (data || []).map(mapOrder);
        renderAdminOrders();
    } catch (e) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-400">خطأ في تحميل الطلبات: ${esc(e.message)}</td></tr>`;
    }
}

function renderAdminOrders() {
    const container = document.getElementById('adminOrdersTable');
    if (!container) return;

    const filterStatus = (document.getElementById('adminOrderFilter') || {}).value || '';
    const searchVal = ((document.getElementById('adminOrderSearch') || {}).value || '').toLowerCase();

    const filtered = allOrders.filter(o => {
        const matchesStatus = !filterStatus || o.status === filterStatus;
        const matchesSearch = !searchVal ||
            o.id.toLowerCase().includes(searchVal) ||
            o.serviceName.toLowerCase().includes(searchVal) ||
            (o.notes && o.notes.toLowerCase().includes(searchVal)) ||
            (o.contentLink && o.contentLink.toLowerCase().includes(searchVal));
        return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">لا توجد طلبات تطابق هذا البحث</td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(o => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
            <td class="p-3 text-xs font-mono text-slate-400">${esc(o.id)}</td>
            <td class="p-3 font-semibold text-sm">${esc(o.serviceName)}</td>
            <td class="p-3 text-sm">${o.quantity.toLocaleString()}</td>
            <td class="p-3 text-sm text-green-400 font-bold">${o.totalPrice.toFixed(2)} ج.م</td>
            <td class="p-3">
                ${o.contentLink ? `<a href="${safeHref(o.contentLink)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline text-xs truncate block max-w-[150px]">${esc(o.contentLink)}</a>` : '-'}
            </td>
            <td class="p-3">
                <select class="form-select text-xs py-1 px-2" onchange="updateOrderStatus('${o.id}', this.value)">
                    <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>في الانتظار</option>
                    <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>قيد التنفيذ</option>
                    <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>مكتمل</option>
                    <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                </select>
            </td>
            <td class="p-3 text-left">
                <button onclick="deleteOrder('${o.id}')" class="text-red-400 hover:text-red-300 p-1" title="حذف الطلب">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, status) {
    try {
        await window.db.adminUpdateOrderStatus(orderId, status);
        showNotification('تم تحديث حالة الطلب بنجاح', 'success');
        const item = allOrders.find(x => x.id === orderId);
        if (item) item.status = status;
    } catch (e) {
        showNotification(e.message || 'فشل التحديث', 'error');
        loadAdminOrders();
    }
}
window.updateOrderStatus = updateOrderStatus;

async function deleteOrder(orderId) {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائيًا؟')) return;
    try {
        await window.db.adminDeleteOrder(orderId);
        showNotification('تم حذف الطلب بنجاح', 'success');
        allOrders = allOrders.filter(x => x.id !== orderId);
        renderAdminOrders();
    } catch (e) {
        showNotification(e.message || 'فشل حذف الطلب', 'error');
    }
}
window.deleteOrder = deleteOrder;

// ---------------- BALANCE REQUESTS ----------------
async function loadAdminBalanceRequests() {
    const container = document.getElementById('adminBalanceRequestsTable');
    if (!container) return;

    try {
        const raw = await window.db.fetchAllBalanceRequests();
        allBalanceReqs = (raw || []).map(mapBalanceReq);
        renderAdminBalanceRequests();
    } catch (e) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-400">خطأ في تحميل طلبات الشحن</td></tr>`;
    }
}

function renderAdminBalanceRequests() {
    const container = document.getElementById('adminBalanceRequestsTable');
    if (!container) return;

    if (allBalanceReqs.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">لا توجد طلبات شحن</td></tr>`;
        return;
    }

    container.innerHTML = allBalanceReqs.map(r => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
            <td class="p-3 text-xs font-mono text-slate-400">${esc(r.id)}</td>
            <td class="p-3 font-bold text-green-400">${r.amount.toFixed(2)} ج.م</td>
            <td class="p-3 text-sm">${paymentMethodLabel(r.paymentMethod)}</td>
            <td class="p-3 text-sm font-mono">${esc(r.transactionId)}</td>
            <td class="p-3 text-xs">${r.timestamp}</td>
            <td class="p-3">
                <span class="badge badge-${r.status === 'completed' ? 'success' : (r.status === 'cancelled' ? 'error' : 'warning')}">
                    ${r.status === 'completed' ? 'مقبول' : (r.status === 'cancelled' ? 'مرفوض' : 'في الانتظار')}
                </span>
            </td>
            <td class="p-3 text-left space-x-2 rtl:space-x-reverse">
                ${r.status === 'pending' ? `
                    <button onclick="approveBalanceRequest('${r.id}')" class="btn-primary text-xs py-1 px-3 bg-green-600 hover:bg-green-500">قبول</button>
                    <button onclick="rejectBalanceRequest('${r.id}')" class="text-xs py-1 px-3 bg-red-600/80 hover:bg-red-600 rounded-lg">رفض</button>
                ` : ''}
                <button onclick="deleteBalanceRequest('${r.id}')" class="text-red-400 hover:text-red-300 p-1" title="حذف">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function approveBalanceRequest(id) {
    try {
        await window.db.adminApproveBalanceRequest(id);
        showNotification('تمت الموافقة على طلب الشحن وإضافة الرصيد للعميل', 'success');
        loadAdminBalanceRequests();
    } catch (e) {
        showNotification(e.message || 'فشلت الموافقة', 'error');
    }
}
window.approveBalanceRequest = approveBalanceRequest;

async function rejectBalanceRequest(id) {
    try {
        await window.db.adminRejectBalanceRequest(id);
        showNotification('تم رفض طلب الشحن', 'info');
        loadAdminBalanceRequests();
    } catch (e) {
        showNotification(e.message || 'فشل الرفض', 'error');
    }
}
window.rejectBalanceRequest = rejectBalanceRequest;

async function deleteBalanceRequest(id) {
    if (!confirm('حذف هذا الطلب نهائيًا؟')) return;
    try {
        await window.db.adminDeleteBalanceRequest(id);
        showNotification('تم الحذف', 'success');
        loadAdminBalanceRequests();
    } catch (e) {
        showNotification(e.message || 'فشل الحذف', 'error');
    }
}
window.deleteBalanceRequest = deleteBalanceRequest;

// ---------------- CUSTOMERS ----------------
async function loadAdminCustomers() {
    const container = document.getElementById('adminCustomersTable');
    if (!container) return;

    try {
        const data = await window.db.fetchAllCustomers();
        allCustomers = (data || []).map(mapProfile);
        renderAdminCustomers();
    } catch (e) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-400">خطأ في تحميل العملاء</td></tr>`;
    }
}

function renderAdminCustomers() {
    const container = document.getElementById('adminCustomersTable');
    if (!container) return;

    const searchVal = ((document.getElementById('adminCustomerSearch') || {}).value || '').toLowerCase();
    const filtered = allCustomers.filter(c => {
        return !searchVal ||
            (c.name && c.name.toLowerCase().includes(searchVal)) ||
            (c.phone && c.phone.includes(searchVal)) ||
            (c.username && c.username.toLowerCase().includes(searchVal));
    });

    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">لا يوجد عملاء يطابقون البحث</td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(c => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
            <td class="p-3 font-semibold text-sm">${esc(c.name)}</td>
            <td class="p-3 text-sm font-mono">${esc(c.phone)}</td>
            <td class="p-3 text-xs text-blue-400 font-mono">@${esc(c.username || '-')}</td>
            <td class="p-3 text-sm font-bold text-green-400">${c.balance.toFixed(2)} ج.م</td>
            <td class="p-3 text-sm text-yellow-400">${c.points} نقطة</td>
            <td class="p-3">
                <span class="badge badge-${c.isBlocked ? 'error' : 'success'}">${c.isBlocked ? 'محظور' : 'نشط'}</span>
            </td>
            <td class="p-3 text-left space-x-1 rtl:space-x-reverse">
                <button onclick="promptAddBalance('${c.id}', '${esc(c.name)}')" class="btn-primary text-xs py-1 px-2" title="إضافة رصيد">+ رصيد</button>
                <button onclick="promptDeductBalance('${c.id}', '${esc(c.name)}')" class="text-xs py-1 px-2 bg-slate-700 hover:bg-slate-600 rounded" title="خصم رصيد">- رصيد</button>
                <button onclick="toggleBlockCustomer('${c.id}', ${!c.isBlocked})" class="text-xs py-1 px-2 ${c.isBlocked ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} rounded">
                    ${c.isBlocked ? 'إلغاء الحظر' : 'حظر'}
                </button>
            </td>
        </tr>
    `).join('');
}

async function promptAddBalance(userId, userName) {
    const amtStr = prompt(`أدخل المبلغ المراد إضافته لحساب ${userName}:`);
    if (!amtStr) return;
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) {
        showNotification('يرجى كتابة مبلغ صحيح', 'error');
        return;
    }
    try {
        await window.db.adminAddBalance(userId, amount);
        showNotification(`تم إضافة ${amount} جنيه بنجاح`, 'success');
        loadAdminCustomers();
    } catch (e) {
        showNotification(e.message || 'فشلت الإضافة', 'error');
    }
}
window.promptAddBalance = promptAddBalance;

async function promptDeductBalance(userId, userName) {
    const amtStr = prompt(`أدخل المبلغ المراد خصمه من حساب ${userName}:`);
    if (!amtStr) return;
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) {
        showNotification('يرجى كتابة مبلغ صحيح', 'error');
        return;
    }
    try {
        await window.db.adminDeductBalance(userId, amount);
        showNotification(`تم خصم ${amount} جنيه بنجاح`, 'success');
        loadAdminCustomers();
    } catch (e) {
        showNotification(e.message || 'فشل الخصم', 'error');
    }
}
window.promptDeductBalance = promptDeductBalance;

async function toggleBlockCustomer(userId, block) {
    try {
        await window.db.adminSetBlockStatus(userId, block);
        showNotification(block ? 'تم حظر المستخدم' : 'تم إلغاء الحظر', 'success');
        loadAdminCustomers();
    } catch (e) {
        showNotification(e.message || 'فشلت العملية', 'error');
    }
}
window.toggleBlockCustomer = toggleBlockCustomer;

// ---------------- SUPPORT TICKETS / MESSAGES ----------------
async function loadAdminMessages() {
    const container = document.getElementById('adminMessagesList');
    if (!container) return;

    try {
        const raw = await window.db.fetchAllMessages();
        allSupportMessages = (raw || []).map(mapMessage);
        renderAdminMessages();
    } catch (e) {
        container.innerHTML = `<div class="p-4 text-center text-red-400">خطأ في تحميل رسائل الدعم: ${esc(e.message)}</div>`;
    }
}

function renderAdminMessages() {
    const container = document.getElementById('adminMessagesList');
    if (!container) return;

    if (allSupportMessages.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400">لا توجد رسائل دعم حالياً</div>`;
        return;
    }

    container.innerHTML = allSupportMessages.map(m => `
        <div class="bg-slate-800/60 p-5 rounded-xl border border-slate-700 mb-4 shadow">
            <div class="flex justify-between items-start mb-3 flex-wrap gap-2">
                <div>
                    <h4 class="font-bold text-base text-blue-400">${esc(m.subject)}</h4>
                    <span class="text-xs text-slate-400">${esc(m.name || m.phone || 'مستخدم')} - ${esc(m.timestamp)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="badge badge-${m.status === 'completed' ? 'success' : 'warning'}">${m.status === 'completed' ? 'محلولة' : 'نشطة'}</span>
                    <button onclick="resolveAdminTicket('${m.id}')" class="text-xs py-1 px-2 bg-green-600 hover:bg-green-500 rounded">حل التذكرة</button>
                    <button onclick="deleteAdminTicket('${m.id}')" class="text-red-400 hover:text-red-300 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 mb-3 text-sm">
                <p>${esc(m.content)}</p>
            </div>
            ${(m.replies || []).map(r => `
                <div class="p-2 mb-2 rounded text-xs ${r.from === 'admin' ? 'bg-blue-900/30 border border-blue-700/40 text-blue-200 mr-4' : 'bg-slate-700/40 ml-4'}">
                    <strong>${r.from === 'admin' ? 'رد الإدارة' : 'العميل'}:</strong> ${esc(r.content)}
                </div>
            `).join('')}
            <div class="flex gap-2 mt-3">
                <input type="text" id="adminReplyInput-${m.id}" class="form-input w-full text-sm" placeholder="اكتب رد الدعم الفني...">
                <button onclick="submitAdminReply('${m.id}')" class="btn-primary px-4 py-1 text-sm">إرسال الرد</button>
            </div>
        </div>
    `).join('');
}

async function submitAdminReply(id) {
    const input = document.getElementById(`adminReplyInput-${id}`);
    const content = input ? input.value.trim() : '';
    if (!content) return;

    try {
        await window.db.adminReplyMessage(id, content);
        input.value = '';
        showNotification('تم إرسال الرد للعميل بنجاح', 'success');
        loadAdminMessages();
    } catch (e) {
        showNotification(e.message || 'فشل إرسال الرد', 'error');
    }
}
window.submitAdminReply = submitAdminReply;

async function resolveAdminTicket(id) {
    const notes = prompt('ملاحظات الحل (اختياري):', 'تم حل المشكلة بنجاح');
    try {
        await window.db.adminResolveMessage(id, notes || 'تم الحل');
        showNotification('تم وضع علامة محلولة على التذكرة', 'success');
        loadAdminMessages();
    } catch (e) {
        showNotification(e.message || 'فشلت العملية', 'error');
    }
}
window.resolveAdminTicket = resolveAdminTicket;

async function deleteAdminTicket(id) {
    if (!confirm('حذف هذه التذكرة؟')) return;
    try {
        await window.db.adminDeleteMessage(id);
        showNotification('تم الحذف', 'success');
        loadAdminMessages();
    } catch (e) {
        showNotification(e.message || 'فشل الحذف', 'error');
    }
}
window.deleteAdminTicket = deleteAdminTicket;

// ---------------- SETTINGS & CONFIGS ----------------
async function loadAdminSettings() {
    try {
        const pointVal = await window.db.fetchPointValue().catch(() => 0.05);
        const pointInput = document.getElementById('configPointValue');
        if (pointInput) pointInput.value = pointVal;

        loadAdminFaqs();
        loadAdminDiscounts();
    } catch (e) {
        console.error("loadAdminSettings error:", e);
    }
}

async function savePointValueSetting() {
    const valInput = document.getElementById('configPointValue');
    const val = parseFloat(valInput ? valInput.value : 0.05);
    try {
        await window.db.adminSetPointValue(val);
        showNotification('تم تحديث قيمة النقطة بنجاح', 'success');
    } catch (e) {
        showNotification(e.message || 'فشل التحديث', 'error');
    }
}
window.savePointValueSetting = savePointValueSetting;

async function loadAdminFaqs() {
    const container = document.getElementById('adminFaqsList');
    if (!container) return;
    try {
        allFaqs = await window.db.fetchFaqs();
        container.innerHTML = (allFaqs || []).map(f => `
            <div class="p-3 bg-slate-800/40 rounded-lg border border-slate-700 flex justify-between items-start gap-4">
                <div>
                    <div class="font-bold text-sm text-blue-400">${esc(f.question)}</div>
                    <div class="text-xs text-slate-300 mt-1">${esc(f.answer)}</div>
                    <div class="text-xs text-slate-500 mt-1">الكلمات المفتاحية: ${esc(f.keywords || '-')}</div>
                </div>
                <button onclick="deleteFaqItem('${f.id}')" class="text-red-400 hover:text-red-300 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('') || '<p class="text-xs text-slate-400 py-2">لا توجد أسئلة شائعة مضافة</p>';
    } catch (e) {}
}

async function handleAddFaq(e) {
    e.preventDefault();
    const q = document.getElementById('newFaqQuestion').value.trim();
    const k = document.getElementById('newFaqKeywords').value.trim();
    const a = document.getElementById('newFaqAnswer').value.trim();
    if (!q || !a) return;

    try {
        await window.db.adminAddFaq(q, k, a);
        showNotification('تمت إضافة السؤال بنجاح', 'success');
        e.target.reset();
        loadAdminFaqs();
    } catch (err) {
        showNotification(err.message || 'فشلت الإضافة', 'error');
    }
}

async function deleteFaqItem(id) {
    if (!confirm('حذف هذا السؤال؟')) return;
    try {
        await window.db.adminDeleteFaq(id);
        showNotification('تم الحذف', 'success');
        loadAdminFaqs();
    } catch (e) {
        showNotification(e.message || 'فشل الحذف', 'error');
    }
}
window.deleteFaqItem = deleteFaqItem;

async function loadAdminDiscounts() {
    const container = document.getElementById('adminDiscountsList');
    if (!container) return;
    try {
        allDiscounts = await window.db.fetchDiscountCodes();
        container.innerHTML = (allDiscounts || []).map(d => `
            <div class="p-3 bg-slate-800/40 rounded-lg border border-slate-700 flex justify-between items-center">
                <div>
                    <span class="font-mono font-bold text-green-400">${esc(d.code)}</span>
                    <span class="text-xs text-slate-400 mr-2">خصم ${d.percentage}%</span>
                </div>
                <button onclick="deleteDiscountItem('${d.id}')" class="text-red-400 hover:text-red-300 text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('') || '<p class="text-xs text-slate-400 py-2">لا توجد أكواد خصم نشطة</p>';
    } catch (e) {}
}

async function handleGenerateDiscount(e) {
    e.preventDefault();
    const pct = parseFloat(document.getElementById('discountPercent').value);
    const expDate = document.getElementById('discountExpiresAt').value;
    try {
        const res = await window.db.adminGenerateDiscountCode(pct, null, expDate ? new Date(expDate).toISOString() : null);
        showNotification(`تم إنشاء كود الخصم: ${res ? res.code : ''}`, 'success');
        e.target.reset();
        loadAdminDiscounts();
    } catch (err) {
        showNotification(err.message || 'فشل إنشاء الكود', 'error');
    }
}

async function deleteDiscountItem(id) {
    if (!confirm('حذف هذا الكود؟')) return;
    try {
        await window.db.adminDeleteDiscountCode(id);
        showNotification('تم الحذف', 'success');
        loadAdminDiscounts();
    } catch (e) {
        showNotification(e.message || 'فشل الحذف', 'error');
    }
}
window.deleteDiscountItem = deleteDiscountItem;

// Tab Switching
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active', 'border-blue-500', 'text-blue-400'));

    const tabEl = document.getElementById(`tab-${tabId}`);
    if (tabEl) tabEl.classList.remove('hidden');

    const btnEl = document.getElementById(`tab-btn-${tabId}`);
    if (btnEl) btnEl.classList.add('active', 'border-blue-500', 'text-blue-400');
}
window.switchAdminTab = switchAdminTab;

window.addEventListener('userDataLoaded', () => {
    loadAdminDashboard();
});

document.addEventListener('DOMContentLoaded', () => {
    const faqForm = document.getElementById('addFaqForm');
    if (faqForm) faqForm.addEventListener('submit', handleAddFaq);

    const discountForm = document.getElementById('addDiscountForm');
    if (discountForm) discountForm.addEventListener('submit', handleGenerateDiscount);

    const orderFilter = document.getElementById('adminOrderFilter');
    if (orderFilter) orderFilter.addEventListener('change', renderAdminOrders);

    const orderSearch = document.getElementById('adminOrderSearch');
    if (orderSearch) orderSearch.addEventListener('input', renderAdminOrders);

    const custSearch = document.getElementById('adminCustomerSearch');
    if (custSearch) custSearch.addEventListener('input', renderAdminCustomers);

    loadAdminDashboard();
});
