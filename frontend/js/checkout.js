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
    document.getElementById('closeCheckoutModal')?.addEventListener('click', () => { 
        document.getElementById('checkoutModal').style.display = 'none'; 
        
        // WhatsApp floating widget ko wapas show karein
        const floatingWa = document.getElementById('floatingWaBtn'); 
        if (floatingWa) {
            floatingWa.style.display = 'flex'; // Kyunki aapke HTML mein ye flex use karta hai
        }
    });
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
window.buyNowSingle = function (productId) {
    const p = allProducts.find((item) => item._id === productId);
    if (!p) return;
    const advance = (p.advancePayment !== undefined && p.advancePayment !== null && p.advancePayment !== "") ? p.advancePayment : CONFIG.globalAdvancePayment;
    checkoutItems = [{ productId: p._id, title: p.title, price: p.price, quantity: 1, images: p.images || (p.imageUrl ? [p.imageUrl] : []), image: p.images && p.images.length ? p.images[0] : (p.imageUrl || 'https://placehold.co/60'), advance: advance }];
    openCheckoutModal();
};

window.buyNowWithVariant = function (productId, title, basePrice, image, advancePayment) {
    let selectedVariants = [];
    const activeBtns = document.querySelectorAll('.variant-btn.active');
    activeBtns.forEach(btn => { selectedVariants.push(`${btn.getAttribute('data-group')}: ${btn.getAttribute('data-val')}`); });

    const totalGroups = document.querySelectorAll('.variant-group').length;
    if (activeBtns.length < totalGroups) { alert('Please select all product options before buying.'); return; }

    let finalTitle = selectedVariants.length > 0 ? `${title} (${selectedVariants.join(', ')})` : title;
    checkoutItems = [{ productId: productId, title: finalTitle, price: Number(basePrice), quantity: 1, image: image, advance: advancePayment }];
    openCheckoutModal();
};

window.checkoutFromCart = function () {
    if (cart.length === 0) { alert('Your cart is empty!'); return; }
    checkoutItems = [...cart];

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
        summaryBox.innerHTML = checkoutItems.map(item => `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom:6px;"><div><span>${item.title} <strong>(x${item.quantity})</strong></span></div>
            <strong style="white-space: nowrap; flex-shrink: 0; margin-left: 10px;">₹${item.price * item.quantity}</strong></div>`).join('');
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
    
    // WhatsApp floating widget ko hide karein
    const floatingWa = document.getElementById('floatingWaBtn'); 
    if (floatingWa) {
        floatingWa.style.display = 'none';
    }
}

function updatePriceCalculations() {
    const totalCartPrice = checkoutItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

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

    // --- BUTTON DISABLE & SPINNER LOGIC ---
    const submitBtn = document.getElementById('submitOrderBtn');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Proceed to Pay';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processing... <i class="fas fa-spinner fa-spin"></i>';
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'not-allowed';
    }
    // --------------------------------------

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

            // ❌ यहाँ बटन वापस इनेबल मत करना (ताकि डबल क्लिक न हो)
            showPaymentSuccessModal(result.orderId || orderId, payNow, phone, name, (currentPaymentPlan === 'FULL_PAID' && totalCartPrice >= 1000));
        } else {
            // ✔️ फेल होने पर बटन वापस चालू करें
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
            alert(result.message || 'Order creation failed.');
        }
    } catch (err) {
        // ✔️ एरर आने पर बटन वापस चालू करें
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
        alert('Server error! Please check backend console.');
    }
}

function showPaymentSuccessModal(orderId, payAmount, phone, name, isFreeGift) {
    const modalContent = document.getElementById('checkoutModalBody');
    let cleanPhone = CONFIG.adminWhatsapp ? String(CONFIG.adminWhatsapp).replace(/\D/g, '') : '';
    if (cleanPhone.length === 10) { cleanPhone = '91' + cleanPhone; }

    const giftText = isFreeGift ? ' (🎁 Full Paid + Free AirPods Offer)' : ' (Partial Advance)';
    const message = encodeURIComponent(`Hello! I have placed an order${giftText}.\nOrder ID: ${orderId}\nName: ${name}\nPhone: ${phone}\nAmount to Pay: ₹${payAmount}\nSharing payment screenshot.`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    // --- UPI Parameters & QR URL ---
    const merchantName = "NS Smart Gadgets";
    const baseUpiParams = `pa=${CONFIG.adminUpiId || ''}&pn=${encodeURIComponent(merchantName)}&am=${payAmount}&cu=INR`;

    const genericUpiUri = `upi://pay?${baseUpiParams}`;
    const phonepeUri = `phonepe://pay?${baseUpiParams}`;
    const paytmUri = `paytmmp://pay?${baseUpiParams}`;
    const gpayUri = `gpay://upi/pay?${baseUpiParams}`;

    const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(genericUpiUri)}`;

    // --- OS Detection Logic ---
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /android/i.test(userAgent);

    let mobileButtonsHtml = '';

    if (isAndroid) {
        // NAYA: onclick="trackUpiClick()" add kiya gaya hai
        mobileButtonsHtml = `
            <a href="${genericUpiUri}" onclick="trackUpiClick()"
               style="display: block; background: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 15px 0;">
               📱 Pay via UPI App (GPay/PhonePe)
            </a>
        `;
    } else if (isIOS) {
        // NAYA: onclick="trackUpiClick()" sabhi buttons mein add kiya gaya hai
        mobileButtonsHtml = `
            <div style="display: flex; flex-direction: column; gap: 10px; margin: 15px 0;">
                <a href="${phonepeUri}" onclick="trackUpiClick()" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #5f259f; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" style="height: 22px; filter: brightness(0) invert(1);" alt="PhonePe">
                    Pay via PhonePe
                </a>
                
                <a href="${paytmUri}" onclick="trackUpiClick()" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #002970; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" style="height: 14px; filter: brightness(0) invert(1);" alt="Paytm">
                    Pay via Paytm
                </a>
                
                <a href="${gpayUri}" onclick="trackUpiClick()" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #ffffff; color: #3c4043; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; border: 1px solid #dadce0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" style="height: 18px;" alt="GPay">
                    Pay via GPay
                </a>
            </div>
        `;
    }

    modalContent.innerHTML = `
    <div style="text-align: center;">
      <h3 style="color: #059669; margin-bottom: 6px;">🎉 Order Placed!</h3>
      <p style="font-size: 0.85rem; color: #64748b;">Order ID: <strong>${orderId}</strong></p>
      ${isFreeGift ? '<div style="background:#ecfdf5; color:#047857; padding:6px; border-radius:6px; font-weight:600; font-size:0.85rem; margin:10px 0;">🎉 Free AirPods unlocked!</div>' : ''}
      
      <div style="margin: 14px 0; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
        <p style="font-weight: 700; font-size: 0.95rem;">Amount to Pay: <span style="color:#059669;">₹${payAmount}</span></p>
        
        ${mobileButtonsHtml}
        
        <p style="font-size: 0.85rem; margin: 10px 0;">${(isAndroid || isIOS) ? 'OR ' : ''}Scan QR Code to Pay</p>
        
        
        <!-- NAYA QR LOGIC: Blurred Dummy QR with Overlay -->
        <div id="qrContainer" style="position: relative; margin: 15px auto; width: 180px; height: 180px; cursor: pointer;" onclick="generateAndShowQr('${dynamicQrUrl}')">
           
           <!-- Dummy Blurred QR ( असली जनरेट नहीं होगा जब तक क्लिक न हो ) -->
           <img id="dynamicQrImage" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TapToPay" alt="Scan to Pay" style="width: 100%; height: 100%; border-radius: 8px; object-fit: contain; border: 2px solid #cbd5e1; padding: 12px; background: #fff; filter: blur(6px); transition: filter 0.3s ease;" />
           
           <!-- Text Overlay (👆 Tap to View QR) -->
           <div id="qrOverlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.3); border-radius: 8px; font-weight: 700; color: #0f172a; font-size: 0.95rem; text-shadow: 0 0 4px #fff;">
              👆 Tap to View QR
           </div>
        </div>
        ${CONFIG.adminUpiId ? `<p style="font-size: 0.85rem;">UPI ID: <strong>${CONFIG.adminUpiId}</strong></p>` : ''}
      </div>

      <!-- NAYA BUTTON LOGIC: By default hidden rahega -->
      <div id="postPaymentSection" style="display: none;">
          <p style="font-size: 0.8rem; color: #d97706; font-weight: bold; margin-bottom: 12px;">Step 2: Please send payment screenshot to confirm order:</p>
          <button onclick="processWhatsAppRedirect(this,'${waUrl}', '${orderId}', '${phone}')" class="btn-primary" style="display:block; width: 100%; border: none; cursor: pointer; text-decoration:none; background:#25D366; text-align:center; color:#fff; padding:10px; border-radius:6px; font-weight:600;">
  💬 I Have Paid (Send Screenshot)
</button>
      </div>
    </div>`;
}

// --- GLOBAL HELPER FUNCTIONS ---
window.revealPostPaymentUI = function () {
    const postPaymentDiv = document.getElementById('postPaymentSection');
    if (postPaymentDiv) postPaymentDiv.style.display = 'block';
};



window.processWhatsAppRedirect = async function (btn, waUrl, orderId, customerPhone) {
    const originalText = btn.innerHTML;
    
    // Button ko disable karo taaki double click na ho
    btn.innerHTML = 'Processing... <i class="fas fa-spinner fa-spin"></i>';
    btn.style.pointerEvents = 'none';

    try {
        // 1. Backend ko hit karke duplicate udayenge aur status Pending karenge
        const res = await fetch(`${CONFIG.BASE_URL}/orders/confirm-screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, customerPhone })
        });

        const data = await res.json();
        
        if (data.success) {
            // 2. Database update hone ke baad hi WhatsApp kholenge
            window.open(waUrl, '_blank');
            localStorage.removeItem('user_cart');
            window.location.href = 'success.html';
        } else {
            alert("Error: " + data.message);
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
        }
    } catch (err) {
        alert("Network Error! Please try again.");
        btn.innerHTML = originalText;
        btn.style.pointerEvents = 'auto';
    }
};
// --- NAYA LOGIC: Visibility Tracker ---
window.upiAppClicked = false; // Track karne ke liye ki button click hua ya nahi

// Jab browser background se wapas foreground (samne) aaye
document.addEventListener("visibilitychange", () => {
    // Agar page wapas samne aa gaya hai AUR usne pehle UPI button click kiya tha
    if (document.visibilityState === "visible" && window.upiAppClicked) {
        window.revealPostPaymentUI();
        window.upiAppClicked = false; // Reset kar dein
    }
});

// Naya function jo sirf click track karega, button show nahi karega
window.trackUpiClick = function() {
    window.upiAppClicked = true;
};



window.generateAndShowQr = function (qrUrl) {
    const qrImage = document.getElementById('dynamicQrImage');
    const overlay = document.getElementById('qrOverlay');
    
    if (qrImage) {
        // 1. ब्लर हटाओ
        qrImage.style.filter = 'none';
        // 2. अब जाकर असली डायनामिक QR लोड करो
        qrImage.src = qrUrl; 
        
        // 3. दोबारा क्लिक होने से रोको
        qrImage.parentElement.style.cursor = 'default';
        qrImage.parentElement.onclick = null;
    }
    
    if (overlay) {
        // 4. 'Tap to View' वाला टेक्स्ट गायब कर दो
        overlay.style.display = 'none'; 
    }
    
    revealPostPaymentUI(); 
};