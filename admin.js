const API_URL = '/api';

let token = null;
let currentUser = null;

// Check authentication
token = localStorage.getItem('token');
currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || currentUser.role !== 'admin') {
    window.location.href = '/';
}

// Toast function
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// API Helper
const api = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }
        return data;
    },
    get(endpoint) { return this.request(endpoint); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

// Load Dashboard
async function loadDashboard() {
    try {
        const data = await api.get('/admin/stats');
        const stats = data.stats;
        
        return `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-title">মোট ব্যবহারকারী</div><div class="stat-value">${stats.totalUsers}</div></div>
                <div class="stat-card"><div class="stat-title">মোট পণ্য</div><div class="stat-value">${stats.totalProducts}</div></div>
                <div class="stat-card"><div class="stat-title">মোট অর্ডার</div><div class="stat-value">${stats.totalOrders}</div></div>
                <div class="stat-card"><div class="stat-title">মোট বিক্রয়</div><div class="stat-value">৳${stats.totalRevenue.toLocaleString()}</div></div>
            </div>
            <div class="data-table"><h3 style="margin-bottom:1rem;">সাম্প্রতিক অর্ডার</h3><div id="recentOrders"></div></div>
        `;
    } catch (error) {
        return '<div class="error">Error loading dashboard</div>';
    }
}

// Load Orders
async function loadOrders() {
    try {
        const data = await api.get('/admin/orders');
        const orders = data.orders || [];
        
        if (orders.length === 0) return '<div class="data-table"><p style="padding:2rem; text-align:center;">কোনো অর্ডার নেই</p></div>';
        
        return `
            <div class="data-table">
                <table>
                    <thead><tr><th>অর্ডার আইডি</th><th>তারিখ</th><th>গ্রাহক</th><th>মোট</th><th>স্ট্যাটাস</th><th>পেমেন্ট</th><th>অ্যাকশন</th></tr></thead>
                    <tbody>
                        ${orders.map(order => `
                            <tr>
                                <td>${order.id?.slice(-8) || order._id?.slice(-8)}</td>
                                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                                <td>${order.customer_info?.name}<br><small>${order.customer_info?.phone}</small></td>
                                <td>৳${order.total}</td>
                                <td><span class="status-badge status-${order.order_status}">${order.order_status}</span></td>
                                <td><span class="status-badge">${order.payment_method}</span></td>
                                <td><button class="btn btn-primary btn-sm update-status" data-id="${order.id || order._id}" data-status="${order.order_status}">স্ট্যাটাস</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        return '<div>Error loading orders</div>';
    }
}

// Load Products
async function loadProducts() {
    try {
        const data = await api.get('/products');
        const products = data.products || [];
        
        return `
            <div class="data-table">
                <table>
                    <thead><tr><th>ছবি</th><th>নাম</th><th>ক্যাটাগরি</th><th>মূল্য</th><th>স্টক</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
                    <tbody>
                        ${products.map(product => `
                            <tr>
                                <td><img src="${product.image}" class="product-image-thumb" onerror="this.src='https://via.placeholder.com/50'"></td>
                                <td>${product.name}</td>
                                <td>${product.category}</td>
                                <td>৳${product.base_price}</td>
                                <td>${product.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0) || 0}</td>
                                <td><span class="status-badge ${product.is_active ? 'status-success' : 'status-danger'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
                                <td>
                                    <button class="btn btn-primary btn-sm edit-product" data-id="${product.id}">এডিট</button>
                                    <button class="btn btn-danger btn-sm delete-product" data-id="${product.id}">ডিলিট</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        return '<div>Error loading products</div>';
    }
}

// Load Users
async function loadUsers() {
    try {
        const data = await api.get('/admin/users');
        const users = data.users || [];
        
        return `
            <div class="data-table">
                <table>
                    <thead><tr><th>নাম</th><th>ইমেইল</th><th>রোল</th><th>জয়েন তারিখ</th><th>অ্যাকশন</th></tr></thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${user.name}</td>
                                <td>${user.email}</td>
                                <td><span class="status-badge ${user.role === 'admin' ? 'status-warning' : 'status-success'}">${user.role}</span></td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>${user.role !== 'admin' ? `<button class="btn btn-danger btn-sm delete-user" data-id="${user.id}">ডিলিট</button>` : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        return '<div>Error loading users</div>';
    }
}

// Add Product Form
function getAddProductForm() {
    return `
        <div class="form-card">
            <div class="form-group"><label>পণ্যের নাম *</label><input type="text" id="prodName" placeholder="পণ্যের নাম"></div>
            <div class="form-group"><label>ক্যাটাগরি *</label><select id="prodCategory"><option value="clothing">পোশাক</option><option value="electronics">ইলেকট্রনিক্স</option><option value="accessories">এক্সেসরিজ</option></select></div>
            <div class="form-group"><label>মূল্য *</label><input type="number" id="prodPrice" placeholder="বর্তমান মূল্য"></div>
            <div class="form-group"><label>পুরনো মূল্য</label><input type="number" id="prodOldPrice" placeholder="আগের মূল্য"></div>
            <div class="form-group"><label>ইমেজ URL *</label><input type="text" id="prodImage" placeholder="https://..."></div>
            <div class="form-group"><label>সাইজ ও স্টক *</label><div id="prodSizes"><div class="size-row"><input type="text" placeholder="সাইজ" style="width:40%"><input type="number" placeholder="মূল্য" style="width:30%"><input type="number" placeholder="স্টক" style="width:30%"></div></div><button type="button" class="btn btn-sm" id="addMoreSize">+ আরো সাইজ</button></div>
            <div class="form-group"><label>বেজ</label><input type="text" id="prodBadge" placeholder="সেল, বেস্ট সেলার"></div>
            <div class="form-group"><label>রেটিং</label><input type="number" id="prodRating" step="0.1" min="0" max="5" value="4.0"></div>
            <button class="btn btn-primary btn-block" id="submitNewProduct">পণ্য যোগ করুন</button>
        </div>
    `;
}

// Page Router
const pages = {
    dashboard: loadDashboard,
    orders: loadOrders,
    products: loadProducts,
    'add-product': getAddProductForm,
    users: loadUsers
};

// Load Page
async function loadPage(page) {
    const pageContent = document.getElementById('pageContent');
    const pageTitle = document.getElementById('pageTitle');
    
    const titles = { dashboard: '📊 ড্যাশবোর্ড', orders: '🚚 অর্ডার ব্যবস্থাপনা', products: '📦 পণ্য ব্যবস্থাপনা', 'add-product': '➕ নতুন পণ্য যোগ করুন', users: '👥 ব্যবহারকারী ব্যবস্থাপনা' };
    pageTitle.innerHTML = titles[page] || 'ড্যাশবোর্ড';
    
    if (pages[page]) {
        const content = await pages[page]();
        pageContent.innerHTML = content;
        if (page === 'orders') attachOrderEvents();
        if (page === 'products') attachProductEvents();
        if (page === 'add-product') attachAddProductEvents();
        if (page === 'users') attachUserEvents();
    }
}

// Event Attachments
let currentOrderId = null;

function attachOrderEvents() {
    document.querySelectorAll('.update-status').forEach(btn => {
        btn.addEventListener('click', () => {
            currentOrderId = btn.dataset.id;
            document.getElementById('orderStatusModal').style.display = 'flex';
        });
    });
}

async function updateOrderStatus() {
    const status = document.getElementById('orderStatusSelect').value;
    const tracking = document.getElementById('orderTracking').value;
    try {
        await api.put(`/admin/orders/${currentOrderId}/status`, { orderStatus: status, tracking });
        showToast('অর্ডার আপডেট করা হয়েছে', 'success');
        document.getElementById('orderStatusModal').style.display = 'none';
        loadPage('orders');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function attachProductEvents() {
    document.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', () => showProductModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('পণ্যটি ডিলিট করতে চান?')) {
                try {
                    await api.delete(`/admin/products/${btn.dataset.id}`);
                    showToast('পণ্য ডিলিট করা হয়েছে', 'success');
                    loadPage('products');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            }
        });
    });
}

function attachAddProductEvents() {
    document.getElementById('addMoreSize')?.addEventListener('click', () => {
        const container = document.getElementById('prodSizes');
        container.innerHTML += `<div class="size-row"><input type="text" placeholder="সাইজ" style="width:40%"><input type="number" placeholder="মূল্য" style="width:30%"><input type="number" placeholder="স্টক" style="width:30%"></div>`;
    });
    document.getElementById('submitNewProduct')?.addEventListener('click', async () => {
        const name = document.getElementById('prodName').value;
        const category = document.getElementById('prodCategory').value;
        const base_price = parseFloat(document.getElementById('prodPrice').value);
        const old_price = parseFloat(document.getElementById('prodOldPrice').value) || 0;
        const image = document.getElementById('prodImage').value;
        const badge = document.getElementById('prodBadge').value;
        const rating = parseFloat(document.getElementById('prodRating').value);
        
        const sizes = [];
        document.querySelectorAll('#prodSizes .size-row').forEach(row => {
            const inputs = row.querySelectorAll('input');
            const nameVal = inputs[0].value;
            const priceVal = parseFloat(inputs[1].value);
            const stockVal = parseInt(inputs[2].value);
            if (nameVal && priceVal && stockVal) sizes.push({ name: nameVal, price: priceVal, stock: stockVal });
        });
        
        if (!name || !category || !base_price || !image || sizes.length === 0) {
            showToast('সব তথ্য পূরণ করুন', 'error');
            return;
        }
        
        try {
            await api.post('/admin/products', { name, category, base_price, old_price, image, sizes, badge, rating, is_active: true });
            showToast('পণ্য যোগ করা হয়েছে', 'success');
            loadPage('products');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

function attachUserEvents() {
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('ব্যবহারকারী ডিলিট করতে চান?')) {
                try {
                    await api.delete(`/admin/users/${btn.dataset.id}`);
                    showToast('ব্যবহারকারী ডিলিট করা হয়েছে', 'success');
                    loadPage('users');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            }
        });
    });
}

function showProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    document.getElementById('productModalTitle').innerHTML = productId ? 'পণ্য এডিট করুন' : 'নতুন পণ্য যোগ করুন';
    modal.style.display = 'flex';
}

// Navigation
document.querySelectorAll('.admin-menu a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
        loadPage(link.dataset.page);
    });
});

// Theme Toggle
document.getElementById('themeToggle')?.addEventListener('click', () => document.body.classList.toggle('dark'));

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
});

// Modal Close
document.getElementById('closeProductModal')?.addEventListener('click', () => document.getElementById('productModal').style.display = 'none');
document.getElementById('closeOrderStatusModal')?.addEventListener('click', () => document.getElementById('orderStatusModal').style.display = 'none');
document.getElementById('updateOrderStatusBtn')?.addEventListener('click', updateOrderStatus);

// Initial Load
loadPage('dashboard');