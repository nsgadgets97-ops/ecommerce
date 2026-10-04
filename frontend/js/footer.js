document.addEventListener('DOMContentLoaded', async () => {
    const footerContainer = document.getElementById('footer-container');
    if (!footerContainer) return;

    // बेसिक HTML ढांचा
    footerContainer.innerHTML = `
      <footer style="background: #0f172a; color: #fff; padding: 40px 20px 20px; margin-top: 40px;">
        
        <!-- सोशल मीडिया आइकन्स - सबसे ऊपर, सेंटर में और बड़े साइज़ में -->
        <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 35px; font-size: 2.2rem;">
            <a href="https://www.instagram.com/ns_smart_gadgets_?igsh=MWJiNWFvZTFqbHZ1eA%3D%3D&utm_source=qr" target="_blank" style="color: #e1306c; text-decoration: none;"><i class="fab fa-instagram"></i></a>
            <a href="https://www.youtube.com/@nssmartgadgets0744" target="_blank" style="color: #ff0000; text-decoration: none;"><i class="fab fa-youtube"></i></a>
        </div>

        <div style="max-width: 1100px; margin: auto; display: flex; flex-wrap: wrap; gap: 40px; justify-content: space-between;">
            <div style="flex: 1; min-width: 250px;">
                <h3 style="margin-bottom: 15px; color: #38bdf8;">Shop by Categories</h3>
                <div id="footerCategoryList" style="display: flex; flex-direction: column; gap: 10px;">
                    Loading categories...
                </div>
            </div>
            <div style="flex: 1; min-width: 250px;">
                <h3 style="margin-bottom: 15px; color: #38bdf8;">Contact Us</h3>
                <p style="margin-bottom: 8px; font-size: 0.9rem; line-height: 1.6;">
    📍 <span id="footerAddress">
        NS Smart Gadgets <br> 
        Near Salamat Gate <br>
        Main Road, Masuri <br> 
        Ghaziabad - 201015
    </span>
</p>
                <p style="margin-bottom: 8px; font-size: 0.9rem;">📧 <span id="footerEmail">nsgadgets97@gmail.com</span></p>
                <p id="footerPhoneContainer" style="margin-bottom: 8px; font-size: 0.9rem; display: none;">📞 <span id="footerPhone"></span></p>
            </div>
        </div>
        <div style="text-align: center; border-top: 1px solid #334155; margin-top: 30px; padding-top: 20px; font-size: 0.8rem; color: #94a3b8;">
            &copy; 2026 ShopOnline. All rights reserved.
        </div>
      </footer>
    `;

    // ग्लोबल सेटिंग्स (एड्रेस और नंबर) मंगाना
    try {
        const setRes = await fetch(`${CONFIG.BASE_URL}/settings`);
        const setData = await setRes.json();
        if (setData.success && setData.data) {
            if (setData.data.supportEmail) document.getElementById('footerEmail').textContent = setData.data.supportEmail;
            
            const waNumber = setData.data.whatsappNumber || '';
            if (waNumber) {
                document.getElementById('footerPhone').textContent = waNumber;
                document.getElementById('footerPhoneContainer').style.display = 'block';
            }
        }
    } catch (err) { console.error('Footer settings error:', err); }

    // कैटेगरीज मंगाना
    try {
        const catRes = await fetch(`${CONFIG.BASE_URL}/categories`);
        const catData = await catRes.json();
        if (catData.success && catData.data) {
            const footerCatList = document.getElementById('footerCategoryList');
            footerCatList.innerHTML = '';
            catData.data.forEach(cat => {
                const link = document.createElement('a');
                link.href = `index.html?category=${cat._id}`;
                link.textContent = cat.name;
                link.style.cssText = "color: #cbd5e1; text-decoration: none; font-size: 0.9rem;";
                footerCatList.appendChild(link);
            });
        }
    } catch (err) { console.error('Footer categories error:', err); }
});