let currentUser = JSON.parse(localStorage.getItem('storeUser')) || null;
let myOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Load Checks
    if (currentUser && currentUser.phone) {
        fetchOrders();
    } else {
        document.getElementById('loginView').style.display = 'block';
    }

    // 2. Login Form Handling
    document.getElementById('trackLoginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('trackPhone').value.trim();
        const password = document.getElementById('trackPassword').value.trim();
        
        try {
            const res = await fetch(`${CONFIG.BASE_URL}/orders/customer/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = { phone, password };
                localStorage.setItem('storeUser', JSON.stringify(currentUser));
                myOrders = data.orders;
                renderOrderAccordion();
            } else {
                alert(data.message || 'Invalid Credentials');
            }
        } catch (err) {
            alert('Network Error');
        }
    });

    // 3. Navbar Setup (Cart & Search)
    setupNavbarForTrack();
});

async function fetchOrders() {
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/orders/track/${currentUser.phone}`);
        const data = await res.json();
        if (data.success) {
            myOrders = data.orders;
            renderOrderAccordion();
        } else {
            renderOrderAccordion(); 
        }
    } catch (err) {
        alert('Error fetching orders');
    }
}

// Global toggle for accordion
window.toggleOrderDetails = function(orderId) {
    const detailsDiv = document.getElementById('order-details-' + orderId);
    const icon = document.getElementById('icon-' + orderId);
    
    if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
        detailsDiv.style.display = 'block';
        if(icon) icon.style.transform = 'rotate(180deg)'; 
    } else {
        detailsDiv.style.display = 'none';
        if(icon) icon.style.transform = 'rotate(0deg)';
    }
};

function renderOrderAccordion() {
    document.getElementById('loginView').style.display = 'none';
    const container = document.getElementById('ordersListContainer');
    document.getElementById('listView').style.display = 'block';
    
    if (myOrders.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding: 40px 0; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">You have no previous orders.</p>';
        return;
    }

    container.innerHTML = myOrders.map(o => {
        const orderNum = o.orderId || o._id.slice(-6);
        const paidAmt = o.amountToPayOnline || 0;
        const balAmt = o.remainingBalance || 0;
        const totalOrderValue = paidAmt + balAmt;
        const courier = o.courierName || 'Courier';
        const trackId = o.trackingId || '';

        const statusLevels = { 'Screenshot Pending': 0, 'Pending': 1, 'Accepted': 2, 'Packed': 3, 'Dispatched': 4, 'Delivered': 5, 'RTO': -1 };
        const currentLevel = statusLevels[o.orderStatus] !== undefined ? statusLevels[o.orderStatus] : 1;

        // Dynamic Badge Styling
        let badgeBg = '#eff6ff'; let badgeColor = '#2563eb';
        if (o.orderStatus === 'Screenshot Pending') { badgeBg = '#fee2e2'; badgeColor = '#dc2626'; } 
        else if (o.orderStatus === 'Delivered') { badgeBg = '#d1fae5'; badgeColor = '#059669'; } 
        else if (o.orderStatus === 'RTO') { badgeBg = '#fecaca'; badgeColor = '#991b1b'; } 
        else if (currentLevel >= 3) { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }

        // Stepper HTML
        let stepperHtml = '';
        if (currentLevel === -1) {
            stepperHtml = `<div style="color: #dc2626; font-weight: 700; text-align: center; padding: 12px; background: #fee2e2; border-radius: 8px; margin-bottom: 15px;">↩ Order Returned (RTO)</div>`;
        } else {
            stepperHtml = `
            <div class="track-stepper">
                <div class="step ${currentLevel >= 1 ? 'completed' : (currentLevel === 0 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 1 ? '✓' : '1'}</div><div class="label">Placed</div>
                    <span class="step-help">${currentLevel === 0 ? 'Awaiting Payment' : 'Received'}</span>
                </div>
                <div class="step ${currentLevel >= 2 ? 'completed' : (currentLevel === 1 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 2 ? '✓' : '2'}</div><div class="label">Confirmed</div><span class="step-help">Preparing</span>
                </div>
                <div class="step ${currentLevel >= 3 ? 'completed' : (currentLevel === 2 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 3 ? '✓' : '3'}</div><div class="label">Packed</div><span class="step-help">Ready</span>
                </div>
                <div class="step ${currentLevel >= 4 ? 'completed' : (currentLevel === 3 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 4 ? '✓' : '4'}</div><div class="label">Shipped</div><span class="step-help">${currentLevel >= 4 ? 'In transit' : 'Waiting'}</span>
                </div>
                <div class="step ${currentLevel === 5 ? 'completed' : (currentLevel === 4 ? 'active' : '')}">
                    <div class="circle">5</div><div class="label">Delivered</div>
                </div>
            </div>`;
        }

        const productsHtml = (o.products && o.products.length > 0) ? o.products.map(p => `
            <div class="track-item" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0;">
                <div style="flex: 1; padding-right: 10px;">
                    <strong style="color:#0f172a;">${p.title}</strong><br>
                    <small style="color:#64748b; font-weight: 600;">Qty: ${p.quantity || 1} × ₹${p.price}</small>
                </div>
                <div style="font-weight: 800; color: #334155;">₹${p.price * (p.quantity || 1)}</div>
            </div>
        `).join('') : '<p style="font-size:0.8rem; color:#64748b;">No product details found.</p>';

        let actionHtml = '';
        if (o.orderStatus === 'Screenshot Pending') {
             let cleanPhone = CONFIG.adminWhatsapp ? String(CONFIG.adminWhatsapp).replace(/\D/g, '') : '';
             if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
             const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello! I have paid ₹${paidAmt} for Order ID: ${orderNum}. Here is my payment screenshot.`)}`;
             
             actionHtml = `
             <div style="padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-top: 15px; text-align: center;">
                 <p style="font-size: 0.8rem; color: #b45309; font-weight: 700; margin-bottom: 10px;">Action Required: Payment Screenshot Pending!</p>
                 <button onclick="confirmAndSendScreenshot(this, '${waUrl}', '${orderNum}', '${o.customerPhone}')" class="btn-primary" style="width: 100%; background: #25D366; font-size: 0.9rem; padding: 10px;">
                     💬 Send Screenshot Now
                 </button>
             </div>`;
        } else if (currentLevel >= 4 && trackId) {
             actionHtml = `
             <div style="margin-top: 15px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                 <div><span style="color: #64748b; font-size: 0.75rem;">Courier Partner</span><br><strong>${courier}</strong></div>
                 <div style="text-align: right;"><span style="color: #64748b; font-size: 0.75rem;">Tracking ID</span><br><strong style="color:#1d4ed8;">${trackId}</strong></div>
             </div>`;
        }

        return `
        <div class="track-card" style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; background: #fff; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div onclick="toggleOrderDetails('${orderNum}')" style="cursor: pointer; padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                <div style="flex: 1;">
                    <strong style="color: #0f172a; font-size: 1rem;">${orderNum}</strong><br>
                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">${new Date(o.createdAt).toLocaleDateString('en-IN')} • Total: ₹${totalOrderValue}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 5px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; border: 1px solid ${badgeColor}33; text-transform: uppercase;">
                        ${o.orderStatus}
                    </span>
                    <i id="icon-${orderNum}" class="fas fa-chevron-down" style="color: #94a3b8; font-size: 1.1rem; transition: transform 0.3s ease;"></i>
                </div>
            </div>

            <div id="order-details-${orderNum}" style="display: none; border-top: 1px solid #f1f5f9; background: #fdfdfd; padding: 16px;">
                ${stepperHtml}
                <h4 style="font-size: 0.85rem; color: #64748b; text-transform: uppercase; margin: 20px 0 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">Order Details</h4>
                ${productsHtml}
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 0.88rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="color: #065f46;">Paid Online:</span> <strong style="color: #065f46;">₹${paidAmt}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:#b45309; font-size: 0.95rem; border-top: 1px dashed #bbf7d0; padding-top: 6px; margin-top: 4px;">
                        <span>To Pay (COD):</span> <strong>₹${balAmt}</strong>
                    </div>
                </div>
                ${actionHtml}
            </div>
        </div>`;
    }).join('');
}

window.confirmAndSendScreenshot = async function (btn, waUrl, orderId, customerPhone) {
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Processing... <i class="fas fa-spinner fa-spin"></i>';
    btn.style.pointerEvents = 'none';

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/orders/confirm-screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, customerPhone }) 
        });
        const data = await res.json();
        
        if (data.success) {
            window.open(waUrl, '_blank');
            fetchOrders(); 
        } else {
            alert("Error: " + data.message);
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
        }
    } catch (err) {
        alert("Network Error!");
        btn.innerHTML = originalText;
        btn.style.pointerEvents = 'auto';
    }
};

function setupNavbarForTrack() {
    const searchToggle = document.getElementById('searchToggleBtn');
    const searchInput = document.getElementById('productSearchInput');

    // Jaise hi Search Icon par click ho -> index.html par bhejo ek special flag ke sath
    searchToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = 'index.html?openSearch=true';
    });

    // Agar galti se input par focus ho jaye, tab bhi redirect kar do
    searchInput?.addEventListener('focus', () => {
        window.location.href = 'index.html?openSearch=true';
    });
    // let trackCart = [];
    // const savedCart = localStorage.getItem('user_cart');
    // if (savedCart) {
    //     try { trackCart = JSON.parse(savedCart); } catch (e) { trackCart = []; }
    // }
    
    // const badge = document.getElementById('cartCount');
    // if (badge) badge.textContent = trackCart.reduce((acc, item) => acc + item.quantity, 0);

    // document.getElementById('openCartBtn')?.addEventListener('click', () => {
    //     const list = document.getElementById('cartItemsList');
    //     const totalEl = document.getElementById('cartTotalPrice');
        
    //     if (trackCart.length === 0) { 
    //         list.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px 0;">Your cart is empty.</p>'; 
    //         totalEl.textContent = '₹0'; 
    //     } else {
    //         let total = 0;
    //         list.innerHTML = trackCart.map((item) => {
    //             const itemTotal = item.price * item.quantity;
    //             total += itemTotal;
    //             return `
    //             <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding:12px 0;">
    //                 <div>
    //                     <h4 style="margin: 0; font-size: 0.9rem;">${item.title}</h4>
    //                     <p style="margin: 2px 0; font-size: 0.8rem; color: #64748b;">Qty: ${item.quantity} x ₹${item.price}</p>
    //                 </div>
    //                 <strong>₹${itemTotal}</strong>
    //             </div>`;
    //         }).join('');
    //         totalEl.textContent = `₹${total}`;
    //     }
    //     document.getElementById('cartModal').style.display = 'flex';
    // });

    // document.getElementById('closeCartModal')?.addEventListener('click', () => { 
    //     document.getElementById('cartModal').style.display = 'none'; 
    // });

    // const searchToggle = document.getElementById('searchToggleBtn');
    // const searchPanel = document.getElementById('searchPanel');
    // const searchInput = document.getElementById('productSearchInput');
    // const searchClear = document.getElementById('searchClearBtn');

    // searchToggle?.addEventListener('click', (e) => {
    //     e.stopPropagation();
    //     searchPanel?.classList.toggle('open');
    //     if (searchPanel?.classList.contains('open')) searchInput?.focus();
    // });

    // searchInput?.addEventListener('keydown', (e) => {
    //     if (e.key === 'Enter') {
    //         e.preventDefault();
    //         const value = searchInput.value.trim();
    //         window.location.href = value ? `index.html?q=${encodeURIComponent(value)}` : 'index.html';
    //     }
    // });

    // searchClear?.addEventListener('click', () => {
    //     if (searchInput) searchInput.value = '';
    // });

    // document.addEventListener('click', (e) => {
    //     if (searchPanel?.classList.contains('open') && !e.target.closest('.search-wrap')) {
    //         searchPanel.classList.remove('open');
    //     }
    // });
}