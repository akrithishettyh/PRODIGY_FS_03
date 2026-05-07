// ==========================================
// 🚀 SERVERLESS MOCK BACKEND
// ==========================================
// This script intercepts window.fetch and serves data from localStorage
// allowing the app to run completely offline without any backend server.

const MOCK_DELAY = 300; // Simulate network latency (ms)

// --- SEED DATA ---
const INITIAL_PRODUCTS = [
    { id: 1, name: "Wireless Noise-Cancelling Headphones", description: "Premium over-ear headphones with active noise cancellation and 30-hour battery life.", price: 299, quantity: 50, category: "Audio", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80", avgRating: 4.8, reviewCount: 120 },
    { id: 2, name: "Ultra-Slim 4K Monitor", description: "27-inch 4K UHD IPS monitor with ultra-thin bezels for an immersive viewing experience.", price: 349, quantity: 30, category: "Displays", image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80", avgRating: 4.5, reviewCount: 85 },
    { id: 3, name: "Mechanical Gaming Keyboard", description: "RGB backlit mechanical keyboard with tactile blue switches and aluminum frame.", price: 129, quantity: 100, category: "Accessories", image: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&q=80", avgRating: 4.7, reviewCount: 210 },
    { id: 4, name: "Pro Wireless Mouse", description: "Ultra-lightweight gaming mouse with 25K DPI sensor and 70-hour battery.", price: 149, quantity: 75, category: "Accessories", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&q=80", avgRating: 4.9, reviewCount: 340 },
    { id: 5, name: "Smart Home Hub", description: "Voice-controlled smart speaker to manage all your connected devices.", price: 99, quantity: 200, category: "Smart Home", image: "https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=500&q=80", avgRating: 4.3, reviewCount: 45 },
    { id: 6, name: "Portable SSD 1TB", description: "High-speed external solid state drive with USB-C connection.", price: 159, quantity: 120, category: "Storage", image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&q=80", avgRating: 4.8, reviewCount: 500 }
];

const INITIAL_USERS = [
    { id: 1, username: "admin", email: "admin@techmart.com", password: "admin123", isAdmin: true },
    { id: 2, username: "johndoe", email: "john@example.com", password: "password123", isAdmin: false }
];

// --- INIT LOCALSTORAGE ---
function initDB() {
    if (!localStorage.getItem('techmart_products')) {
        localStorage.setItem('techmart_products', JSON.stringify(INITIAL_PRODUCTS));
    }
    if (!localStorage.getItem('techmart_users')) {
        localStorage.setItem('techmart_users', JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem('techmart_cart')) localStorage.setItem('techmart_cart', JSON.stringify([]));
    if (!localStorage.getItem('techmart_orders')) localStorage.setItem('techmart_orders', JSON.stringify([]));
    if (!localStorage.getItem('techmart_reviews')) localStorage.setItem('techmart_reviews', JSON.stringify([]));
    if (!localStorage.getItem('techmart_support')) localStorage.setItem('techmart_support', JSON.stringify([]));
}
initDB();

// --- HELPERS ---
const db = {
    get: (table) => JSON.parse(localStorage.getItem(`techmart_${table}`) || '[]'),
    set: (table, data) => localStorage.setItem(`techmart_${table}`, JSON.stringify(data)),
    getNextId: (table) => {
        const items = JSON.parse(localStorage.getItem(`techmart_${table}`) || '[]');
        return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    }
};

const createResponse = (body, status = 200) => {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
};

const authenticate = (req) => {
    const authHeader = req.headers ? (req.headers.Authorization || req.headers.get('Authorization')) : null;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    // Our mock token format: "userId-username-isAdmin"
    const parts = token.split('-');
    if (parts.length >= 3) {
        return { id: parseInt(parts[0]), username: parts[1], isAdmin: parts[2] === 'true' };
    }
    return null;
};

// --- FETCH INTERCEPTOR ---
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const urlStr = typeof args[0] === 'string' ? args[0] : args[0].url;
    const reqOptions = args[1] || {};
    
    // Only intercept /api/ calls
    if (!urlStr.includes('/api/')) {
        return originalFetch(...args);
    }

    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname.replace('/api/', '');
    const method = reqOptions.method ? reqOptions.method.toUpperCase() : 'GET';
    const body = reqOptions.body ? JSON.parse(reqOptions.body) : null;
    const searchParams = url.searchParams;

    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

    try {
        // --- AUTH ---
        if (path === 'auth/login' && method === 'POST') {
            const users = db.get('users');
            const user = users.find(u => u.email === body.email && u.password === body.password);
            if (!user) return createResponse({ error: 'Invalid credentials' }, 401);
            
            const token = `${user.id}-${user.username}-${user.isAdmin}`;
            return createResponse({ userId: user.id, username: user.username, isAdmin: user.isAdmin, token });
        }
        
        if (path === 'auth/register' && method === 'POST') {
            const users = db.get('users');
            if (users.find(u => u.email === body.email || u.username === body.username)) {
                return createResponse({ error: 'User already exists' }, 400);
            }
            const newUser = { id: db.getNextId('users'), username: body.username, email: body.email, password: body.password, phone: body.phone, isAdmin: false };
            users.push(newUser);
            db.set('users', users);
            
            const token = `${newUser.id}-${newUser.username}-false`;
            return createResponse({ userId: newUser.id, username: newUser.username, isAdmin: false, token });
        }

        // --- PRODUCTS ---
        if (path === 'products' && method === 'GET') {
            let products = db.get('products');
            if (searchParams.get('search')) {
                const query = searchParams.get('search').toLowerCase();
                products = products.filter(p => p.name.toLowerCase().includes(query));
            }
            if (searchParams.get('category')) {
                products = products.filter(p => p.category === searchParams.get('category'));
            }
            if (searchParams.get('minPrice')) {
                products = products.filter(p => p.price >= parseFloat(searchParams.get('minPrice')));
            }
            if (searchParams.get('maxPrice')) {
                products = products.filter(p => p.price <= parseFloat(searchParams.get('maxPrice')));
            }
            
            const sortBy = searchParams.get('sortBy');
            if (sortBy === 'price_asc') products.sort((a,b) => a.price - b.price);
            if (sortBy === 'price_desc') products.sort((a,b) => b.price - a.price);
            if (sortBy === 'rating') products.sort((a,b) => b.avgRating - a.avgRating);

            return createResponse(products);
        }

        if (path === 'products/categories/list' && method === 'GET') {
            const products = db.get('products');
            const categories = [...new Set(products.map(p => p.category))];
            return createResponse(categories);
        }

        if (path.match(/^products\/\d+$/) && method === 'GET') {
            const id = parseInt(path.split('/')[1]);
            const product = db.get('products').find(p => p.id === id);
            if (!product) return createResponse({ error: 'Product not found' }, 404);
            return createResponse(product);
        }

        // --- CART ---
        if (path.startsWith('cart')) {
            const user = authenticate({ headers: reqOptions.headers });
            if (!user) return createResponse({ error: 'Unauthorized' }, 401);
            
            let cart = db.get('cart');
            
            if (path === 'cart' && method === 'GET') {
                const userCart = cart.filter(c => c.userId === user.id);
                const products = db.get('products');
                const detailedCart = userCart.map(c => {
                    const p = products.find(prod => prod.id === c.productId);
                    return { id: c.id, quantity: c.quantity, productId: p.id, name: p.name, price: p.price, image: p.image };
                });
                return createResponse(detailedCart);
            }
            
            if (path === 'cart/add' && method === 'POST') {
                const existing = cart.find(c => c.userId === user.id && c.productId === body.productId);
                if (existing) {
                    existing.quantity += (parseInt(body.quantity) || 1);
                } else {
                    cart.push({ id: db.getNextId('cart'), userId: user.id, productId: body.productId, quantity: parseInt(body.quantity) || 1 });
                }
                db.set('cart', cart);
                return createResponse({ success: true });
            }

            const match = path.match(/^cart\/(\d+)$/);
            if (match && method === 'PUT') {
                const id = parseInt(match[1]);
                const item = cart.find(c => c.id === id && c.userId === user.id);
                if (item) item.quantity = parseInt(body.quantity);
                db.set('cart', cart);
                return createResponse({ success: true });
            }

            if (match && method === 'DELETE') {
                const id = parseInt(match[1]);
                cart = cart.filter(c => !(c.id === id && c.userId === user.id));
                db.set('cart', cart);
                return createResponse({ success: true });
            }
        }

        // --- ORDERS ---
        if (path.startsWith('orders')) {
            const user = authenticate({ headers: reqOptions.headers });
            
            if (path === 'orders' && method === 'POST') {
                if (!user) return createResponse({ error: 'Unauthorized' }, 401);
                let cart = db.get('cart');
                const userCart = cart.filter(c => c.userId === user.id);
                if (userCart.length === 0) return createResponse({ error: 'Cart empty' }, 400);
                
                const products = db.get('products');
                let subtotal = 0;
                const orderItems = userCart.map(c => {
                    const p = products.find(prod => prod.id === c.productId);
                    subtotal += p.price * c.quantity;
                    return { productId: p.id, name: p.name, price: p.price, quantity: c.quantity };
                });
                
                const total = subtotal * 1.1;
                const orderNumber = 'ORD-' + Date.now();
                
                const orders = db.get('orders');
                const newOrder = {
                    id: db.getNextId('orders'), userId: user.id, orderNumber,
                    totalPrice: total, status: 'processing', shippingAddress: body.shippingAddress,
                    createdAt: new Date().toISOString(), items: orderItems
                };
                orders.push(newOrder);
                db.set('orders', orders);
                
                // Clear cart
                db.set('cart', cart.filter(c => c.userId !== user.id));
                return createResponse({ orderNumber });
            }

            if (path === 'orders' && method === 'GET') {
                if (!user) return createResponse({ error: 'Unauthorized' }, 401);
                const orders = db.get('orders').filter(o => o.userId === user.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                return createResponse(orders);
            }

            const trackMatch = path.match(/^orders\/track\/(.+)$/);
            if (trackMatch && method === 'GET') {
                const order = db.get('orders').find(o => o.orderNumber === trackMatch[1]);
                if (!order) return createResponse({ error: 'Not found' }, 404);
                return createResponse(order);
            }

            const match = path.match(/^orders\/(\d+)$/);
            if (match && method === 'GET') {
                if (!user) return createResponse({ error: 'Unauthorized' }, 401);
                const order = db.get('orders').find(o => o.id === parseInt(match[1]) && o.userId === user.id);
                if (!order) return createResponse({ error: 'Not found' }, 404);
                return createResponse(order);
            }
        }

        // --- REVIEWS & SUPPORT ---
        if (path.startsWith('reviews')) {
            const user = authenticate({ headers: reqOptions.headers });
            if (path === 'reviews/user/reviews' && method === 'GET') {
                if (!user) return createResponse({ error: 'Unauthorized' }, 401);
                const reviews = db.get('reviews').filter(r => r.userId === user.id);
                return createResponse(reviews);
            }
            if (path === 'reviews' && method === 'POST') {
                if (!user) return createResponse({ error: 'Unauthorized' }, 401);
                const reviews = db.get('reviews');
                reviews.push({ id: db.getNextId('reviews'), userId: user.id, username: user.username, productId: body.productId, rating: body.rating, comment: body.comment, createdAt: new Date().toISOString() });
                db.set('reviews', reviews);
                return createResponse({ success: true });
            }
            const match = path.match(/^reviews\/(\d+)$/);
            if (match && method === 'GET') {
                const reviews = db.get('reviews').filter(r => r.productId === parseInt(match[1])).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                return createResponse(reviews);
            }
        }

        if (path === 'support' && method === 'POST') {
            const user = authenticate({ headers: reqOptions.headers });
            if (!user) return createResponse({ error: 'Unauthorized' }, 401);
            const support = db.get('support');
            support.push({ id: db.getNextId('support'), userId: user.id, subject: body.subject, message: body.message, createdAt: new Date().toISOString(), status: 'open' });
            db.set('support', support);
            return createResponse({ success: true });
        }
        
        if (path === 'support' && method === 'GET') {
            const user = authenticate({ headers: reqOptions.headers });
            if (!user) return createResponse({ error: 'Unauthorized' }, 401);
            return createResponse(db.get('support').filter(s => s.userId === user.id));
        }

        // --- ADMIN ---
        if (path === 'admin/dashboard' && method === 'GET') {
            const user = authenticate({ headers: reqOptions.headers });
            if (!user || !user.isAdmin) return createResponse({ error: 'Forbidden' }, 403);
            const orders = db.get('orders');
            return createResponse({
                users: db.get('users').length,
                orders: orders.length,
                revenue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
                products: db.get('products').length
            });
        }

        if (path === 'admin/products' && method === 'POST') {
            const user = authenticate({ headers: reqOptions.headers });
            if (!user || !user.isAdmin) return createResponse({ error: 'Forbidden' }, 403);
            const products = db.get('products');
            products.push({ id: db.getNextId('products'), ...body, createdAt: new Date().toISOString(), avgRating: 0, reviewCount: 0 });
            db.set('products', products);
            return createResponse({ success: true });
        }

        return createResponse({ error: 'API route not mocked' }, 404);
    } catch (e) {
        console.error("Mock Backend Error:", e);
        return createResponse({ error: e.message }, 500);
    }
};
