// frontend/js/checkout.js
let checkoutItems = [];
let currentPaymentPlan = 'FULL_PAID';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Checkout Modal HTML automatically
    const checkoutHTML = `
    <div class="modal-overlay" id="checkoutModal" style="display: none;">
      <div class="modal-content">
        <button class="close-modal-btn" id="closeCheckoutModal">&times;</button>
        <div id="checkoutModalBody">
          <h3 class="modal-heading">Checkout Details</h3>
          <div id="checkoutItemsSummary" style="max-height: 120px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 12px; background: #f8fafc;"></div>
          <form id="quickCheckoutForm">
            <div class="form-group"><label>Mobile Number *</label><input type="tel" id="custPhone" pattern="[0-9]{10}" maxlength="10" required placeholder="10-digit number" /></div>
            
            <div id="existingUserAlert" style="display: none; background: #e0f2fe; border: 1px solid #7dd3fc; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
              <p style="font-size: 0.85rem; margin: 0 0 6px 0; color: #0369a1; font-weight: 600;">👋 Welcome back! Enter your password to auto-fill your address:</p>
              <div style="display: flex; gap: 8px;">
                <input type="password" id="verifyPasswordInput" placeholder="Enter password" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                <button type="button" id="btnAutofillAddress" class="btn-secondary" style="padding: 6px 12px; cursor: pointer; white-space: nowrap;">Auto-Fill</button>
              </div>
            </div>

            <div class="form-group"><label>Full Name *</label><input type="text" id="custName" required placeholder="e.g. Rahul Sharma" /></div>
            <div class="form-group"><label>House / Flat No., Street, Landmark *</label><textarea id="custAddress" rows="2" required placeholder="H.no, Street, Near landmark"></textarea></div>
            <div style="display: flex; gap: 8px;">
              <div class="form-group" style="flex: 1;"><label>City *</label><input type="text" id="custCity" required /></div>
              <div class="form-group" style="flex: 1;"><label>State *</label><input type="text" id="custState" required /></div>
              <div class="form-group" style="flex: 1;"><label>Pincode *</label><input type="text" id="custPincode" pattern="[0-9]{6}" maxlength="6" required /></div>
            </div>
            <div class="form-group"><label>Account Password</label><input type="text" id="custPassword" required placeholder="Auto-generated" /></div>
            <small class="helper-text" style="display: block; margin-top: -10px; margin-bottom: 15px;">Auto-filled as your First Name. You may change it if you wish.</small>

            <div class="payment-options-wrap">
              <label class="section-sublabel">Select Payment Option:</label>
              <label class="pay-option recommended" id="optionFullPay">
                <input type="radio" name="paymentPlan" value="FULL_PAID" checked />
                <div class="pay-option-details">
                  <div class="option-header"><strong>Pay Full Online</strong><span class="badge-rec">🌟 Recommended</span></div>
                  <p class="offer-gift" id="airpods-badge" style="display:none; color:#059669; margin-top:5px;">🎁<strong>Free AirPods Included!</strong></p>
                  <p class="option-calc">No COD verification needed. 100% fast dispatch.</p>
                </div>
              </label>
              <label class="pay-option" id="optionAdvancePay">
                <input type="radio" name="paymentPlan" value="ADVANCE_COD" />
                <div class="pay-option-details">
                  <div class="option-header"><strong>Partial Advance + COD</strong></div>
                  <p class="option-calc">Pay small advance online, remaining balance on delivery.</p>
                </div>
              </label>
            </div>
            <div class="price-breakdown">
              <div class="price-row"><span>Total Products Price:</span><span id="summaryTotal">₹0</span></div>
              <div class="price-row highlight"><span>Pay Now Amount:</span><strong id="summaryPayNow">₹0</strong></div>
              <div class="price-row"><span>Remaining Balance on Delivery (COD):</span><span id="summaryCOD">₹0</span></div>
            </div>
            <button type="submit" class="btn-primary" id="submitOrderBtn">Proceed to Pay</button>
          </form>
        </div>
      </div>
    </div>`;
    
    const div = document.createElement('div');
    div.innerHTML = checkoutHTML;
    document.body.appendChild(div);

    setupCheckoutListeners();
});

function setupCheckoutListeners() {
    document.getElementById('closeCheckoutModal')?.addEventListener('click', () => { document.getElementById('checkoutModal').style.display = 'none'; });
    document.querySelectorAll('input[name="paymentPlan"]').forEach((radio) => { radio.addEventListener('change', (e) => { currentPaymentPlan = e.target.value; updatePriceCalculations(); }); });
    document.getElementById('quickCheckoutForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await handleOrderSubmit(); });
    
    // Auto password fill logic
    const nameInput = document.getElementById('custName');
    const passwordInput = document.getElementById('custPassword');
    let isPasswordManuallyEdited = false;
    if (passwordInput && nameInput) {
        passwordInput.addEventListener('input', () => { isPasswordManuallyEdited = true; });
        nameInput.addEventListener('input', () => {
            if (!isPasswordManuallyEdited) {
                const rawVal = nameInput.value.trim();
                passwordInput.value = rawVal ? rawVal.split(/\s+/)[0] : '';
            }
        });
    }

    // Phone check logic
    const phoneField = document.getElementById('custPhone');
    const alertBox = document.getElementById('existingUserAlert');
    if (phoneField) {
        phoneField.addEventListener('blur', async () => {
            const phone = phoneField.value.trim();
            if (phone.length === 10) {
                try {
                    const res = await fetch(`${CONFIG.BASE_URL}/orders/customer/check/${phone}`);
                    const data = await res.json();
                    if (data.success && data.exists) { if (alertBox) alertBox.style.display = 'block'; }
                    else { if (alertBox) alertBox.style.display = 'none'; }
                } catch (err) { console.error('Phone check error:', err); }
            } else { if (alertBox) alertBox.style.display = 'none'; }
        });
    }

    // Autofill address
    document.getElementById('btnAutofillAddress')?.addEventListener('click', async () => {
        const phone = phoneField ? phoneField.value.trim() : '';
        const password = document.getElementById('verifyPasswordInput')?.value.trim();
        if (!password) { alert('Please enter your password.'); return; }
        try {
            const res = await fetch(`${CONFIG.BASE_URL}/orders/customer/verify-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
            const result = await res.json();
            if (result.success && result.data) {
                if (document.getElementById('custName')) document.getElementById('custName').value = result.data.name || '';
                if (result.data.address) {
                    if (document.getElementById('custAddress')) document.getElementById('custAddress').value = result.data.address.address || '';
                    if (document.getElementById('custCity')) document.getElementById('custCity').value = result.data.address.city || '';
                    if (document.getElementById('custState')) document.getElementById('custState').value = result.data.address.state || '';
                    if (document.getElementById('custPincode')) document.getElementById('custPincode').value = result.data.address.pincode || '';
                }
                if (document.getElementById('custPassword')) document.getElementById('custPassword').value = password;
                if (alertBox) alertBox.style.display = 'none';
                alert('Address loaded successfully!');
            } else { alert(result.message || 'Incorrect password.'); }
        } catch (err) { alert('Unable to load saved address.'); }
    });
}

// Global checkout triggers
window.buyNowSingle = function(productId) {
    const p = allProducts.find((item) => item._id === productId);
    if (!p) return;
    const advance = (p.advancePayment !== undefined && p.advancePayment !== null && p.advancePayment !== "") ? p.advancePayment : CONFIG.globalAdvancePayment;
    checkoutItems = [{ productId: p._id, title: p.title, price: p.price, quantity: 1, images: p.images || (p.imageUrl ? [p.imageUrl] : []), image: p.images && p.images.length ? p.images[0] : (p.imageUrl || 'https://placehold.co/60'), advance: advance }];
    openCheckoutModal();
};

window.buyNowWithVariant = function(productId, title, basePrice, image, advancePayment) {
    let selectedVariants = [];
    const activeBtns = document.querySelectorAll('.variant-btn.active');
    activeBtns.forEach(btn => { selectedVariants.push(`${btn.getAttribute('data-group')}: ${btn.getAttribute('data-val')}`); });

    const totalGroups = document.querySelectorAll('.variant-group').length;
    if (activeBtns.length < totalGroups) { alert('Please select all product options before buying.'); return; }

    let finalTitle = selectedVariants.length > 0 ? `${title} (${selectedVariants.join(', ')})` : title;
    checkoutItems = [{ productId: productId, title: finalTitle, price: Number(basePrice), quantity: 1, image: image, advance: advancePayment }];
    openCheckoutModal();
};

window.checkoutFromCart = function() {
    if (cart.length === 0) { alert('Your cart is empty!'); return; }
    checkoutItems = [...cart];
    
    // अब सीधे कार्ट से एडवांस ले रहे हैं
    checkoutItems.forEach(item => {
        if (item.advance === undefined || item.advance === null) {
            item.advance = CONFIG.globalAdvancePayment;
        }
    });
    
    const cartModal = document.getElementById('cartModal');
    if (cartModal) cartModal.style.display = 'none';
    openCheckoutModal();
};

function openCheckoutModal() {
    currentPaymentPlan = 'FULL_PAID';
    const fullPayRadio = document.querySelector('input[name="paymentPlan"][value="FULL_PAID"]');
    if (fullPayRadio) fullPayRadio.checked = true;

    const summaryBox = document.getElementById('checkoutItemsSummary');
    if (summaryBox) {
        summaryBox.innerHTML = checkoutItems.map(item => `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:6px;"><div><span>${item.title} <strong>(x${item.quantity})</strong></span></div><strong>₹${item.price * item.quantity}</strong></div>`).join('');
    }
    updatePriceCalculations();

    const loggedInUser = JSON.parse(localStorage.getItem('storeUser')) || null;
    if (loggedInUser) {
        setTimeout(() => {
            const phoneEl = document.getElementById('custPhone');
            if (phoneEl) { phoneEl.value = loggedInUser.phone || ''; phoneEl.readOnly = true; phoneEl.style.backgroundColor = '#f1f5f9'; }
            if (document.getElementById('custName')) document.getElementById('custName').value = loggedInUser.name || '';
            if (document.getElementById('custAddress')) document.getElementById('custAddress').value = loggedInUser.address || '';
            if (document.getElementById('custCity')) document.getElementById('custCity').value = loggedInUser.city || '';
            if (document.getElementById('custState')) document.getElementById('custState').value = loggedInUser.state || '';
            if (document.getElementById('custPincode')) document.getElementById('custPincode').value = loggedInUser.pincode || '';
            if (document.getElementById('custPassword')) document.getElementById('custPassword').value = loggedInUser.password || '';
        }, 50);
    }
    document.getElementById('checkoutModal').style.display = 'flex';
}

function updatePriceCalculations() {
    const totalCartPrice = checkoutItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Yaha Advance Payment ka issue fix hua hai (Product specific vs Global)
    const maxAdvance = checkoutItems.reduce((max, item) => {
        const itemAdv = (item.advance !== undefined && item.advance !== null && item.advance !== "") ? item.advance : (CONFIG.globalAdvancePayment || 300);
        return Math.max(max, Number(itemAdv));
    }, 0);
    
    const advanceAmount = maxAdvance;
    const payNow = currentPaymentPlan === 'FULL_PAID' ? totalCartPrice : Math.min(advanceAmount, totalCartPrice);
    const codRemaining = currentPaymentPlan === 'FULL_PAID' ? 0 : Math.max(0, totalCartPrice - payNow);

    const sumTotal = document.getElementById('summaryTotal');
    const sumPayNow = document.getElementById('summaryPayNow');
    const sumCOD = document.getElementById('summaryCOD');
    const submitBtn = document.getElementById('submitOrderBtn');
    const airpodsBadge = document.getElementById('airpods-badge');

    if (sumTotal) sumTotal.textContent = `${CONFIG.CURRENCY}${totalCartPrice}`;
    if (sumPayNow) sumPayNow.textContent = `${CONFIG.CURRENCY}${payNow}`;
    if (sumCOD) sumCOD.textContent = `${CONFIG.CURRENCY}${codRemaining}`;

    if (airpodsBadge) {
        if (totalCartPrice >= 1000 && currentPaymentPlan === 'FULL_PAID') { airpodsBadge.style.display = 'block'; }
        else { airpodsBadge.style.display = 'none'; }
    }

    if (submitBtn) {
        if (currentPaymentPlan === 'FULL_PAID') { submitBtn.textContent = totalCartPrice >= 1000 ? `Pay Full ${CONFIG.CURRENCY}${payNow} (Free AirPods)` : `Pay Full ${CONFIG.CURRENCY}${payNow}`; } 
        else { submitBtn.textContent = `Pay Advance ${CONFIG.CURRENCY}${payNow}`; }
    }
}

async function handleOrderSubmit() {
    const name = document.getElementById('custName')?.value.trim();
    const phone = document.getElementById('custPhone')?.value.trim();
    const address = document.getElementById('custAddress')?.value.trim();
    const city = document.getElementById('custCity')?.value.trim();
    const state = document.getElementById('custState')?.value.trim();
    const pincode = document.getElementById('custPincode')?.value.trim();
    const password = document.getElementById('custPassword')?.value.trim();

    const totalCartPrice = checkoutItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const advanceAmount = checkoutItems.reduce((max, item) => Math.max(max, Number((item.advance !== undefined && item.advance !== null && item.advance !== "") ? item.advance : (CONFIG.globalAdvancePayment || 300))), 0);
    
    const payNow = currentPaymentPlan === 'FULL_PAID' ? totalCartPrice : Math.min(advanceAmount, totalCartPrice);
    const remaining = currentPaymentPlan === 'FULL_PAID' ? 0 : Math.max(0, totalCartPrice - payNow);
    const orderId = 'ORD-' + Date.now();

    try {
        const orderPayload = {
            orderId: orderId, customerPhone: phone,
            shippingDetails: { name, phone, address, city, state, pincode },
            products: checkoutItems.map((item) => ({ productId: item.productId, title: item.title, price: Number(item.price), quantity: Number(item.quantity) })),
            paymentType: currentPaymentPlan, amountToPayOnline: Number(payNow), remainingBalance: Number(remaining), password: password
        };
        
        const res = await fetch(`${CONFIG.BASE_URL}/orders/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload) });
        const result = await res.json();

        if (result.success) {
            cart = cart.filter(c => !checkoutItems.some(ci => ci.productId === c.productId));
            localStorage.setItem('user_cart', JSON.stringify(cart));
            document.getElementById('cartCount').textContent = cart.reduce((acc, item) => acc + item.quantity, 0);

            const updatedUser = { phone, name, address, city, state, pincode, password };
            localStorage.setItem('storeUser', JSON.stringify(updatedUser));
            
            showPaymentSuccessModal(result.orderId || orderId, payNow, phone, name, (currentPaymentPlan === 'FULL_PAID' && totalCartPrice >= 1000));
        } else { alert(result.message || 'Order creation failed.'); }
    } catch (err) { alert('Server error! Please check backend console.'); }
}

function showPaymentSuccessModal(orderId, payAmount, phone, name, isFreeGift) {
    const modalContent = document.getElementById('checkoutModalBody');
    let cleanPhone = CONFIG.adminWhatsapp ? String(CONFIG.adminWhatsapp).replace(/\D/g, '') : '';
    if (cleanPhone.length === 10) { cleanPhone = '91' + cleanPhone; }
    
    const giftText = isFreeGift ? ' (🎁 Full Paid + Free AirPods Offer)' : ' (Partial Advance)';
    const message = encodeURIComponent(`Hello! I have placed an order${giftText}.\nOrder ID: ${orderId}\nName: ${name}\nPhone: ${phone}\nAmount to Pay: ₹${payAmount}\nSharing payment screenshot.`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    modalContent.innerHTML = `
    <div style="text-align: center;">
      <h3 style="color: #059669; margin-bottom: 6px;">Order Placed!</h3>
      <p style="font-size: 0.85rem; color: #64748b;">Order ID: <strong>${orderId}</strong></p>
      ${isFreeGift ? '<div style="background:#ecfdf5; color:#047857; padding:6px; border-radius:6px; font-weight:600; font-size:0.85rem; margin:10px 0;">🎉 Free AirPods unlocked!</div>' : ''}
      <div style="margin: 14px 0; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
        <p style="font-weight: 700; font-size: 0.95rem;">Scan & Pay: <span style="color:#059669;">₹${payAmount}</span></p>
        <div style="margin: 10px 0;"><img src="${CONFIG.adminQrCodeUrl || 'https://placehold.co/180x180?text=Scan+QR'}" alt="UPI QR" style="width: 170px; height: 170px; border-radius: 6px; object-fit: contain;" /></div>
        ${CONFIG.adminUpiId ? `<p style="font-size: 0.85rem;">UPI ID: <strong>${CONFIG.adminUpiId}</strong></p>` : ''}
      </div>
      <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">Please send payment screenshot on WhatsApp to confirm order:</p>
      
      <!-- YAHAN BUTTON CHANGE KIYA HAI -->
      <button onclick="processWhatsAppRedirect('${waUrl}')" class="btn-primary" style="display:block; width: 100%; border: none; cursor: pointer; text-decoration:none; background:#25D366; text-align:center; color:#fff; padding:10px; border-radius:6px; font-weight:600;">💬 Send Screenshot on WhatsApp</button>
    </div>`;
}

// YAHAN SE NAYA FUNCTION SHURU HOTA HAI (Ise file ke sabse end mein daal do)
window.processWhatsAppRedirect = function(waUrl) {
    // 1. WhatsApp naye tab mein open karo
    window.open(waUrl, '_blank');
    
    // 2. Extra safety ke liye cart poori tarah saaf kar do
    localStorage.removeItem('user_cart');
    
    // 3. Current page ko naye success.html par bhej do
    window.location.href = 'success.html';
};