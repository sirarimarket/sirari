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
    
    // Forms & Inputs
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    
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
    const categoryEditId = document.getElementById('category-edit-id');
    const categorySaveBtn = document.getElementById('category-save-btn');
    const categoryList = document.getElementById('category-list');

    // Checkout & Map
    const checkoutForm = document.getElementById('checkout-form');
    const locationQuestionStep = document.getElementById('location-question-step');
    const btnYesLocation = document.getElementById('btn-yes-location');
    const btnNoLocation = document.getElementById('btn-no-location');
    const mapContainerWrapper = document.getElementById('map-container-wrapper');
    const confirmMapLocationBtn = document.getElementById('confirm-map-location');
    const checkoutSubmitBtn = document.getElementById('checkout-submit-btn');
    const locationStatus = document.getElementById('location-status');

    // Globales
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';
    
    let map = null;
    let marker = null;
    let selectedCoordinates = null;

    // --- UTILIDADES ---
    function formatPriceHTML(price) {
        const num = parseFloat(price);
        if (isNaN(num)) return "0,00";
        const formatted = num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const parts = formatted.split(',');
        if (parts.length === 2) {
            return `${parts[0]}<span class="decimal-small">,${parts[1]}</span>`;
        }
        return formatted;
    }

    function calculateFinalPrice(price, type, value) {
        let final = parseFloat(price);
        let original = parseFloat(price);
        let hasDiscount = false;

        if (type === 'percent' && value > 0) {
            final = price - (price * (value / 100));
            hasDiscount = true;
        } else if (type === 'fixed' && value > 0) {
            final = price - value;
            hasDiscount = true;
        }
        return { original, final: Math.max(0, final), hasDiscount };
    }

    // --- NAVEGACIÓN ---
    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[viewName]) views[viewName].classList.remove('hidden');
    }

    document.getElementById('go-to-store-btn').addEventListener('click', () => showView('store'));
    document.getElementById('admin-login-btn').addEventListener('click', () => showView('login'));
    
    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        await sb.auth.signOut();
        showView('login');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({
            email: usernameInput.value,
            password: passwordInput.value,
        });
        if (error) loginError.textContent = 'Credenciales incorrectas';
        else {
            loginError.textContent = '';
            showView('admin');
            loadDataFromServer();
        }
    });

    // --- URLS IMAGENES (ADMIN) ---
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

    // --- GUARDAR PRODUCTO ---
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
        let error = null;

        try {
            if (editingId) {
                const { error: err } = await sb.from('products').update(productData).eq('id', editingId);
                error = err;
            } else {
                productData.code = 'SIRARI-' + Math.random().toString(36).substr(2, 6).toUpperCase();
                const { error: err } = await sb.from('products').insert([productData]);
                error = err;
            }

            if (error) {
                alert("Error al guardar: " + error.message);
            } else {
                alert("Producto guardado");
                loadDataFromServer();
                resetAdminForm();
            }
        } catch (e) {
            alert("Error: " + e.message);
        }
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

    // --- CATEGORÍAS ---
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = categoryNameInput.value.trim().toLowerCase();
        if (!newName) return;
        
        if (categories.some(c => c.name === newName)) {
            alert("Categoría ya existe");
            return;
        }

        const { error } = await sb.from('categories').insert([{ name: newName }]);
        if (error) alert(error.message);
        else {
            categoryNameInput.value = '';
            await loadDataFromServer();
            alert("Categoría creada");
        }
    });

    function renderCategoryList() {
        categoryList.innerHTML = '';
        const listToRender = [...categories];
        if(!listToRender.find(c => c.name === 'otros')) listToRender.push({id: 'virtual', name: 'otros'});

        listToRender.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            if (cat.name === 'otros') {
                item.innerHTML = `<span>${cat.name} (Predeterminado)</span>`;
            } else {
                item.innerHTML = `<span>${cat.name}</span> <button class="action-btn delete-btn" data-id="${cat.id}" data-name="${cat.name}">X</button>`;
            }
            categoryList.appendChild(item);
        });

        categoryList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                if(confirm(`¿Borrar "${name}"? Productos irán a "otros".`)) {
                    await sb.from('products').update({ category: 'otros' }).eq('category', name);
                    await sb.from('categories').delete().eq('id', id);
                    loadDataFromServer();
                }
            });
        });
    }

    // --- TIENDA Y DETALLES (AQUÍ ESTÁ LA SOLUCIÓN) ---
    
    // Función global para abrir el modal (se llama desde el HTML onclick)
    window.showProductDetail = (id) => {
        const p = products.find(x => x.id == id);
        if(!p) return;

        // Construir galería
        let thumbs = '';
        if(p.images && p.images.length > 0) {
            p.images.forEach((url, i) => {
                 // onmouseover para que cambie al pasar el mouse, o onclick para clic
                 thumbs += `<img src="${url}" class="gallery-thumbnail ${i===0?'active':''}" onclick="switchMainImage(this, '${url}')">`;
            });
        }

        const mainImg = p.images && p.images[0] ? p.images[0] : '';
        const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);

        const content = document.getElementById('product-detail-content');
        
        // Inyectar HTML del modal
        content.innerHTML = `
            <button class="close-modal" onclick="closeDetailModal()">×</button>
            <div id="product-detail-gallery">
                <img src="${mainImg}" id="gallery-main-image" style="width:100%; height:300px; object-fit:contain; border:1px solid #eee;">
                <div id="gallery-thumbnails" style="display:flex; gap:5px; margin-top:10px; overflow-x:auto;">${thumbs}</div>
            </div>
            <div id="product-detail-info">
                <h2 style="font-size:1.8rem; margin-bottom:0.5rem;">${p.title}</h2>
                <p style="color:#666; font-size:0.9rem; margin-bottom:10px;">Cód: ${p.code}</p>
                
                <div style="margin-bottom: 15px;">
                    ${pricing.hasDiscount 
                        ? `<span class="original-price" style="text-decoration:line-through; color:#888;">Bs. ${p.price.toFixed(2)}</span> 
                           <br>
                           <span class="final-price discounted" style="font-size:1.6rem; color:#D32F2F; font-weight:bold;">Bs. ${formatPriceHTML(pricing.final)}</span>`
                        : `<span class="final-price" style="font-size:1.6rem; font-weight:bold;">Bs. ${formatPriceHTML(p.price)}</span>`
                    }
                </div>

                <p style="margin-bottom:10px;"><b>Stock:</b> ${p.stock > 0 ? p.stock + ' unidades' : '<span style="color:red">Agotado</span>'}</p>
                <p class="product-full-description" style="white-space: pre-wrap; margin-bottom:20px;">${p.description}</p>
                
                <button class="primary-btn" style="width:100%; padding:15px;" onclick="addToCart('${p.id}'); closeDetailModal()">Añadir al Carrito</button>
            </div>
        `;
        
        document.getElementById('product-detail-modal').classList.remove('hidden');
    };

    // Funciones auxiliares para el modal (Globales para que el HTML las vea)
    window.switchMainImage = (thumb, url) => {
        document.getElementById('gallery-main-image').src = url;
        document.querySelectorAll('.gallery-thumbnail').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active'); // Nota: Asegúrate de tener estilo CSS para .active si quieres borde
    };

    window.closeDetailModal = () => {
        document.getElementById('product-detail-modal').classList.add('hidden');
    };

    // --- RENDERIZADO PRODUCTOS ---
    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const searchTerm = document.getElementById('search-input').value.toLowerCase();

        let filtered = products.filter(p => {
            if (currentCategoryFilter === 'ofertas') {
                return (p.discount_type === 'percent' || p.discount_type === 'fixed') && p.discount_value > 0;
            }
            return currentCategoryFilter === 'todos' || p.category === currentCategoryFilter;
        });

        filtered = filtered.filter(p => p.title.toLowerCase().includes(searchTerm) || p.code.toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            grid.innerHTML = '<p>No se encontraron productos.</p>';
            return;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            
            let badgeHTML = '';
            if (pricing.hasDiscount) {
                const label = p.discount_type === 'percent' ? `-${p.discount_value}%` : `-${p.discount_value}Bs`;
                badgeHTML = `<div class="discount-badge">${label}</div>`;
            }

            let stockHTML = '';
            if (p.stock > 20) stockHTML = `<p class="stock-display">+20 Disponibles</p>`;
            else if (p.stock <= 9) stockHTML = `<p class="stock-display low-stock">¡Solo ${p.stock} disponibles!</p>`;
            else stockHTML = `<p class="stock-display">${p.stock} Disponibles</p>`;

            let priceHTML = pricing.hasDiscount 
                ? `<div class="price-container"><span class="original-price">Bs. ${p.price.toFixed(2)}</span><span class="final-price discounted">Bs. ${formatPriceHTML(pricing.final)}</span></div>`
                : `<div class="price-container"><span class="final-price">Bs. ${formatPriceHTML(p.price)}</span></div>`;

            // AQUÍ AGREGUÉ EL ONCLICK para abrir detalles
            card.innerHTML = `
                ${badgeHTML}
                <div class="product-image-container" onclick="showProductDetail('${p.id}')" style="cursor:pointer;">
                    <img src="${(p.images && p.images[0]) || ''}" class="product-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title" onclick="showProductDetail('${p.id}')" style="cursor:pointer;">${p.title}</h3>
                    <p class="product-code">${p.code}</p>
                    ${priceHTML}
                    ${stockHTML}
                    <button class="add-to-cart-btn primary-btn" onclick="addToCart('${p.id}')">Añadir al Carrito</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        
        const createBtn = (text, val) => {
            const btn = document.createElement('button');
            btn.className = `category-filter-btn ${currentCategoryFilter === val ? 'active' : ''}`;
            btn.textContent = text;
            btn.onclick = () => {
                currentCategoryFilter = val;
                renderCategoryFilters();
                renderProducts();
            };
            container.appendChild(btn);
        };

        createBtn('Ver Todos', 'todos');
        const hasOffers = products.some(p => (p.discount_type === 'percent' || p.discount_type === 'fixed') && p.discount_value > 0);
        if (hasOffers) createBtn('🔥 Ofertas', 'ofertas');

        categories.forEach(c => createBtn(c.name, c.name));
        if(!categories.find(c => c.name === 'otros')) createBtn('otros', 'otros');
    }

    // --- CARRITO & CHECKOUT (MAPA) ---
    window.addToCart = (productId) => { 
        const prod = products.find(p => p.id == productId);
        if (!prod) return;
        const existing = cart.find(i => i.id == productId);
        if (existing) existing.quantity++;
        else {
            const pricing = calculateFinalPrice(prod.price, prod.discount_type, prod.discount_value);
            cart.push({
                id: prod.id, title: prod.title, price: pricing.final,
                code: prod.code, image: prod.images?.[0] || '', quantity: 1
            });
        }
        saveCart();
        alert("Producto añadido");
    };

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

    btnYesLocation.addEventListener('click', async () => {
        locationQuestionStep.classList.add('hidden');
        locationStatus.textContent = "Obteniendo GPS...";
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 10000});
            });
            selectedCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            locationStatus.textContent = "✅ Ubicación detectada.";
            locationStatus.style.color = "green";
            checkoutSubmitBtn.classList.remove('hidden');
        } catch (e) {
            alert("No pudimos detectar GPS. Usa el mapa.");
            btnNoLocation.click();
        }
    });

    btnNoLocation.addEventListener('click', () => {
        locationQuestionStep.classList.add('hidden');
        mapContainerWrapper.classList.remove('hidden');
        initMap();
    });

    confirmMapLocationBtn.addEventListener('click', () => {
        mapContainerWrapper.classList.add('hidden');
        locationStatus.textContent = "✅ Ubicación mapa confirmada.";
        locationStatus.style.color = "green";
        checkoutSubmitBtn.classList.remove('hidden');
    });

    checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        
        let mapLink = selectedCoordinates 
            ? `https://maps.google.com/?q=${selectedCoordinates.lat},${selectedCoordinates.lng}`
            : 'No especificada';

        let msg = `*PEDIDO SIRARI* 🛍️\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${mapLink}\n\n*ITEMS:*`;
        let total = 0;
        cart.forEach(i => {
            total += i.price * i.quantity;
            msg += `\n- ${i.title} (${i.quantity}) = Bs.${(i.price * i.quantity).toFixed(2)}`;
        });
        msg += `\n\n*TOTAL: Bs. ${total.toFixed(2)}*`;

        window.open(`https://api.whatsapp.com/send?phone=59173164833&text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = [];
        saveCart();
        document.getElementById('checkout-modal').classList.add('hidden');
        resetCheckout();
    });

    function resetCheckout() {
        locationQuestionStep.classList.remove('hidden');
        mapContainerWrapper.classList.add('hidden');
        checkoutSubmitBtn.classList.add('hidden');
        locationStatus.textContent = '';
    }

    // --- MODALES GENERICOS ---
    document.getElementById('cart-btn').addEventListener('click', () => {
        const list = document.getElementById('cart-items');
        list.innerHTML = '';
        let total = 0;
        cart.forEach((item, idx) => {
            total += item.price * item.quantity;
            list.innerHTML += `<div class="cart-item"><img src="${item.image}" style="width:50px;"><div><b>${item.title}</b><br>Bs. ${item.price.toFixed(2)}</div><button onclick="cart.splice(${idx},1); saveCart(); document.getElementById('cart-btn').click()">X</button></div>`;
        });
        document.getElementById('cart-total').textContent = total.toFixed(2);
        document.getElementById('cart-modal').classList.remove('hidden');
        document.getElementById('checkout-btn').disabled = cart.length === 0;
    });

    document.getElementById('checkout-btn').addEventListener('click', () => {
        document.getElementById('cart-modal').classList.add('hidden');
        document.getElementById('checkout-modal').classList.remove('hidden');
    });

    // Cerrar modal al hacer clic fuera o en X
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));
    document.getElementById('product-detail-modal').addEventListener('click', (e) => {
        if(e.target.id === 'product-detail-modal') closeDetailModal();
    });


    // --- CARGA INICIAL ---
    async function loadDataFromServer() {
        const [sess, cats, prods] = await Promise.all([
            sb.auth.getSession(),
            sb.from('categories').select('*'),
            sb.from('products').select('*').order('id', {ascending: false})
        ]);

        categories = cats.data || [];
        products = prods.data || [];

        renderCategoryFilters();
        renderProducts();
        renderCategoryList();

        if (sess.data.session) {
            showView('admin');
            renderAdminList();
            fillCategorySelect();
        } else {
            showView('store');
        }
    }

    function renderAdminList() {
        const list = document.getElementById('admin-product-list');
        list.innerHTML = '';
        products.forEach(p => {
            list.innerHTML += `
                <div class="admin-product-item">
                    <img src="${p.images?.[0] || ''}">
                    <div><h4>${p.title}</h4><p>Stock: ${p.stock}</p></div>
                    <button class="action-btn edit-btn" onclick="editProduct('${p.id}')">Editar</button>
                    <button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')">X</button>
                </div>`;
        });
    }

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
        if(p.images) p.images.forEach(url => addUrlInput(url));
        else addUrlInput();
        document.getElementById('admin-form-title').textContent = 'Editar';
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        window.scrollTo(0,0);
    };

    window.deleteProduct = async (id) => {
        if(confirm('¿Borrar?')) {
            await sb.from('products').delete().eq('id', id);
            loadDataFromServer();
        }
    };

    function fillCategorySelect() {
        const sel = document.getElementById('product-category');
        sel.innerHTML = '';
        const cats = [...categories];
        if(!cats.find(c => c.name === 'otros')) cats.push({name: 'otros'});
        cats.forEach(c => sel.innerHTML += `<option value="${c.name}">${c.name}</option>`);
    }

    function saveCart() { localStorage.setItem('sirari_cart', JSON.stringify(cart)); updateCartCount(); }
    function updateCartCount() { document.getElementById('cart-count').textContent = cart.reduce((a,b)=>a+b.quantity,0); document.getElementById('cart-count').style.display = cart.length?'block':'none'; }

    loadDataFromServer();
});
