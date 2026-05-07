const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = 5000;
const SECRET_KEY = 'techmart_super_secret_key'; 

// ==========================================
// DATABASE SETUP
// ==========================================
const dbPath = path.resolve(__dirname, 'ecommerce.db');
const db = new DatabaseSync(dbPath);

function createTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL, phone TEXT, address TEXT, city TEXT, state TEXT, zipcode TEXT,
            isAdmin BOOLEAN DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL,
            quantity INTEGER NOT NULL, category TEXT NOT NULL, image TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, orderNumber TEXT UNIQUE NOT NULL,
            totalPrice REAL NOT NULL, status TEXT DEFAULT 'pending', shippingAddress TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL, productId INTEGER NOT NULL,
            quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY (orderId) REFERENCES orders(id), FOREIGN KEY (productId) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, productId INTEGER NOT NULL,
            quantity INTEGER NOT NULL, addedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (productId) REFERENCES products(id), UNIQUE(userId, productId)
        );
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, productId INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), comment TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id), FOREIGN KEY (productId) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, subject TEXT NOT NULL,
            message TEXT NOT NULL, response TEXT, status TEXT DEFAULT 'open', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id)
        );
    `);
}
createTables();

// Helper functions for DB queries
function queryAll(sql, ...params) {
    return db.prepare(sql).all(...params);
}
function queryRun(sql, ...params) {
    return db.prepare(sql).run(...params);
}
function queryGet(sql, ...params) {
    return db.prepare(sql).get(...params);
}

// ==========================================
// AUTH UTILS (ZERO DEPENDENCY)
// ==========================================
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function base64url(str) {
    return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateToken(payload) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const data = base64url(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
    const signature = base64url(crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${data}`).digest());
    return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
    try {
        const [header, data, signature] = token.split('.');
        const expectedSignature = base64url(crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${data}`).digest());
        if (signature === expectedSignature) {
            const payload = JSON.parse(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
            if (payload.exp && payload.exp < Date.now()) return null;
            return payload;
        }
        return null;
    } catch (e) { return null; }
}

// ==========================================
// SERVER LOGIC
// ==========================================
const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Helper to send JSON
    res.json = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // Helper to parse JSON body
    const parseBody = () => new Promise(resolve => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => resolve(body ? JSON.parse(body) : {}));
    });

    // Helper to get authenticated user
    const authenticate = () => {
        const authHeader = req.headers['authorization'];
        if (!authHeader) return null;
        const token = authHeader.split(' ')[1];
        return verifyToken(token);
    };

    // --- ROUTER ---
    if (pathname.startsWith('/api/')) {
        (async () => {
            try {
                // AUTH ROUTES
                if (pathname === '/api/auth/register' && req.method === 'POST') {
                    const { username, email, password, phone } = await parseBody();
                    if (!username || !email || !password) return res.json(400, { error: 'Missing fields' });
                    const existing = queryAll(`SELECT id FROM users WHERE email = ? OR username = ?`, email, username);
                    if (existing.length > 0) return res.json(400, { error: 'User already exists' });
                    
                    const info = queryRun(`INSERT INTO users (username, email, password, phone) VALUES (?, ?, ?, ?)`, username, email, hashPassword(password), phone || null);
                    const token = generateToken({ id: info.lastInsertRowid, username, isAdmin: 0 });
                    return res.json(200, { userId: info.lastInsertRowid, username, isAdmin: false, token });
                }
                if (pathname === '/api/auth/login' && req.method === 'POST') {
                    const { email, password } = await parseBody();
                    if (!email || !password) return res.json(400, { error: 'Missing fields' });
                    const user = queryGet(`SELECT * FROM users WHERE email = ?`, email);
                    if (!user || user.password !== hashPassword(password)) return res.json(401, { error: 'Invalid credentials' });
                    
                    const token = generateToken({ id: user.id, username: user.username, isAdmin: user.isAdmin });
                    return res.json(200, { userId: user.id, username: user.username, isAdmin: user.isAdmin == 1, token });
                }

                // PRODUCTS
                if (pathname === '/api/products/categories/list' && req.method === 'GET') {
                    const rows = queryAll(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL`);
                    return res.json(200, rows.map(r => r.category));
                }
                if (pathname === '/api/products' && req.method === 'GET') {
                    let sql = `SELECT p.*, COALESCE(AVG(r.rating), 0) as avgRating, COUNT(r.id) as reviewCount 
                               FROM products p LEFT JOIN reviews r ON p.id = r.productId WHERE 1=1`;
                    const params = [];
                    const search = url.searchParams.get('search');
                    if (search) { sql += ` AND p.name LIKE ?`; params.push(`%${search}%`); }
                    const cat = url.searchParams.get('category');
                    if (cat) { sql += ` AND p.category = ?`; params.push(cat); }
                    const min = url.searchParams.get('minPrice');
                    if (min) { sql += ` AND p.price >= ?`; params.push(min); }
                    const max = url.searchParams.get('maxPrice');
                    if (max) { sql += ` AND p.price <= ?`; params.push(max); }
                    sql += ` GROUP BY p.id`;
                    const sort = url.searchParams.get('sortBy');
                    if (sort === 'price_asc') sql += ` ORDER BY p.price ASC`;
                    else if (sort === 'price_desc') sql += ` ORDER BY p.price DESC`;
                    else if (sort === 'newest') sql += ` ORDER BY p.createdAt DESC`;
                    else if (sort === 'rating') sql += ` ORDER BY avgRating DESC`;
                    
                    return res.json(200, queryAll(sql, ...params));
                }
                if (pathname.match(/^\/api\/products\/\d+$/) && req.method === 'GET') {
                    const id = pathname.split('/').pop();
                    const product = queryGet(`SELECT p.*, COALESCE(AVG(r.rating), 0) as avgRating, COUNT(r.id) as reviewCount FROM products p LEFT JOIN reviews r ON p.id = r.productId WHERE p.id = ? GROUP BY p.id`, id);
                    if (!product) return res.json(404, { error: 'Not found' });
                    return res.json(200, product);
                }

                // CART
                if (pathname.startsWith('/api/cart')) {
                    const user = authenticate();
                    if (!user) return res.json(401, { error: 'Unauthorized' });

                    if (pathname === '/api/cart' && req.method === 'GET') {
                        const items = queryAll(`SELECT c.id, c.quantity, p.id as productId, p.name, p.price, p.image FROM cart_items c JOIN products p ON c.productId = p.id WHERE c.userId = ?`, user.id);
                        return res.json(200, items);
                    }
                    if (pathname === '/api/cart/add' && req.method === 'POST') {
                        const { productId, quantity } = await parseBody();
                        const qty = parseInt(quantity) || 1;
                        const existing = queryGet(`SELECT id FROM cart_items WHERE userId = ? AND productId = ?`, user.id, productId);
                        if (existing) queryRun(`UPDATE cart_items SET quantity = quantity + ? WHERE id = ?`, qty, existing.id);
                        else queryRun(`INSERT INTO cart_items (userId, productId, quantity) VALUES (?, ?, ?)`, user.id, productId, qty);
                        return res.json(200, { success: true });
                    }
                    const match = pathname.match(/^\/api\/cart\/(\d+)$/);
                    if (match && req.method === 'PUT') {
                        const { quantity } = await parseBody();
                        queryRun(`UPDATE cart_items SET quantity = ? WHERE id = ? AND userId = ?`, parseInt(quantity), match[1], user.id);
                        return res.json(200, { success: true });
                    }
                    if (match && req.method === 'DELETE') {
                        queryRun(`DELETE FROM cart_items WHERE id = ? AND userId = ?`, match[1], user.id);
                        return res.json(200, { success: true });
                    }
                }

                // ORDERS
                if (pathname.startsWith('/api/orders')) {
                    const user = authenticate();
                    
                    if (pathname === '/api/orders' && req.method === 'POST') {
                        if (!user) return res.json(401, { error: 'Unauthorized' });
                        const { shippingAddress } = await parseBody();
                        const cartItems = queryAll(`SELECT c.quantity, p.id as productId, p.price FROM cart_items c JOIN products p ON c.productId = p.id WHERE c.userId = ?`, user.id);
                        if (cartItems.length === 0) return res.json(400, { error: 'Cart empty' });
                        const total = cartItems.reduce((s, i) => s + (i.price * i.quantity), 0) * 1.1;
                        const orderNumber = 'ORD-' + Date.now();
                        const info = queryRun(`INSERT INTO orders (userId, orderNumber, totalPrice, shippingAddress) VALUES (?, ?, ?, ?)`, user.id, orderNumber, total, shippingAddress);
                        cartItems.forEach(item => queryRun(`INSERT INTO order_items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)`, info.lastInsertRowid, item.productId, item.quantity, item.price));
                        queryRun(`DELETE FROM cart_items WHERE userId = ?`, user.id);
                        return res.json(200, { orderNumber });
                    }
                    if (pathname === '/api/orders' && req.method === 'GET') {
                        if (!user) return res.json(401, { error: 'Unauthorized' });
                        return res.json(200, queryAll(`SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC`, user.id));
                    }
                    const trackMatch = pathname.match(/^\/api\/orders\/track\/(.+)$/);
                    if (trackMatch && req.method === 'GET') {
                        const order = queryGet(`SELECT * FROM orders WHERE orderNumber = ?`, trackMatch[1]);
                        if (!order) return res.json(404, { error: 'Not found' });
                        return res.json(200, order);
                    }
                    const match = pathname.match(/^\/api\/orders\/(\d+)$/);
                    if (match && req.method === 'GET') {
                        if (!user) return res.json(401, { error: 'Unauthorized' });
                        const order = queryGet(`SELECT * FROM orders WHERE id = ? AND userId = ?`, match[1], user.id);
                        if (!order) return res.json(404, { error: 'Not found' });
                        order.items = queryAll(`SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.productId = p.id WHERE oi.orderId = ?`, match[1]);
                        return res.json(200, order);
                    }
                }

                // REVIEWS & SUPPORT & ADMIN
                if (pathname === '/api/reviews/user/reviews' && req.method === 'GET') {
                    const user = authenticate();
                    if (!user) return res.json(401, { error: 'Unauthorized' });
                    return res.json(200, queryAll(`SELECT r.*, p.name FROM reviews r JOIN products p ON r.productId = p.id WHERE r.userId = ?`, user.id));
                }
                if (pathname === '/api/reviews' && req.method === 'POST') {
                    const user = authenticate();
                    if (!user) return res.json(401, { error: 'Unauthorized' });
                    const { productId, rating, comment } = await parseBody();
                    queryRun(`INSERT INTO reviews (userId, productId, rating, comment) VALUES (?, ?, ?, ?)`, user.id, productId, rating, comment);
                    return res.json(200, { success: true });
                }
                const reviewMatch = pathname.match(/^\/api\/reviews\/(\d+)$/);
                if (reviewMatch && req.method === 'GET') {
                    return res.json(200, queryAll(`SELECT r.*, u.username FROM reviews r JOIN users u ON r.userId = u.id WHERE r.productId = ? ORDER BY r.createdAt DESC`, reviewMatch[1]));
                }
                
                if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
                    const user = authenticate();
                    if (!user || !user.isAdmin) return res.json(403, { error: 'Forbidden' });
                    return res.json(200, {
                        users: queryGet(`SELECT COUNT(*) as c FROM users`).c,
                        orders: queryGet(`SELECT COUNT(*) as c, SUM(totalPrice) as r FROM orders`).c,
                        revenue: queryGet(`SELECT SUM(totalPrice) as r FROM orders`).r || 0,
                        products: queryGet(`SELECT COUNT(*) as c FROM products`).c
                    });
                }
                if (pathname === '/api/admin/products' && req.method === 'POST') {
                    const user = authenticate();
                    if (!user || !user.isAdmin) return res.json(403, { error: 'Forbidden' });
                    const { name, description, price, quantity, category, image } = await parseBody();
                    queryRun(`INSERT INTO products (name, description, price, quantity, category, image) VALUES (?, ?, ?, ?, ?, ?)`, name, description, price, quantity, category, image);
                    return res.json(200, { success: true });
                }

                // Fallback API route
                return res.json(404, { error: 'API route not found' });
            } catch (err) {
                console.error(err);
                res.json(500, { error: err.message });
            }
        })();
        return;
    }

    // --- STATIC FILE SERVING ---
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    
    const extname = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg'
    };
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
                    if (err) { res.writeHead(500); res.end('Error loading index.html'); }
                    else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(content, 'utf-8'); }
                });
            } else {
                res.writeHead(500); res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Zero-Dependency Backend running on http://localhost:${PORT}`);
});
