// Complete F1-F7. Use your PA1 display/validation ideas, but the server owns data.
const byId = id => document.getElementById(id);
let csrfToken = null;
let editingId = null;
let purchases = []; // Display cache only. Do not use this as persistent storage.
const form = byId('purchase-form');
const message = byId('message');
const saveButton = byId('save-button');
function money(cents) { return '$' + (cents / 100).toFixed(2); }

async function refreshCsrf() {
  const response = await fetch('/api/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Could not initialize the session');
  csrfToken = (await response.json()).csrfToken;
}

async function api(path, options = {}) {
  // F1: await refreshCsrf if needed; build headers and credentials:'same-origin'.
  if (!csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase())) {
    await refreshCsrf();
  }
  options.headers = options.headers || {};
  options.credentials = 'same-origin';

  // If options.body is an object, JSON.stringify it and set Content-Type.
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  // Add X-CSRF-Token on mutations; fetch; parse JSON; throw Error on !response.ok.
  if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase())) {
    options.headers['X-CSRF-Token'] = csrfToken;
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch (err) {
    // Use try/catch to give a useful connection error only for actual network failure.
    throw new Error('Connection error. Please check your network connection.');
  }

  if (!response.ok) {
    // Preserve server-provided error messages for HTTP failures.
    let errorMsg = `Server error: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errorMsg = errData.error;
      }
    } catch (e) {
      // Fallback if error is not JSON
    }
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return null;
}

async function loadPurchases() {
  // F2: purchases = await api('/api/purchases'); then renderHistory/updateSummary.
  purchases = await api('/api/purchases');
  renderHistory();
  updateSummary();
}

async function showTracker(user) {
  // F3: load categories and populate select using createElement/textContent.
  const categories = await api('/api/categories');
  const select = byId('category');
  select.textContent = '';
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.append(opt);
  }

  // Show user email, reveal panel, loadPurchases. Do not display password/hash.
  byId('account-status').textContent = `Logged in as ${user.email}`;
  byId('tracker-panel').hidden = false;
  await loadPurchases();
}

function resetEdit() {
  editingId = null; 
  form.reset(); 
  saveButton.textContent = 'Add purchase';
}

function renderHistory() {
  const list = byId('purchase-list'); 
  list.textContent = '';
  for (const purchase of purchases) {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = `${purchase.name} / Quantity: ${purchase.quantity} / Unit price: ${money(purchase.unitPriceCents)} / Cost: ${money(purchase.costCents)} / ${purchase.categoryName}`;
    
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => beginEdit(purchase));
    
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deletePurchase(purchase.id));
    
    li.append(text, edit, del); 
    list.append(li);
  }
}

function updateSummary() {
  // F4: sum costCents from current purchases; display money(total) and length.
  let totalCents = 0;
  for (const purchase of purchases) {
    totalCents += purchase.costCents;
  }
  byId('total-invested').textContent = money(totalCents);
  byId('purchase-count').textContent = purchases.length;
}

function beginEdit(purchase) {
  // F5: fill all four fields; editingId=purchase.id; label button 'Save changes'.
  editingId = purchase.id;
  byId('investment-name').value = purchase.name;
  byId('quantity').value = purchase.quantity;
  byId('unit-price').value = (purchase.unitPriceCents / 100).toFixed(2);
  byId('category').value = purchase.categoryId;
  saveButton.textContent = 'Save changes';
  message.textContent = '';
}

async function deletePurchase(id) {
  // F5: DELETE, reset edit if deleting that record, reload list, feedback; catch failures.
  try {
    await api(`/api/purchases/${id}`, { method: 'DELETE' });
    if (editingId === id) {
      resetEdit();
    }
    await loadPurchases();
    message.textContent = 'Purchase deleted successfully.';
  } catch (err) {
    message.textContent = err.message;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  // F6: validate PA1 input bounds/step before converting dollars to integer cents.
  const nameVal = byId('investment-name').value.trim();
  const quantityVal = Number(byId('quantity').value);
  const priceVal = Number(byId('unit-price').value);
  const categoryIdVal = Number(byId('category').value);
  const quantityInputEl = byId('quantity');
  const priceInputEl = byId('unit-price');

  if (nameVal === '') {
    message.textContent = 'Please enter an investment name.';
    return;
  }
  if (!Number.isFinite(quantityVal) || quantityVal < 1 || quantityVal > 10000) {
    message.textContent = 'Quantity must be an integer between 1 and 10,000.';
    return;
  }
  if (quantityInputEl.validity.stepMismatch) {
    message.textContent = 'Quantity must be a whole number.';
    return;
  }
  if (!Number.isFinite(priceVal) || priceVal <= 0 || priceVal > 1000000) {
    message.textContent = 'Unit price must be positive and up to $1,000,000.';
    return;
  }
  if (priceInputEl.validity.stepMismatch) {
    message.textContent = 'Unit price can have at most two decimal places.';
    return;
  }

  // Build {name,quantity,unitPriceCents,categoryId}; use Number for numeric fields.
  const unitPriceCents = Math.round(priceVal * 100);
  const payload = {
    name: nameVal,
    quantity: quantityVal,
    unitPriceCents,
    categoryId: categoryIdVal
  };

  // Disable saveButton; in try use POST or PUT according to editingId.
  saveButton.disabled = true;
  try {
    if (editingId === null) {
      await api('/api/purchases', {
        method: 'POST',
        body: payload
      });
      message.textContent = 'Purchase added successfully.';
    } else {
      await api(`/api/purchases/${editingId}`, {
        method: 'PUT',
        body: payload
      });
      message.textContent = 'Purchase updated successfully.';
    }
    // Reset only after a successful mutation; reload authoritative list and show feedback.
    form.reset();
    resetEdit();
    await loadPurchases();
  } catch (err) {
    // In catch preserve failed inputs and show error
    message.textContent = err.message;
  } finally {
    // finally restore saveButton.
    saveButton.disabled = false;
  }
});

byId('cancel-edit').addEventListener('click', resetEdit);

byId('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';

  // F7: POST login using email/password; refreshCsrf after session regeneration;
  const email = byId('email').value.trim();
  const password = byId('password').value;
  const loginBtn = byId('login-button');

  loginBtn.disabled = true;
  try {
    const user = await api('/api/login', {
      method: 'POST',
      body: { email, password }
    });
    await refreshCsrf();
    byId('password').value = '';
    // showTracker; clear password input. Show errors and restore disabled button.
    await showTracker(user);
    message.textContent = 'Logged in successfully.';
  } catch (err) {
    message.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
  }
});

byId('register-button').addEventListener('click', async () => {
  message.textContent = '';

  // F7: POST register; show 'Registration complete. Please log in.'; clear password.
  const email = byId('email').value.trim();
  const password = byId('password').value;
  const regBtn = byId('register-button');

  regBtn.disabled = true;
  try {
    await api('/api/register', {
      method: 'POST',
      body: { email, password }
    });
    byId('password').value = '';
    message.textContent = 'Registration complete. Please log in.';
  } catch (err) {
    message.textContent = err.message;
  } finally {
    regBtn.disabled = false;
  }
});

byId('logout-button').addEventListener('click', async () => {
  message.textContent = '';

  // F7: POST logout; clear local purchases, form, account label and private UI.
  try {
    await api('/api/logout', { method: 'POST' });
    // csrfToken=null so the next mutation initializes a new session.
    csrfToken = null;
    purchases = [];
    form.reset();
    resetEdit();
    byId('tracker-panel').hidden = true;
    byId('account-status').textContent = '';
    byId('email').value = '';
    byId('password').value = '';
    message.textContent = 'Logged out successfully.';
  } catch (err) {
    message.textContent = err.message;
  }
});

async function initialize() {
  // F7: GET /api/me; showTracker when logged in; handle 401 as signed out.
  // Do not show an alarming error merely because a new visitor is not logged in.
  try {
    const user = await api('/api/me');
    await showTracker(user);
  } catch (err) {
    byId('tracker-panel').hidden = true;
    byId('account-status').textContent = '';
  }
}

initialize();