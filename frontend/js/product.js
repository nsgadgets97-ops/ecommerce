document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        document.getElementById('productContainer').innerHTML = '<h2>Product Not Found</h2>';
        return;
    }

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/products/${productId}`);
        const data = await res.json();
        
        if (data.success && (data.data || data.product)) {
            renderProductPage(data.data || data.product);
        } else {
            document.getElementById('productContainer').innerHTML = '<h2>Product Not Found</h2>';
        }
    } catch (err) {
        document.getElementById('productContainer').innerHTML = '<h2>Error loading product</h2>';
    }
});

function renderProductPage(p) {
    const container = document.getElementById('productContainer');
    
    // Images array
    const images = (p.images && p.images.length > 0) ? p.images : (p.imageUrl ? [p.imageUrl] : ['https://placehold.co/400']);
    const advance = p.advancePayment !== undefined && p.advancePayment !== null ? p.advancePayment : (CONFIG.globalAdvancePayment || 300);
    const categoryName = p.category?.name || 'Store Item';

    // Generate thumbnails
    let thumbHTML = '';
    if (images.length > 1) {
        thumbHTML = images.map((img, i) => `
            <img src="${img}" class="thumb-img ${i === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${img}')" />
        `).join('');
    }

    container.innerHTML = `
        <div class="product-gallery">
            <img src="${images[0]}" id="mainProductImage" class="main-image" />
            <div class="thumb-row">${thumbHTML}</div>
        </div>
        <div class="product-info">
            <div class="prod-category">${categoryName}</div>
            <h1 class="prod-title">${p.title}</h1>
            <div class="prod-price-box">
                <span class="prod-sell-price">${CONFIG.CURRENCY}${p.price}</span>
                ${p.mrp ? `<span class="prod-mrp">${CONFIG.CURRENCY}${p.mrp}</span>` : ''}
                <br/>
                <div class="adv-badge">Advance to pay: ${CONFIG.CURRENCY}${advance}</div>
            </div>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                ${p.description || 'Premium quality product delivered safely to your doorstep. Cash on delivery available for the remaining balance.'}
            </p>

            <div class="action-buttons">
                <button class="btn-large btn-add" onclick="addSingleToCart('${p._id}', '${p.title}', ${p.price}, '${images[0]}')">Add to Cart</button>
                <button class="btn-large btn-buy" onclick="buyNowRedirect('${p._id}')">Buy Now</button>
            </div>
        </div>
    `;
}

function changeMainImage(thumbElement, imageUrl) {
    document.getElementById('mainProductImage').src = imageUrl;
    document.querySelectorAll('.thumb-img').forEach(el => el.classList.remove('active'));
    thumbElement.classList.add('active');
}

function buyNowRedirect(productId) {
    // Sidha homepage ke checkout modal par bhejega
    window.location.href = `index.html?product=${productId}`;
}

function addSingleToCart(productId, title, price, image) {
    let cart = [];
    const saved = localStorage.getItem('user_cart');
    if (saved) {
        try { cart = JSON.parse(saved); } catch (e) { cart = []; }
    }
    
    const existing = cart.find(item => item.productId === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ productId, title, price: Number(price), quantity: 1, image });
    }
    
    localStorage.setItem('user_cart', JSON.stringify(cart));
    alert(`${title} added to cart!`);
}