const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ==================== MIDDLEWARE ====================

const protect = async (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required' });
    }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{ name, email, password: hashedPassword, role: 'user' }])
            .select()
            .single();
        
        if (error) {
            throw new Error(error.message);
        }
        
        // Generate token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== PRODUCT ROUTES ====================

app.get('/api/products', async (req, res) => {
    try {
        const { search, category, sort } = req.query;
        
        let query = supabase.from('products').select('*').eq('is_active', true);
        
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        
        let orderBy = { column: 'created_at', ascending: false };
        if (sort === 'price_asc') orderBy = { column: 'base_price', ascending: true };
        if (sort === 'price_desc') orderBy = { column: 'base_price', ascending: false };
        
        const { data: products, error } = await query.order(orderBy.column, { ascending: orderBy.ascending });
        
        if (error) throw error;
        
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CART ROUTES ====================

app.get('/api/cart', protect, async (req, res) => {
    try {
        const { data: cart, error } = await supabase
            .from('cart')
            .select('items')
            .eq('user_id', req.user.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        const items = cart?.items || [];
        
        // Get product details for each cart item
        const itemsWithDetails = [];
        for (const item of items) {
            const { data: product } = await supabase
                .from('products')
                .select('id, name, image, base_price')
                .eq('id', item.product_id)
                .single();
            
            if (product) {
                itemsWithDetails.push({
                    id: item.id,
                    product: product,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price
                });
            }
        }
        
        res.json({ success: true, cart: { items: itemsWithDetails } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/cart/add', protect, async (req, res) => {
    try {
        const { productId, size, quantity = 1 } = req.body;
        
        // Get product
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();
        
        if (productError || !product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        // Get size price and stock
        const sizes = product.sizes || [];
        const sizeObj = sizes.find(s => s.name === size);
        if (!sizeObj || sizeObj.stock < quantity) {
            return res.status(400).json({ success: false, message: 'Insufficient stock' });
        }
        
        // Get existing cart
        const { data: existingCart } = await supabase
            .from('cart')
            .select('items')
            .eq('user_id', req.user.id)
            .single();
        
        let items = existingCart?.items || [];
        const existingItemIndex = items.findIndex(item => item.product_id === productId && item.size === size);
        
        if (existingItemIndex > -1) {
            items[existingItemIndex].quantity += quantity;
        } else {
            items.push({
                id: Date.now().toString(),
                product_id: productId,
                size,
                quantity,
                price: sizeObj.price
            });
        }
        
        // Update cart
        const { error } = await supabase
            .from('cart')
            .upsert({ user_id: req.user.id, items, updated_at: new Date() })
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, cart: { items } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/cart/update/:itemId', protect, async (req, res) => {
    try {
        const { quantity } = req.body;
        const { itemId } = req.params;
        
        const { data: cart } = await supabase
            .from('cart')
            .select('items')
            .eq('user_id', req.user.id)
            .single();
        
        let items = cart?.items || [];
        const itemIndex = items.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        if (quantity <= 0) {
            items.splice(itemIndex, 1);
        } else {
            items[itemIndex].quantity = quantity;
        }
        
        const { error } = await supabase
            .from('cart')
            .upsert({ user_id: req.user.id, items, updated_at: new Date() });
        
        if (error) throw error;
        
        res.json({ success: true, cart: { items } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/cart/remove/:itemId', protect, async (req, res) => {
    try {
        const { itemId } = req.params;
        
        const { data: cart } = await supabase
            .from('cart')
            .select('items')
            .eq('user_id', req.user.id)
            .single();
        
        let items = cart?.items || [];
        items = items.filter(item => item.id !== itemId);
        
        const { error } = await supabase
            .from('cart')
            .upsert({ user_id: req.user.id, items, updated_at: new Date() });
        
        if (error) throw error;
        
        res.json({ success: true, cart: { items } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ORDER ROUTES ====================

app.post('/api/orders', protect, async (req, res) => {
    try {
        const { customerInfo, paymentMethod, paymentDetails } = req.body;
        
        // Get cart
        const { data: cart } = await supabase
            .from('cart')
            .select('items')
            .eq('user_id', req.user.id)
            .single();
        
        const cartItems = cart?.items || [];
        
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }
        
        let subtotal = 0;
        const orderItems = [];
        
        for (const item of cartItems) {
            const { data: product } = await supabase
                .from('products')
                .select('*')
                .eq('id', item.product_id)
                .single();
            
            if (!product) continue;
            
            const sizeObj = product.sizes?.find(s => s.name === item.size);
            if (!sizeObj || sizeObj.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
            }
            
            subtotal += item.price * item.quantity;
            orderItems.push({
                product_id: product.id,
                name: product.name,
                size: item.size,
                quantity: item.quantity,
                price: item.price
            });
            
            // Update stock
            sizeObj.stock -= item.quantity;
            await supabase
                .from('products')
                .update({ sizes: product.sizes })
                .eq('id', product.id);
        }
        
        const deliveryCharge = customerInfo.district === 'ঢাকা' ? 60 : 100;
        const total = subtotal + deliveryCharge;
        
        // Create order
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                user_id: req.user.id,
                items: orderItems,
                customer_info: customerInfo,
                payment_method: paymentMethod,
                payment_details: paymentMethod === 'cod' ? { payment_status: 'pending' } : paymentDetails,
                subtotal,
                delivery_charge: deliveryCharge,
                total
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Clear cart
        await supabase
            .from('cart')
            .upsert({ user_id: req.user.id, items: [], updated_at: new Date() });
        
        res.status(201).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/orders', protect, async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/stats', protect, admin, async (req, res) => {
    try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        
        const { data: revenueData } = await supabase
            .from('orders')
            .select('total')
            .not('order_status', 'eq', 'cancelled');
        
        const totalRevenue = revenueData?.reduce((sum, o) => sum + o.total, 0) || 0;
        
        res.json({
            success: true,
            stats: { totalUsers, totalProducts, totalOrders, totalRevenue }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/orders', protect, admin, async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/orders/:id/status', protect, admin, async (req, res) => {
    try {
        const { orderStatus, tracking } = req.body;
        
        const { data: order, error } = await supabase
            .from('orders')
            .update({ order_status: orderStatus, tracking })
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/users', protect, admin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, name, email, role, created_at');
        
        if (error) throw error;
        
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/users/:id', protect, admin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/products', protect, admin, async (req, res) => {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .insert([req.body])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/products/:id', protect, admin, async (req, res) => {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/products/:id', protect, admin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SERVER ====================

module.exports = app;
