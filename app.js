// ==========================================
// 🛍️ TECHMART E-COMMERCE PLATFORM
// ==========================================

// 🔧 CONFIGURATION - API endpoint will be resolved automatically
let API_URL = null;
const API_CANDIDATES = (() => {
  const candidates = [];
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    candidates.push(`${window.location.origin}/api`);
  }
  candidates.push('http://localhost:8000/api');
  candidates.push('http://127.0.0.1:8000/api');
  candidates.push('http://localhost:5000/api');
  candidates.push('http://127.0.0.1:5000/api');
  candidates.push('http://localhost:3000/api');
  candidates.push('http://127.0.0.1:3000/api');
  return candidates;
})();
const BACKEND_RETRY_INTERVAL = 2000;
const DEBUG_MODE = true; // Set to false to hide debug info

// Global State
let currentUser = null;
let currentProduct = null;
let cart = [];
let backendConnected = false;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TechMart Platform Initializing...');
  loadLocalStorage();
  resolveApiUrl().then(() => {
    console.log('📡 Selected API Endpoint:', API_URL);
    checkBackendConnection(); // Check if backend is running
    loadProducts();
    loadCategories();
    updateCartUI();
    checkAuthStatus();
    console.log('✅ TechMart Platform Ready!');
  });
});

async function resolveApiUrl() {
  while (!API_URL) {
    for (const url of API_CANDIDATES) {
      try {
        const response = await fetch(`${url}/products`, { method: 'GET' });
        if (response.ok) {
          API_URL = url;
          console.log(`✅ Backend auto-connected to ${url}`);
          return;
        }
      } catch (err) {
        if (DEBUG_MODE) console.warn(`Backend probe failed for ${url}: ${err.message}`);
      }
    }

    if (!API_URL) {
      console.warn('⚠️ Backend not found yet. Retrying in 2 seconds...');
      if (window.location.protocol === 'file:') {
        showAlert('Searching for backend server... Please start it with npm start and open the app via http://localhost:5000', 'warning');
      } else {
        showAlert('Searching for backend server... Please start it with npm start', 'warning');
      }
      await new Promise((resolve) => setTimeout(resolve, BACKEND_RETRY_INTERVAL));
    }
  }
}

// ============= BACKEND CONNECTION CHECK =============

function checkBackendConnection() {
  fetch(`${API_URL}/products`, { method: 'GET' })
    .then(() => {
      backendConnected = true;
      updateStatusIndicator(true);
      console.log('✅ Backend Connected!');
    })
    .catch(() => {
      backendConnected = false;
      updateStatusIndicator(false);
      console.warn('⚠️ Backend Not Connected');

      if (window.location.protocol === 'file:') {
        console.log('📍 Please open the app through the server at http://localhost:5000');
        showAlert('⚠️ Please open the app through the backend server at http://localhost:5000, not via file://', 'warning');
      } else {
        console.log('📍 Please ensure backend is running: npm start');
        showAlert('⚠️ Backend server not running. Please start it with: npm start', 'warning');
      }
    });
}

function updateStatusIndicator(connected) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  if (connected) {
    statusDot?.classList.add('connected');
    statusDot?.classList.remove('disconnected');
    if (statusText) statusText.textContent = '✅ Connected';
  } else {
    statusDot?.classList.add('disconnected');
    statusDot?.classList.remove('connected');
    if (statusText) statusText.textContent = '❌ Disconnected';
  }
}

// ============= AUTHENTICATION =============

function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('Please fill in all fields', 'error');
    return;
  }

  fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        showAlert(data.error, 'error');
      } else {
        currentUser = {
          id: data.userId,
          username: data.username,
          email: email,
          isAdmin: data.isAdmin,
          token: data.token,
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('token', data.token);
        showAlert('Login successful!', 'success');
        updateAuthUI();
        showHome();
      }
    })
    .catch((err) => showAlert('Login failed: ' + err.message, 'error'));
}

function register() {
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const phone = document.getElementById('regPhone').value;

  if (!username || !email || !password) {
    showAlert('Please fill in all required fields', 'error');
    return;
  }

  fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, phone }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        showAlert(data.error, 'error');
      } else {
        currentUser = {
          id: data.userId,
          username: username,
          email: email,
          isAdmin: false,
          token: data.token,
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('token', data.token);
        showAlert('Registration successful!', 'success');
        updateAuthUI();
        toggleRegisterForm();
        showHome();
      }
    })
    .catch((err) => showAlert('Registration failed: ' + err.message, 'error'));
}

function logout() {
  currentUser = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  updateAuthUI();
  showAlert('Logged out successfully', 'success');
  showHome();
}

function checkAuthStatus() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (user && token) {
    currentUser = JSON.parse(user);
    updateAuthUI();
    loadCart();
  }
}

function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const supportLink = document.getElementById('supportLink');
  const ordersLink = document.getElementById('ordersLink');
  const reviewsLink = document.getElementById('reviewsLink');
  const adminLink = document.getElementById('adminLink');

  if (currentUser) {
    authBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    logoutBtn.textContent = `Logout (${currentUser.username})`;
    supportLink.style.display = 'inline-block';
    ordersLink.style.display = 'inline-block';
    reviewsLink.style.display = 'inline-block';

    if (currentUser.isAdmin) {
      adminLink.style.display = 'inline-block';
    }
  } else {
    authBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    supportLink.style.display = 'none';
    ordersLink.style.display = 'none';
    reviewsLink.style.display = 'none';
    adminLink.style.display = 'none';
  }
}

// ============= NAVIGATION =============

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach((s) => {
    s.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
  window.scrollTo(0, 0);
}

function showHome() {
  showSection('homeSection');
}

function showProducts() {
  showSection('productsSection');
  loadProducts();
}

function showCart() {
  showSection('cartSection');
  loadCart();
}

function showCheckout() {
  if (cart.length === 0) {
    showAlert('Your cart is empty', 'error');
    return;
  }
  if (!currentUser) {
    showAlert('Please login to checkout', 'error');
    toggleAuth();
    return;
  }
  showSection('checkoutSection');
  loadCheckoutSummary();
}

function showOrders() {
  if (!currentUser) {
    showAlert('Please login to view orders', 'error');
    toggleAuth();
    return;
  }
  showSection('ordersSection');
  loadOrders();
}

function showReviews() {
  if (!currentUser) {
    showAlert('Please login to view reviews', 'error');
    toggleAuth();
    return;
  }
  showSection('reviewsSection');
  loadUserReviews();
}

function showSupport() {
  if (!currentUser) {
    showAlert('Please login to access support', 'error');
    toggleAuth();
    return;
  }
  showSection('supportSection');
  loadSupportTickets();
}

function showAdmin() {
  if (!currentUser || !currentUser.isAdmin) {
    showAlert('Admin access required', 'error');
    return;
  }
  showSection('adminSection');
  loadAdminDashboard();
}

function showTrackOrder() {
  showSection('trackOrderSection');
}

function toggleAuth() {
  showSection('authSection');
}

function toggleRegisterForm() {
  document.getElementById('loginForm').style.display =
    document.getElementById('loginForm').style.display === 'none' ? 'block' : 'none';
  document.getElementById('registerForm').style.display =
    document.getElementById('registerForm').style.display === 'none' ? 'block' : 'none';
}

// ============= PRODUCTS =============

function loadProducts() {
  fetch(`${API_URL}/products`)
    .then((res) => res.json())
    .then((products) => {
      renderProducts(products);
    })
    .catch((err) => console.error('Error loading products:', err));
}

function loadCategories() {
  fetch(`${API_URL}/products/categories/list`)
    .then((res) => res.json())
    .then((categories) => {
      const select = document.getElementById('categoryFilter');
      categories.forEach((cat) => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });
    })
    .catch((err) => console.error('Error loading categories:', err));
}

function filterProducts() {
  const search = document.getElementById('searchInput').value;
  const category = document.getElementById('categoryFilter').value;
  const minPrice = document.getElementById('minPrice').value;
  const maxPrice = document.getElementById('maxPrice').value;
  const sortBy = document.getElementById('sortBy').value;

  let url = `${API_URL}/products?`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (category) url += `category=${encodeURIComponent(category)}&`;
  if (minPrice) url += `minPrice=${minPrice}&`;
  if (maxPrice) url += `maxPrice=${maxPrice}&`;
  if (sortBy) url += `sortBy=${sortBy}&`;

  document.getElementById('priceDisplay').textContent = minPrice;
  document.getElementById('priceDisplay2').textContent = maxPrice;

  fetch(url)
    .then((res) => res.json())
    .then((products) => renderProducts(products))
    .catch((err) => console.error('Error filtering products:', err));
}

function renderProducts(products) {
  const container = document.getElementById('productsList');

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No products found</h3></div>';
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" onclick="showProductDetail(${product.id})">
      <div class="product-image">
        <img src="${product.image || 'https://via.placeholder.com/250x200?text=No+Image'}" alt="${product.name}">
      </div>
      <div class="product-body">
        <h3>${product.name}</h3>
        <p>${product.description || 'No description'}</p>
        <div class="product-rating">
          ${'★'.repeat(Math.round(product.avgRating))}${'☆'.repeat(5 - Math.round(product.avgRating))} (${product.reviewCount})
        </div>
      </div>
      <div class="product-footer">
        <span class="product-price">₹${product.price.toLocaleString('en-IN')}</span>
        <button onclick="quickAddToCart(event, ${product.id})" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Add</button>
      </div>
    </div>
  `
    )
    .join('');
}

function showProductDetail(productId) {
  fetch(`${API_URL}/products/${productId}`)
    .then((res) => res.json())
    .then((product) => {
      currentProduct = product;
      document.getElementById('detailName').textContent = product.name;
      document.getElementById('detailDescription').textContent = product.description || 'No description';
      document.getElementById('detailPrice').textContent = `₹${product.price.toLocaleString('en-IN')}`;
      document.getElementById('detailImage').src =
        product.image || 'https://via.placeholder.com/400x400?text=No+Image';
      document.getElementById('detailRating').textContent = '★'.repeat(Math.round(product.avgRating)) +
        '☆'.repeat(5 - Math.round(product.avgRating));
      document.getElementById('reviewCount').textContent = `(${product.reviewCount} reviews)`;
      document.getElementById('detailQuantity').value = 1;

      // Show add review form if logged in
      if (currentUser) {
        document.getElementById('addReviewForm').style.display = 'block';
      } else {
        document.getElementById('addReviewForm').style.display = 'none';
      }

      showSection('productDetailSection');
      loadProductReviews(productId);
    })
    .catch((err) => console.error('Error loading product:', err));
}

function showProductReviews() {
  loadProductReviews(currentProduct.id);
}

function loadProductReviews(productId) {
  fetch(`${API_URL}/reviews/${productId}`)
    .then((res) => res.json())
    .then((reviews) => {
      const container = document.getElementById('reviewsList');
      if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
      }
      container.innerHTML = reviews
        .map(
          (review) => `
        <div class="review-item">
          <h4>${review.username}</h4>
          <div class="rating">
            ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} (${review.rating}/5)
          </div>
          <p>${review.comment}</p>
          <span class="date">${new Date(review.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading reviews:', err));
}

// ============= CART =============

function quickAddToCart(event, productId) {
  event.stopPropagation();
  if (!currentUser) {
    showAlert('Please login to add items to cart', 'error');
    toggleAuth();
    return;
  }
  addToCartAPI(productId, 1);
}

function addToCart() {
  if (!currentUser) {
    showAlert('Please login to add items to cart', 'error');
    toggleAuth();
    return;
  }
  const quantity = parseInt(document.getElementById('detailQuantity').value) || 1;
  addToCartAPI(currentProduct.id, quantity);
}

function addToCartAPI(productId, quantity) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/cart/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId, quantity }),
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Item added to cart!', 'success');
      loadCart();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadCart() {
  if (!currentUser) {
    cart = [];
    updateCartUI();
    return;
  }

  const token = localStorage.getItem('token');
  fetch(`${API_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((items) => {
      cart = items;
      updateCartUI();
      renderCart();
    })
    .catch((err) => console.error('Error loading cart:', err));
}

function updateCartUI() {
  document.getElementById('cartCount').textContent = cart.length;
}

function renderCart() {
  const container = document.getElementById('cartItems');

  if (cart.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><h3>Your cart is empty</h3><p>Start shopping to add items to your cart</p></div>';
    document.getElementById('checkoutBtn').style.display = 'none';
    updateCartSummary();
    return;
  }

  container.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item">
      <div class="cart-item-image">
        <img src="${item.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p>₹${item.price.toLocaleString('en-IN')}</p>
      </div>
      <input type="number" min="1" value="${item.quantity}" onchange="updateCartItem(${item.id}, this.value)" class="form-input">
      <p>₹${(item.price * item.quantity).toLocaleString('en-IN')}</p>
      <button onclick="removeFromCart(${item.id})" class="btn btn-danger">Remove</button>
    </div>
  `
    )
    .join('');

  document.getElementById('checkoutBtn').style.display = 'inline-block';
  updateCartSummary();
}

function updateCartItem(cartItemId, quantity) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/cart/${cartItemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quantity: parseInt(quantity) }),
  })
    .then((res) => res.json())
    .then((data) => {
      loadCart();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function removeFromCart(cartItemId) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/cart/${cartItemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      loadCart();
      showAlert('Item removed from cart', 'success');
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  document.getElementById('subtotal').textContent = subtotal.toLocaleString('en-IN');
  document.getElementById('tax').textContent = Math.round(tax).toLocaleString('en-IN');
  document.getElementById('total').textContent = Math.round(total).toLocaleString('en-IN');
}

function loadCheckoutSummary() {
  updateCartSummary();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.1;
  document.getElementById('checkoutTotal').textContent = Math.round(total).toLocaleString('en-IN');
}

// ============= ORDERS =============

function completeOrder() {
  const address = document.getElementById('addressInput').value;
  const city = document.getElementById('cityInput').value;
  const state = document.getElementById('stateInput').value;
  const zipcode = document.getElementById('zipcodeInput').value;

  if (!address || !city || !state || !zipcode) {
    showAlert('Please fill in all address fields', 'error');
    return;
  }

  const shippingAddress = `${address}, ${city}, ${state} ${zipcode}`;
  const token = localStorage.getItem('token');

  fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ shippingAddress }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        showAlert(data.error, 'error');
      } else {
        showAlert(`Order created successfully! Order Number: ${data.orderNumber}`, 'success');
        loadCart();
        showOrders();
      }
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadOrders() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((orders) => {
      const container = document.getElementById('ordersList');
      if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No orders yet</h3></div>';
        return;
      }

      container.innerHTML = orders
        .map(
          (order) => `
        <div class="order-card">
          <h3>Order #${order.orderNumber}</h3>
          <p>Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
          <p>Total: ₹${order.totalPrice.toLocaleString('en-IN')}</p>
          <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
          <button onclick="loadOrderDetails(${order.id})" class="btn btn-primary" style="margin-top: 1rem;">View Details</button>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading orders:', err));
}

function loadOrderDetails(orderId) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((order) => {
      let itemsHTML = '';
      if (order.items && order.items.length > 0) {
        itemsHTML = order.items
          .map(
            (item) => `
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee;">
            <span>${item.name} x${item.quantity}</span>
            <span>₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
          </div>
        `
          )
          .join('');
      }

      alert(`Order Details:
Order #: ${order.orderNumber}
Status: ${order.status}
Total: ₹${order.totalPrice.toLocaleString('en-IN')}
Items: ${order.items?.length || 0}
${itemsHTML}`);
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function trackOrder() {
  const orderNumber = document.getElementById('orderNumberInput').value;

  if (!orderNumber) {
    showAlert('Please enter order number', 'error');
    return;
  }

  fetch(`${API_URL}/orders/track/${orderNumber}`)
    .then((res) => res.json())
    .then((order) => {
      if (order.error) {
        showAlert(order.error, 'error');
        document.getElementById('trackResult').innerHTML = '';
      } else {
        document.getElementById('trackResult').innerHTML = `
          <div class="order-card">
            <h3>Order Tracking</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Status:</strong> <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span></p>
            <p><strong>Total:</strong> ₹${order.totalPrice.toLocaleString('en-IN')}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
            <p><strong>Last Updated:</strong> ${new Date(order.updatedAt).toLocaleDateString('en-IN')}</p>
          </div>
        `;
      }
    })
    .catch((err) => {
      showAlert('Error: ' + err.message, 'error');
      document.getElementById('trackResult').innerHTML = '';
    });
}

// ============= REVIEWS =============

function submitReview() {
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value;
  const token = localStorage.getItem('token');

  if (rating < 1 || rating > 5) {
    showAlert('Please select a valid rating', 'error');
    return;
  }

  fetch(`${API_URL}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId: currentProduct.id, rating, comment }),
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Review submitted successfully!', 'success');
      document.getElementById('reviewComment').value = '';
      loadProductReviews(currentProduct.id);
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadUserReviews() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/reviews/user/reviews`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((reviews) => {
      const container = document.getElementById('userReviewsList');
      if (!reviews || reviews.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No reviews yet</h3></div>';
        return;
      }

      container.innerHTML = reviews
        .map(
          (review) => `
        <div class="review-card">
          <h3>${review.name}</h3>
          <div class="rating">
            ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} (${review.rating}/5)
          </div>
          <p>${review.comment}</p>
          <span class="date">${new Date(review.createdAt).toLocaleDateString()}</span>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading reviews:', err));
}

// ============= SUPPORT =============

function createSupportTicket() {
  const subject = document.getElementById('supportSubject').value;
  const message = document.getElementById('supportMessage').value;
  const token = localStorage.getItem('token');

  if (!subject || !message) {
    showAlert('Please fill in all fields', 'error');
    return;
  }

  fetch(`${API_URL}/support`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject, message }),
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Support ticket created successfully!', 'success');
      document.getElementById('supportSubject').value = '';
      document.getElementById('supportMessage').value = '';
      loadSupportTickets();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadSupportTickets() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/support`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((tickets) => {
      const container = document.getElementById('ticketsList');
      if (!tickets || tickets.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No support tickets yet</p></div>';
        return;
      }

      container.innerHTML = tickets
        .map(
          (ticket) => `
        <div class="ticket-card">
          <h3>${ticket.subject}</h3>
          <p>${ticket.message}</p>
          <span class="order-status status-${ticket.status}">${ticket.status.toUpperCase()}</span>
          ${ticket.response ? `<p><strong>Response:</strong> ${ticket.response}</p>` : ''}
          <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #999;">
            Created: ${new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading tickets:', err));
}

// ============= ADMIN =============

function loadAdminDashboard() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((stats) => {
      document.getElementById('statUsers').textContent = stats.userCount;
      document.getElementById('statOrders').textContent = stats.orderCount;
      document.getElementById('statProducts').textContent = stats.productCount;
      document.getElementById('statRevenue').textContent = `₹${stats.totalRevenue.toLocaleString('en-IN')}`;
      showAdminTab('dashboard');
      loadAdminProducts();
      loadAdminOrders();
    })
    .catch((err) => console.error('Error loading stats:', err));
}

function showAdminTab(tabName) {
  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  document.getElementById(tabName + 'Tab').classList.add('active');
  event.target.classList.add('active');
}

function addProductAdmin() {
  const name = document.getElementById('adminProdName').value;
  const description = document.getElementById('adminProdDesc').value;
  const price = document.getElementById('adminProdPrice').value;
  const quantity = document.getElementById('adminProdQty').value;
  const category = document.getElementById('adminProdCategory').value;
  const image = document.getElementById('adminProdImage').value;
  const token = localStorage.getItem('token');

  if (!name || !price || !quantity || !category) {
    showAlert('Please fill in all required fields', 'error');
    return;
  }

  fetch(`${API_URL}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, description, price, quantity, category, image }),
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Product added successfully!', 'success');
      document.getElementById('adminProdName').value = '';
      document.getElementById('adminProdDesc').value = '';
      document.getElementById('adminProdPrice').value = '';
      document.getElementById('adminProdQty').value = '';
      document.getElementById('adminProdCategory').value = '';
      document.getElementById('adminProdImage').value = '';
      loadAdminProducts();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadAdminProducts() {
  fetch(`${API_URL}/products`)
    .then((res) => res.json())
    .then((products) => {
      const container = document.getElementById('adminProductsList');
      if (!products || products.length === 0) {
        container.innerHTML = '<p>No products</p>';
        return;
      }

      container.innerHTML = products
        .map(
          (product) => `
        <div class="order-card" style="margin-bottom: 1rem;">
          <h3>${product.name}</h3>
          <p>Price: ₹${product.price.toLocaleString('en-IN')}</p>
          <p>Quantity: ${product.quantity}</p>
          <p>Category: ${product.category}</p>
          <div>
            <button onclick="editProductAdmin(${product.id})" class="btn btn-secondary">Edit</button>
            <button onclick="deleteProductAdmin(${product.id})" class="btn btn-danger">Delete</button>
          </div>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading products:', err));
}

function deleteProductAdmin(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;

  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Product deleted successfully!', 'success');
      loadAdminProducts();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

function loadAdminOrders() {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/orders/list`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((orders) => {
      const container = document.getElementById('adminOrdersList');
      if (!orders || orders.length === 0) {
        container.innerHTML = '<p>No orders</p>';
        return;
      }

      container.innerHTML = orders
        .map(
          (order) => `
        <div class="order-card">
          <h3>${order.orderNumber}</h3>
          <p>Customer: ${order.username} (${order.email})</p>
          <p>Total: ₹${order.totalPrice.toLocaleString('en-IN')}</p>
          <p>Status: 
            <select onchange="updateOrderStatus(${order.id}, this.value)" class="form-input" style="width: auto;">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </p>
          <p>Created: ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
      `
        )
        .join('');
    })
    .catch((err) => console.error('Error loading orders:', err));
}

function updateOrderStatus(orderId, status) {
  const token = localStorage.getItem('token');
  fetch(`${API_URL}/admin/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
    .then((res) => res.json())
    .then((data) => {
      showAlert('Order status updated!', 'success');
      loadAdminOrders();
    })
    .catch((err) => showAlert('Error: ' + err.message, 'error'));
}

// ============= UTILITIES =============

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '80px';
  alertDiv.style.right = '20px';
  alertDiv.style.zIndex = '1000';
  alertDiv.style.maxWidth = '400px';

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.remove();
  }, 3000);
}

function saveLocalStorage() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function loadLocalStorage() {
  const savedCart = localStorage.getItem('cart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      cart = [];
    }
  }
}
