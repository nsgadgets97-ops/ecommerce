let adminToken = localStorage.getItem('storeAdminToken') || null;
let allOrdersData = [];
let allProductsList = [];
let editProductCurrentImages = []; // Stores remaining images during edit
let quillEditor; // Quill Editor को ग्लोबल वेरिएबल बनाया है

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showDashboard();
  } else {
    showLogin();
  }
  setupAdminEvents();

  // Quill Editor को DOM लोड होने के बाद चालू करें
  quillEditor = new Quill('#productEditor', {
    theme: 'snow'
  });
});

function showLogin() {
  document.getElementById('adminLoginBox').style.display = 'block';
  document.getElementById('adminApp').style.display = 'none';
}

function showDashboard() {
  document.getElementById('adminLoginBox').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  loadOrders();
  loadAdminProducts();
  loadAdminCategories();
  loadCurrentSettings();
  loadBanners();
}

function setupAdminEvents() {
  // Main Tabs Navigation (With URL Hash Logic)
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) targetPanel.classList.add('active');

      // URL में टैब का नाम अपडेट करें
      window.location.hash = tabId;
    });
  });

  // Page Refresh होने पर URL चेक करने का लॉजिक
  const currentHash = window.location.hash.replace('#', '');
  if (currentHash) {
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${currentHash}"]`);
    if (activeBtn) {
      activeBtn.click(); // ऑटोमैटिकली उसी टैब को खोल देगा
    }
  }

  // Admin Login
  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        adminToken = data.token;
        localStorage.setItem('storeAdminToken', adminToken);
        showDashboard();
      } else {
        alert(data.message || 'Invalid Credentials');
      }
    } catch (err) {
      alert('Login error, server chal raha hai check karein');
    }
  });

  // Admin Logout
  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem('storeAdminToken');
    adminToken = null;
    showLogin();
  });

  // Category Add
  document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editCategoryId').value;
    const name = document.getElementById('catNameInput').value.trim();
    const imageFile = document.getElementById('catImageInput').files[0];

    if (!name) return alert('Category Name zaroori hai!');
    if (!editId && !imageFile) return alert('Nayi category ke liye Image zaroori hai!');

    const formData = new FormData();
    formData.append('name', name);
    if (imageFile) formData.append('categoryImage', imageFile);

    const url = editId ? `${CONFIG.BASE_URL}/categories/${editId}` : `${CONFIG.BASE_URL}/categories`;
    const method = editId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method: method, headers: { Authorization: `Bearer ${adminToken}` }, body: formData });
      const data = await res.json();
      if (data.success) {
        alert(editId ? 'Category Updated!' : 'Category Added!');
        resetCategoryForm();
        loadAdminCategories();
      } else { alert(data.message || 'Category save nahi ho saki'); }
    } catch (err) { alert('Category save error'); }
  });

  // Banner Add
  document.getElementById('addBannerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const imageFile = document.getElementById('bannerImageInput').files[0];
    const targetLink = document.getElementById('bannerLinkInput').value.trim();

    if (!imageFile) return alert('Banner Image upload karna zaroori hai!');

    const formData = new FormData();
    formData.append('bannerImage', imageFile);
    if (targetLink) formData.append('targetLink', targetLink);

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/banners/add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('Banner add ho gaya!');
        document.getElementById('addBannerForm').reset();
        loadBanners();
      } else {
        alert(data.message || 'Banner upload fail ho gaya');
      }
    } catch (err) {
      alert('Banner submit error');
    }
  });

  // Global Settings Save
  document.getElementById('globalSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('defaultAdvancePayment', document.getElementById('settingDefaultAdvance').value);
    formData.append('upiId', document.getElementById('settingUpiId').value);
    formData.append('whatsappNumber', document.getElementById('settingWhatsapp').value);
    formData.append('announcement1', document.getElementById('announcement1').value);
    formData.append('announcement2', document.getElementById('announcement2').value);
    formData.append('announcement3', document.getElementById('announcement3').value);

    const qrFile = document.getElementById('settingQrFile').files[0];
    if (qrFile) formData.append('qrImage', qrFile);

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/settings/update`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings saved successfully!');
      } else {
        alert(data.message || 'Settings update fail');
      }
    } catch (err) {
      alert('Settings network error');
    }
  });

  // Product Add / Update with Selective Image Management & Spinner
  document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editProductId').value;
    const isEditing = Boolean(editId);

    const submitBtn = document.getElementById('pSubmitBtn');
    const spinner = document.getElementById('pBtnSpinner');
    const btnText = document.getElementById('pBtnText');

    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.innerText = isEditing ? 'Updating...' : 'Uploading & Saving...';

    const formData = new FormData();
    formData.append('title', document.getElementById('pTitle').value);
    formData.append('category', document.getElementById('pCategory').value);
    formData.append('price', document.getElementById('pPrice').value);
    formData.append('mrp', document.getElementById('pMrp').value);
    formData.append('inStock', document.getElementById('pInStock').checked);

    // Editor का कंटेंट अब सही से निकलेगा
    const descriptionHtml = quillEditor.root.innerHTML;
    formData.append('description', descriptionHtml);
    // YouTube Link 
    formData.append('youtubeLink', document.getElementById('pYoutubeLink').value);

    // Advanced Variants Extract karna
    let variantsArray = [];
    document.querySelectorAll('.variant-block').forEach(block => {
      const label = block.querySelector('.var-label').value;
      const hasDifferentPrice = block.querySelector('.var-price-cb').checked;

      let options = [];
      block.querySelectorAll('.option-row').forEach(row => {
        const name = row.querySelector('.opt-name').value.trim();
        const price = row.querySelector('.opt-price').value;
        if (name) {
          options.push({ name: name, price: hasDifferentPrice ? Number(price) : null });
        }
      });

      if (label && options.length > 0) {
        variantsArray.push({ label, hasDifferentPrice, options });
      }
    });

    formData.append('variants', JSON.stringify(variantsArray));

    const customAdv = document.getElementById('pCustomAdvance').value;
    if (customAdv) formData.append('advancePayment', customAdv);

    const imageFiles = document.getElementById('pImageFile').files;

    if (!isEditing && imageFiles.length === 0) {
      resetProductSubmitBtn(isEditing);
      return alert('Kam se kam 1 image upload karna zaroori hai');
    }

    const totalImagesCount = (isEditing ? editProductCurrentImages.length : 0) + imageFiles.length;
    if (totalImagesCount > 4) {
      resetProductSubmitBtn(isEditing);
      return alert(`Aap maximum 4 images hi rakh sakte hain. Current: ${totalImagesCount}`);
    }

    for (let i = 0; i < imageFiles.length; i++) {
      formData.append('images', imageFiles[i]);
    }

    if (isEditing) {
      formData.append('existingImages', JSON.stringify(editProductCurrentImages));
    }

    const url = isEditing ? `${CONFIG.BASE_URL}/products/update/${editId}` : `${CONFIG.BASE_URL}/products/add`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        alert(isEditing ? 'Product details updated!' : 'Product added successfully!');
        closeProductForm();
        loadAdminProducts();
      } else {
        alert(data.message || 'Product save error');
      }
    } catch (err) {
      console.error(err);
      alert('Server error while saving product.');
    } finally {
      resetProductSubmitBtn(isEditing);
    }
  });
}

function resetProductSubmitBtn(isEditing) {
  const submitBtn = document.getElementById('pSubmitBtn');
  const spinner = document.getElementById('pBtnSpinner');
  const btnText = document.getElementById('pBtnText');
  submitBtn.disabled = false;
  spinner.style.display = 'none';
  btnText.innerText = isEditing ? 'Update Product Details' : 'Save Product';
}

/* ========================================================
   ORDERS SECTION LOGIC
======================================================== */
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/all`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success && data.orders) {
      allOrdersData = data.orders;
      filterOrders('All');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Koi order nahi mila.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Orders load error</td></tr>';
  }
}

function filterOrders(statusFilter) {
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.includes(statusFilter)) btn.classList.add('active');
  });

  const tbody = document.getElementById('ordersTableBody');
  let filtered = allOrdersData;
  if (statusFilter !== 'All') {
    filtered = allOrdersData.filter(o => o.orderStatus === statusFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No ${statusFilter} orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((o) => {
    const productFormatted = o.products && o.products.length > 0
      ? o.products.map(p => `<strong>${p.quantity || 1} ×</strong> ${p.title}`).join('<br/>')
      : 'No product info';

    let actionHTML = '';
    if (o.orderStatus === 'Pending') {
      actionHTML = `<button onclick="updateOrderStatus('${o._id}', 'Accepted')" class="btn-action btn-accept">Accept Order</button>`;
    } else if (o.orderStatus === 'Accepted') {
      actionHTML = `<button onclick="updateOrderStatus('${o._id}', 'Packed')" class="btn-action btn-pack">Mark Packed</button>`;
    } else if (o.orderStatus === 'Packed') {
      actionHTML = `
        <input type="text" placeholder="Courier (Delhivery)" id="courier_${o._id}" style="width: 100%; margin-bottom: 4px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.78rem;"/>
        <input type="text" placeholder="Tracking ID" id="track_${o._id}" style="width: 100%; margin-bottom: 4px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.78rem;"/>
        <button onclick="dispatchOrder('${o._id}')" class="btn-action btn-dispatch" style="width: 100%;">Dispatch</button>
      `;
    } else if (o.orderStatus === 'Dispatched') {
      actionHTML = `
        <div style="font-size: 0.78rem; margin-bottom: 4px; color: #475569;">
          <strong>AWB:</strong> ${o.trackingId || 'N/A'}<br/>
          <strong>Via:</strong> ${o.courierName || 'Speed Post'}
        </div>
        <button onclick="updateOrderStatus('${o._id}', 'Delivered')" class="btn-action btn-deliver" style="width: 100%;">Mark Delivered</button>
      `;
    } else if (o.orderStatus === 'Delivered') {
      actionHTML = `<span style="color: var(--success); font-weight: 700; font-size: 0.8rem;">✔ Delivered</span>`;
    }

    const dateStr = new Date(o.createdAt).toLocaleDateString('en-IN');

    return `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="viewOrderDetail('${o._id}')" style="color: var(--primary); font-weight: 700; text-decoration: underline;">
            ${o.orderId || ('#' + o._id.slice(-6))}
          </a><br/>
          <small style="color: #64748b;">${dateStr}</small>
        </td>
        <td>
          <strong>${o.shippingDetails?.name || 'N/A'}</strong><br/>
          <span style="font-size: 0.8rem;">📞 ${o.customerPhone}</span><br/>
          <small style="color: #64748b;">${o.shippingDetails?.address || ''}, PIN: ${o.shippingDetails?.pincode || ''}</small>
        </td>
        <td>
          <div style="margin-bottom: 4px; font-size: 0.82rem;">${productFormatted}</div>
          <span class="badge-paid">${o.paymentType === 'FULL_PAID' ? 'Fully Paid' : 'COD (Adv ₹' + (o.amountToPayOnline || 0) + ')'}</span>
        </td>
        <td>
          <span class="badge-status">${o.orderStatus || 'Pending'}</span>
        </td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');
}

function viewOrderDetail(orderId) {
  const order = allOrdersData.find(o => o._id === orderId);
  if (!order) return;

  const origin = window.location.origin;
  const content = document.getElementById('orderModalContent');

  const productsHTML = order.products.map(p => {
    const productLink = `${origin}/frontend/product.html?id=${p.productId || p._id}`;
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 6px; border-bottom: 1px solid var(--border);">
        <div style="flex: 1; padding-right: 10px;">
          <span style="font-weight: 700; color: #1e293b;">${p.quantity || 1} × </span>
          <a href="${productLink}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; word-break: break-word;">
            ${p.title} 🔗
          </a>
        </div>
        <div style="font-weight: 700; white-space: nowrap;">₹${p.price}</div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div style="margin-bottom: 14px; font-size: 0.88rem; line-height: 1.5;">
      <p><strong>Order ID:</strong> <span style="color: #64748b;">${order.orderId || order._id}</span></p>
      <p><strong>Customer:</strong> ${order.shippingDetails?.name || 'N/A'}</p>
      <p><strong>Phone:</strong> <a href="tel:${order.customerPhone}" style="color: var(--primary); text-decoration: none;">📞 ${order.customerPhone}</a></p>
      <p><strong>Address:</strong> ${order.shippingDetails?.address || ''}, ${order.shippingDetails?.city || ''} (PIN: ${order.shippingDetails?.pincode || ''})</p>
      <p><strong>Payment Mode:</strong> <span class="badge-paid">${order.paymentType}</span> (Online Paid: ₹${order.amountToPayOnline || 0})</p>
      <p style="margin-top: 4px;"><strong>Status:</strong> <span class="badge-status">${order.orderStatus}</span></p>
    </div>
    <h4 style="margin-bottom: 8px; font-size: 0.92rem;">Ordered Items (Click to view product):</h4>
    <div style="background: #f8fafc; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 14px;">
      ${productsHTML}
    </div>
  `;

  document.getElementById('orderDetailModal').style.display = 'flex';
}

function closeOrderModal() {
  document.getElementById('orderDetailModal').style.display = 'none';
}

async function updateOrderStatus(orderId, newStatus) {
  if (!confirm(`Mark this order as ${newStatus}?`)) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ orderStatus: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
    } else {
      alert('Update failed: ' + data.message);
    }
  } catch (err) {
    alert('Server Update error');
  }
}

async function dispatchOrder(orderId) {
  const courierName = document.getElementById(`courier_${orderId}`).value.trim();
  const trackingId = document.getElementById(`track_${orderId}`).value.trim();

  if (!trackingId || !courierName) {
    return alert('Dispatch ke liye Courier Name aur Tracking ID dono zaroori hain!');
  }

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ orderStatus: 'Dispatched', trackingId, courierName })
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
    } else {
      alert('Dispatch failed: ' + data.message);
    }
  } catch (err) {
    alert('Server Update error');
  }
}

/* ========================================================
   PRODUCTS SECTION LOGIC
======================================================== */
// admin.js का अपडेटेड फंक्शन
async function loadAdminProducts() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  try {
    // Yahan URL mein ?admin=true lagaya gaya hai
    const res = await fetch(`${CONFIG.BASE_URL}/products?admin=true`);
    const data = await res.json();
    allProductsList = data.products || data.data || [];
    document.getElementById('productCountBadge').innerText = `${allProductsList.length} Products`;

    // Default load pe jo bhi current filter select hai uske hisaab se render karega
    handleProductSearch();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Failed to load products.</td></tr>';
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Koi product nahi mila.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map((p) => {
    // 👉 बदलाव यहाँ है: पहले thumbnailUrl चेक करेगा, नहीं मिला तो पुरानी इमेज उठाएगा
    const displayImg = p.thumbnailUrl || ((p.images && p.images.length > 0) ? p.images[0] : (p.imageUrl || 'https://via.placeholder.com/60'));

    const categoryName = (p.category && p.category.name) ? p.category.name : (p.category || 'N/A');

    const stockBadge = p.inStock === false
      ? '<span style="color: red; font-size:0.75rem; font-weight:bold;">Out of Stock</span>'
      : '<span style="color: green; font-size:0.75rem; font-weight:bold;">In Stock</span>';

    return `
      <tr>
        <td>
          <img src="${displayImg}" alt="${p.title}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border);" />
        </td>
        <td>
          <strong style="color: #1e293b;">${p.title}</strong><br>
          ${stockBadge}
        </td>
        <td><span style="font-size: 0.8rem; color: #475569;">${categoryName}</span></td>
        <td>
          <strong style="color: var(--success);">₹${p.price}</strong> 
          ${p.mrp ? `<small style="text-decoration: line-through; color: #94a3b8; margin-left: 4px;">₹${p.mrp}</small>` : ''}
          <div style="font-size: 0.72rem; color: #64748b;">Adv: ₹${p.advancePayment || 'Default'}</div>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
            <button onclick="copyProductLink('${p._id}')" class="btn-action" style="background: #0284c7; color: white;">Copy Link</button>
            <button onclick="editProduct('${p._id}')" class="btn-action" style="background: #f59e0b; color: #000;">Edit</button>
            <button onclick="deleteProduct('${p._id}')" class="btn-action" style="background: var(--danger); color: #fff;">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// function handleProductSearch() {
//   const query = document.getElementById('productSearchInput').value.toLowerCase().trim();
//   const sortVal = document.getElementById('productSortSelect').value;

//   // पहले नाम से सर्च करें
//   let filtered = allProductsList.filter(p => p.title.toLowerCase().includes(query));

//   // फिर शॉर्टिंग अप्लाई करें (Date या Price)
//   if (sortVal === 'newest') {
//     filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
//   } else if (sortVal === 'oldest') {
//     filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
//   } else if (sortVal === 'priceHigh') {
//     filtered.sort((a, b) => b.price - a.price);
//   } else if (sortVal === 'priceLow') {
//     filtered.sort((a, b) => a.price - b.price);
//   }

//   renderProductsTable(filtered);
// }
// ग्लोबल वेरिएबल टैब का स्टेटस ट्रैक करने के लिए
let currentProductFilter = 'all';

function setProductFilter(status) {
  currentProductFilter = status;

  // UI में एक्टिव टैब का कलर बदलें
  document.querySelectorAll('#productFilterTabs .sub-tab-btn').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // फ़िल्टर अप्लाई करें
  handleProductSearch();
}

function handleProductSearch() {
  const searchInput = document.getElementById('productSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const sortSelect = document.getElementById('productSortSelect');
  const sortVal = sortSelect ? sortSelect.value : 'newest';

  let filtered = allProductsList;

  // 1. Status Filter (All / Active / Inactive)
  if (currentProductFilter === 'active') {
    filtered = filtered.filter(p => p.inStock !== false); // Default active maante hain agar false nahi hai
  } else if (currentProductFilter === 'inactive') {
    filtered = filtered.filter(p => p.inStock === false);
  }

  // 2. Search Filter (By Title)
  if (query) {
    filtered = filtered.filter(p => p.title.toLowerCase().includes(query));
  }

  // 3. Sorting
  if (sortVal === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (sortVal === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (sortVal === 'priceHigh') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortVal === 'priceLow') {
    filtered.sort((a, b) => a.price - b.price);
  }

  // Count update karein
  const countBadge = document.getElementById('productCountBadge');
  if (countBadge) {
    countBadge.innerText = `${filtered.length} Products`;
  }

  // Table render karein
  renderProductsTable(filtered);
}

function copyProductLink(productId) {
  const origin = window.location.origin;
  const directLink = `${origin}/frontend/product.html?id=${productId}`;

  navigator.clipboard.writeText(directLink).then(() => {
    alert('Product link copied to clipboard!\n' + directLink);
  }).catch(() => {
    prompt('Copy this link:', directLink);
  });
}

function openAddProductModal() {
  editProductCurrentImages = [];
  document.getElementById('editProductId').value = '';
  document.getElementById('addProductForm').reset();

  // Quill Editor को खाली करें
  if (quillEditor) quillEditor.root.innerHTML = '';

  document.getElementById('productFormTitle').innerText = 'Add New Product';
  document.getElementById('existingImagesContainer').style.display = 'none';
  document.getElementById('pImageFile').required = true;
  document.getElementById('pImageLabel').innerText = 'Upload Images (Max 3) *';
  document.getElementById('pBtnText').innerText = 'Save Product';
  document.getElementById('productFormWrapper').style.display = 'block';
  document.getElementById('productFormWrapper').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('pYoutubeLink').value = '';
  document.getElementById('variantsContainer').innerHTML = ''; // Pehle se pade variants clear karo
}

function editProduct(productId) {
  const product = allProductsList.find(p => p._id === productId);
  if (!product) return;

  document.getElementById('editProductId').value = product._id;
  document.getElementById('pTitle').value = product.title || '';
  document.getElementById('pPrice').value = product.price || '';
  document.getElementById('pMrp').value = product.mrp || '';
  document.getElementById('pCustomAdvance').value = product.advancePayment || '';
  document.getElementById('pInStock').checked = product.inStock !== false;

  // Quill Editor में पुराना डिस्क्रिप्शन लोड करें
  if (quillEditor) quillEditor.root.innerHTML = product.description || '';

  const catVal = (product.category && product.category._id) ? product.category._id : product.category;
  if (catVal) document.getElementById('pCategory').value = catVal;

  // 1. YouTube Link Fix: डेटाबेस से लिंक निकालकर इनपुट में डालना
  document.getElementById('pYoutubeLink').value = product.youtubeLink || '';

  // 2. Variants Fix: पुराने वेरिएंट्स को एडिट मोड में लोड करना
  document.getElementById('variantsContainer').innerHTML = ''; // पहले बॉक्स को खाली करें
  if (product.variants && product.variants.length > 0) {
    // अगर वेरिएंट्स सेव हैं, तो लूप चलाकर उनके ब्लॉक बनाएं
    product.variants.forEach(variant => {
      addVariantBlock(variant);
    });
  }

  // इमेजेस लोड करने का पुराना लॉजिक
  editProductCurrentImages = Array.isArray(product.images) ? [...product.images] : (product.imageUrl ? [product.imageUrl] : []);
  renderExistingImagesPreview();

  document.getElementById('pImageFile').required = false;
  document.getElementById('pImageLabel').innerText = 'Add More Images (Optional)';
  document.getElementById('productFormTitle').innerText = 'Edit Product Details';
  document.getElementById('pBtnText').innerText = 'Update Product Details';

  document.getElementById('productFormWrapper').style.display = 'block';
  document.getElementById('productFormWrapper').scrollIntoView({ behavior: 'smooth' });
}

function renderExistingImagesPreview() {
  const container = document.getElementById('existingImagesContainer');
  const grid = document.getElementById('existingImagesGrid');

  if (editProductCurrentImages.length === 0) {
    container.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  grid.innerHTML = editProductCurrentImages.map((imgUrl, index) => `
    <div class="thumb-item">
      <img src="${imgUrl}" alt="Photo" />
      <button type="button" class="thumb-delete-btn" onclick="removeExistingImage(${index})">&times;</button>
    </div>
  `).join('');
}

function removeExistingImage(index) {
  editProductCurrentImages.splice(index, 1);
  renderExistingImagesPreview();
}

function closeProductForm() {
  document.getElementById('productFormWrapper').style.display = 'none';
  document.getElementById('addProductForm').reset();
  if (quillEditor) quillEditor.root.innerHTML = '';
  editProductCurrentImages = [];
}
function resetCategoryForm() {
  document.getElementById('editCategoryId').value = '';
  document.getElementById('addCategoryForm').reset();
  document.getElementById('catSubmitBtn').textContent = 'Add';
  document.getElementById('catCancelBtn').style.display = 'none';
  document.getElementById('catImageInput').required = true;
}

function editCategory(id, name) {
  document.getElementById('editCategoryId').value = id;
  document.getElementById('catNameInput').value = name;
  document.getElementById('catSubmitBtn').textContent = 'Update';
  document.getElementById('catCancelBtn').style.display = 'inline-block';
  document.getElementById('catImageInput').required = false; // Edit me image optional hai
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    if ((await res.json()).success) loadAdminCategories();
  } catch (err) { alert('Delete error'); }
}

/* ========================================================
   CATEGORIES, BANNERS & SETTINGS
======================================================== */
async function loadAdminCategories() {
  const select = document.getElementById('pCategory');
  const list = document.getElementById('adminCategoryList');
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/categories`);
    const data = await res.json();
    if (data.success && data.data) {
      select.innerHTML = '<option value="">Select Category</option>' + data.data.map((c) => `<option value="${c._id}">${c.name}</option>`).join('');
      list.innerHTML = data.data.map((c) => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
          <span style="font-weight:600;">• ${c.name}</span>
          <div style="display:flex; gap:8px;">
            <button onclick="editCategory('${c._id}', '${c.name}')" class="btn-action" style="background: #f59e0b; color: #000;">Edit</button>
            <button onclick="deleteCategory('${c._id}')" class="btn-action" style="background: var(--danger); color: #fff;">Delete</button>
          </div>
        </li>`).join('');
    }
  } catch (err) { console.error('Categories error'); }
}

async function loadCurrentSettings() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/settings`);
    const data = await res.json();
    if (data.success && data.data) {
      // 300 वाले बग का फिक्स (दोनों नामों को चेक करेगा)
      document.getElementById('settingDefaultAdvance').value = data.data.defaultAdvanceAmount || data.data.defaultAdvancePayment || 300;
      document.getElementById('settingUpiId').value = data.data.upiId || '';
      document.getElementById('settingWhatsapp').value = data.data.whatsappNumber || '';

      // अनाउंसमेंट प्री-पॉपुलेट करने का फिक्स (ताकि नल न हों)
      document.getElementById('announcement1').value = data.data.announcement1 || '';
      document.getElementById('announcement2').value = data.data.announcement2 || '';
      document.getElementById('announcement3').value = data.data.announcement3 || '';
    }
  } catch (err) {
    console.error('Settings error');
  }
}

async function loadBanners() {
  const list = document.getElementById('adminBannerList');
  if (!list) return;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/banners/all`);
    const responseData = await res.json();
    const bannersArray = responseData.banners || responseData.data || [];

    if (responseData.success && bannersArray.length > 0) {
      list.innerHTML = bannersArray.map((b) => `
        <li style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: #fff;">
          <img src="${b.imageUrl}" alt="Banner" style="width: 120px; height: 60px; object-fit: cover; border-radius: 6px;">
          <div style="flex-grow: 1;">
            <strong>Link:</strong> ${b.targetLink || 'No Link'}
          </div>
          <button onclick="deleteBanner('${b._id}')" class="btn-action" style="background: var(--danger); color: #fff;">Delete</button>
        </li>
      `).join('');
    } else {
      list.innerHTML = '<li style="color: #64748b;">Koi banner upload nahi kiya gaya hai.</li>';
    }
  } catch (err) {
    list.innerHTML = '<li style="color: red;">Banners load karne mein error aayi.</li>';
  }
}

function filterOrders(statusFilter = null) {
  if (statusFilter) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.innerText.includes(statusFilter)) btn.classList.add('active');
    });
  }

  const activeBtn = document.querySelector('.sub-tab-btn.active');
  const activeStatus = activeBtn ? activeBtn.innerText : 'All';

  // Safety check lagaya gaya hai
  const searchInput = document.getElementById('orderSearchInput');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  let filtered = allOrdersData;

  // 1. Status Filter
  if (!activeStatus.includes('All')) {
    filtered = filtered.filter(o => o.orderStatus === activeStatus || activeStatus.includes(o.orderStatus));
  }

  // 2. Search Filter
  if (searchQuery) {
    filtered = filtered.filter(o =>
      (o.orderId && o.orderId.toLowerCase().includes(searchQuery)) ||
      (o._id && o._id.toLowerCase().includes(searchQuery)) ||
      (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
      (o.shippingDetails?.name && o.shippingDetails.name.toLowerCase().includes(searchQuery))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No orders found.</td></tr>`;
    return;
  }

  // HTML Rendering (Tumhara purana design hi rakha hai)
  tbody.innerHTML = filtered.map((o) => {
    const productFormatted = o.products && o.products.length > 0
      ? o.products.map(p => `<strong>${p.quantity || 1} ×</strong> ${p.title}`).join('<br/>')
      : 'No product info';

    let actionHTML = '';
    if (o.orderStatus === 'Pending') {
      actionHTML = `<button onclick="updateOrderStatus('${o._id}', 'Accepted')" class="btn-action btn-accept">Accept Order</button>`;
    } else if (o.orderStatus === 'Accepted') {
      actionHTML = `<button onclick="updateOrderStatus('${o._id}', 'Packed')" class="btn-action btn-pack">Mark Packed</button>`;
    } else if (o.orderStatus === 'Packed') {
      actionHTML = `
        <input type="text" placeholder="Courier (Delhivery)" id="courier_${o._id}" style="width: 100%; margin-bottom: 4px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.78rem;"/>
        <input type="text" placeholder="Tracking ID" id="track_${o._id}" style="width: 100%; margin-bottom: 4px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.78rem;"/>
        <button onclick="dispatchOrder('${o._id}')" class="btn-action btn-dispatch" style="width: 100%;">Dispatch</button>
      `;
    } else if (o.orderStatus === 'Dispatched') {
      actionHTML = `
        <div style="font-size: 0.78rem; margin-bottom: 4px; color: #475569;">
          <strong>AWB:</strong> ${o.trackingId || 'N/A'}<br/>
          <strong>Via:</strong> ${o.courierName || 'Speed Post'}
        </div>
        <button onclick="updateOrderStatus('${o._id}', 'Delivered')" class="btn-action btn-deliver" style="width: 100%;">Mark Delivered</button>
      `;
    } else if (o.orderStatus === 'Delivered') {
      actionHTML = `<span style="color: var(--success); font-weight: 700; font-size: 0.8rem;">✔ Delivered</span>`;
    }

    const dateStr = new Date(o.createdAt).toLocaleDateString('en-IN');
    return `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="viewOrderDetail('${o._id}')" style="color: var(--primary); font-weight: 700; text-decoration: underline;">
            ${o.orderId || ('#' + o._id.slice(-6))}
          </a><br/><small style="color: #64748b;">${dateStr}</small>
        </td>
        <td>
          <strong>${o.shippingDetails?.name || 'N/A'}</strong><br/>
          <span style="font-size: 0.8rem;">📞 ${o.customerPhone}</span><br/>
          <small style="color: #64748b;">${o.shippingDetails?.address || ''}, PIN: ${o.shippingDetails?.pincode || ''}</small>
        </td>
        <td>
          <div style="margin-bottom: 4px; font-size: 0.82rem;">${productFormatted}</div>
          <span class="badge-paid">${o.paymentType === 'FULL_PAID' ? 'Fully Paid' : 'COD (Adv ₹' + (o.amountToPayOnline || 0) + ')'}</span>
        </td>
        <td><span class="badge-status">${o.orderStatus || 'Pending'}</span></td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');
}
async function deleteProduct(id) {
  if (!confirm('Warning: Is product ko delete karna chahte hain?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    if ((await res.json()).success) loadAdminProducts();
  } catch (err) { alert('Product delete error'); }
}
async function deleteBanner(id) {
  if (!confirm('Are you sure you want to delete this banner?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/banners/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    if ((await res.json()).success) loadBanners();
  } catch (err) { alert('Banner delete error'); }
}

// 1. Variant Block Banane ka function (Add aur Edit dono ke liye)
function addVariantBlock(variantData = null) {
  const container = document.getElementById('variantsContainer');
  const block = document.createElement('div');
  block.className = 'variant-block';
  block.style.cssText = 'border: 1px solid #cbd5e1; padding: 15px; margin-bottom: 15px; border-radius: 8px; background: #fff;';

  const predefinedTypes = ['Color', 'Size', 'Model', 'Storage', 'RAM', 'Material'];
  let currentLabel = variantData ? variantData.label : '';
  let hasDiffPrice = variantData ? variantData.hasDifferentPrice : false;
  let isCustom = currentLabel && !predefinedTypes.includes(currentLabel);

  let selectOptions = '<option value="">-- Select Variant Type --</option>';
  predefinedTypes.forEach(type => {
    selectOptions += `<option value="${type}" ${currentLabel === type ? 'selected' : ''}>${type}</option>`;
  });
  if (isCustom) selectOptions += `<option value="${currentLabel}" selected>${currentLabel} (Custom)</option>`;

  block.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;">
      <select class="var-label" style="flex: 1; min-width: 150px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;" required>
        ${selectOptions}
      </select>
      <label style="display: flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer; color: #b45309; background: #fef3c7; padding: 6px 10px; border-radius: 4px;">
        <input type="checkbox" class="var-price-cb" ${hasDiffPrice ? 'checked' : ''} onchange="toggleVariantPrices(this)">
        Price Different?
      </label>
      <button type="button" onclick="this.parentElement.parentElement.remove()" style="background: var(--danger); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Remove</button>
    </div>
    
    <div class="options-container" style="padding-left: 10px; border-left: 2px solid #e2e8f0;">
      <!-- Options yahan add honge -->
    </div>
    
    <button type="button" onclick="addOptionRow(this.previousElementSibling)" style="background: #e2e8f0; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; margin-top: 10px; cursor: pointer;">+ Add Option (e.g. Red, XL)</button>
  `;

  container.appendChild(block);
  const optionsContainer = block.querySelector('.options-container');

  // Edit Mode: Purane options load karna
  if (variantData && variantData.options && variantData.options.length > 0) {
    variantData.options.forEach(opt => addOptionRow(optionsContainer, opt.name, opt.price, hasDiffPrice));
  } else {
    // Add Mode: Default ek khali option box dena
    addOptionRow(optionsContainer, '', '', hasDiffPrice);
  }
}

// 2. Options (Red, Black) add karne ka function
function addOptionRow(container, name = '', price = '', showPrice = false) {
  const row = document.createElement('div');
  row.className = 'option-row';
  row.style.cssText = 'display: flex; gap: 10px; margin-top: 10px; align-items: center;';

  row.innerHTML = `
    <input type="text" class="opt-name" placeholder="Option (e.g. Red)" value="${name}" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" required>
    
    <input type="number" class="opt-price" placeholder="New Price (₹)" value="${price}" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; display: ${showPrice ? 'block' : 'none'};" ${showPrice ? 'required' : ''}>
    
    <button type="button" onclick="this.parentElement.remove()" style="color: var(--danger); border: none; background: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
  `;
  container.appendChild(row);
}

// 3. Checkbox par tick karte hi Price wale box show/hide karna
function toggleVariantPrices(checkbox) {
  const optionsContainer = checkbox.closest('.variant-block').querySelector('.options-container');
  const priceInputs = optionsContainer.querySelectorAll('.opt-price');
  priceInputs.forEach(input => {
    if (checkbox.checked) {
      input.style.display = 'block';
      input.required = true; // Price daalna compulsory ho jayega
    } else {
      input.style.display = 'none';
      input.required = false;
      input.value = ''; // Hide hone par value clear kar dena
    }
  });
}
