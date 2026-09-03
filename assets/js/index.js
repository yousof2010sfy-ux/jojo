// =========================================================
// Refresh - Homepage & Service Ordering Logic
// =========================================================

const serviceData = {
    'views_10k': {
        title: '👁️ 10,000 مشاهدة تيك توك',
        price: 15,
        minQuantity: 500,
        description: 'زيادة مشاهدات الفيديو على تيك توك',
        features: ['مشاهدات حقيقية 100%', 'تسليم سريع خلال ساعة', 'ضمان عدم النقصان']
    },
    'likes_1k': {
        title: '❤️ 1,000 لايك تيك توك',
        price: 13.5,
        minQuantity: 50,
        description: 'زيادة الإعجابات على الفيديو',
        features: ['لايكات حقيقية', 'تفاعل طبيعي', 'ضمان الجودة']
    },
    'saves_100': {
        title: '🔖 100 حفظ تيك توك',
        price: 3.5,
        minQuantity: 10,
        description: 'زيادة عدد مرات حفظ الفيديو',
        features: ['حفظ حقيقي', 'تحسين الوصول', 'تسليم سريع']
    },
    'shares_100': {
        title: '🔗 100 مشاركة تيك توك',
        price: 2.5,
        minQuantity: 10,
        description: 'زيادة مشاركات الفيديو',
        features: ['مشاركات حقيقية', 'انتشار أوسع', 'تفاعل طبيعي']
    },
    'followers_1k': {
        title: '👤 100 متابع تيك توك',
        price: 15,
        minQuantity: 10,
        description: 'زيادة المتابعين على الحساب',
        features: ['متابعين حقيقيين', 'نمو طبيعي', 'ضمان عدم الإلغاء']
    },
    'repost_100': {
        title: '🔁 100 إعادة نشر (Repost)',
        price: 10,
        minQuantity: 10,
        description: 'زيادة معدل إعادة نشر الفيديو',
        features: ['إعادة نشر حقيقي', 'انتشار واسع', 'دعم وصول الفيديو']
    },
    'package_beginner': {
        title: '🌱 الباقة الأساسية',
        price: 21.5,
        minQuantity: 1,
        description: 'باقة متميزة للانطلاق',
        features: ['7,500 مشاهدة', '500 لايك', '13 حفظ', '30 مشاركة', '100 إعادة نشر']
    },
    'package_basic': {
        title: '🚀 باقة الانطلاقة',
        price: 45.5,
        minQuantity: 1,
        description: 'باقة أساسية للصعود القوي',
        features: ['15,000 مشاهدة', '750 لايك', '25 حفظ', '80 مشاركة', '250 إعادة نشر']
    },
    'package_intensive': {
        title: '📈 باقة الصعود',
        price: 84.5,
        minQuantity: 1,
        description: 'باقة للانتشار السريع والمكثف',
        features: ['25,000 مشاهدة', '1,500 لايك', '50 حفظ', '130 مشاركة', '500 إعادة نشر']
    },
    'package_focused': {
        title: '🔥 باقة التريند',
        price: 163.5,
        minQuantity: 1,
        description: 'للوصول إلى قائمة التريند',
        features: ['50,000 مشاهدة', '2,500 لايك', '75 حفظ', '250 مشاركة', '1000 إعادة نشر']
    },
    'package_elite': {
        title: '📡 باقة الانتشار',
        price: 286.5,
        minQuantity: 1,
        description: 'باقة النجومية الاحترافية',
        features: ['100,000 مشاهدة', '5,000 لايك', '125 حفظ', '400 مشاركة', '1500 إعادة نشر']
    },
    'package_vip': {
        title: '👑 باقة النخبة',
        price: 590.5,
        minQuantity: 1,
        description: 'باقة المشاهير الكبيرة',
        features: ['250,000 مشاهدة', '10,000 لايك', '250 حفظ', '750 مشاركة', '2500 إعادة نشر']
    }
};

window.serviceData = serviceData;
let appliedDiscount = null;

function scrollToServices() {
    const el = document.getElementById('servicesSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function computeBaseTotal(serviceId, quantity) {
    const service = serviceData[serviceId];
    if (!service) return 0;
    if (serviceId.startsWith("package_")) {
        return service.price * quantity;
    }
    const baseQuantity = parseInt(
        serviceId.includes('views') ? '10000' : 
        serviceId.includes('likes') ? '1000' : 
        serviceId.includes('saves') ? '100' : 
        serviceId.includes('shares') ? '100' : 
        serviceId.includes('followers') ? '100' : 
        serviceId.includes('repost') ? '100' : '1'
    );
    return (service.price / baseQuantity) * quantity;
}

function showServiceDetails(serviceId) {
    const service = serviceData[serviceId];
    if (!service) return;
    
    const modal = document.getElementById('serviceDetailsModal');
    if (!modal) return;

    document.getElementById('serviceTitle').textContent = td(service.title);
    document.getElementById('serviceInfo').innerHTML = `
        <div class="space-y-4">
            <div>
                <h5 class="font-semibold mb-2">${window.currentLang === 'en' ? 'Description' : 'الوصف'}</h5>
                <p class="text-slate-300">${td(service.description)}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h5 class="font-semibold mb-2">${window.currentLang === 'en' ? 'Price' : 'السعر'}</h5>
                    <p class="text-2xl font-bold text-green-400" id="serviceInfoPrice">${formatPrice(service.price)}</p>
                </div>
                <div>
                    <h5 class="font-semibold mb-2">${window.currentLang === 'en' ? 'Minimum Quantity' : 'الحد الأدنى'}</h5>
                    <p class="text-lg font-semibold">${service.minQuantity.toLocaleString()}</p>
                </div>
            </div>
            <div>
                <h5 class="font-semibold mb-2">${window.currentLang === 'en' ? 'Features' : 'المميزات'}</h5>
                <ul class="list-disc list-inside text-slate-300 space-y-1">
                    ${service.features.map(f => `<li>${td(f)}</li>`).join("")}
                </ul>
            </div>
        </div>
    `;
    
    document.getElementById('serviceOrderForm').dataset.serviceId = serviceId;
    appliedDiscount = null;
    const discountInput = document.getElementById('discountCodeInput');
    if (discountInput) discountInput.value = '';
    const discountMsg = document.getElementById('discountCodeMsg');
    if (discountMsg) discountMsg.textContent = '';

    const quantityField = document.getElementById('quantityField');
    const quantityInput = document.getElementById('quantity');
    if (serviceId.startsWith('package_')) {
        if (quantityField) quantityField.style.display = 'none';
        if (quantityInput) quantityInput.value = 1;
    } else {
        if (quantityField) quantityField.style.display = 'block';
        if (quantityInput) quantityInput.value = service.minQuantity;
    }

    const usePointsField = document.getElementById('usePointsField');
    const usePointsCheckbox = document.getElementById('usePointsCheckbox');
    if (usePointsCheckbox) usePointsCheckbox.checked = false;
    const wrap = document.getElementById('pointsUsageInputWrap');
    if (wrap) wrap.classList.add('hidden');
    const pInput = document.getElementById('pointsUsageInput');
    if (pInput) pInput.value = 0;

    if (window.currentUser && window.currentUser.points > 0 && window.pointValueEgp > 0) {
        if (usePointsField) usePointsField.classList.remove('hidden');
        const avail = document.getElementById('availablePointsLabel');
        if (avail) avail.textContent = window.currentUser.points;
    } else {
        if (usePointsField) usePointsField.classList.add('hidden');
    }

    calculateTotalPrice();
    modal.classList.add('show');
}

function closeServiceModal() {
    const modal = document.getElementById('serviceDetailsModal');
    if (modal) modal.classList.remove('show');
}

function calculateTotalPrice() {
    const form = document.getElementById("serviceOrderForm");
    if (!form || !form.dataset.serviceId) return;
    const serviceId = form.dataset.serviceId;
    const service = serviceData[serviceId];
    if (!service) return;
    
    const quantityInput = document.getElementById("quantity");
    let quantity = parseInt(quantityInput.value) || service.minQuantity;
    const quantityError = document.getElementById("quantityError");
    
    if (quantity < service.minQuantity) {
        if (quantityError) {
            quantityError.textContent = window.currentLang === 'en' ? `Minimum: ${service.minQuantity.toLocaleString()}` : `الحد الأدنى: ${service.minQuantity.toLocaleString()}`;
            quantityError.classList.remove("hidden");
        }
        return;
    } else {
        if (quantityError) quantityError.classList.add("hidden");
    }
    
    let totalPrice = computeBaseTotal(serviceId, quantity);
    if (appliedDiscount) totalPrice = totalPrice * (1 - appliedDiscount.percentage / 100);
    totalPrice = parseFloat(totalPrice.toFixed(2));

    const pointsSlider = document.getElementById('pointsUsageInput');
    let pointsUsed = 0;
    const usePointsCheckbox = document.getElementById('usePointsCheckbox');
    if (window.currentUser && window.pointValueEgp > 0 && usePointsCheckbox && usePointsCheckbox.checked && pointsSlider) {
        const maxUsefulPoints = Math.ceil(totalPrice / window.pointValueEgp);
        const maxPoints = Math.max(0, Math.min(window.currentUser.points, maxUsefulPoints));
        pointsSlider.max = maxPoints;
        if (parseInt(pointsSlider.value) > maxPoints) pointsSlider.value = maxPoints;
        pointsUsed = parseInt(pointsSlider.value) || 0;
    }
    const pointsCashValue = Math.min(round2(pointsUsed * window.pointValueEgp), totalPrice);
    const cashDue = round2(totalPrice - pointsCashValue);

    const valEl = document.getElementById('pointsUsageValue');
    if (valEl) valEl.textContent = pointsUsed;
    const cashEl = document.getElementById('pointsUsageCash');
    if (cashEl) cashEl.textContent = pointsCashValue.toFixed(2);

    const tpEl = document.getElementById("totalPrice");
    if (tpEl) tpEl.textContent = formatPrice(totalPrice);

    const breakdown = document.getElementById('priceBreakdown');
    if (breakdown) {
        if (pointsUsed > 0) {
            breakdown.textContent = window.currentLang === 'en'
                ? `From balance: ${cashDue.toFixed(2)} EGP + from points: ${pointsUsed} pts (${pointsCashValue.toFixed(2)} EGP)`
                : `من رصيدك: ${cashDue.toFixed(2)} جنيه + من نقاطك: ${pointsUsed} نقطة (${pointsCashValue.toFixed(2)} جنيه)`;
        } else {
            breakdown.textContent = '';
        }
    }
}
window.calculateTotalPrice = calculateTotalPrice;

function togglePointsUsage() {
    const checked = document.getElementById('usePointsCheckbox')?.checked;
    const wrap = document.getElementById('pointsUsageInputWrap');
    if (wrap) wrap.classList.toggle('hidden', !checked);
    const pInput = document.getElementById('pointsUsageInput');
    if (!checked && pInput) pInput.value = 0;
    calculateTotalPrice();
}

async function applyDiscountCodeToOrder() {
    const form = document.getElementById("serviceOrderForm");
    const serviceId = form?.dataset.serviceId;
    const codeInput = document.getElementById('discountCodeInput');
    const code = codeInput ? codeInput.value.trim() : '';
    const msg = document.getElementById('discountCodeMsg');
    if (!code) {
        appliedDiscount = null;
        if (msg) msg.textContent = '';
        calculateTotalPrice();
        return;
    }
    try {
        const percentage = await window.db.validateDiscountCode(code, serviceId);
        if (percentage) {
            appliedDiscount = { code, percentage };
            if (msg) {
                msg.textContent = `✅ تم تطبيق خصم ${percentage}%`;
                msg.className = 'text-sm mt-1 text-green-400';
            }
        } else {
            appliedDiscount = null;
            if (msg) {
                msg.textContent = '❌ الكود غير صالح لهذه الخدمة';
                msg.className = 'text-sm mt-1 text-red-400';
            }
        }
    } catch (err) {
        appliedDiscount = null;
        if (msg) {
            msg.textContent = '❌ حصل خطأ أثناء التحقق من الكود';
            msg.className = 'text-sm mt-1 text-red-400';
        }
    }
    calculateTotalPrice();
}

async function handleServiceOrder(e) {
    e.preventDefault();
    if (!window.currentUser) {
        showNotification(td('يجب تسجيل الدخول أولاً لإنشاء طلب'), 'error');
        showLoginModal();
        return;
    }
    
    const form = e.target;
    const serviceId = form.dataset.serviceId;
    const service = serviceData[serviceId];
    
    const contentLink = document.getElementById('contentLink').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value);
    const notes = document.getElementById('orderNotes').value.trim();
    
    if (quantity < service.minQuantity) {
        showNotification(window.currentLang === 'en' ? `Minimum quantity: ${service.minQuantity.toLocaleString()}` : `الحد الأدنى للكمية: ${service.minQuantity.toLocaleString()}`, 'error');
        return;
    }
    
    let totalPrice = computeBaseTotal(serviceId, quantity);
    if (appliedDiscount) totalPrice = totalPrice * (1 - appliedDiscount.percentage / 100);
    const finalPrice = parseFloat(totalPrice.toFixed(2));

    let pointsUsed = 0;
    const useCheckbox = document.getElementById('usePointsCheckbox');
    if (window.currentUser.points > 0 && window.pointValueEgp > 0 && useCheckbox && useCheckbox.checked) {
        const maxUsefulPoints = Math.ceil(finalPrice / window.pointValueEgp);
        pointsUsed = Math.max(0, Math.min(window.currentUser.points, maxUsefulPoints, parseInt(document.getElementById('pointsUsageInput')?.value) || 0));
    }
    const pointsCashValue = Math.min(round2(pointsUsed * window.pointValueEgp), finalPrice);
    const cashDue = round2(finalPrice - pointsCashValue);

    if (window.currentUser.balance < cashDue) {
        showNotification(window.currentLang === 'en' ? `Insufficient balance. Current balance: ${window.currentUser.balance.toFixed(2)} EGP` : `رصيدك غير كافٍ. الرصيد الحالي: ${window.currentUser.balance.toFixed(2)} جنيه`, 'error');
        return;
    }

    try {
        const dbOrder = await window.db.placeOrder({
            serviceId,
            contentLink,
            quantity,
            notes,
            discountCode: appliedDiscount ? appliedDiscount.code : null,
            pointsUsed
        });
        const order = mapOrder(dbOrder);
        window.currentUser.balance = parseFloat((window.currentUser.balance - order.cashPaid).toFixed(2));
        window.currentUser.points = window.currentUser.points - order.pointsUsed + order.pointsEarned;
        updateBalanceDisplay();

        closeServiceModal();
        playPurchaseSound();
        showNotification(window.currentLang === 'en' ? `Your order was submitted and ${order.cashPaid.toFixed(2)} EGP was deducted from your balance!` : `تم إرسال طلبك وخصم ${order.cashPaid.toFixed(2)} جنيه من رصيدك بنجاح!`, 'success');
        if (order.pointsEarned > 0) {
            setTimeout(() => {
                showNotification(window.currentLang === 'en' ? `🎉 You earned ${order.pointsEarned} points from purchasing ${service.title}!` : `🎉 مبروك! كسبت ${order.pointsEarned} نقطة من عملية شراء ${service.title}`, 'success');
            }, 600);
        }
        form.reset();
        appliedDiscount = null;
    } catch (err) {
        showNotification(td(err.message) || td('حصل خطأ أثناء إرسال الطلب'), 'error');
    }
}

function animateCounter(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current;
    }, 40);
}

async function loadLiveCounter() {
    if (!window.db) return;
    try {
        const count = await window.db.fetchCompletedTodayCount();
        animateCounter('liveCompletedToday', count);
    } catch (err) { /* ignore */ }
    try {
        const totalOrders = await window.db.fetchTotalOrdersCount();
        animateCounter('liveTotalOrders', totalOrders);
    } catch (err) { /* ignore */ }
    try {
        const totalCustomers = await window.db.fetchTotalCustomersCount();
        animateCounter('liveTotalCustomers', totalCustomers);
    } catch (err) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLiveCounter();
});
