let adminToken = localStorage.getItem('isLoggedIn') === 'true' ? true : null;
let allOrdersData = [];
let allProductsList = [];
let editProductCurrentImages = [];
let quillEditor;

// --- PAGINATION VARIABLES ---
let filteredOrdersList = [];
let currentOrderPage = 1;
const ORDERS_PER_PAGE = 50;

// --- FLAGS FIX ---
let isProductsLoaded = false;
let isCategoriesLoaded = false;
let isBannersLoaded = false;
let isSettingsLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showDashboard();
  } else {
    showLogin();
  }
  setupAdminEvents();

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
}

function setupAdminEvents() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) targetPanel.classList.add('active');
      window.location.hash = tabId;
      if (tabId === 'productsTab' && !isProductsLoaded) {
          loadAdminProducts();
          isProductsLoaded = true;
      }
      if (tabId === 'categoriesTab' && !isCategoriesLoaded) {
          loadAdminCategories();
          isCategoriesLoaded = true;
      }
      if (tabId === 'banners' && !isBannersLoaded) {
          loadBanners();
          isBannersLoaded = true;
      }
      if (tabId === 'settingsTab' && !isSettingsLoaded) {
          loadCurrentSettings();
          isSettingsLoaded = true;
      }
    });
  });

  const currentHash = window.location.hash.replace('#', '');
  if (currentHash) {
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${currentHash}"]`);
    if (activeBtn) {
      activeBtn.click();
    }
  }

  // 🌟 Secure Login Code
  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        adminToken = true; 
        localStorage.setItem('isLoggedIn', 'true'); 
        showDashboard();
      } else {
        alert(data.message || 'Invalid Credentials');
      }
    } catch (err) {
      alert('Login error, server chal raha hai check karein');
    }
  });

  // 🌟 Secure Logout Code
  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    try {
      await fetch(`${CONFIG.BASE_URL}/admin/logout`, { 
        method: 'POST', 
        credentials: 'include' 
      });
    } catch(e) { console.log('Logout API error'); }
    
    localStorage.removeItem('isLoggedIn');
    adminToken = null;
    showLogin();
  });

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
      const res = await fetch(url, { method: method, credentials: 'include', body: formData });
      const data = await res.json();
      if (data.success) {
        alert(editId ? 'Category Updated!' : 'Category Added!');
        resetCategoryForm();
        loadAdminCategories();
      } else { alert(data.message || 'Category save nahi ho saki'); }
    } catch (err) { alert('Category save error'); }
  });

  document.getElementById('addBannerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const imageFile = document.getElementById('bannerImageInput').files[0];
    const selectedProductId = document.getElementById('bannerSelectedProductId').value;

    if (!imageFile) return alert('Banner Image upload karna zaroori hai!');

    const formData = new FormData();
    formData.append('bannerImage', imageFile);
    if (selectedProductId) {
      formData.append('targetLink', selectedProductId);
    }

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/banners/add`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('Banner add ho gaya!');
        document.getElementById('addBannerForm').reset();
        document.getElementById('bannerSelectedProductId').value = ''; 
        loadBanners();
      } else {
        alert(data.message || 'Banner upload fail ho gaya');
      }
    } catch (err) {
      alert('Banner submit error');
    }
  });

  document.getElementById('globalSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('defaultAdvancePayment', document.getElementById('settingDefaultAdvance').value);
    formData.append('upiId', document.getElementById('settingUpiId').value);
    formData.append('whatsappNumber', document.getElementById('settingWhatsapp').value);
    formData.append('announcement1', document.getElementById('announcement1').value);
    formData.append('announcement2', document.getElementById('announcement2').value);
    formData.append('announcement3', document.getElementById('announcement3').value);
    formData.append('howToOrderTitle', document.getElementById('settingVideoTitle').value);
    formData.append('howToOrderVideoUrl', document.getElementById('settingVideoUrl').value);
    formData.append('pendingOrderExpiryHours', document.getElementById('settingExpiryHours').value);

    const qrFile = document.getElementById('settingQrFile').files[0];
    if (qrFile) formData.append('qrImage', qrFile);

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/settings/update`, {
        method: 'PUT',
        credentials: 'include',
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
    formData.append('priority', document.getElementById('productPriority').value || 0);

    const descriptionHtml = quillEditor.root.innerHTML;
    formData.append('description', descriptionHtml);
    formData.append('youtubeLink', document.getElementById('pYoutubeLink').value);

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
        credentials: 'include',
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

  const bannerImageInput = document.getElementById('bannerImageInput');
  if (bannerImageInput) {
    bannerImageInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = function () {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const isWidthValid = width >= 1250 && width <= 1310;
        const isHeightValid = height >= 690 && height <= 750;

        if (!isWidthValid || !isHeightValid) {
          alert(`❌ बैनर का साइज़ गलत है!\n\nआपने ${width}x${height} पिक्सल की फोटो डाली है।\nकृपया बिल्कुल 'YouTube Thumbnail' (1280x720) साइज़ का ही बैनर अपलोड करें।`);
          e.target.value = ''; 
        }
      };
    });
  }
}

function resetProductSubmitBtn(isEditing) {
  const submitBtn = document.getElementById('pSubmitBtn');
  const spinner = document.getElementById('pBtnSpinner');
  const btnText = document.getElementById('pBtnText');
  submitBtn.disabled = false;
  spinner.style.display = 'none';
  btnText.innerText = isEditing ? 'Update Product Details' : 'Save Product';
}

async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/all`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success && data.orders) {
      allOrdersData = data.orders;
      updateOrderTabCounts();
      filterOrders('All');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Koi order nahi mila.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Orders load error</td></tr>';
  }
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
      <p><strong>Address:</strong> </br> Street- ${order.shippingDetails?.address || ''} </br> City - ${order.shippingDetails?.city || ''} </br> State - ${order.shippingDetails?.state || ''} (Country - India) </br> PIN: ${order.shippingDetails?.pincode || ''}</p>
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

// 🌟 Secure Order Updates
async function updateOrderStatus(orderId, newStatus) {
  if (!confirm(`Mark this order as ${newStatus}?`)) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderStatus: newStatus })
    });
    const data = await res.json();
    if (data.success) { loadOrders(); } 
    else { alert('Update failed: ' + data.message); }
  } catch (err) { alert('Server Update error'); }
}

async function dispatchOrder(orderId) {
  const courierName = document.getElementById(`courier_${orderId}`).value.trim();
  const trackingId = document.getElementById(`track_${orderId}`).value.trim();
  if (!trackingId || !courierName) return alert('Dispatch ke liye Courier Name aur Tracking ID dono zaroori hain!');
  
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderStatus: 'Dispatched', trackingId, courierName })
    });
    const data = await res.json();
    if (data.success) { loadOrders(); } 
    else { alert('Dispatch failed: ' + data.message); }
  } catch (err) { alert('Server Update error'); }
}

async function loadAdminProducts() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/products?admin=true`);
    const data = await res.json();
    allProductsList = data.products || data.data || [];
    document.getElementById('productCountBadge').innerText = `${allProductsList.length} Products`;
    handleProductSearch();
    setupBannerProductSearch();
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

let currentProductFilter = 'all';

function setProductFilter(status) {
  currentProductFilter = status;
  document.querySelectorAll('#productFilterTabs .sub-tab-btn').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  handleProductSearch();
}

function handleProductSearch() {
  const searchInput = document.getElementById('productSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const sortSelect = document.getElementById('productSortSelect');
  const sortVal = sortSelect ? sortSelect.value : 'newest';
  let filtered = [...allProductsList]; 

  if (currentProductFilter === 'active') {
    filtered = filtered.filter(p => p.inStock !== false);
  } else if (currentProductFilter === 'inactive') {
    filtered = filtered.filter(p => p.inStock === false);
  }

  if (query) {
    filtered = filtered.filter(p => p.title.toLowerCase().includes(query));
  }

  if (sortVal === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } else if (sortVal === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  } else if (sortVal === 'priceHigh') {
    filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  } else if (sortVal === 'priceLow') {
    filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  }

  const countBadge = document.getElementById('productCountBadge');
  if (countBadge) { countBadge.innerText = `${filtered.length} Products`; }

  renderProductsTable(filtered);
}

function copyProductLink(productId) {
  const origin = window.location.origin;
  const directLink = `${origin}/frontend/product.html?id=${productId}`;
  navigator.clipboard.writeText(directLink).then(() => {
    alert('Product link copied to clipboard!\n' + directLink);
  }).catch(() => { prompt('Copy this link:', directLink); });
}

// 🌟 Categories Load Bug Fix
async function openAddProductModal() {
  if (!isCategoriesLoaded) {
    await loadAdminCategories();
    isCategoriesLoaded = true;
  }
  editProductCurrentImages = [];
  document.getElementById('editProductId').value = '';
  document.getElementById('addProductForm').reset();
  document.getElementById('productPriority').value = '0';
  if (quillEditor) quillEditor.root.innerHTML = '';
  document.getElementById('productFormTitle').innerText = 'Add New Product';
  document.getElementById('existingImagesContainer').style.display = 'none';
  document.getElementById('pImageFile').required = true;
  document.getElementById('pImageLabel').innerText = 'Upload Images (Max 3) *';
  document.getElementById('pBtnText').innerText = 'Save Product';
  document.getElementById('productFormWrapper').style.display = 'block';
  document.getElementById('productFormWrapper').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('pYoutubeLink').value = '';
  document.getElementById('variantsContainer').innerHTML = '';
}

// 🌟 Categories Load Bug Fix
async function editProduct(productId) {
  if (!isCategoriesLoaded) {
    await loadAdminCategories();
    isCategoriesLoaded = true;
  }
  const product = allProductsList.find(p => p._id === productId);
  if (!product) return;

  document.getElementById('editProductId').value = product._id;
  document.getElementById('pTitle').value = product.title || '';
  document.getElementById('pPrice').value = product.price || '';
  document.getElementById('pMrp').value = product.mrp || '';
  document.getElementById('pCustomAdvance').value = product.advancePayment || '';
  document.getElementById('pInStock').checked = product.inStock !== false;
  document.getElementById('productPriority').value = product.priority || 0;

  if (quillEditor) quillEditor.root.innerHTML = product.description || '';

  const catVal = (product.category && product.category._id) ? product.category._id : product.category;
  if (catVal) document.getElementById('pCategory').value = catVal;

  document.getElementById('pYoutubeLink').value = product.youtubeLink || '';

  document.getElementById('variantsContainer').innerHTML = '';
  if (product.variants && product.variants.length > 0) {
    product.variants.forEach(variant => { addVariantBlock(variant); });
  }

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
  document.getElementById('catImageInput').required = false;
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    if ((await res.json()).success) loadAdminCategories();
  } catch (err) { alert('Delete error'); }
}

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
      document.getElementById('settingDefaultAdvance').value = data.data.defaultAdvanceAmount || data.data.defaultAdvancePayment || 300;
      document.getElementById('settingUpiId').value = data.data.upiId || '';
      document.getElementById('settingWhatsapp').value = data.data.whatsappNumber || '';
      document.getElementById('announcement1').value = data.data.announcement1 || '';
      document.getElementById('announcement2').value = data.data.announcement2 || '';
      document.getElementById('announcement3').value = data.data.announcement3 || '';
      if (document.getElementById('settingVideoTitle')) document.getElementById('settingVideoTitle').value = data.data.howToOrderTitle || '';
      if (document.getElementById('settingVideoUrl')) document.getElementById('settingVideoUrl').value = data.data.howToOrderVideoUrl || '';
      if (document.getElementById('settingExpiryHours')) document.getElementById('settingExpiryHours').value = data.data.pendingOrderExpiryHours || 48;
    }
  } catch (err) { console.error('Settings error'); }
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
  } catch (err) { list.innerHTML = '<li style="color: red;">Banners load karne mein error aayi.</li>'; }
}

let currentOrderStatusFilter = 'All';

function filterOrders(statusFilter = null) {
  if (statusFilter) {
    currentOrderStatusFilter = statusFilter;
    document.querySelectorAll('.sub-tabs-bar .sub-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick') === `filterOrders('${statusFilter}')`) {
        btn.classList.add('active');
      }
    });
  }

  const searchInput = document.getElementById('orderSearchInput');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  filteredOrdersList = allOrdersData; 

  if (currentOrderStatusFilter !== 'All') {
    filteredOrdersList = filteredOrdersList.filter(o => o.orderStatus === currentOrderStatusFilter);
  }

  if (searchQuery) {
    filteredOrdersList = filteredOrdersList.filter(o =>
      (o.orderId && o.orderId.toLowerCase().includes(searchQuery)) ||
      (o._id && o._id.toLowerCase().includes(searchQuery)) ||
      (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
      (o.shippingDetails?.name && o.shippingDetails.name.toLowerCase().includes(searchQuery))
    );
  }
  
  filteredOrdersList.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA; 
  });

  currentOrderPage = 1;
  renderOrdersTable();
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const totalOrders = filteredOrdersList.length;
  const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE) || 1;

  const prevBtn = document.getElementById('prevOrderPageBtn');
  const nextBtn = document.getElementById('nextOrderPageBtn');
  const pageInfo = document.getElementById('orderPageInfo');

  if (prevBtn) prevBtn.disabled = currentOrderPage === 1;
  if (nextBtn) nextBtn.disabled = currentOrderPage === totalPages;
  if (pageInfo) pageInfo.innerText = `Page ${currentOrderPage} of ${totalPages} (${totalOrders} Orders)`;

  if (totalOrders === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No orders found.</td></tr>`;
    return;
  }

  const startIndex = (currentOrderPage - 1) * ORDERS_PER_PAGE;
  const endIndex = startIndex + ORDERS_PER_PAGE;
  const paginatedOrders = filteredOrdersList.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedOrders.map((o) => {
    const productFormatted = o.products && o.products.length > 0
      ? o.products.map(p => `<strong>${p.quantity || 1} ×</strong> ${p.title}`).join('<br/>')
      : 'No product info';

    let actionHTML = '';
    if (o.orderStatus === 'Pending' || o.orderStatus === 'Screenshot Pending') {
      actionHTML = `
        <button onclick="updateOrderStatus('${o._id}', 'Accepted')" class="btn-action btn-accept" style="width: 100%; margin-bottom: 6px;">Accept Order</button>
        <button onclick="deleteSingleOrder('${o._id}')" class="btn-action" style="background-color: #dc3545; color: white; width: 100%;">Delete Order</button>
      `;
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
        <button onclick="updateOrderStatus('${o._id}', 'Delivered')" class="btn-action btn-deliver" style="width: 100%; margin-bottom: 6px;">Mark Delivered</button>
        <button onclick="updateOrderStatus('${o._id}', 'RTO')" class="btn-action" style="width: 100%; background: #991b1b; color: white;">Mark as RTO</button>
      `;
    } else if (o.orderStatus === 'Delivered') {
      actionHTML = `<span style="color: var(--success); font-weight: 700; font-size: 0.8rem;">✔ Delivered</span>`;
    } else if (o.orderStatus === 'RTO') {
      actionHTML = `<span style="color: #991b1b; font-weight: 700; font-size: 0.8rem;">↩ RTO (Returned)</span>`;
    }

    const orderDateObj = new Date(o.createdAt);
    const dateStr = orderDateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = orderDateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    let paymentBadgeText = o.paymentType === 'FULL_PAID' ? `Fully Paid (₹${o.amountToPayOnline || 0})` : `COD (Adv ₹${o.amountToPayOnline || 0})`;
    let paymentHTML = `<span class="badge-paid">${paymentBadgeText}</span>`;

    if (o.orderStatus === 'Pending' || o.orderStatus === 'Screenshot Pending') {
      paymentHTML += ` <button onclick="openEditPaymentModal('${o._id}')" title="Edit Payment" style="background: none; border: none; cursor: pointer; color: #d97706; font-size: 1rem; margin-left: 6px; vertical-align: middle;">✏️</button>`;
    }

    return `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="viewOrderDetail('${o._id}')" style="color: var(--primary); font-weight: 700; text-decoration: underline;">
            ${o.orderId || ('#' + o._id.slice(-6))}
          </a><br/><small style="color: #64748b;">📅 ${dateStr} <br/> 🕒 ${timeStr}</small>
        </td>
        <td>
          <strong>${o.shippingDetails?.name || 'N/A'}</strong><br/>
          <span style="font-size: 0.8rem;">📞 ${o.customerPhone}</span><br/>
          <small style="color: #64748b;">
            ${o.shippingDetails?.address || ''}, 
            ${o.shippingDetails?.city || ''}, 
            ${o.shippingDetails?.state || ''} - 
            PIN: ${o.shippingDetails?.pincode || ''}
          </small>
        </td>
        <td>
          <div style="margin-bottom: 4px; font-size: 0.82rem;">${productFormatted}</div>
          ${paymentHTML}
        </td>
        <td><span class="badge-status">${o.orderStatus || 'Pending'}</span></td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');
}

function changeOrderPage(direction) {
  currentOrderPage += direction;
  renderOrdersTable();
}

async function deleteProduct(id) {
  if (!confirm('Warning: Is product ko delete karna chahte hain?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/products/${id}`, { method: 'DELETE', credentials: 'include' });
    if ((await res.json()).success) loadAdminProducts();
  } catch (err) { alert('Product delete error'); }
}
async function deleteBanner(id) {
  if (!confirm('Are you sure you want to delete this banner?')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/banners/${id}`, { method: 'DELETE', credentials: 'include' });
    if ((await res.json()).success) loadBanners();
  } catch (err) { alert('Banner delete error'); }
}

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
    <div class="options-container" style="padding-left: 10px; border-left: 2px solid #e2e8f0;"></div>
    <button type="button" onclick="addOptionRow(this.previousElementSibling)" style="background: #e2e8f0; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; margin-top: 10px; cursor: pointer;">+ Add Option (e.g. Red, XL)</button>
  `;
  container.appendChild(block);
  const optionsContainer = block.querySelector('.options-container');

  if (variantData && variantData.options && variantData.options.length > 0) {
    variantData.options.forEach(opt => addOptionRow(optionsContainer, opt.name, opt.price, hasDiffPrice));
  } else { addOptionRow(optionsContainer, '', '', hasDiffPrice); }
}

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

function toggleVariantPrices(checkbox) {
  const optionsContainer = checkbox.closest('.variant-block').querySelector('.options-container');
  const priceInputs = optionsContainer.querySelectorAll('.opt-price');
  priceInputs.forEach(input => {
    if (checkbox.checked) {
      input.style.display = 'block'; input.required = true;
    } else {
      input.style.display = 'none'; input.required = false; input.value = '';
    }
  });
}

// 🌟 Secure Delete Order
async function deleteSingleOrder(orderId) {
  if (!confirm('Warning: Kya aap sach mein is pending order ko delete karna chahte hain? Ye wapas nahi aayega.')) return;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/delete/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) { alert('Order successfully delete ho gaya!'); loadOrders(); } 
    else { alert('Order delete nahi hua: ' + (data.message || 'Unknown error')); }
  } catch (err) { alert('Server error, please check console.'); }
}

let currentStaleOrders = [];

async function openStaleOrdersModal() {
  const expiryHours = Number(document.getElementById('settingExpiryHours')?.value) || 48;
  const cutoffTime = new Date(Date.now() - (expiryHours * 60 * 60 * 1000));

  currentStaleOrders = allOrdersData.filter(o => {
    return (o.orderStatus === 'Pending' || o.orderStatus === 'Screenshot Pending') && new Date(o.createdAt) < cutoffTime;
  });

  const modal = document.getElementById('staleOrdersModal');
  const infoText = document.getElementById('staleOrdersInfoText');
  const container = document.getElementById('staleOrdersListContainer');

  infoText.innerText = `Found ${currentStaleOrders.length} pending order(s) older than ${expiryHours} hours. Review and choose which ones to remove:`;

  if (currentStaleOrders.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No stale pending orders found!</p>';
    document.getElementById('btnDeleteSelectedStale').disabled = true;
  } else {
    document.getElementById('btnDeleteSelectedStale').disabled = false;
    container.innerHTML = currentStaleOrders.map(o => {
      const orderDate = new Date(o.createdAt).toLocaleString('en-IN');
      const products = o.products?.map(p => `${p.quantity || 1}x ${p.title}`).join(', ') || 'Item';
      return `
        <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-bottom: 1px solid var(--border); background: #fff; border-radius: 6px; margin-bottom: 6px;">
          <input type="checkbox" class="stale-order-checkbox" value="${o._id}" checked onchange="updateStaleCount()" style="margin-top: 4px; width: 16px; height: 16px;">
          <div style="flex: 1; font-size: 0.85rem;">
            <strong>${o.orderId || o._id}</strong> — <span style="color: #64748b;">${orderDate}</span><br/>
            <span>Customer: <strong>${o.shippingDetails?.name || 'N/A'}</strong> (${o.customerPhone})</span><br/>
            <small style="color: #475569;">${products} | Pay: ₹${o.amountToPayOnline || 0}</small>
          </div>
        </div>
      `;
    }).join('');
  }

  updateStaleCount();
  modal.style.display = 'flex';
}

function closeStaleOrdersModal() {
  document.getElementById('staleOrdersModal').style.display = 'none';
}

function toggleSelectAllStale(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.stale-order-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
  updateStaleCount();
}

function updateStaleCount() {
  const checked = document.querySelectorAll('.stale-order-checkbox:checked').length;
  const countEl = document.getElementById('selectedStaleCount');
  if (countEl) countEl.innerText = `${checked} selected`;
}

// 🌟 Secure Stale Delete
async function deleteSelectedStaleOrders() {
  const selectedCheckboxes = document.querySelectorAll('.stale-order-checkbox:checked');
  const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.value);
  if (idsToDelete.length === 0) return alert('Please select at least one order to delete.');
  if (!confirm(`Are you sure you want to delete ${idsToDelete.length} pending orders? This cannot be undone.`)) return;

  try {
    let deletedCount = 0;
    for (const id of idsToDelete) {
      const res = await fetch(`${CONFIG.BASE_URL}/orders/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) deletedCount++;
    }
    alert(`Successfully deleted ${deletedCount} orders!`);
    closeStaleOrdersModal();
    loadOrders();
  } catch (err) { alert('Error deleting some orders.'); }
}

function openEditPaymentModal(orderId) {
  const order = allOrdersData.find(o => o._id === orderId);
  if (!order) return;
  document.getElementById('epOrderId').value = orderId;
  document.getElementById('epPaymentType').value = order.paymentType || 'ADVANCE_COD';
  document.getElementById('epAmountOnline').value = order.amountToPayOnline || 0;
  document.getElementById('editPaymentModal').style.display = 'flex';
}

function closeEditPaymentModal() {
  document.getElementById('editPaymentModal').style.display = 'none';
}

// 🌟 Secure Save Payment
async function savePaymentDetails() {
  const orderId = document.getElementById('epOrderId').value;
  const paymentType = document.getElementById('epPaymentType').value;
  const amountToPayOnline = document.getElementById('epAmountOnline').value;
  if (!confirm('Kya aap is order ki payment details update karna chahte hain?')) return;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paymentType: paymentType, amountToPayOnline: Number(amountToPayOnline) })
    });
    const data = await res.json();
    if (data.success) { alert('Payment details successfully update ho gayi!'); closeEditPaymentModal(); loadOrders(); } 
    else { alert('Update failed: ' + (data.message || 'Unknown error')); }
  } catch (err) { alert('Server error while updating payment.'); }
}

function setupBannerProductSearch() {
  const searchInput = document.getElementById('bannerProductSearch');
  const dropdown = document.getElementById('bannerProductDropdown');
  const hiddenId = document.getElementById('bannerSelectedProductId');
  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('focus', () => { renderDropdown(allProductsList); dropdown.style.display = 'block'; });
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allProductsList.filter(p => p.title.toLowerCase().includes(query));
    renderDropdown(filtered);
    hiddenId.value = ''; 
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bannerProductSearch') && !e.target.closest('#bannerProductDropdown')) {
      dropdown.style.display = 'none';
    }
  });

  function renderDropdown(products) {
    dropdown.innerHTML = '';
    const top7 = products.slice(0, 7);
    if (top7.length === 0) { dropdown.innerHTML = '<li style="padding: 8px 12px; color: #64748b;">No products found</li>'; return; }
    top7.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p.title;
      li.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 0.9rem;';
      li.addEventListener('mouseover', () => li.style.background = '#f8fafc');
      li.addEventListener('mouseout', () => li.style.background = '#fff');
      li.addEventListener('click', () => {
        searchInput.value = p.title; hiddenId.value = p._id; dropdown.style.display = 'none';
      });
      dropdown.appendChild(li);
    });
  }
}

function updateOrderTabCounts() {
  const counts = { 'All': allOrdersData.length, 'Screenshot Pending': 0, 'Pending': 0, 'Accepted': 0, 'Packed': 0, 'Dispatched': 0, 'Delivered': 0, 'RTO': 0 };
  allOrdersData.forEach(order => { if (counts[order.orderStatus] !== undefined) counts[order.orderStatus]++; });

  document.querySelectorAll('#ordersTab .sub-tabs-bar .sub-tab-btn').forEach(btn => {
    const onclickAction = btn.getAttribute('onclick');
    let label = '', count = 0;
    if (onclickAction.includes('All')) { label = 'All Orders'; count = counts['All']; }
    else if (onclickAction.includes('Screenshot Pending')) { label = 'SS Pending'; count = counts['Screenshot Pending']; } 
    else if (onclickAction.includes('Pending')) { label = 'To Accept'; count = counts['Pending']; }
    else if (onclickAction.includes('Accepted')) { label = 'To Pack'; count = counts['Accepted']; }
    else if (onclickAction.includes('Packed')) { label = 'To Dispatch'; count = counts['Packed']; }
    else if (onclickAction.includes('Dispatched')) { label = 'In Transit'; count = counts['Dispatched']; }
    else if (onclickAction.includes('Delivered')) { label = 'Completed Orders'; count = counts['Delivered']; }
    else if (onclickAction.includes('RTO')) { label = 'RTO (Returned)'; count = counts['RTO']; }

    btn.innerHTML = `<div class="tab-count-val">${count}</div><div class="tab-count-label">${label}</div>`;
  });
}