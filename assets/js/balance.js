// =========================================================
// Refresh - Balance Top-Up Page Logic (balance.js)
// =========================================================

function togglePaymentMethodInfo() {
    const methodEl = document.getElementById('paymentMethod');
    if (!methodEl) return;
    const method = methodEl.value;
    
    const vf = document.getElementById('vodafoneInfo');
    if (vf) vf.classList.toggle('hidden', method !== 'vodafone_cash');
    const tdEl = document.getElementById('teldaInfo');
    if (tdEl) tdEl.classList.toggle('hidden', method !== 'telda');

    const label = document.getElementById('transactionIdLabel');
    const input = document.getElementById('transactionId');
    if (method === 'telda') {
        if (label) label.textContent = window.currentLang === 'en' ? 'Your Telda username (sent from)' : 'يوزر تيلدا بتاعك (اللي حولت منه)';
        if (input) input.placeholder = window.currentLang === 'en' ? 'Enter your Telda username' : 'أدخل يوزر تيلدا بتاعك';
    } else {
        if (label) label.textContent = window.currentLang === 'en' ? 'The phone number you transferred from' : 'رقم الهاتف الذي تم التحويل منه';
        if (input) input.placeholder = window.currentLang === 'en' ? 'Enter the phone number' : 'أدخل رقم الهاتف';
    }
}
window.togglePaymentMethodInfo = togglePaymentMethodInfo;

async function handleBalanceCharge(e) {
    e.preventDefault();
    if (!window.currentUser) {
        showNotification(td('يجب تسجيل الدخول أولاً'), 'error');
        showLoginModal();
        return;
    }

    const amountInput = document.getElementById('chargeAmount');
    const amount = parseFloat(amountInput ? amountInput.value : 0);
    const methodEl = document.getElementById('paymentMethod');
    const paymentMethod = methodEl ? methodEl.value : '';
    const txInput = document.getElementById('transactionId');
    const transactionId = txInput ? txInput.value.trim() : '';
    const transferTo = paymentMethod === 'telda' ? 'joefix' : (paymentMethod === 'vodafone_cash' ? '01013062296' : '');

    if (!paymentMethod || !transactionId) {
        showNotification(td('يرجى اختيار طريقة الدفع وإدخال البيانات المطلوبة'), 'error');
        return;
    }
    if (isNaN(amount) || amount < 5) {
        showNotification(td('أقل مبلغ للشحن هو 5 جنيه'), 'error');
        return;
    }

    const submitBtn = document.getElementById('balanceSubmitBtn');
    const fileInput = document.getElementById('paymentProofFile');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = window.currentLang === 'en' ? 'Submitting...' : 'جاري الإرسال...';
    }

    try {
        let proofUrl = null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
            proofUrl = await window.db.uploadPaymentProof(window.currentUser.id, fileInput.files[0]);
        }
        await window.db.createBalanceRequest({
            amount,
            paymentMethod,
            transactionId,
            transferTo,
            proofUrl
        });

        showNotification(td('تم إرسال طلب الشحن بنجاح!'), 'success');
        e.target.reset();
        togglePaymentMethodInfo();
        loadUserBalanceHistory();
    } catch (err) {
        showNotification(td(err.message) || td('حصل خطأ، حاول تاني'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}

async function loadUserBalanceHistory() {
    const list = document.getElementById('balanceHistoryList');
    if (!list) return;

    if (!window.currentUser) {
        list.innerHTML = `<p class="text-slate-400 text-center py-4">${window.currentLang === 'en' ? 'Log in to view top-up history' : 'سجل دخول لعرض سجل الشحن'}</p>`;
        return;
    }

    try {
        // Balance requests for current user
        const { data, error } = await supabaseClient
            .from("balance_requests")
            .select("*")
            .eq("user_id", window.currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        const requests = (data || []).map(mapBalanceReq);

        if (requests.length === 0) {
            list.innerHTML = `<p class="text-slate-400 text-center py-6">${window.currentLang === 'en' ? 'No balance requests yet' : 'لا توجد طلبات شحن سابقة'}</p>`;
            return;
        }

        list.innerHTML = requests.map(r => {
            const statusColor = r.status === 'completed' ? 'success' : (r.status === 'cancelled' ? 'error' : 'warning');
            const statusText = r.status === 'completed' ? (window.currentLang === 'en' ? 'Approved' : 'تم القبول')
                : (r.status === 'cancelled' ? (window.currentLang === 'en' ? 'Rejected' : 'مرفوض')
                : (window.currentLang === 'en' ? 'Pending' : 'قيد المراجعة'));

            return `
                <div class="bg-slate-800/40 rounded-lg p-4 border border-slate-700 flex justify-between items-center flex-wrap gap-2">
                    <div>
                        <div class="font-bold text-lg text-green-400">${r.amount.toFixed(2)} ${window.currentLang === 'en' ? 'EGP' : 'جنيه'}</div>
                        <div class="text-xs text-slate-400 mt-1">${paymentMethodLabel(r.paymentMethod)} - ${r.timestamp}</div>
                    </div>
                    <span class="badge badge-${statusColor}">${statusText}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("loadUserBalanceHistory error:", err);
    }
}

window.addEventListener('userDataLoaded', () => {
    loadUserBalanceHistory();
    const curBal = document.getElementById('currentBalanceDisplay');
    if (curBal && window.currentUser) {
        curBal.textContent = formatPrice(window.currentUser.balance);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('balanceForm');
    if (form) form.addEventListener('submit', handleBalanceCharge);
    togglePaymentMethodInfo();
});
