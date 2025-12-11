// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; // Pon tu URL aquí
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA'; // Pon tu Key aquí


const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // --- SELECTORES ---
    const views = {
        login: document.getElementById('login-view'),
        admin: document.getElementById('admin-view'),
        store: document.getElementById('store-view')
    };
    
    // Admin Products
    const addProductForm = document.getElementById('add-product-form');
    const urlInputsContainer = document.getElementById('url-inputs-container');
    const addUrlBtn = document.getElementById('add-url-btn');
    const productStock = document.getElementById('product-stock');
    const discountType = document.getElementById('discount-type');
    const discountValue = document.getElementById('discount-value');

    // Admin Categories
    const categoryForm = document.getElementById('category-form');
    const categoryNameInput = document.getElementById('category-name-input');
    const categoryList = document.getElementById('category-list');

    // Checkout
    const checkoutForm = document.getElementById('checkout-form');
    
    // Globales
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';
    
    // Mapa
    let map = null;
    let marker = null;
    let selectedCoordinates = null;

    // --- TOAST NOTIFICATION (Nueva función) ---
    // Crea el contenedor si no existe
    if (!document.getElementById('toast-container')) {
        const toastDiv = document.createElement('div');
        toastDiv.id = 'toast-notification';
        toastDiv.className = 'toast-notification';
        document.body.appendChild(toastDiv);
    }
    
    window.showToast = (message, type = 'success') => {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.className = 'toast-notification show'; // Reset class
        
        if (type === 'success') toast.classList.add('toast-success');
        if (type === 'error') toast.classList.add('toast-error');

        setTimeout(() => {
            toast.className = toast.className.replace("show", "");
        }, 3000);
    };

    // --- NAVEGACIÓN ---
    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[viewName]) views[viewName].classList.remove('hidden');
    }

    // Login logic
    document.getElementById('admin-login-btn').addEventListener('click', () => showView('login'));
    document.getElementById('go-to-store-btn').addEventListener('click', () => showView('store'));
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({
            email: document.getElementById('username').value,
            password: document.getElementById('password').value,
        });
        if (error) document.getElementById('login-error').textContent = 'Credenciales incorrectas';
        else {
            document.getElementById('login-error').textContent = '';
            showView('admin');
            loadDataFromServer();
        }
    });
    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        await sb.auth.signOut();
        showView('login');
    });


    // --- UTILS ---
    function calculateFinalPrice(price, type, value) {
        let final = parseFloat(price);
        if (type === 'percent' && value > 0) final = price - (price * (value / 100));
        else if (type === 'fixed' && value > 0) final = price - value;
        return { original: parseFloat(price), final: Math.max(0, final), hasDiscount: final < price };
    }

    function formatPriceHTML(price) {
        const parts = parseFloat(price).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',');
        return parts.length === 2 ? `${parts[0]}<span class="decimal-small">,${parts[1]}</span>` : parts[0];
    }

    // --- ADMIN: PRODUCTOS & URLS ---
    function addUrlInput(value = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'url-input-wrapper';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'https://...';
        input.value = value;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.className = 'remove-url-btn';
        removeBtn.onclick = () => wrapper.remove();
        wrapper.appendChild(input);
        wrapper.appendChild(removeBtn);
        urlInputsContainer.appendChild(wrapper);
    }
    addUrlBtn.addEventListener('click', () => addUrlInput());

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = urlInputsContainer.querySelectorAll('input');
        const imageUrls = [];
        inputs.forEach(inp => { if(inp.value.trim()) imageUrls.push(inp.value.trim()); });
        
        const productData = {
            title: document.getElementById('product-title').value,
            description: document.getElementById('product-desc').value,
            price: parseFloat(document.getElementById('product-price').value) || 0,
            stock: parseInt(productStock.value) || 0,
            category: document.getElementById('product-category').value,
            images: imageUrls,
            discount_type: discountType.value || null,
            discount_value: parseFloat(discountValue.value) || 0
        };

        const editingId = document.getElementById('product-edit-id').value;
        try {
            const { error } = editingId 
                ? await sb.from('products').update(productData).eq('id', editingId)
                : await sb.from('products').insert([{ ...productData, code: 'SIRARI-' + Math.random().toString(36).substr(2, 6).toUpperCase() }]);

            if (error) alert("Error: " + error.message);
            else {
                showToast("Producto guardado correctamente");
                loadDataFromServer();
                resetAdminForm();
            }
        } catch (e) { alert("Error: " + e.message); }
    });

    function resetAdminForm() {
        addProductForm.reset();
        urlInputsContainer.innerHTML = '';
        addUrlInput();
        document.getElementById('product-edit-id').value = '';
        document.getElementById('admin-form-title').textContent = 'Añadir Nuevo Producto';
        document.getElementById('cancel-edit-btn').classList.add('hidden');
    }
    document.getElementById('cancel-edit-btn').addEventListener('click', resetAdminForm);


    // --- ADMIN: CATEGORÍAS ---
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = categoryNameInput.value.trim().toLowerCase();
        if (!newName || categories.some(c => c.name === newName)) return alert("Nombre inválido o duplicado");

        const { error } = await sb.from('categories').insert([{ name: newName }]);
        if (error) alert(error.message);
        else {
            categoryNameInput.value = '';
            loadDataFromServer();
            showToast("Categoría creada");
        }
    });

    function renderCategoryList() {
        categoryList.innerHTML = '';
        const cats = [...categories];
        if(!cats.find(c => c.name === 'otros')) cats.push({id:'virtual', name:'otros'});
        cats.forEach(cat => {
            const btnHtml = cat.name !== 'otros' ? `<button class="action-btn delete-btn" onclick="deleteCategory('${cat.id}', '${cat.name}')">X</button>` : '';
            categoryList.innerHTML += `<div class="category-item"><span>${cat.name}</span>${btnHtml}</div>`;
        });
    }

    window.deleteCategory = async (id, name) => {
        if(confirm(`¿Borrar "${name}"?`)) {
            await sb.from('products').update({ category: 'otros' }).eq('category', name);
            await sb.from('categories').delete().eq('id', id);
            loadDataFromServer();
        }
    };


    // --- TIENDA: DETALLES ---
    let currentDetailQty = 1;

    // Función auxiliar para leer el input del modal (SOLUCIÓN AL PROBLEMA DE BOTÓN AÑADIR)
    window.getDetailQtyValue = () => {
        const input = document.getElementById('detail-qty-input');
        return input ? parseInt(input.value) : 1;
    };

    window.showProductDetail = (id) => {
        const p = products.find(x => x.id == id);
        if(!p) return;
        currentDetailQty = 1;

        let thumbs = '';
        if(p.images) p.images.forEach((url, i) => thumbs += `<img src="${url}" class="gallery-thumbnail ${i===0?'active':''}" onclick="document.getElementById('gallery-main-image').src='${url}'; document.querySelectorAll('.gallery-thumbnail').forEach(t=>t.classList.remove('active')); this.classList.add('active');">`);
        
        const mainImg = p.images?.[0] || '';
        const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
        const maxStock = p.stock > 0 ? p.stock : 1;

        document.getElementById('product-detail-content').innerHTML = `
            <button class="close-modal" onclick="document.getElementById('product-detail-modal').classList.add('hidden')">×</button>
            <div id="product-detail-gallery">
                <img src="${mainImg}" id="gallery-main-image">
                <div id="gallery-thumbnails">${thumbs}</div>
            </div>
            <div id="product-detail-info">
                <h2 style="font-size:1.6rem; margin-bottom:0.5rem;">${p.title}</h2>
                <p style="color:#666; font-size:0.9rem;">Cód: ${p.code}</p>
                <div style="margin: 15px 0;">
                    ${pricing.hasDiscount 
                        ? `<span class="original-price">Bs. ${p.price.toFixed(2)}</span><br><span class="final-price discounted">Bs. ${formatPriceHTML(pricing.final)}</span>`
                        : `<span class="final-price">Bs. ${formatPriceHTML(p.price)}</span>`}
                </div>
                <p style="margin-bottom:10px;"><b>Stock:</b> ${p.stock > 0 ? p.stock : '<span style="color:red">Agotado</span>'}</p>
                <p class="product-full-description" style="white-space: pre-wrap; font-size: 0.95rem;">${p.description}</p>
                
                <div class="detail-actions">
                    <div class="qty-selector">
                        <button class="qty-btn" onclick="updateDetailQty(-1)">-</button>
                        <input type="text" id="detail-qty-input" class="qty-input" value="1" readonly>
                        <button class="qty-btn" onclick="updateDetailQty(1, ${maxStock})">+</button>
                    </div>
                    <button class="primary-btn" style="flex-grow:1; padding:12px;" onclick="addToCart('${p.id}', getDetailQtyValue()); document.getElementById('product-detail-modal').classList.add('hidden')">Añadir al Carrito</button>
                </div>
            </div>
        `;
        document.getElementById('product-detail-modal').classList.remove('hidden');
    };

    window.updateDetailQty = (change, max = 999) => {
        let newQty = currentDetailQty + change;
        if(newQty < 1) newQty = 1;
        if(newQty > max) newQty = max;
        currentDetailQty = newQty;
        const input = document.getElementById('detail-qty-input');
        if(input) input.value = currentDetailQty;
    };


    // --- TIENDA: RENDER ---
    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const search = document.getElementById('search-input').value.toLowerCase();

        const filtered = products.filter(p => {
            if(currentCategoryFilter === 'ofertas') return (p.discount_type && p.discount_value > 0);
            return currentCategoryFilter === 'todos' || p.category === currentCategoryFilter;
        }).filter(p => p.title.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));

        if (filtered.length === 0) { grid.innerHTML = '<p>No se encontraron productos.</p>'; return; }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = (e) => { if(!e.target.classList.contains('add-to-cart-btn')) showProductDetail(p.id); };

            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            const badge = pricing.hasDiscount ? `<div class="discount-badge">-${p.discount_type==='percent'?p.discount_value+'%':p.discount_value+'Bs'}</div>` : '';
            const stockMsg = p.stock > 20 ? '+20 Disp.' : (p.stock < 10 ? `¡Solo ${p.stock}!` : `${p.stock} Disp.`);
            const priceHtml = pricing.hasDiscount 
                ? `<span class="original-price">Bs.${p.price.toFixed(2)}</span> <span class="final-price discounted">Bs.${formatPriceHTML(pricing.final)}</span>`
                : `<span class="final-price">Bs.${formatPriceHTML(p.price)}</span>`;

            card.innerHTML = `
                ${badge}
                <div class="product-image-container"><img src="${p.images?.[0]||''}" class="product-image" loading="lazy"></div>
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <p class="product-code">${p.code}</p>
                    <div class="price-container">${priceHtml}</div>
                    <p class="stock-display ${p.stock<10?'low-stock':''}">${stockMsg}</p>
                    <button class="add-to-cart-btn primary-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)">Añadir al Carrito</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // --- CARRITO (LOGICA CORREGIDA) ---
    
    // Añadir (Global)
    window.addToCart = (id, qty) => {
        // Aseguramos que qty sea número
        qty = parseInt(qty) || 1;
        
        const p = products.find(x => x.id == id);
        if(!p) return;
        if(p.stock < 1) return showToast("Producto Agotado", "error");

        const existing = cart.find(i => i.id == id);
        if(existing) {
            if(existing.quantity + qty > p.stock) return showToast("No hay suficiente stock", "error");
            existing.quantity += qty;
        } else {
            if(qty > p.stock) return showToast("No hay suficiente stock", "error");
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            cart.push({
                id: p.id, title: p.title, price: pricing.final, 
                code: p.code, image: p.images?.[0]||'', quantity: qty, maxStock: p.stock
            });
        }
        saveCart();
        showToast("Producto añadido al carrito"); // AQUI ESTÁ EL TOAST
    };

    // Cambiar Cantidad desde Carrito
    window.changeCartQty = (idx, delta) => {
        const item = cart[idx];
        const newQty = item.quantity + delta;
        if(newQty < 1) return;
        if(newQty > item.maxStock) return showToast("Stock máximo alcanzado", "error");
        item.quantity = newQty;
        saveCart();
        renderCartHTML();
    };

    // ELIMINAR (SOLUCIÓN AL PROBLEMA DE ELIMINAR)
    window.removeFromCart = (idx) => {
        cart.splice(idx, 1);
        saveCart();
        renderCartHTML();
        showToast("Producto eliminado del carrito");
    };

    function renderCartHTML() {
        const list = document.getElementById('cart-items');
        list.innerHTML = '';
        let total = 0;
        
        if (cart.length === 0) list.innerHTML = "<p style='text-align:center'>Carrito vacío</p>";

        cart.forEach((item, idx) => {
            total += item.price * item.quantity;
            list.innerHTML += `
                <div class="cart-item">
                    <img src="${item.image}" class="cart-item-img">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-price">Bs. ${item.price.toFixed(2)}</div>
                    </div>
                    <div class="cart-qty-selector">
                        <button class="cart-qty-btn" onclick="changeCartQty(${idx}, -1)">-</button>
                        <div class="cart-qty-value">${item.quantity}</div>
                        <button class="cart-qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
                    </div>
                    <button class="cart-remove-btn" onclick="removeFromCart(${idx})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        document.getElementById('cart-total').textContent = total.toFixed(2);
        document.getElementById('checkout-btn').disabled = cart.length === 0;
    }
    
    // Listeners del Carrito
    document.getElementById('cart-btn').addEventListener('click', () => {
        renderCartHTML();
        document.getElementById('cart-modal').classList.remove('hidden');
    });
    
    // Otros Listeners
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));

    function saveCart() { 
        localStorage.setItem('sirari_cart', JSON.stringify(cart)); 
        document.getElementById('cart-count').textContent = cart.reduce((a,b)=>a+b.quantity,0);
        document.getElementById('cart-count').style.display = cart.length?'block':'none';
    }

    // --- CHECKOUT & MAPA (Sin cambios lógicos mayores) ---
    // (Incluye la lógica de mapa Leaflet idéntica a la anterior, abreviada aquí por espacio pero debe estar completa)
    // ... Copia la lógica de initMap, btnYesLocation, etc. del código anterior o mantenla si ya la tienes ...
    // Aquí solo me aseguro de incluir las funciones básicas para que no falle si copias todo.
    
    function initMap() {
        const defaultLat = -17.7833; 
        const defaultLng = -63.1821;
        if (map) map.remove();
        map = L.map('delivery-map').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        marker = L.marker([defaultLat, defaultLng], {draggable: true}).addTo(map);
        marker.on('dragend', function(e) { selectedCoordinates = marker.getLatLng(); });
        map.on('click', function(e) { marker.setLatLng(e.latlng); selectedCoordinates = e.latlng; });
        selectedCoordinates = { lat: defaultLat, lng: defaultLng };
        setTimeout(() => { map.invalidateSize(); }, 200);
    }
    document.getElementById('btn-yes-location').onclick = async () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('location-status').textContent = "Obteniendo GPS...";
        try {
            const pos = await new Promise((r, j) => navigator.geolocation.getCurrentPosition(r, j, {timeout: 10000}));
            selectedCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            document.getElementById('location-status').textContent = "✅ Ubicación detectada.";
            document.getElementById('checkout-submit-btn').classList.remove('hidden');
        } catch (e) { document.getElementById('btn-no-location').click(); }
    };
    document.getElementById('btn-no-location').onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    };
    document.getElementById('confirm-map-location').onclick = () => {
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = "✅ Ubicación confirmada.";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };
    checkoutForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const link = selectedCoordinates ? `https://maps.google.com/?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` : 'No especificada';
        
        let msg = `*PEDIDO SIRARI* 🛍️\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${link}\n\n*ITEMS:*`;
        let total = 0;
        cart.forEach(i => { total += i.price*i.quantity; msg += `\n- ${i.title} (${i.quantity}) = Bs.${(i.price*i.quantity).toFixed(2)}`; });
        msg += `\n\n*TOTAL: Bs. ${total.toFixed(2)}*`;
        
        window.open(`https://api.whatsapp.com/send?phone=59173164833&text=${encodeURIComponent(msg)}`, '_blank');
        cart = []; saveCart();
        document.getElementById('checkout-modal').classList.add('hidden');
        document.getElementById('location-question-step').classList.remove('hidden');
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('checkout-submit-btn').classList.add('hidden');
    };
    document.getElementById('checkout-btn').onclick = () => {
        document.getElementById('cart-modal').classList.add('hidden');
        document.getElementById('checkout-modal').classList.remove('hidden');
    };

    // --- INIT ---
    async function loadDataFromServer() {
        const [sess, cats, prods] = await Promise.all([
            sb.auth.getSession(),
            sb.from('categories').select('*'),
            sb.from('products').select('*').order('id', {ascending: false})
        ]);
        categories = cats.data || [];
        products = prods.data || [];
        
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        const addBtn = (t,v) => {
            const b = document.createElement('button');
            b.className = `category-filter-btn ${currentCategoryFilter===v?'active':''}`;
            b.textContent=t; 
            b.onclick=()=>{currentCategoryFilter=v; renderCategoryFilters(); renderProducts();};
            container.appendChild(b);
        };
        addBtn('Ver Todos','todos');
        if(products.some(p => (p.discount_type && p.discount_value > 0))) addBtn('🔥 Ofertas','ofertas');
        categories.forEach(c => addBtn(c.name, c.name));
        if(!categories.find(c=>c.name==='otros')) addBtn('otros','otros');

        renderProducts();
        
        if (sess.data.session) {
            showView('admin');
            renderCategoryList();
            const list = document.getElementById('admin-product-list');
            list.innerHTML = '';
            products.forEach(p => list.innerHTML += `<div class="admin-product-item"><img src="${p.images?.[0]||''}"><div><h4>${p.title}</h4></div><button class="action-btn edit-btn" onclick="editProduct('${p.id}')">Editar</button><button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')">X</button></div>`);
            
            const sel = document.getElementById('product-category');
            sel.innerHTML = '';
            const catsList = [...categories];
            if(!catsList.find(c => c.name === 'otros')) catsList.push({name: 'otros'});
            catsList.forEach(c => sel.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        } else {
            showView('store');
        }
    }
    
    // Funciones Admin globales
    window.editProduct = (id) => {
        const p = products.find(x => x.id == id);
        document.getElementById('product-edit-id').value = p.id;
        document.getElementById('product-title').value = p.title;
        document.getElementById('product-desc').value = p.description;
        document.getElementById('product-price').value = p.price;
        document.getElementById('product-stock').value = p.stock;
        document.getElementById('product-category').value = p.category;
        discountType.value = p.discount_type || "";
        discountValue.value = p.discount_value || "";
        urlInputsContainer.innerHTML = '';
        if(p.images) p.images.forEach(u => addUrlInput(u)); else addUrlInput();
        document.getElementById('admin-form-title').textContent = 'Editar';
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        window.scrollTo(0,0);
    };
    window.deleteProduct = async (id) => { if(confirm('¿Borrar?')) { await sb.from('products').delete().eq('id', id); loadDataFromServer(); }};

    saveCart();
    loadDataFromServer();
});
