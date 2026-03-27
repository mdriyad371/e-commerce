// API URL
const API_URL = '/api';

let currentUser = null;
let token = null;
let cart = [];
let wishlist = [];

// Districts data - Complete 64 districts
const districtsByDivision = {
    "ঢাকা": ["ঢাকা", "গাজীপুর", "নারায়ণগঞ্জ", "টাঙ্গাইল", "কিশোরগঞ্জ", "মানিকগঞ্জ", "মুন্সীগঞ্জ", "নরসিংদী", "ফরিদপুর", "গোপালগঞ্জ", "মাদারীপুর", "রাজবাড়ী", "শরীয়তপুর"],
    "চট্টগ্রাম": ["চট্টগ্রাম", "কক্সবাজার", "কুমিল্লা", "ফেনী", "ব্রাহ্মণবাড়িয়া", "রাঙ্গামাটি", "খাগড়াছড়ি", "বান্দরবান", "নোয়াখালী", "লক্ষ্মীপুর", "চাঁদপুর"],
    "রাজশাহী": ["রাজশাহী", "বগুড়া", "জয়পুরহাট", "নওগাঁ", "নাটোর", "চাঁপাইনবাবগঞ্জ", "পাবনা", "সিরাজগঞ্জ"],
    "খুলনা": ["খুলনা", "বাগেরহাট", "চুয়াডাঙ্গা", "যশোর", "ঝিনাইদহ", "কুষ্টিয়া", "মাগুরা", "মেহেরপুর", "নড়াইল", "সাতক্ষীরা"],
    "বরিশাল": ["বরিশাল", "ঝালকাঠি", "পটুয়াখালী", "ভোলা", "পিরোজপুর", "বরগুনা"],
    "সিলেট": ["সিলেট", "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ"],
    "রংপুর": ["রংপুর", "দিনাজপুর", "গাইবান্ধা", "কুড়িগ্রাম", "লালমনিরহাট", "নীলফামারী", "পঞ্চগড়", "ঠাকুরগাঁও"],
    "ময়মনসিংহ": ["ময়মনসিংহ", "জামালপুর", "শেরপুর", "নেত্রকোণা"]
};

const paymentAccounts = {
    bkash: { name: "bKash", number: "01709130371" },
    nagad: { name: "Nagad", number: "01709130371" },
    rocket: { name: "Rocket", number: "01709130371" }
};

// API Helper
const api = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            showToast(error.message, 'error');
            throw error;
        }
    },
    
    get(endpoint) { return this.request(endpoint); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

// Show toast notification
function showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Update cart badge
function updateCartBadge() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById("cartCount");
    if (badge) badge.innerText = total;
}

// Update bottom navigation based on user role
function updateBottomNavigation() {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    
    const existingAdminBtn = bottomNav.querySelector('[data-nav="admin"]');
    if (existingAdminBtn) existingAdminBtn.remove();
    
    if (currentUser && currentUser.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-item';
        adminBtn.setAttribute('data-nav', 'admin');
        adminBtn.innerHTML = '<i class="fas fa-chart-line"></i><span>অ্যাডমিন</span>';
        adminBtn.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });
        bottomNav.appendChild(adminBtn);
    }
}

// Update districts dropdown
function updateDistricts() {
    const division = document.getElementById("deliveryDivision").value;
    const districtSelect = document.getElementById("deliveryDistrict");
    const deliveryFeeInfo = document.getElementById("deliveryFeeInfo");
    
    if (division && districtsByDivision[division]) {
        districtSelect.disabled = false;
        districtSelect.innerHTML = '<option value="">জেলা নির্বাচন করুন</option>' + 
            districtsByDivision[division].map(d => `<option value="${d}">${d}</option>`).join('');
        deliveryFeeInfo.innerHTML = `<i class="fas fa-info-circle"></i> জেলা নির্বাচন করলে ডেলিভারি চার্জ দেখাবে`;
    } else {
        districtSelect.disabled = true;
        districtSelect.innerHTML = '<option value="">প্রথমে বিভাগ নির্বাচন করুন</option>';
        deliveryFeeInfo.innerHTML = `<i class="fas fa-info-circle"></i> ডেলিভারি চার্জ: জেলা নির্বাচনের পরে দেখানো হবে`;
    }
    districtSelect.value = "";
}

// Update delivery fee
function updateDeliveryFee() {
    const district = document.getElementById("deliveryDistrict").value;
    const deliveryFeeInfo = document.getElementById("deliveryFeeInfo");
    
    if (district) {
        const charge = district === "ঢাকা" ? 60 : 100;
        deliveryFeeInfo.innerHTML = `<i class="fas fa-truck"></i> ডেলিভারি চার্জ: <strong>৳${charge}</strong>`;
    }
}

// Update payment account info
function updateAccountInfo() {
    const method = document.getElementById("paymentMethod").value;
    const panel = document.getElementById("accountInfoPanel");
    if (method !== "cod") {
        panel.style.display = "block";
        const account = paymentAccounts[method];
        document.getElementById("accountDetails").innerHTML = `
            <div class="payment-account">
                <div>${account.name} নম্বর</div>
                <div class="account-number">${account.number}</div>
            </div>`;
    } else {
        panel.style.display = "none";
    }
}

// Load products
async function loadProducts() {
    try {
        const search = document.getElementById('searchInput')?.value || '';
        const category = document.getElementById('categoryFilter')?.value || 'all';
        const sort = document.getElementById('sortSelect')?.value || 'default';
        
        const query = new URLSearchParams({ search, category, sort }).toString();
        const data = await api.get(`/products?${query}`);
        return data.products || [];
    } catch (error) {
        return [];
    }
}

// Render products
async function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>লোড হচ্ছে...</p></div>';
    
    const products = await loadProducts();
    
    if (products.length === 0) {
        container.innerHTML = '<div class="loading-spinner"><p>কোনো পণ্য নেই</p></div>';
        return;
    }
    
    container.innerHTML = products.map(product => {
        const inWish = wishlist.includes(product.id);
        const totalStock = product.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0) || 0;
        
        return `
            <div class="product-card">
                ${product.badge ? `<div class="product-badge">🏷️ ${product.badge}</div>` : ''}
                <img class="product-image" src="${product.image || 'https://via.placeholder.com/300'}" alt="${product.name}">
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-price">
                        <span class="current-price">৳${product.base_price}</span>
                        ${product.old_price ? `<span class="old-price">৳${product.old_price}</span>` : ''}
                    </div>
                    <div class="product-rating">
                        ${'★'.repeat(Math.floor(product.rating || 4))}${'☆'.repeat(5 - Math.floor(product.rating || 4))}
                        <span>(${product.rating || 4})</span>
                    </div>
                    <div class="product-stock ${totalStock > 0 ? 'in-stock' : 'out-stock'}">
                        <i class="fas ${totalStock > 0 ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${totalStock > 0 ? `স্টকে ${totalStock}টি` : 'স্টক আউট'}
                    </div>
                    <select id="size-${product.id}" class="size-select">
                        ${product.sizes?.map(s => `<option value="${s.name}" ${s.stock === 0 ? 'disabled' : ''}>${s.name} - ৳${s.price} ${s.stock > 0 ? `(${s.stock})` : '(Out)'}</option>`).join('')}
                    </select>
                    <div class="product-actions">
                        <button class="btn btn-primary add-to-cart" data-id="${product.id}" ${totalStock === 0 ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> কার্ট
                        </button>
                        <button class="icon-btn wishlist-btn" data-id="${product.id}" style="background:${inWish ? '#fee2e2' : 'transparent'}">
                            <i class="fas fa-heart" style="color:${inWish ? '#ef4444' : '#cbd5e1'}"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentUser) { showLoginPrompt(); return; }
            const productId = btn.dataset.id;
            const sizeSelect = document.getElementById(`size-${productId}`);
            const size = sizeSelect?.value;
            await addToCart(productId, size);
        });
    });
    
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentUser) { showLoginPrompt(); return; }
            const productId = btn.dataset.id;
            await toggleWishlist(productId);
        });
    });
}

// Add to cart
async function addToCart(productId, size) {
    if (!currentUser) { showLoginPrompt(); return; }
    try {
        await api.post('/cart/add', { productId, size, quantity: 1 });
        await loadCart();
        showToast('কার্টে যোগ করা হয়েছে', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Toggle wishlist
async function toggleWishlist(productId) {
    if (wishlist.includes(productId)) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast('উইশলিস্ট থেকে সরানো হয়েছে');
    } else {
        wishlist.push(productId);
        showToast('উইশলিস্টে যুক্ত হয়েছে', 'success');
    }
    localStorage.setItem(`wishlist_${currentUser?.id}`, JSON.stringify(wishlist));
    await renderProducts();
}

// Load cart
async function loadCart() {
    if (!currentUser) return;
    try {
        const data = await api.get('/cart');
        cart = data.cart?.items || [];
        updateCartBadge();
    } catch (error) {
        cart = [];
    }
}

// Load wishlist
function loadWishlist() {
    if (currentUser) {
        wishlist = JSON.parse(localStorage.getItem(`wishlist_${currentUser.id}`) || '[]');
    }
}

// Render cart sidebar
async function renderCartSidebar() {
    const cartDiv = document.getElementById("cartItemsList");
    const summary = document.getElementById("cartSummary");
    
    if (!cart || cart.length === 0) {
        cartDiv.innerHTML = '<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>কার্ট খালি</p></div>';
        summary.innerHTML = "";
        return;
    }
    
    let subtotal = 0;
    const itemsHtml = cart.map((item, idx) => {
        const product = item.product || {};
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        return `
            <div class="cart-item">
                <img src="${product.image || 'https://via.placeholder.com/50'}" alt="${product.name}">
                <div class="cart-item-details">
                    <div class="cart-item-name">${product.name}</div>
                    <div class="cart-item-size">সাইজ: ${item.size}</div>
                    <div class="cart-item-price">৳${item.price} x ${item.quantity} = ৳${itemTotal}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="update-cart" data-index="${idx}" data-op="inc">+</button>
                    <button class="update-cart" data-index="${idx}" data-op="dec">-</button>
                    <button class="remove-cart" data-index="${idx}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
    
    cartDiv.innerHTML = itemsHtml;
    
    const district = document.getElementById("deliveryDistrict")?.value || "";
    const deliveryCharge = district ? (district === "ঢাকা" ? 60 : 100) : 0;
    const total = subtotal + deliveryCharge;
    
    summary.innerHTML = `
        <div class="cart-summary">
            <div class="summary-row"><span>সাবটোটাল:</span><strong>৳${subtotal}</strong></div>
            <div class="summary-row"><span>ডেলিভারি চার্জ:</span><strong>৳${deliveryCharge}</strong></div>
            <div class="summary-row total"><span>মোট:</span><strong>৳${total}</strong></div>
        </div>
    `;
    
    // Attach cart events
    document.querySelectorAll('.update-cart').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const item = cart[index];
            const newQuantity = btn.dataset.op === 'inc' ? item.quantity + 1 : item.quantity - 1;
            
            if (newQuantity <= 0) {
                await api.delete(`/cart/remove/${item.id}`);
            } else {
                await api.put(`/cart/update/${item.id}`, { quantity: newQuantity });
            }
            await loadCart();
            await renderCartSidebar();
            await renderProducts();
        });
    });
    
    document.querySelectorAll('.remove-cart').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const item = cart[index];
            await api.delete(`/cart/remove/${item.id}`);
            await loadCart();
            await renderCartSidebar();
            await renderProducts();
        });
    });
}

// Confirm order
async function confirmOrder() {
    if (!currentUser) { showLoginPrompt(); return; }
    
    const name = document.getElementById("deliveryName").value;
    const phone = document.getElementById("deliveryPhone").value;
    const division = document.getElementById("deliveryDivision").value;
    const district = document.getElementById("deliveryDistrict").value;
    const address = document.getElementById("deliveryAddress").value;
    const paymentMethod = document.getElementById("paymentMethod").value;
    
    if (!name || !phone || !division || !district || !address) {
        showToast("সব তথ্য দিন");
        return;
    }
    
    const paymentDetails = {};
    if (paymentMethod !== "cod") {
        const senderNumber = document.getElementById("senderNumber").value;
        const transactionId = document.getElementById("transactionId").value;
        if (!senderNumber || !transactionId) {
            showToast("পেমেন্ট তথ্য দিন");
            return;
        }
        paymentDetails.senderNumber = senderNumber;
        paymentDetails.transactionId = transactionId;
    }
    
    try {
        const data = await api.post('/orders', {
            customerInfo: { name, phone, division, district, address },
            paymentMethod,
            paymentDetails
        });
        
        showToast(`✅ অর্ডার সম্পন্ন!`, "success");
        document.getElementById("checkoutModal").style.display = "none";
        await loadCart();
        await renderProducts();
        
        // Reset form
        document.getElementById("deliveryName").value = "";
        document.getElementById("deliveryPhone").value = "";
        document.getElementById("deliveryDivision").value = "";
        document.getElementById("deliveryAddress").value = "";
        document.getElementById("senderNumber").value = "";
        document.getElementById("transactionId").value = "";
    } catch (error) {
        showToast(error.message, "error");
    }
}

// Load orders
async function loadOrders() {
    if (!currentUser) return [];
    try {
        const data = await api.get('/orders');
        return data.orders || [];
    } catch (error) {
        return [];
    }
}

// Render orders list
async function renderOrdersList() {
    const container = document.getElementById("ordersList");
    const orders = await loadOrders();
    
    if (orders.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>কোনো অর্ডার নেই</p></div>';
        return;
    }
    
    container.innerHTML = orders.map(o => `
        <div class="order-card">
            <div class="order-header">
                <strong>📦 অর্ডার #${o.id?.slice(-8) || o._id?.slice(-8)}</strong>
                <span class="order-status status-${o.order_status}">${o.order_status}</span>
            </div>
            <div class="order-date">📅 ${new Date(o.created_at).toLocaleString('bn-BD')}</div>
            <div class="order-total">💰 ৳${o.total}</div>
            <div class="order-location">📍 ${o.customer_info?.district}, ${o.customer_info?.division}</div>
            ${o.tracking ? `<div class="order-tracking">📮 ট্র্যাকিং: ${o.tracking}</div>` : ''}
        </div>
    `).join('');
}

// Render wishlist
async function renderWishlist() {
    const container = document.getElementById("wishlistItems");
    
    if (wishlist.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-heart-broken"></i><p>উইশলিস্ট খালি</p></div>';
        return;
    }
    
    const products = await loadProducts();
    const wishlistProducts = products.filter(p => wishlist.includes(p.id));
    
    container.innerHTML = wishlistProducts.map(p => `
        <div class="wishlist-item">
            <img src="${p.image}" alt="${p.name}">
            <div class="wishlist-item-details">
                <div class="wishlist-item-name">${p.name}</div>
                <div class="wishlist-item-price">৳${p.base_price}</div>
            </div>
            <button class="btn btn-danger remove-wish" data-id="${p.id}">সরান</button>
        </div>
    `).join('');
    
    document.querySelectorAll(".remove-wish").forEach(btn => {
        btn.addEventListener("click", async () => {
            wishlist = wishlist.filter(w => w !== btn.dataset.id);
            localStorage.setItem(`wishlist_${currentUser?.id}`, JSON.stringify(wishlist));
            await renderWishlist();
            await renderProducts();
            showToast("উইশলিস্ট থেকে সরানো হয়েছে");
        });
    });
}

// Auth functions
async function loginUser(email, password) {
    try {
        const data = await api.post('/auth/login', { email, password });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        await loadCart();
        loadWishlist();
        await renderProducts();
        updateBottomNavigation();
        showToast(`স্বাগতম ${currentUser.name}!`, 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

async function registerUser(name, email, password, confirmPassword) {
    if (!name || !email || !password) {
        showToast("সব তথ্য দিন");
        return false;
    }
    if (password !== confirmPassword) {
        showToast("পাসওয়ার্ড মিলছে না");
        return false;
    }
    
    try {
        const data = await api.post('/auth/register', { name, email, password });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        await loadCart();
        loadWishlist();
        await renderProducts();
        updateBottomNavigation();
        showToast('রেজিস্ট্রেশন সফল!', 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

function logout() {
    token = null;
    currentUser = null;
    cart = [];
    wishlist = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateCartBadge();
    updateBottomNavigation();
    renderProducts();
    showToast('লগআউট সফল!', 'success');
}

function showLoginPrompt() {
    document.getElementById("loginModal").style.display = "flex";
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// Check auto login
async function checkAutoLogin() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        await loadCart();
        loadWishlist();
        await renderProducts();
        updateBottomNavigation();
    } else {
        await renderProducts();
    }
}

// Event listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById("themeToggle")?.addEventListener("click", () => {
        document.body.classList.toggle("dark");
    });
    
    // Cart icon
    document.getElementById("cartIconBtn")?.addEventListener("click", async () => {
        if (!currentUser) { showLoginPrompt(); return; }
        await renderCartSidebar();
        document.getElementById("cartModal").style.display = "flex";
    });
    
    // User button
    document.getElementById("userBtn")?.addEventListener("click", () => {
        if (currentUser) {
            document.getElementById("profileEmail").innerHTML = `
                <div class="profile-name"><i class="fas fa-user"></i> ${currentUser.name}</div>
                <div class="profile-email"><i class="fas fa-envelope"></i> ${currentUser.email}</div>
                <div class="profile-role"><i class="fas fa-badge"></i> ${currentUser.role === 'admin' ? 'অ্যাডমিন' : 'ব্যবহারকারী'}</div>
            `;
            document.getElementById("profileModal").style.display = "flex";
        } else {
            showLoginPrompt();
        }
    });
    
    // Checkout
    document.getElementById("checkoutBtn")?.addEventListener("click", () => {
        document.getElementById("cartModal").style.display = "none";
        document.getElementById("checkoutModal").style.display = "flex";
        updateAccountInfo();
    });
    
    // Confirm order
    document.getElementById("confirmOrderBtn")?.addEventListener("click", confirmOrder);
    
    // Payment method change
    document.getElementById("paymentMethod")?.addEventListener("change", updateAccountInfo);
    
    // Delivery division change
    document.getElementById("deliveryDivision")?.addEventListener("change", updateDistricts);
    document.getElementById("deliveryDistrict")?.addEventListener("change", updateDeliveryFee);
    
    // Login modal
    document.getElementById("modalLoginBtn")?.addEventListener("click", async () => {
        const email = document.getElementById("modalLoginEmail").value;
        const password = document.getElementById("modalLoginPassword").value;
        if (await loginUser(email, password)) {
            closeAllModals();
        }
    });
    
    // Register modal
    document.getElementById("registerSubmitBtn")?.addEventListener("click", async () => {
        const name = document.getElementById("regName").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;
        const confirm = document.getElementById("regConfirmPassword").value;
        if (await registerUser(name, email, password, confirm)) {
            closeAllModals();
        }
    });
    
    // Switch modals
    document.getElementById("modalSwitchToRegister")?.addEventListener("click", () => {
        document.getElementById("loginModal").style.display = "none";
        document.getElementById("registerModal").style.display = "flex";
    });
    
    document.getElementById("modalSwitchToLogin")?.addEventListener("click", () => {
        document.getElementById("registerModal").style.display = "none";
        document.getElementById("loginModal").style.display = "flex";
    });
    
    // Close modals
    document.getElementById("closeLoginModal")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeRegisterModal")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeCart")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeCheckout")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeProfile")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeOrders")?.addEventListener("click", () => closeAllModals());
    document.getElementById("closeWishlist")?.addEventListener("click", () => closeAllModals());
    
    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        logout();
        closeAllModals();
    });
    
    // Bottom navigation
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", async () => {
            const nav = btn.dataset.nav;
            if (nav === "home") {
                await renderProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (nav === "wishlist") {
                if (!currentUser) { showLoginPrompt(); return; }
                await renderWishlist();
                document.getElementById("wishlistModal").style.display = "flex";
            } else if (nav === "orders") {
                if (!currentUser) { showLoginPrompt(); return; }
                await renderOrdersList();
                document.getElementById("ordersModal").style.display = "flex";
            } else if (nav === "profile") {
                if (currentUser) {
                    document.getElementById("profileEmail").innerHTML = `
                        <div class="profile-name">${currentUser.name}</div>
                        <div class="profile-email">${currentUser.email}</div>
                    `;
                    document.getElementById("profileModal").style.display = "flex";
                } else {
                    showLoginPrompt();
                }
            }
        });
    });
    
    // Filters
    document.getElementById("searchInput")?.addEventListener("input", () => renderProducts());
    document.getElementById("categoryFilter")?.addEventListener("change", () => renderProducts());
    document.getElementById("sortSelect")?.addEventListener("change", () => renderProducts());
    
    // Scroll to top
    window.addEventListener("scroll", () => {
        const scrollBtn = document.getElementById("scrollTopBtn");
        if (scrollBtn) {
            scrollBtn.style.display = window.scrollY > 200 ? "flex" : "none";
        }
    });
    
    document.getElementById("scrollTopBtn")?.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    
    // Logo click
    document.getElementById("logoHome")?.addEventListener("click", () => {
        renderProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Initialize app
async function init() {
    await checkAutoLogin();
    setupEventListeners();
}

init();