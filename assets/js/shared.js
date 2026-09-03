// =========================================================
// Refresh / Taf3el - Shared JavaScript Infrastructure
// =========================================================

// --- Global Application State ---
window.currentUser = null;
window.isAdmin = false;
window.pointValueEgp = 0.1;
window.servicePointsMap = {};
window.allFaqs = [];

const APK_DOWNLOAD_URL = "https://www.mediafire.com/REPLACE_WITH_YOUR_APK_LINK";

// =========================================================
// 1. Session Architecture Note:
// - Supabase Auth Session (via supabaseClient.auth.getSession()):
//   The ONLY authoritative user authentication session. Restores logged-in user
//   identity, profile, balance, points, and admin privileges after full page reloads.
// - taf3elSessionId (in localStorage):
//   ANONYMOUS presence identifier for the "online users now" real-time counter.
//   It is completely independent of user login or logout.
// =========================================================

function getPresenceSessionId() {
    let sid = localStorage.getItem('taf3elSessionId');
    if (!sid) {
        sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('sid_' + Date.now() + '_' + Math.random().toString(36).slice(2));
        localStorage.setItem('taf3elSessionId', sid);
    }
    return sid;
}

function startPresenceHeartbeat() {
    if (window.db && typeof window.db.heartbeatPresence === 'function') {
        const sid = getPresenceSessionId();
        window.db.heartbeatPresence(sid);
        setInterval(() => window.db.heartbeatPresence(sid), 25000);
    }
}

// =========================================================
// 2. Data Mapping Helpers
// =========================================================
function mapProfile(p) {
    return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        username: p.username || null,
        balance: parseFloat(p.balance || 0),
        isAdmin: !!p.is_admin,
        isBlocked: !!p.is_blocked,
        registrationDate: p.created_at ? new Date(p.created_at).toLocaleString('ar-EG') : '',
        referralCode: p.referral_code,
        points: p.points || 0,
        referralCount: p.referral_count || 0,
        referredBy: p.referred_by || null,
        avatarUrl: p.avatar_url || null
    };
}

function mapOrder(o) {
    return {
        id: o.id,
        serviceId: o.service_id,
        serviceName: o.service_name,
        contentLink: o.content_link,
        quantity: o.quantity,
        totalPrice: parseFloat(o.total_price),
        notes: o.notes,
        status: o.status,
        timestamp: new Date(o.created_at).toLocaleString('ar-EG'),
        user: o.user_phone,
        userId: o.user_id,
        pointsUsed: o.points_used || 0,
        pointsEarned: o.points_earned || 0,
        cashPaid: o.cash_paid != null ? parseFloat(o.cash_paid) : parseFloat(o.total_price)
    };
}

function mapMessage(m) {
    const adminReplies = (m.message_replies || []).map(r => ({
        from: 'admin',
        content: r.content,
        date: new Date(r.created_at),
        timestamp: new Date(r.created_at).toLocaleString('ar-EG')
    }));
    const clientReplies = (m.message_client_replies || []).map(r => ({
        from: 'client',
        content: r.content,
        date: new Date(r.created_at),
        timestamp: new Date(r.created_at).toLocaleString('ar-EG')
    }));
    const thread = [...adminReplies, ...clientReplies].sort((a, b) => a.date - b.date);
    return {
        id: m.id,
        type: 'contact',
        name: m.name,
        phone: m.user_phone,
        subject: m.subject,
        content: m.content,
        timestamp: new Date(m.created_at).toLocaleString('ar-EG'),
        user: m.user_phone,
        status: m.status,
        startedByAdmin: !!m.started_by_admin,
        replies: thread
    };
}

function mapBalanceReq(r) {
    return {
        id: r.id,
        amount: parseFloat(r.amount),
        paymentMethod: r.payment_method,
        transactionId: r.transaction_id,
        transferTo: r.transfer_to,
        proofPath: r.proof_image_url,
        timestamp: new Date(r.created_at).toLocaleString('ar-EG'),
        user: r.user_phone,
        status: r.status
    };
}

function paymentMethodLabel(m) {
    return m === 'telda' ? 'تيلدا' : (m === 'vodafone_cash' ? 'فودافون كاش' : 'غير معروف');
}

// =========================================================
// 3. User Data Loader (Single Shared Session Restorer)
// =========================================================
async function loadUserData() {
    if (!window.db) return;
    try {
        const session = await window.db.getSession();
        if (!session || !session.user) {
            hideUserProfile();
            hideAdminAccess();
            window.currentUser = null;
            window.isAdmin = false;
            window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: { user: null } }));
            return;
        }

        const profileRaw = await window.db.fetchProfile(session.user.id);
        const profile = mapProfile(profileRaw);

        if (profile.isBlocked) {
            await window.db.signOut();
            window.currentUser = null;
            window.isAdmin = false;
            hideUserProfile();
            hideAdminAccess();
            showBlockedUserModal();
            return;
        }

        window.currentUser = profile;
        window.isAdmin = profile.isAdmin;

        const nameEl = document.getElementById('logoUserName');
        if (nameEl) nameEl.textContent = profile.name;
        const phoneEl = document.getElementById('logoUserPhone');
        if (phoneEl) phoneEl.textContent = profile.phone;

        updateHeaderAvatar();
        updateBalanceDisplay();
        showUserProfile();

        if (window.isAdmin) {
            showAdminAccess();
        } else {
            hideAdminAccess();
        }

        window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: { user: window.currentUser, isAdmin: window.isAdmin } }));
    } catch (err) {
        console.error("loadUserData error:", err);
    }
}

function updateBalanceDisplay() {
    if (window.currentUser) {
        const balanceEl = document.getElementById('userBalance');
        if (balanceEl) balanceEl.textContent = formatPrice(window.currentUser.balance);
        const mainB = document.getElementById('currentBalance');
        if (mainB) mainB.textContent = window.currentUser.balance.toFixed(2);
        const ptsEl = document.getElementById('userPoints');
        if (ptsEl) ptsEl.textContent = window.currentUser.points;
    }
}

function showUserProfile() {
    const up = document.getElementById('userProfile');
    if (up) up.classList.remove('hidden');
    const ab = document.getElementById('authButtons');
    if (ab) ab.classList.add('hidden');
    const anm = document.getElementById('accountNavWrapperMobile');
    if (anm) anm.classList.remove('hidden');
    const law = document.getElementById('logoAccountWrapper');
    if (law) law.classList.remove('hidden');
}

function hideUserProfile() {
    const up = document.getElementById('userProfile');
    if (up) up.classList.add('hidden');
    const ab = document.getElementById('authButtons');
    if (ab) ab.classList.remove('hidden');
    const anm = document.getElementById('accountNavWrapperMobile');
    if (anm) anm.classList.add('hidden');
    const law = document.getElementById('logoAccountWrapper');
    if (law) law.classList.add('hidden');
    const lud = document.getElementById('logoUserDropdown');
    if (lud) lud.classList.add('hidden');
}

function showAdminAccess() {
    const an = document.getElementById('adminNav');
    if (an) an.classList.remove('hidden');
    const anm = document.getElementById('adminNavMobile');
    if (anm) anm.classList.remove('hidden');
}

function hideAdminAccess() {
    const an = document.getElementById('adminNav');
    if (an) an.classList.add('hidden');
    const anm = document.getElementById('adminNavMobile');
    if (anm) anm.classList.add('hidden');
}

function toggleLogoUserDropdown() {
    const d = document.getElementById('logoUserDropdown');
    if (d) d.classList.toggle('hidden');
}

function updateHeaderAvatar() {
    const wrapper = document.getElementById('logoUserAvatar');
    if (!wrapper || !window.currentUser) return;
    if (window.currentUser.avatarUrl) {
        wrapper.innerHTML = `<img src="${esc(window.currentUser.avatarUrl)}" alt="${esc(window.currentUser.name || '')}" class="w-10 h-10 rounded-full object-cover">`;
    } else {
        wrapper.innerHTML = `<span class="text-sm font-bold" id="logoUserInitial">${esc((window.currentUser.name || 'U').charAt(0).toUpperCase())}</span>`;
    }
}

function avatarCircleHtml(name, avatarUrl, sizeClass) {
    const safeName = esc(name || '');
    const initial = esc((name || 'U').charAt(0).toUpperCase());
    if (avatarUrl) {
        return `<img src="${esc(avatarUrl)}" alt="${safeName}" class="${sizeClass} rounded-full object-cover" style="border:1px solid var(--border-color-soft);">`;
    }
    return `<div class="${sizeClass} bg-blue-500 rounded-full flex items-center justify-center font-bold">${initial}</div>`;
}

// =========================================================
// 4. Security & Sanitization Utilities
// =========================================================
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function safeHref(url) {
    try {
        const u = new URL(url, location.origin);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '#';
    } catch {
        return '#';
    }
}

function escJsAttr(str) {
    return String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

function round2(n) { return Math.round(n * 100) / 100; }

// =========================================================
// 5. Toast Notifications & Sound FX
// =========================================================
function showNotification(message, type = 'info') {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'fixed top-4 left-4 z-50 space-y-2';
        document.body.appendChild(container);
    }
    const n = document.createElement('div');
    const bg = { 'success': 'bg-green-600', 'error': 'bg-red-600', 'warning': 'bg-yellow-600', 'info': 'bg-blue-600' }[type] || 'bg-blue-600';
    n.className = `notification ${bg} text-white p-4 rounded-lg shadow-lg max-w-sm flex justify-between items-center transition-opacity duration-300`;
    n.innerHTML = `<div class="pr-2">${message}</div><button onclick="this.parentElement.remove()" class="ml-2 text-xl font-bold opacity-75 hover:opacity-100">×</button>`;
    container.appendChild(n);
    setTimeout(() => {
        n.classList.add('opacity-0');
        setTimeout(() => n.remove(), 300);
    }, 5000);
}

function playPurchaseSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        [[1046.5, 0], [1568, 0.09]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.28);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.3);
        });
        setTimeout(() => ctx.close(), 700);
    } catch (e) { /* ignore */ }
}

async function copyToClipboard(text, btnEl) {
    const originalHTML = btnEl.innerHTML;
    const showCopiedState = () => {
        btnEl.innerHTML = `<i class="fa-solid fa-check"></i><span>${window.currentLang === 'en' ? 'Copied' : 'اتنسخ ✓'}</span>`;
        btnEl.classList.add('copy-success');
        setTimeout(() => { btnEl.innerHTML = originalHTML; btnEl.classList.remove('copy-success'); }, 1800);
    };
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            showCopiedState();
            return;
        }
        throw new Error('clipboard-api-unavailable');
    } catch (err) {
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = text;
            tempInput.style.position = 'fixed';
            tempInput.style.top = '0';
            tempInput.style.opacity = '0';
            document.body.appendChild(tempInput);
            tempInput.focus();
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            showCopiedState();
        } catch (fallbackErr) {
            showNotification(td('تعذر نسخ القيمة تلقائيًا، انسخها يدويًا'), 'error');
        }
    }
}

// =========================================================
// 6. Language Support (Arabic / English)
// =========================================================
const translations = {
    ar: {
        nav_home: '🏠 الرئيسية', nav_orders: '📦 طلباتي', nav_orders_noicon: 'طلباتي', nav_referral: '🎁 دعوة صديق', nav_support: '🎧 الدعم الفني',
        nav_app: '📱 تحميل التطبيق', logout_btn: '🚪 تسجيل الخروج', copy_btn: 'نسخ',
        header_tagline: 'منصة تزويد خدمات السوشيال ميديا', currency_label: 'العملة', balance_label: 'الرصيد: ', points_unit: 'نقطة',
        watch_ad_earn_points_title: 'شاهد إعلان واكسب نقط', topup_balance_btn: '💳 شحن الرصيد', header_login_btn: '🔑 تسجيل الدخول',
        header_signup_btn: '📝 إنشاء حساب', menu_aria_label: 'القائمة', nav_admin_panel: '⚙️ لوحة التحكم', earn_points_btn: '🎬 اكسب نقط',
        hero_title: 'مرحباً بك في Refresh', hero_subtitle: 'أفضل منصة لتزويد خدمات السوشيال ميديا بأسعار منافسة وجودة عالية', browse_services: 'تصفح الخدمات',
        login_title: '🔑 تسجيل الدخول', login_subtitle: 'مرحباً بعودتك إلى Refresh', phone_label: 'رقم الهاتف', phone_placeholder: 'أدخل رقم هاتفك',
        password_label: 'كلمة المرور', password_placeholder: 'أدخل كلمة المرور', remember_me: 'تذكرني', login_btn: 'تسجيل الدخول',
        no_account: 'ليس لديك حساب؟', signup_link: 'إنشاء حساب جديد',
        signup_title: '📝 إنشاء حساب جديد', full_name_label: 'الاسم الكامل', full_name_placeholder: 'أدخل اسمك الكامل',
        strong_password_placeholder: 'أدخل كلمة مرور قوية', confirm_password_label: 'تأكيد كلمة المرور', confirm_password_placeholder: 'أعد إدخال كلمة المرور',
        password_strength_weak: 'ضعيف', password_strength_medium: 'متوسط', password_strength_good: 'كويس', password_strength_very_strong: 'قوي جدًا',
        referral_code_label: 'كود الدعوة (اختياري)', referral_code_placeholder: 'لو حد رشحلك الموقع اكتب كوده هنا', signup_btn: 'إنشاء الحساب',
        have_account: 'لديك حساب بالفعل؟', login_link: 'تسجيل الدخول',
        trust1_title: 'تفاعل حقيقي', trust1_desc: 'جودة مضمونة على كل الطلبات', trust2_title: 'تنفيذ سريع', trust2_desc: 'التسليم عادة خلال ساعة بإذن الله',
        trust3_title: 'شحن مرن', trust3_desc: 'فودافون كاش أو تيلدا',
        stat_today: 'طلب تم تنفيذه النهاردة', stat_total_orders: 'طلب منذ انطلاق الموقع', stat_total_customers: 'عميل مسجل', stat_support: 'دعم فني',
        content_link_label: 'رابط المحتوى', quantity_label: 'الكمية', notes_label: 'ملاحظات (اختياري)', notes_placeholder: 'أي ملاحظات إضافية...',
        discount_code_label: 'كود خصم (اختياري)', discount_code_placeholder: 'اكتب الكود لو عندك', check_btn: 'تحقق',
        total_price_label: 'إجمالي السعر:', order_service_btn: 'طلب الخدمة',
        new_message_title: 'إرسال رسالة جديدة', subject_label: 'الموضوع', message_label: 'الرسالة',
        app_download_title: 'حمّل تطبيق تفعيل', app_download_desc: 'نفس الموقع بالظبط، في تطبيق واحد على جهازك — نفس حسابك ونفس رصيدك.',
        app_download_btn: '⬇️ تحميل APK', app_download_note: 'التطبيق لأجهزة Android فقط حاليًا. لازم تسمح بـ "التثبيت من مصادر غير معروفة" أول مرة.',
        profile_title: '👤 الملف الشخصي', change_password_title: '🔒 تغيير كلمة المرور', current_password_label: 'كلمة المرور الحالية',
        new_password_label: 'كلمة المرور الجديدة', confirm_new_password_label: 'تأكيد كلمة المرور الجديدة', change_password_btn: 'تغيير كلمة المرور',
        phone_or_username_label: 'رقم الهاتف أو اليوزر نيم', phone_or_username_placeholder: 'أدخل رقم هاتفك أو اليوزر نيم',
        phone_format_hint: 'لازم يكون 11 رقم ويبدأ بـ 01', username_label: 'اليوزر نيم', username_placeholder: 'اختر يوزر نيم خاص بيك',
        username_format_hint: 'من 3 لـ 20 خانة، ولازم يحتوي على حرف ورقم على الأقل (والرمز المميز . _ - اختياري)',
        username_checking: '⏳ بيتم التحقق...', username_available: '✅ اليوزر نيم متاح', username_taken: '❌ اليوزر نيم ده مأخوذ، جرب واحد تاني',
        username_check_error: '⚠️ حصل خطأ في التحقق، حاول تاني', username_missing_prefix: 'لسه ناقص: ',
        username_missing_length: 'الطول من 3 لـ 20 خانة', username_missing_letter: 'حرف واحد على الأقل', username_missing_number: 'رقم واحد على الأقل',
        username_invalid_chars: 'يسمح فقط بحروف إنجليزية وأرقام ورموز (. _ -)',
        edit_profile_title: '✏️ تعديل البيانات الشخصية', save_changes_btn: '💾 حفظ التعديلات', change_avatar_btn: '📷 تغيير الصورة', avatar_format_hint: 'JPG أو PNG أو WEBP، بحد أقصى 5 ميجا',
        adblock_modal_title: 'محتاجين نوقف أداة حجب الإعلانات',
        adblock_modal_desc: 'لاحظنا إن عندك إضافة حجب إعلانات (Ad Blocker) شغالة في المتصفح. عشان تقدر تستخدم الموقع بشكل طبيعي، من فضلك وقّف الإضافة دي لهذا الموقع وبعدين اعمل تحديث للصفحة.',
        adblock_reload_btn: '🔄 أعدت التحميل بعد إيقافها',
        services_section_title: '🎵 خدمات تيك توك 🎵', individual_prices_title: '📌 الأسعار الفردية:', packages_title: '📦 الباقات الجاهزة للتفاعل:',
        details_btn: 'تفاصيل', badge_most_popular: '⭐ الأكثر طلبًا',
        svc_views10k_title: '👁️ 10,000 مشاهدة', svc_likes1k_title: '❤️ 1,000 لايك', svc_saves100_title: '🔖 100 حفظ',
        svc_shares100_title: '🔗 100 مشاركة', svc_followers1k_title: '👤 100 متابع',
        svc_repost100_title: '🔁 100 إعادة نشر (Repost)',
        pkg_beginner_title: '🌱 الباقة الأساسية', pkg_beginner_f1: '7,500 مشاهدة', pkg_beginner_f2: '500 لايك', pkg_beginner_f3: '13 حفظ', pkg_beginner_f4: '30 مشاركة', pkg_beginner_f5: '100 إعادة نشر',
        pkg_basic_title: '🚀 باقة الانطلاقة', pkg_basic_f1: '15,000 مشاهدة', pkg_basic_f2: '750 لايك', pkg_basic_f3: '25 حفظ', pkg_basic_f4: '80 مشاركة', pkg_basic_f5: '250 إعادة نشر',
        pkg_intensive_title: '📈 باقة الصعود', pkg_intensive_f1: '25,000 مشاهدة', pkg_intensive_f2: '1,500 لايك', pkg_intensive_f3: '50 حفظ', pkg_intensive_f4: '130 مشاركة', pkg_intensive_f5: '500 إعادة نشر',
        pkg_focused_title: '🔥 باقة التريند', pkg_focused_f1: '50,000 مشاهدة', pkg_focused_f2: '2,500 لايك', pkg_focused_f3: '75 حفظ', pkg_focused_f4: '250 مشاركة', pkg_focused_f5: '1000 إعادة نشر',
        pkg_elite_title: '📡 باقة الانتشار', pkg_elite_f1: '100,000 مشاهدة', pkg_elite_f2: '5,000 لايك', pkg_elite_f3: '125 حفظ', pkg_elite_f4: '400 مشاركة', pkg_elite_f5: '1500 إعادة نشر',
        pkg_vip_title: '👑 باقة النخبة', pkg_vip_f1: '250,000 مشاهدة', pkg_vip_f2: '10,000 لايك', pkg_vip_f3: '250 حفظ', pkg_vip_f4: '750 مشاركة', pkg_vip_f5: '2500 إعادة نشر',
        status_all: 'جميع الحالات', status_pending: 'في الانتظار', status_processing: 'قيد التنفيذ', status_completed: 'مكتمل', status_cancelled: 'ملغي',
        user_info_title: 'معلومات المستخدم', whatsapp_contact: 'تواصل معنا مباشرة على واتساب',
        previous_conversations_title: 'المحادثات السابقة', no_previous_conversations: 'لا توجد محادثات سابقة',
        ask_question_title: '❓ اسأل سؤالك (إجابة فورية)', faq_search_placeholder: 'اكتب سؤالك هنا... مثلاً: هل الخدمة آمنة؟',
        subject_placeholder: 'موضوع الرسالة', message_placeholder: 'اكتب رسالتك هنا...', send_message_btn: 'إرسال الرسالة',
        admin_dashboard_title: '⭐ لوحة التحكم الإدارية ⭐', admin_new_orders: 'طلبات جديده',
        admin_tab_new_orders: 'الطلبات الجديدة', admin_tab_active_orders: 'الطلبات النشطة', admin_tab_completed_orders: 'الطلبات المكتملة',
        admin_tab_cancelled_orders: 'الطلبات الملغاة', admin_tab_new_balance_requests: 'طلبات الشحن الجديدة', admin_tab_completed_balance_requests: 'طلبات الشحن المكتملة',
        admin_tab_customers_info: 'معلومات العملاء',
        th_customer_name: 'الاسم', th_customer_phone: 'رقم الهاتف', th_customer_balance: 'الرصيد', th_customer_orders_count: 'عدد الطلبات',
        th_customer_reg_date: 'تاريخ التسجيل', th_customer_actions: 'الإجراءات',
        ph_admin_chat_subject: 'مثال: بخصوص طلبك الأخير', ph_admin_chat_content: 'اكتب رسالتك للعميل...',
        ph_transaction_id: 'أدخل رقم الهاتف أو اليوزر',
        ph_faq_question: 'مثلاً: هل الخدمة آمنة على حسابي؟', ph_faq_keywords: 'آمن, أمان, حظر, حساب',
        blocked_modal_title: 'تم حظر هذا الحساب', blocked_modal_desc: 'حسابك محظور حاليًا ومينفعش تدخل بيه على الموقع. لو حاسس إن ده غلط أو عايز تستفسر، تواصل مع فريق الدعم:', close_btn: 'إغلاق',
        toggle_password_aria: 'إظهار/إخفاء كلمة المرور',
        balance_modal_title: '💰 شحن الرصيد', charge_amount_label: 'المبلغ (جنيه)', payment_method_label: 'طريقة الدفع',
        select_payment_method_option: 'اختر طريقة الدفع', vodafone_cash_option: 'فودافون كاش', telda_option: 'تيلدا (Telda)',
        vodafone_transfer_instruction: 'حوّل مبلغ الشحن على رقم فودافون كاش:', telda_transfer_instruction: 'حوّل مبلغ الشحن على يوزر تيلدا:',
        transaction_id_label: 'رقم الهاتف الذي تم التحويل منه', payment_proof_label: 'صورة تأكيد التحويل (اختياري)',
        payment_proof_hint: 'إرفاق سكرين شوت للتحويل (فودافون كاش أو تيلدا) بيسرّع تأكيد الطلب.', balance_submit_btn: 'إرسال طلب الشحن',
        referral_earnings_modal_title: '📋 تفاصيل أرباح الدعوة',
        use_points_checkbox_label: '🎯 ادفع جزء من الطلب بنقاطك (متاح: ', points_will_use_label: 'هتستخدم: ', points_discount_label: 'جنيه خصم',
        contact_user_not_logged_in: 'المستخدم: غير مسجل دخول',
        admin_tab_contact_messages: 'رسائل العملاء', admin_tab_completed_messages: 'رسائل مكتملة', admin_tab_faq_management: '❓ الأسئلة الشائعة',
        faq_admin_title: '❓ إدارة الأسئلة الشائعة (الرد الآلي)',
        faq_admin_desc: 'لما عميل يسأل سؤال قريب من الكلمات المفتاحية، هيظهرله الرد ده أوتوماتيك من غير ما ينتظرك. لو معملتش تطابق، هيتحول لتذكرة دعم عادية.',
        faq_question_label: 'السؤال', faq_keywords_label: 'كلمات مفتاحية (افصل بينها بفاصلة)', faq_answer_label: 'الإجابة',
        faq_submit_add_btn: 'إضافة سؤال', faq_cancel_edit_btn: 'إلغاء التعديل',
        discount_admin_title: '🏷️ أكواد الخصم', discount_percentage_label: 'نسبة الخصم %', discount_expiry_label: 'تاريخ انتهاء (اختياري)',
        discount_linked_services_label: 'مرتبط بخدمات معينة', discount_select_all: '✅ تحديد الكل', discount_generate_btn: '🎲 توليد كود خصم جديد'
    },
    en: {
        nav_home: '🏠 Home', nav_orders: '📦 My Orders', nav_orders_noicon: 'My Orders', nav_referral: '🎁 Invite a Friend', nav_support: '🎧 Support',
        nav_app: '📱 Get the App', logout_btn: '🚪 Log Out', copy_btn: 'Copy',
        header_tagline: 'Social Media Growth Services Platform', currency_label: 'Currency', balance_label: 'Balance: ', points_unit: 'points',
        watch_ad_earn_points_title: 'Watch an ad and earn points', topup_balance_btn: '💳 Top Up Balance', header_login_btn: '🔑 Log In',
        header_signup_btn: '📝 Sign Up', menu_aria_label: 'Menu', nav_admin_panel: '⚙️ Admin Panel', earn_points_btn: '🎬 Earn Points',
        hero_title: 'Welcome to Refresh', hero_subtitle: 'The best platform for social media growth services — great prices, great quality', browse_services: 'Browse Services',
        login_title: '🔑 Log In', login_subtitle: 'Welcome back to Refresh', phone_label: 'Phone Number', phone_placeholder: 'Enter your phone number',
        password_label: 'Password', password_placeholder: 'Enter your password', remember_me: 'Remember me', login_btn: 'Log In',
        no_account: "Don't have an account?", signup_link: 'Create a new account',
        signup_title: '📝 Create New Account', full_name_label: 'Full Name', full_name_placeholder: 'Enter your full name',
        strong_password_placeholder: 'Enter a strong password', confirm_password_label: 'Confirm Password', confirm_password_placeholder: 'Re-enter your password',
        password_strength_weak: 'Weak', password_strength_medium: 'Medium', password_strength_good: 'Good', password_strength_very_strong: 'Very Strong',
        referral_code_label: 'Referral Code (optional)', referral_code_placeholder: "If someone referred you, enter their code", signup_btn: 'Create Account',
        have_account: 'Already have an account?', login_link: 'Log In',
        trust1_title: 'Real Engagement', trust1_desc: 'Guaranteed quality on every order', trust2_title: 'Fast Delivery', trust2_desc: 'Usually delivered within an hour, God willing',
        trust3_title: 'Flexible Top-up', trust3_desc: 'Vodafone Cash or Telda',
        stat_today: 'orders completed today', stat_total_orders: 'orders since launch', stat_total_customers: 'registered customers', stat_support: 'support',
        content_link_label: 'Content Link', quantity_label: 'Quantity', notes_label: 'Notes (optional)', notes_placeholder: 'Any additional notes...',
        discount_code_label: 'Discount Code (optional)', discount_code_placeholder: 'Enter your code if you have one', check_btn: 'Check',
        total_price_label: 'Total Price:', order_service_btn: 'Order Service',
        new_message_title: 'Send New Message', subject_label: 'Subject', message_label: 'Message',
        app_download_title: 'Download the Refresh App', app_download_desc: "Same site, one app on your device — same account, same balance.",
        app_download_btn: '⬇️ Download APK', app_download_note: 'Android only for now. You may need to allow "install from unknown sources" the first time.',
        profile_title: '👤 My Profile', change_password_title: '🔒 Change Password', current_password_label: 'Current Password',
        new_password_label: 'New Password', confirm_new_password_label: 'Confirm New Password', change_password_btn: 'Change Password',
        services_section_title: '🎵 TikTok Services 🎵', individual_prices_title: '📌 Individual Prices:', packages_title: '📦 Ready-Made Engagement Packages:',
        details_btn: 'Details', badge_most_popular: '⭐ Most Popular',
        svc_views10k_title: '👁️ 10,000 Views', svc_likes1k_title: '❤️ 1,000 Likes', svc_saves100_title: '🔖 100 Saves',
        svc_shares100_title: '🔗 100 Shares', svc_followers1k_title: '👤 100 Followers',
        svc_repost100_title: '🔁 100 Reposts',
        pkg_beginner_title: '🌱 Foundation Package', pkg_beginner_f1: '7,500 Views', pkg_beginner_f2: '500 Likes', pkg_beginner_f3: '13 Saves', pkg_beginner_f4: '30 Shares', pkg_beginner_f5: '100 Reposts',
        pkg_basic_title: '🚀 Launch Package', pkg_basic_f1: '15,000 Views', pkg_basic_f2: '750 Likes', pkg_basic_f3: '25 Saves', pkg_basic_f4: '80 Shares', pkg_basic_f5: '250 Reposts',
        pkg_intensive_title: '📈 Rise Package', pkg_intensive_f1: '25,000 Views', pkg_intensive_f2: '1,500 Likes', pkg_intensive_f3: '50 Saves', pkg_intensive_f4: '130 Shares', pkg_intensive_f5: '500 Reposts',
        pkg_focused_title: '🔥 Trend Package', pkg_focused_f1: '50,000 Views', pkg_focused_f2: '2,500 Likes', pkg_focused_f3: '75 Saves', pkg_focused_f4: '250 Shares', pkg_focused_f5: '1,000 Reposts',
        pkg_elite_title: '📡 Reach Package', pkg_elite_f1: '100,000 Views', pkg_elite_f2: '5,000 Likes', pkg_elite_f3: '125 Saves', pkg_elite_f4: '400 Shares', pkg_elite_f5: '1,500 Reposts',
        pkg_vip_title: '👑 Elite Package', pkg_vip_f1: '250,000 Views', pkg_vip_f2: '10,000 Likes', pkg_vip_f3: '250 Saves', pkg_vip_f4: '750 Shares', pkg_vip_f5: '2,500 Reposts',
        status_all: 'All Statuses', status_pending: 'Pending', status_processing: 'Processing', status_completed: 'Completed', status_cancelled: 'Cancelled',
        user_info_title: 'User Info', whatsapp_contact: 'Contact us directly on WhatsApp',
        previous_conversations_title: 'Previous Conversations', no_previous_conversations: 'No previous conversations',
        ask_question_title: '❓ Ask Your Question (instant answer)', faq_search_placeholder: 'Type your question here... e.g. Is the service safe?',
        subject_placeholder: 'Message subject', message_placeholder: 'Type your message here...', send_message_btn: 'Send Message',
        admin_dashboard_title: '⭐ Admin Dashboard ⭐', admin_new_orders: 'New Orders',
        admin_tab_new_orders: 'New Orders', admin_tab_active_orders: 'Active Orders', admin_tab_completed_orders: 'Completed Orders',
        admin_tab_cancelled_orders: 'Cancelled Orders', admin_tab_new_balance_requests: 'New Top-Up Requests', admin_tab_completed_balance_requests: 'Completed Top-Up Requests',
        admin_tab_customers_info: 'Customer Info',
        th_customer_name: 'Name', th_customer_phone: 'Phone Number', th_customer_balance: 'Balance', th_customer_orders_count: 'Orders Count',
        th_customer_reg_date: 'Registration Date', th_customer_actions: 'Actions',
        ph_admin_chat_subject: 'e.g.: About your recent order', ph_admin_chat_content: 'Type your message to the customer...',
        ph_transaction_id: 'Enter the phone number or username',
        ph_faq_question: 'e.g.: Is this service safe for my account?', ph_faq_keywords: 'safe, security, ban, account',
        blocked_modal_title: 'This account is blocked', blocked_modal_desc: 'Your account is currently blocked and you cannot log in. If you think this is a mistake or have a question, contact our support team:', close_btn: 'Close',
        phone_or_username_label: 'Phone number or username', phone_or_username_placeholder: 'Enter your phone number or username',
        phone_format_hint: 'Must be 11 digits starting with 01', username_label: 'Username', username_placeholder: 'Choose your username',
        username_format_hint: '3–20 characters, must include at least one letter and one number (special character . _ - is optional)',
        username_checking: '⏳ Checking...', username_available: '✅ Username available', username_taken: '❌ This username is taken, try another one',
        username_check_error: '⚠️ Something went wrong while checking, try again', username_missing_prefix: 'Still missing: ',
        username_missing_length: '3–20 characters long', username_missing_letter: 'at least one letter', username_missing_number: 'at least one number',
        username_invalid_chars: 'Only English letters, numbers and symbols (. _ -) are allowed',
        edit_profile_title: '✏️ Edit personal info', save_changes_btn: '💾 Save changes', change_avatar_btn: '📷 Change Photo', avatar_format_hint: 'JPG, PNG or WEBP, max 5 MB',
        adblock_modal_title: 'Please disable your ad blocker',
        adblock_modal_desc: 'We noticed an ad blocker extension is active in your browser. To use the site normally, please disable it for this site and refresh the page.',
        adblock_reload_btn: '🔄 Reload after disabling it',
        toggle_password_aria: 'Show/hide password',
        balance_modal_title: '💰 Top Up Balance', charge_amount_label: 'Amount (EGP)', payment_method_label: 'Payment Method',
        select_payment_method_option: 'Select payment method', vodafone_cash_option: 'Vodafone Cash', telda_option: 'Telda',
        vodafone_transfer_instruction: 'Transfer the top-up amount to this Vodafone Cash number:', telda_transfer_instruction: 'Transfer the top-up amount to this Telda username:',
        transaction_id_label: 'The phone number you transferred from', payment_proof_label: 'Transfer confirmation screenshot (optional)',
        payment_proof_hint: 'Attaching a screenshot of the transfer (Vodafone Cash or Telda) speeds up order confirmation.', balance_submit_btn: 'Submit Top-Up Request',
        referral_earnings_modal_title: '📋 Referral Earnings Details',
        use_points_checkbox_label: '🎯 Pay part of the order with your points (available: ', points_will_use_label: 'You will use: ', points_discount_label: 'EGP discount',
        contact_user_not_logged_in: 'User: Not logged in',
        admin_tab_contact_messages: 'Customer Messages', admin_tab_completed_messages: 'Completed Messages', admin_tab_faq_management: '❓ FAQ',
        faq_admin_title: '❓ FAQ Management (Auto-Reply)',
        faq_admin_desc: 'When a customer asks a question close to the keywords, they automatically get this answer without waiting for you. If nothing matches, it turns into a regular support ticket.',
        faq_question_label: 'Question', faq_keywords_label: 'Keywords (comma-separated)', faq_answer_label: 'Answer',
        faq_submit_add_btn: 'Add Question', faq_cancel_edit_btn: 'Cancel Edit',
        discount_admin_title: '🏷️ Discount Codes', discount_percentage_label: 'Discount Percentage %', discount_expiry_label: 'Expiry Date (optional)',
        discount_linked_services_label: 'Linked to Specific Services', discount_select_all: '✅ Select All', discount_generate_btn: '🎲 Generate New Discount Code'
    }
};

const dynamicTranslations = {
    'هذا الحساب محظور': 'This account is blocked',
    'تم تسجيل الدخول بنجاح': 'Logged in successfully',
    'بيانات الدخول غير صحيحة': 'Incorrect login details',
    'كلمات المرور غير متطابقة': 'Passwords do not match',
    'كلمة المرور لازم تكون من 6 لـ 15 حرف/رقم': 'Password must be between 6 and 15 characters',
    'كلمة المرور الجديدة لازم تكون من 6 لـ 15 حرف/رقم': 'New password must be between 6 and 15 characters',
    'تم إنشاء الحساب بنجاح! ابدأ الآن بطلب خدماتك الأولى.': 'Account created successfully! Start ordering your first service now.',
    'رقم الهاتف مستخدم بالفعل': 'This phone number is already in use',
    'رقم الهاتف أو اليوزر نيم مستخدم بالفعل': 'This phone number or username is already in use',
    'رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01': 'Phone number must be 11 digits and start with 01',
    'اليوزر نيم لازم يكون من 3 لـ 20 خانة، ويحتوي على حرف ورقم على الأقل': 'Username must be 3-20 characters and contain at least one letter and one number',
    'لازم تستنى نتيجة التحقق من اليوزر نيم الأول': 'Please wait for the username check to finish first',
    'اليوزر نيم ده مستخدم بالفعل، اختار واحد تاني': 'This username is already taken, choose another one',
    'اليوزر نيم ده مستخدم بالفعل': 'This username is already taken',
    'تم حفظ التعديلات بنجاح': 'Changes saved successfully',
    'لازم تكتب الاسم': 'Please enter your name',
    'رقم التليفون ده مستخدم بالفعل': 'This phone number is already in use',
    'حصل خطأ، حاول تاني': 'Something went wrong, please try again',
    'لسه شغالة، أوقفها أولاً من إعدادات المتصفح للموقع ده': 'It’s already running — stop it first from your browser settings for this site',
    'لازم تسجل دخول الأول': 'You need to log in first',
    'كلمة المرور الجديدة وتأكيدها مش متطابقين': 'New password and confirmation do not match',
    'تم تغيير كلمة المرور بنجاح': 'Password changed successfully',
    'كلمة المرور الحالية غير صحيحة': 'Current password is incorrect',
    'اتنسخ الرابط': 'Link copied',
    'يجب تسجيل الدخول أولاً لإنشاء طلب': 'You must log in first to place an order',
    'حصل خطأ أثناء إرسال الطلب': 'An error occurred while submitting the order',
    'يجب تسجيل الدخول أولاً لإرسال رسالة': 'You must log in first to send a message',
    'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً': 'Your message was sent successfully! We will contact you soon',
    'تم إرسال رسالتك، هنرد عليك في أقرب وقت': 'Your message has been sent — we will reply as soon as possible',
    'يجب تسجيل الدخول أولاً': 'You must log in first',
    'يرجى اختيار طريقة الدفع وإدخال البيانات المطلوبة': 'Please choose a payment method and enter the required details',
    'سجل دخول أولاً بحساب الأدمن، ثم اضغط على أيقونة لوحة التحكم': 'Log in with the admin account first, then tap the dashboard icon',
    'هذا الحساب ليس حساب أدمن': 'This account is not an admin account',
    'تم الدخول': 'Logged in',
    'تمت إضافة السؤال': 'Question added',
    'تم الحذف': 'Deleted',
    'تم الإلغاء': 'Cancelled',
    'اكتب سعر صرف صحيح': 'Enter a valid exchange rate',
    'العميل غير موجود في قايمة العملاء المحمّلة': 'Customer not found in the loaded customer list',
    'تم إرسال الرسالة للعميل': 'Message sent to the customer',
    'حصل خطأ أثناء إرسال الرسالة': 'An error occurred while sending the message',
    'تم تحديد كلمة مرور مؤقتة جديدة للعميل بنجاح — ابعتهالها بنفسك': 'A new temporary password has been set for the customer — send it to them yourself',
    'حصل خطأ أثناء إعادة تعيين كلمة المرور': 'An error occurred while resetting the password',
    'تم التحديث': 'Updated',
    'تم بدء التنفيذ': 'Processing started',
    'انتهى': 'Completed',
    'مرفوض': 'Rejected',
    'ملغي': 'Cancelled',
    'تم رفع الحظر عن العميل': 'Customer unblocked',
    'تم حذف حساب العميل نهائيًا': 'Customer account permanently deleted',
    'تم حذف الطلب': 'Order deleted',
    'تم حذف طلب الشحن': 'Top-up request deleted',
    'تم حذف الرسالة': 'Message deleted',
    'تم تسجيل الخروج': 'Logged out',
    'غير مصرح': 'Not authorized',
    'الرصيد غير كافي': 'Insufficient balance',
    'الطلب غير موجود': 'Order not found',
    'أقل مبلغ للشحن هو 5 جنيه': 'The minimum top-up amount is 5 EGP',
    'تم إرسال طلب الشحن بنجاح!': 'Top-up request submitted successfully!',
    'تم تحديث صورة البروفايل بنجاح': 'Profile photo updated successfully',
    'حصل خطأ أثناء رفع الصورة، حاول تاني': 'An error occurred while uploading the photo, try again'
};

window.currentLang = 'ar';
function t(key) { return (translations[window.currentLang] && translations[window.currentLang][key]) || key; }
function td(text) {
    if (window.currentLang !== 'en' || !text) return text;
    return dynamicTranslations[text] || text;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

function setLanguage(lang) {
    window.currentLang = lang;
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.toggle('lang-en', lang === 'en');
    localStorage.setItem('taf3el_lang', lang);
    const label = lang === 'ar' ? '🌐 AR' : '🌐 EN';
    const b1 = document.getElementById('langToggleBtn'), b2 = document.getElementById('langToggleBtnMobile');
    if (b1) b1.textContent = label;
    if (b2) b2.textContent = label;
    applyTranslations();
    applyCurrencyToPrices();
}

function toggleLanguage() {
    setLanguage(window.currentLang === 'ar' ? 'en' : 'ar');
}

function initLanguage() {
    const saved = localStorage.getItem('taf3el_lang');
    setLanguage(saved || 'ar');
}

// =========================================================
// 7. Multi-Currency System
// =========================================================
window.currentCurrency = 'EGP';
window.currencyRates = { EGP: 1, SAR: 1, USD: 1, EUR: 1, AED: 1, KWD: 1, QAR: 1, JOD: 1 };

async function loadCurrencyRates() {
    if (!window.db) return;
    try {
        const rates = await window.db.fetchCurrencyRates();
        window.currencyRates = { EGP: 1 };
        (rates || []).forEach(r => { window.currencyRates[r.currency_code] = parseFloat(r.rate_per_egp); });
    } catch (err) { /* ignore */ }
    applyCurrencyToPrices();
}

function setCurrency(code) {
    window.currentCurrency = code;
    localStorage.setItem('taf3el_currency', code);
    const sel1 = document.getElementById('currencySelect');
    const sel2 = document.getElementById('currencySelectMobile');
    if (sel1) sel1.value = code;
    if (sel2) sel2.value = code;
    applyCurrencyToPrices();
    if (typeof window.calculateTotalPrice === 'function') window.calculateTotalPrice();
}

function currencySymbol(code) {
    if (window.currentLang === 'en') return code;
    return { EGP: 'ج.م', SAR: 'ر.س', USD: '$', EUR: '€', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', JOD: 'د.أ' }[code] || code;
}

function formatPrice(egpAmount) {
    const rate = window.currencyRates[window.currentCurrency] || 1;
    const converted = egpAmount * rate;
    return `${converted.toFixed(2)} ${currencySymbol(window.currentCurrency)}`;
}

function applyCurrencyToPrices() {
    document.querySelectorAll('.price-egp').forEach(el => {
        const egp = parseFloat(el.dataset.egp);
        if (!isNaN(egp)) el.textContent = formatPrice(egp);
    });
    updateBalanceDisplay();
}

function initCurrency() {
    const saved = localStorage.getItem('taf3el_currency');
    window.currentCurrency = saved || 'EGP';
    const sel1 = document.getElementById('currencySelect');
    const sel2 = document.getElementById('currencySelectMobile');
    if (sel1) sel1.value = window.currentCurrency;
    if (sel2) sel2.value = window.currentCurrency;
    loadCurrencyRates();
}

// =========================================================
// 8. Auth, Modals & Password Utilities
// =========================================================
function showLoginModal() { const m = document.getElementById('loginModal'); if (m) m.classList.remove('hidden'); }
function hideLoginModal() { const m = document.getElementById('loginModal'); if (m) m.classList.add('hidden'); }
function showSignupModal() {
    const m = document.getElementById('signupModal');
    if (m) m.classList.remove('hidden');
    resetUsernameCheckState();
    resetPasswordStrengthMeter('signupPasswordStrength');
}
function hideSignupModal() {
    const m = document.getElementById('signupModal');
    if (m) m.classList.add('hidden');
    resetUsernameCheckState();
    resetPasswordStrengthMeter('signupPasswordStrength');
}
function showBlockedUserModal() { const m = document.getElementById('blockedUserModal'); if (m) m.classList.remove('hidden'); }
function hideBlockedUserModal() { const m = document.getElementById('blockedUserModal'); if (m) m.classList.add('hidden'); }
function showAdminModal() {
    if (window.isAdmin) {
        window.location.href = "/admin/index.html";
    } else {
        const m = document.getElementById('adminModal');
        if (m) m.classList.remove('hidden');
    }
}
function hideAdminModal() { const m = document.getElementById('adminModal'); if (m) m.classList.add('hidden'); }
function showAppDownloadModal() {
    const link = document.getElementById('appDownloadLink');
    if (link) link.href = APK_DOWNLOAD_URL;
    const m = document.getElementById('appDownloadModal');
    if (m) m.classList.remove('hidden');
}
function hideAppDownloadModal() { const m = document.getElementById('appDownloadModal'); if (m) m.classList.add('hidden'); }
function showAdBlockerModal() {
    const m = document.getElementById('adBlockerModal');
    if (m) m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    const icon = document.getElementById('mobileMenuIcon');
    if (icon) icon.textContent = isHidden ? '✕' : '☰';
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.add('hidden');
    const icon = document.getElementById('mobileMenuIcon');
    if (icon) icon.textContent = '☰';
}

function togglePasswordField(btn) {
    const input = btn.previousElementSibling;
    if (!input || input.tagName !== 'INPUT') return;
    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    btn.textContent = willShow ? '🙈' : '👁️';
    btn.setAttribute('aria-label', willShow ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
}

const PASSWORD_STRENGTH_LEVELS = ['weak', 'medium', 'good', 'very_strong'];
const COMMON_WEAK_PASSWORDS = new Set([
    'password', '12345678', '123456789', '1234567890', '123456', '111111', '000000',
    '12345', 'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'abc123', 'admin',
    'welcome', 'letmein', 'monkey', 'dragon', 'football', 'master', 'iloveyou', '123123',
    '1q2w3e4r', '1qaz2wsx', 'password1', 'pass1234', 'changeme', 'trustno1', 'qwerty123'
]);

function calculatePasswordStrength(password) {
    if (!password) return null;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    let levelIndex = 0;
    if (hasDigit && hasSymbol && hasUpper && hasLower) levelIndex = 3;
    else if (hasDigit && (hasUpper || hasLower)) levelIndex = 2;
    else if (hasUpper && hasLower) levelIndex = 1;
    else levelIndex = 0;

    const lower = password.toLowerCase();
    if (COMMON_WEAK_PASSWORDS.has(lower)) return PASSWORD_STRENGTH_LEVELS[0];

    return PASSWORD_STRENGTH_LEVELS[levelIndex];
}

let signupPasswordStrengthLevel = null;

function updatePasswordStrengthMeter(fieldId, meterId) {
    const input = document.getElementById(fieldId);
    const meter = document.getElementById(meterId);
    if (!input || !meter) return;
    const fill = meter.querySelector('.password-strength-bar-fill');
    const label = meter.querySelector('.password-strength-label');
    const level = calculatePasswordStrength(input.value);

    if (fieldId === 'signupPassword') {
        signupPasswordStrengthLevel = level;
        const submitBtn = document.getElementById('signupSubmitBtn');
        if (submitBtn) submitBtn.disabled = !(usernameCheckState === 'available' && (level === 'good' || level === 'very_strong'));
    }

    if (!level) {
        meter.classList.add('hidden');
        if (fill) fill.className = 'password-strength-bar-fill';
        if (label) { label.className = 'password-strength-label'; label.textContent = ''; }
        return;
    }

    meter.classList.remove('hidden');
    if (fill) fill.className = 'password-strength-bar-fill strength-' + level;
    if (label) {
        label.className = 'password-strength-label strength-' + level;
        label.textContent = t('password_strength_' + level);
    }
}

function resetPasswordStrengthMeter(meterId) {
    const meter = document.getElementById(meterId);
    if (!meter) return;
    if (meterId === 'signupPasswordStrength') signupPasswordStrengthLevel = null;
    meter.classList.add('hidden');
    const fill = meter.querySelector('.password-strength-bar-fill');
    const label = meter.querySelector('.password-strength-label');
    if (fill) fill.className = 'password-strength-bar-fill';
    if (label) { label.className = 'password-strength-label'; label.textContent = ''; }
}

// --- Live Username Check ---
const USERNAME_ALLOWED_CHARS_REGEX = /^[A-Za-z0-9_.-]*$/;
const USERNAME_HAS_LETTER_REGEX = /[A-Za-z]/;
const USERNAME_HAS_NUMBER_REGEX = /[0-9]/;
const USERNAME_FULL_REGEX = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9_.-]{3,20}$/;
let usernameCheckTimeout = null;
let usernameCheckToken = 0;
let usernameCheckState = null;

function getUsernameFormatIssues(username) {
    const issues = [];
    if (!USERNAME_ALLOWED_CHARS_REGEX.test(username)) {
        issues.push(t('username_invalid_chars'));
        return issues;
    }
    if (username.length < 3 || username.length > 20) issues.push(t('username_missing_length'));
    if (!USERNAME_HAS_LETTER_REGEX.test(username)) issues.push(t('username_missing_letter'));
    if (!USERNAME_HAS_NUMBER_REGEX.test(username)) issues.push(t('username_missing_number'));
    return issues;
}

function setUsernameCheckStatus(state, message) {
    usernameCheckState = state;
    const el = document.getElementById('usernameCheckStatus');
    if (el) {
        const colorClass = {
            checking: 'text-yellow-400', available: 'text-green-400',
            taken: 'text-red-400', invalid: 'text-slate-400', error: 'text-yellow-400'
        }[state] || 'text-slate-400';
        el.className = 'text-xs mt-1 ' + colorClass;
        el.textContent = message || '';
    }
    const btn = document.getElementById('signupSubmitBtn');
    if (btn) btn.disabled = !(state === 'available' && (signupPasswordStrengthLevel === 'good' || signupPasswordStrengthLevel === 'very_strong'));
}

function resetUsernameCheckState() {
    clearTimeout(usernameCheckTimeout);
    usernameCheckToken++;
    setUsernameCheckStatus(null, '');
}

function handleUsernameInput() {
    const usernameInput = document.getElementById('signupUsername');
    if (!usernameInput) return;
    const username = usernameInput.value.trim();
    clearTimeout(usernameCheckTimeout);
    usernameCheckToken++;
    const myToken = usernameCheckToken;

    if (!username) {
        setUsernameCheckStatus(null, '');
        return;
    }

    const issues = getUsernameFormatIssues(username);
    if (issues.length > 0) {
        const separator = window.currentLang === 'ar' ? '، ' : ', ';
        setUsernameCheckStatus('invalid', t('username_missing_prefix') + issues.join(separator));
        return;
    }

    setUsernameCheckStatus('checking', t('username_checking'));

    usernameCheckTimeout = setTimeout(async () => {
        try {
            const taken = await window.db.isUsernameTaken(username);
            if (myToken !== usernameCheckToken) return;
            setUsernameCheckStatus(taken ? 'taken' : 'available', taken ? t('username_taken') : t('username_available'));
        } catch (err) {
            if (myToken !== usernameCheckToken) return;
            setUsernameCheckStatus('error', t('username_check_error'));
        }
    }, 450);
}

// --- Login & Signup Handlers ---
async function handleLogin(e) {
    e.preventDefault();
    const identifier = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
        const profile = mapProfile(await window.db.signIn(identifier, password));
        if (profile.isBlocked) {
            await window.db.signOut();
            window.currentUser = null;
            window.isAdmin = false;
            hideLoginModal();
            showBlockedUserModal();
            return;
        }
        window.currentUser = profile;
        window.isAdmin = profile.isAdmin;

        updateHeaderAvatar();
        updateBalanceDisplay();
        showUserProfile();
        if (window.isAdmin) showAdminAccess();

        hideLoginModal();
        showNotification(td('تم تسجيل الدخول بنجاح'), 'success');
        e.target.reset();

        window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: { user: window.currentUser, isAdmin: window.isAdmin } }));
    } catch (err) {
        showNotification(td('بيانات الدخول غير صحيحة'), 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const phone = document.getElementById('signupPhone').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!isValidEgyptPhone(phone)) {
        showNotification(td('رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01'), 'error');
        return;
    }
    if (!USERNAME_FULL_REGEX.test(username)) {
        showNotification(td('اليوزر نيم لازم يكون من 3 لـ 20 خانة، ويحتوي على حرف ورقم على الأقل'), 'error');
        return;
    }
    if (usernameCheckState !== 'available') {
        showNotification(td('لازم تستنى نتيجة التحقق من اليوزر نيم الأول'), 'error');
        return;
    }
    if (password !== confirmPassword) {
        showNotification(td('كلمات المرور غير متطابقة'), 'error');
        return;
    }
    if (password.length < 6 || password.length > 15) {
        showNotification(td('كلمة المرور لازم تكون من 6 لـ 15 حرف/رقم'), 'error');
        return;
    }
    const signupStrength = calculatePasswordStrength(password);
    if (signupStrength !== 'good' && signupStrength !== 'very_strong') {
        showNotification(td('كلمة المرور لازم تكون على الأقل "كويس" أو "قوي جدًا" حسب مؤشر القوة'), 'error');
        return;
    }

    const referralCode = document.getElementById('signupReferralCode').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
        if (await window.db.isUsernameTaken(username)) {
            showNotification(td('اليوزر نيم ده مستخدم بالفعل، اختار واحد تاني'), 'error');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        const profile = mapProfile(await window.db.signUp(name, phone, password, referralCode, username));
        window.currentUser = profile;
        window.isAdmin = false;

        updateHeaderAvatar();
        updateBalanceDisplay();
        showUserProfile();
        hideSignupModal();
        showNotification(td('تم إنشاء الحساب بنجاح! ابدأ الآن بطلب خدماتك الأولى.'), 'success');
        e.target.reset();

        window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: { user: window.currentUser, isAdmin: false } }));
    } catch (err) {
        const msg = (err.message || '').includes('duplicate') || (err.message || '').includes('registered')
            ? td('رقم الهاتف أو اليوزر نيم مستخدم بالفعل') : (td(err.message) || td('حصل خطأ، حاول تاني'));
        showNotification(msg, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    if (!window.currentUser) {
        showNotification(td('سجل دخول أولاً بحساب الأدمن، ثم اضغط على أيقونة لوحة التحكم'), 'error');
        return;
    }
    if (!window.currentUser.isAdmin) {
        showNotification(td('هذا الحساب ليس حساب أدمن'), 'error');
        return;
    }
    window.isAdmin = true;
    hideAdminModal();
    window.location.href = "/admin/index.html";
}

async function logout() {
    if (window.db) await window.db.signOut();
    window.currentUser = null;
    window.isAdmin = false;
    hideUserProfile();
    hideAdminAccess();
    showNotification(td('تم تسجيل الخروج'), 'success');
    window.location.href = "/index.html";
}

// =========================================================
// 9. Ad Watch & Points
// =========================================================
let adTimerInterval = null;

async function loadPointsConfig() {
    if (!window.db) return;
    try {
        const [pv, sp] = await Promise.all([window.db.fetchPointValue(), window.db.fetchServicePoints()]);
        window.pointValueEgp = pv;
        window.servicePointsMap = sp || {};
    } catch (err) { /* ignore */ }
}

function detectAdBlocker(callback) {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-placement textads banner_ads';
    bait.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:1px; height:1px;';
    document.body.appendChild(bait);
    setTimeout(() => {
        const blocked = (bait.offsetParent === null || bait.offsetHeight === 0 || bait.clientHeight === 0 || getComputedStyle(bait).display === 'none');
        document.body.removeChild(bait);
        callback(blocked);
    }, 120);
}

function recheckAdBlocker() {
    detectAdBlocker(blocked => {
        if (!blocked) {
            const w = document.getElementById('adBlockerWarning');
            if (w) w.classList.add('hidden');
            const b = document.getElementById('adWatchBody');
            if (b) b.classList.remove('hidden');
            startAdTimer();
        } else {
            showNotification(td('لسه شغالة، أوقفها أولاً من إعدادات المتصفح للموقع ده'), 'warning');
        }
    });
}

function showAdWatchModal() {
    if (!window.currentUser) {
        showNotification(td('لازم تسجل دخول الأول'), 'warning');
        showLoginModal();
        return;
    }
    const m = document.getElementById('adWatchModal');
    if (m) m.classList.remove('hidden');
    detectAdBlocker(blocked => {
        const w = document.getElementById('adBlockerWarning');
        const b = document.getElementById('adWatchBody');
        if (blocked) {
            if (w) w.classList.remove('hidden');
            if (b) b.classList.add('hidden');
        } else {
            if (w) w.classList.add('hidden');
            if (b) b.classList.remove('hidden');
            startAdTimer();
        }
    });
}

function startAdTimer() {
    const btn = document.getElementById('adTimerBtn');
    if (!btn) return;
    btn.disabled = true;
    let seconds = 30;
    let tabWasHidden = false;
    btn.textContent = `⏳ استنى ${seconds} ثانية...`;
    clearInterval(adTimerInterval);

    const visibilityHandler = () => {
        if (document.hidden) tabWasHidden = true;
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    adTimerInterval = setInterval(() => {
        if (tabWasHidden) {
            clearInterval(adTimerInterval);
            document.removeEventListener('visibilitychange', visibilityHandler);
            seconds = 30;
            btn.textContent = '↩️ سبت الصفحة، اضغط تاني وسيبها فاتحة';
            btn.disabled = false;
            btn.onclick = startAdTimer;
            return;
        }
        seconds--;
        if (seconds <= 0) {
            clearInterval(adTimerInterval);
            document.removeEventListener('visibilitychange', visibilityHandler);
            btn.disabled = false;
            btn.textContent = '🎁 خد نقطك دلوقتي';
            btn.onclick = claimAdPoints;
        } else {
            btn.textContent = `⏳ استنى ${seconds} ثانية...`;
        }
    }, 1000);
}

function hideAdWatchModal() {
    const m = document.getElementById('adWatchModal');
    if (m) m.classList.add('hidden');
    clearInterval(adTimerInterval);
}

async function claimAdPoints() {
    const btn = document.getElementById('adTimerBtn');
    if (btn) btn.disabled = true;
    try {
        const result = await window.db.claimAdPoints();
        window.currentUser.points += result.points;
        window.currentUser.balance += result.cash;
        updateBalanceDisplay();
        showNotification(window.currentLang === 'en' ? `🎉 You earned ${result.points} points (${result.cash.toFixed(2)} EGP)!` : `🎉 كسبت ${result.points} نقطة (${result.cash.toFixed(2)} جنيه)!`, 'success');
        hideAdWatchModal();
    } catch (err) {
        showNotification(td(err.message), 'error');
        if (btn) btn.disabled = false;
    }
}

// =========================================================
// 10. Auto-Init on Shared Load
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // OS Platform detection
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    document.documentElement.classList.toggle('os-ios', isIOS);
    document.documentElement.classList.toggle('os-android', isAndroid);

    initLanguage();
    initCurrency();
    loadPointsConfig();
    startPresenceHeartbeat();

    // Check for referral param in URL
    const refCode = new URLSearchParams(window.location.search).get('ref');
    if (refCode) {
        const refInput = document.getElementById('signupReferralCode');
        if (refInput) refInput.value = refCode;
        showSignupModal();
    }

    // Attach form listeners if present in DOM
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLogin);

    const signupUsername = document.getElementById('signupUsername');
    if (signupUsername) signupUsername.addEventListener('input', handleUsernameInput);

    // Close user dropdown when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('#logoUserAvatar')) {
            const dropdown = document.getElementById('logoUserDropdown');
            if (dropdown) dropdown.classList.add('hidden');
        }
        if (!e.target.closest('#mobileMenu') && !e.target.closest('.mobile-menu-btn')) {
            closeMobileMenu();
        }
    });

    // Run user session restoration
    loadUserData();
});
