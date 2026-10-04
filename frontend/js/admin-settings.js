const adminToken = localStorage.getItem('storeAdminToken');

document.addEventListener('DOMContentLoaded', () => {
  if (!adminToken) {
    window.location.href = 'admin.html'; 
    return;
  }
  loadCustomers();

  // Setup real-time password validation on load
  setupRealTimeValidation('newPassword', 'confirmNewPassword', 'pwdMatchStatus');
  setupRealTimeValidation('newAdminPassword', 'confirmAdminPassword', 'adminPwdMatchStatus');
});

// Modal UI Logic
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  
  // Modal band hote hi form reset aur status hide kar do
  if (modalId === 'changePasswordModal') {
    document.getElementById('changePasswordForm').reset();
    document.getElementById('pwdMatchStatus').style.display = 'none';
    resetEyeIcon('confirmNewPassword', 'eyeIcon1');
  }
  if (modalId === 'createAdminModal') {
    document.getElementById('createAdminForm').reset();
    document.getElementById('adminPwdMatchStatus').style.display = 'none';
    resetEyeIcon('confirmAdminPassword', 'eyeIcon2');
  }
}

// 👁️ Eye Icon Toggle Logic
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  
  if (input.type === 'password') {
    input.type = 'text'; // Password dikhaye
    icon.textContent = '🙈'; // Icon hide wala ho jayega
  } else {
    input.type = 'password'; // Password chupaye
    icon.textContent = '👁️'; // Icon show wala ho jayega
  }
}

function resetEyeIcon(inputId, iconId) {
  document.getElementById(inputId).type = 'password';
  document.getElementById(iconId).textContent = '👁️';
}

// 🔄 Real-Time Password Matching Logic
function setupRealTimeValidation(newPwdId, confirmPwdId, statusId) {
  const newPwd = document.getElementById(newPwdId);
  const confirmPwd = document.getElementById(confirmPwdId);
  const statusEl = document.getElementById(statusId);

  function checkMatch() {
    // Agar confirm password khali hai toh status hata do
    if (confirmPwd.value === '') {
      statusEl.style.display = 'none';
      return;
    }
    
    statusEl.style.display = 'block';
    
    if (newPwd.value === confirmPwd.value) {
      statusEl.textContent = '✅ Passwords match';
      statusEl.style.color = 'var(--success)';
    } else {
      statusEl.textContent = '⚠️ Passwords do not match';
      statusEl.style.color = 'var(--danger)';
    }
  }

  // Jab dono mein se kisi bhi field mein type hoga, turant check karega
  newPwd.addEventListener('input', checkMatch);
  confirmPwd.addEventListener('input', checkMatch);
}

// 1. Change Password Logic (Form Submit)
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  // Final check before sending to backend
  if (newPassword !== confirmNewPassword) {
    alert("Naya password aur Confirm password match nahi ho rahe hain!");
    return;
  }

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/admin-settings/change-password`, {

      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    alert(data.message);
    
    if (data.success) {
      closeModal('changePasswordModal');
    }
  } catch (err) {
    alert('Error changing password.');
  }
});

// 2. Create New Admin Logic (Form Submit)
document.getElementById('createAdminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newAdminUsername').value.trim();
  const password = document.getElementById('newAdminPassword').value.trim();
  const confirmPassword = document.getElementById('confirmAdminPassword').value.trim();

  // Final check before sending to backend
  if (password !== confirmPassword) {
    alert("Passwords match nahi ho rahe hain, kripya check karein!");
    return;
  }

  try {
    const res = await fetch(`${CONFIG.BASE_URL}/admin-settings/create-user`, {

      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    alert(data.message);
    
    if (data.success) {
      closeModal('createAdminModal');
    }
  } catch (err) {
    alert('Error creating new admin.');
  }
});

// 3. Load Customers Data
async function loadCustomers() {
  const tbody = document.getElementById('customersTableBody');
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/admin-settings/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    
    if (data.success && data.customers && data.customers.length > 0) {
      tbody.innerHTML = data.customers.map(c => {
        // Address ko URL safe banana
        const safeAddress = encodeURIComponent(c.fullAddress);
        
        return `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td><span style="font-size: 0.9rem;">📞 ${c.phone}</span></td>
          <td>
            <div style="font-size: 0.85rem; color: #475569; margin-bottom: 6px; font-weight: 500;">
              ${c.cityState}
            </div>
            <button onclick="showAddress('${safeAddress}')" class="btn-custom" style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; font-size: 0.75rem; border-radius: 4px;">📍 Show Full Address</button>
          </td>
          <td><small style="color: #64748b;">${new Date(c.createdAt).toLocaleDateString('en-IN')}</small></td>
        </tr>
      `}).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No customers found.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 20px;">Error loading customers data.</td></tr>';
  }
}

// Pop-up kholne ka function (agar pehle add nahi kiya tha toh ise bahar rakhna)
function showAddress(encodedAddress) {
  const addressText = decodeURIComponent(encodedAddress);
  document.getElementById('customerFullAddressText').innerText = addressText;
  openModal('addressModal');
}