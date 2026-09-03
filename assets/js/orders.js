// =========================================================
// Refresh - Orders Page Logic (orders.js)
// =========================================================

let userOrders = [];

function getStatusText(status) {
    return {
        'pending': t('status_pending'),
        'processing': t('status_processing'),
        'completed': t('status_completed'),
        'cancelled': t('status_cancelled')
    }[status] || status;
}

function getStatusColor(status) {
    return {
        'pending': 'warning',
        'processing': 'info',
        'completed': 'success',
        'cancelled': 'error'
    }[status] || 'info';
}

async function loadUserOrdersPage() {
    const ordersList = document.getElementById('userOrdersList');
    if (!ordersList) return;

    if (!window.currentUser) {
        ordersList.innerHTML = `
            <div class="text-center py-12 bg-slate-800/40 rounded-xl p-8 border border-slate-700">
                <div class="text-6xl mb-4">🔒</div>
                <h3 class="text-xl font-semibold mb-2">${window.currentLang === 'en' ? 'Please log in to view your orders' : 'يجب تسجيل الدخول لعرض طلباتك'}</h3>
                <button onclick="showLoginModal()" class="btn-primary px-6 py-2 rounded-lg mt-4">${t('header_login_btn')}</button>
            </div>`;
        return;
    }

    ordersList.innerHTML = `
        <div class="text-center py-12">
            <div class="text-3xl mb-2 animate-spin">⏳</div>
            <p class="text-slate-400">${window.currentLang === 'en' ? 'Loading orders...' : 'جاري تحميل الطلبات...'}</p>
        </div>`;

    try {
        const rawOrders = await window.db.fetchMyOrders(window.currentUser.id);
        userOrders = (rawOrders || []).map(mapOrder);

        renderOrdersList();
    } catch (err) {
        console.error("Error fetching user orders:", err);
        ordersList.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <p>${td(err.message) || (window.currentLang === 'en' ? 'Failed to load orders' : 'تعذر تحميل الطلبات')}</p>
            </div>`;
    }
}

function renderOrdersList() {
    const ordersList = document.getElementById('userOrdersList');
    if (!ordersList) return;

    if (userOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center py-12 bg-slate-800/40 rounded-xl p-8 border border-slate-700">
                <div class="text-6xl mb-4">📦</div>
                <h3 class="text-xl font-semibold mb-2">${window.currentLang === 'en' ? 'No orders yet' : 'لا توجد طلبات حتى الآن'}</h3>
                <a href="/index.html#servicesSection" class="btn-primary px-6 py-2 rounded-lg mt-4 inline-block">${t('browse_services')}</a>
            </div>`;
        return;
    }
    
    const filterEl = document.getElementById('orderStatusFilter');
    const statusFilter = filterEl ? filterEl.value : '';

    const filteredOrders = userOrders.filter(order => {
        return !statusFilter || order.status === statusFilter;
    });

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center py-8 bg-slate-800/40 rounded-xl p-6 border border-slate-700">
                <p class="text-slate-400">${window.currentLang === 'en' ? 'No orders found matching this filter' : 'لا توجد طلبات تطابق هذا التصنيف'}</p>
            </div>`;
        return;
    }
    
    ordersList.innerHTML = filteredOrders.map(order => `
        <div class="order-card">
            <div class="flex justify-between items-start mb-4 flex-wrap gap-2">
                <div>
                    <h4 class="font-semibold text-lg">${esc(order.serviceName)}</h4>
                    <p class="text-slate-400 text-sm">${window.currentLang === 'en' ? 'Order #' : 'طلب #'}${order.id}</p>
                </div>
                <span class="badge badge-${getStatusColor(order.status)}">${getStatusText(order.status)}</span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <span class="text-slate-400 text-sm">${window.currentLang === 'en' ? 'Quantity:' : 'الكمية:'}</span> 
                    <span class="font-semibold">${order.quantity.toLocaleString()}</span>
                </div>
                <div>
                    <span class="text-slate-400 text-sm">${window.currentLang === 'en' ? 'Price:' : 'السعر:'}</span> 
                    <span class="font-semibold text-green-400">${order.totalPrice.toFixed(2)} ${window.currentLang === 'en' ? 'EGP' : 'جنيه'}</span>
                </div>
            </div>
            ${order.contentLink ? `
                <div class="mb-4">
                    <span class="text-slate-400 text-sm">${window.currentLang === 'en' ? 'Link:' : 'الرابط:'}</span> 
                    <a href="${safeHref(order.contentLink)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline text-sm break-all">${esc(order.contentLink)}</a>
                </div>` : ''}
            ${order.notes ? `
                <div class="mb-4">
                    <span class="text-slate-400 text-sm">${window.currentLang === 'en' ? 'Notes:' : 'ملاحظات:'}</span>
                    <p class="text-sm bg-slate-800/50 p-3 rounded-lg border border-slate-700">${esc(order.notes)}</p>
                </div>` : ''}
            <div class="text-slate-400 text-xs flex justify-between items-center border-t border-slate-700 pt-3 mt-3">
                <span>${window.currentLang === 'en' ? 'Order date:' : 'تاريخ الطلب:'} ${order.timestamp}</span>
                ${order.pointsUsed > 0 ? `<span class="text-yellow-400 text-xs">🎯 تم استخدام ${order.pointsUsed} نقطة</span>` : ''}
            </div>
        </div>
    `).join('');
}

window.addEventListener('userDataLoaded', () => {
    loadUserOrdersPage();
});

document.addEventListener('DOMContentLoaded', () => {
    const filterEl = document.getElementById('orderStatusFilter');
    if (filterEl) {
        filterEl.addEventListener('change', renderOrdersList);
    }
});
