document.addEventListener('DOMContentLoaded', async () => {
    const footerContainer = document.getElementById('footer-container');
    if (!footerContainer) return;

    footerContainer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-social">
            <a href="https://www.instagram.com/ns_smart_gadgets_?igsh=MWJiNWFvZTFqbHZ1eA%3D%3D&utm_source=qr" target="_blank" style="color: #e1306c; text-decoration: none;"><i class="fab fa-instagram"></i></a>
            <a href="https://www.youtube.com/@nssmartgadgets0744" target="_blank" style="color: #ff0000; text-decoration: none;"><i class="fab fa-youtube"></i></a>
        </div>
        <div class="footer-grid">
            <div class="footer-col">
                <h3>Shop by Categories</h3>
                <div id="footerCategoryList" class="footer-links">
                    Loading categories...
                </div>
            </div>
            <div class="footer-col">
                <h3>Contact Us</h3>
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
        <div class="footer-copy">
            &copy; 2026 NS Smart Gadgets. All rights reserved.
        </div>
      </footer>
    `;

    try {
        // NAYA CACHE WALA CODE: 2 ghante ke cache ke saath settings load karega
        let setData;
        if (typeof fetchWithCache === 'function') {
            setData = await fetchWithCache(`${CONFIG.BASE_URL}/settings`, 'cache_settings', 2);
        } else {
            const setRes = await fetch(`${CONFIG.BASE_URL}/settings`);
            setData = await setRes.json();
        }

        if (setData && setData.success && setData.data) {
            if (setData.data.supportEmail) document.getElementById('footerEmail').textContent = setData.data.supportEmail;
            
            const waNumber = setData.data.whatsappNumber || '';
            if (waNumber) {
                document.getElementById('footerPhone').textContent = waNumber;
                document.getElementById('footerPhoneContainer').style.display = 'block';
            }
        }
    } catch (err) { console.error('Footer settings error:', err); }

    try {
        // NAYA CACHE WALA CODE: 20 ghante ke cache ke saath categories load karega
        let catData;
        if (typeof fetchWithCache === 'function') {
            catData = await fetchWithCache(`${CONFIG.BASE_URL}/categories`, 'cache_categories', 20);
        } else {
            const catRes = await fetch(`${CONFIG.BASE_URL}/categories`);
            catData = await catRes.json();
        }

        if (catData && catData.success && catData.data) {
            const footerCatList = document.getElementById('footerCategoryList');
            footerCatList.innerHTML = '';
            catData.data.forEach(cat => {
                const link = document.createElement('a');
                link.href = `index.html?category=${cat._id}`;
                link.textContent = cat.name;
                
                // NAYA LOGIC: Footer category click par page refresh rokne ke liye
                link.addEventListener('click', (e) => {
                    const productGrid = document.getElementById('productGrid');
                    // Agar productGrid page par hai (matlab hum homepage par hain) aur filter function available hai
                    if (productGrid && typeof filterByCategory === 'function') {
                        e.preventDefault(); // Page reload rok do
                        
                        // Upar navigation wali category button ko bhi active show karne ke liye select kar lete hain
                        const topCatBtn = document.querySelector(`.category-item[data-category="${cat._id}"]`);
                        filterByCategory(cat._id, cat.name, topCatBtn);
                    }
                    // Agar product page par hain, toh normal e.preventDefault() nahi chalega aur redirect ho jayega
                });

                footerCatList.appendChild(link);
            });
        }
    } catch (err) { console.error('Footer categories error:', err); }
});