// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA'; 

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // --- SELECTORES ---
    // (Los mismos de siempre + los nuevos del mapa y stock)
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
    
    // Variables para el Mapa
    let map = null;
    let marker = null;
    let selectedCoordinates = null; // { lat, lng }

    // --- UTILIDADES DE FORMATO ---

    // Convierte 1500.50 -> "1.500,<span class='small'>50</span>"
    function formatPriceHTML(price) {
        const num = parseFloat(price);
        if (isNaN(num)) return "0,00";
        
        // Formatear con separador de miles (punto)
        const formatted = num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        // Separar la parte entera de la decimal
        const parts = formatted.split(','); // es-ES usa coma para decimales
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
        
        return {
            original: original,
            final: Math.max(0, final), // No precios negativos
            hasDiscount: hasDiscount
        };
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
        if (error) loginError.textContent = 'Error de credenciales';
        else {
            loginError.textContent = '';
            showView('admin');
            loadDataFromServer();
        }
    });

    // --- GESTIÓN DE URLS (ADMIN) ---
    
    function addUrlInput(value = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'url-input-wrapper';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'https://...';
        input.value = value;
        
        // Botón Eliminar Individual
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.className = 'remove-url-btn';
        removeBtn.onclick = () => wrapper.remove(); // Se elimina a sí mismo del DOM
        
        wrapper.appendChild(input);
        wrapper.appendChild(removeBtn);
        urlInputsContainer.appendChild(wrapper);
    }

    addUrlBtn.addEventListener('click', () => addUrlInput());

    // --- ADMIN: GUARDAR PRODUCTO ---
    
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Recopilar URLs de los inputs actuales
        const inputs = urlInputsContainer.querySelectorAll('input');
        const imageUrls = [];
        inputs.forEach(inp => {
            if(inp.value.trim()) imageUrls.push(inp.value.trim());
        });
        
        // Recopilar Datos
        const productData = {
            title: document.getElementById('product-title').value,
            description: document.getElementById('product-desc').value,
            price: parseFloat(document.getElementById('product-price').value),
            stock: parseInt(productStock.value) || 0,
            category: document.getElementById('product-category').value,
            images: imageUrls,
            discount_type: discountType.value || null,
            discount_value: parseFloat(discountValue.value) || 0
        };

        const editingId = document.getElementById('product-edit-id').value;
        let error = null;

        if (editingId) {
            const { error: err } = await sb.from('products').update(productData).eq('id', editingId);
            error = err;
        } else {
            productData.code = 'SIRARI-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            const { error: err } = await sb.from('products').insert([productData]);
            error = err;
        }

        if (error) alert("Error al guardar (¿Logueado?)");
        else {
            alert("Guardado correctamente");
            loadDataFromServer();
            resetAdminForm();
        }
    });

    function resetAdminForm() {
        addProductForm.reset();
        urlInputsContainer.innerHTML = '';
        addUrlInput(); // Uno vacío al inicio
        document.getElementById('product-edit-id').value = '';
        document.getElementById('admin-form-title').textContent = 'Añadir Nuevo Producto';
        document.getElementById('cancel-edit-btn').classList.add('hidden');
    }
    
    document.getElementById('cancel-edit-btn').addEventListener('click', resetAdminForm);

    // --- RENDERIZADO DE TIENDA ---

    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const searchTerm = document.getElementById('search-input').value.toLowerCase();

        // Filtrar
        let filtered = products.filter(p => {
            // Filtro por categoría o "Ofertas"
            if (currentCategoryFilter === 'ofertas') {
                // Si la categoría es ofertas, mostrar solo los que tienen descuento
                return (p.discount_type === 'percent' || p.discount_type === 'fixed') && p.discount_value > 0;
            }
            return currentCategoryFilter === 'todos' || p.category === currentCategoryFilter;
        });

        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) || 
            p.code.toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            grid.innerHTML = '<p>No se encontraron productos.</p>';
            return;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = p.id;

            // Lógica de Precios
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            
            // Badge de Oferta
            let badgeHTML = '';
            if (pricing.hasDiscount) {
                const label = p.discount_type === 'percent' ? `-${p.discount_value}%` : `-${p.discount_value}Bs`;
                badgeHTML = `<div class="discount-badge">${label}</div>`;
            }

            // Lógica de Stock
            let stockHTML = '';
            if (p.stock > 20) stockHTML = `<p class="stock-display">+20 Disponibles</p>`;
            else if (p.stock <= 9) stockHTML = `<p class="stock-display low-stock">¡Solo ${p.stock} disponibles!</p>`;
            else stockHTML = `<p class="stock-display">${p.stock} Disponibles</p>`;

            // HTML de Precios
            let priceHTML = '';
            if (pricing.hasDiscount) {
                priceHTML = `
                    <div class="price-container">
                        <span class="original-price">Bs. ${p.price.toFixed(2)}</span>
                        <span class="final-price discounted">Bs. ${formatPriceHTML(pricing.final)}</span>
                    </div>
                `;
            } else {
                priceHTML = `
                    <div class="price-container">
                        <span class="final-price">Bs. ${formatPriceHTML(p.price)}</span>
                    </div>
                `;
            }

            card.innerHTML = `
                ${badgeHTML}
                <div class="product-image-container">
                    <img src="${(p.images && p.images[0]) || ''}" class="product-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <p class="product-code">${p.code}</p>
                    ${priceHTML}
                    ${stockHTML}
                    <button class="add-to-cart-btn primary-btn">Añadir al Carrito</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }
    
    // Agregar listener a los botones de filtro (incluyendo Ofertas)
    function renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        
        const createBtn = (text, val) => {
            const btn = document.createElement('button');
            btn.className = `category-filter-btn ${currentCategoryFilter === val ? 'active' : ''}`;
            btn.textContent = text;
            btn.onclick = () => {
                currentCategoryFilter = val;
                renderCategoryFilters(); // Re-render para actualizar clase active
                renderProducts();
            };
            container.appendChild(btn);
        };

        createBtn('Ver Todos', 'todos');
        createBtn('🔥 Ofertas', 'ofertas'); // Categoría especial
        categories.forEach(c => createBtn(c.name, c.name));
    }

    // --- CARRITO & CHECKOUT ---
    
    function addToCart(productId) {
        const prod = products.find(p => p.id == productId);
        if (!prod) return;
        
        const existing = cart.find(i => i.id == productId);
        if (existing) existing.quantity++;
        else {
            const pricing = calculateFinalPrice(prod.price, prod.discount_type, prod.discount_value);
            cart.push({
                id: prod.id,
                title: prod.title,
                price: pricing.final, // Guardamos el precio final con descuento
                code: prod.code,
                image: prod.images[0],
                quantity: 1
            });
        }
        saveCart();
        alert("Agregado al carrito");
    }

    // --- LÓGICA DE MAPA (LEAFLET) ---

    function initMap() {
        // Coordenadas por defecto (Santa Cruz, Bolivia o centro genérico)
        const defaultLat = -17.7833; 
        const defaultLng = -63.1821;

        if (map) {
            map.remove(); // Limpiar mapa anterior si existe
        }

        map = L.map('delivery-map').setView([defaultLat, defaultLng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Marcador arrastrable
        marker = L.marker([defaultLat, defaultLng], {draggable: true}).addTo(map);

        // Evento al mover el marcador
        marker.on('dragend', function(e) {
            selectedCoordinates = marker.getLatLng();
        });
        
        // Click en el mapa mueve el marcador
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            selectedCoordinates = e.latlng;
        });
        
        // Inicializar coords
        selectedCoordinates = { lat: defaultLat, lng: defaultLng };
        
        // Truco para que el mapa cargue bien al estar en un modal oculto
        setTimeout(() => { map.invalidateSize(); }, 200);
    }

    // Flujo de Pregunta de Ubicación
    btnYesLocation.addEventListener('click', async () => {
        locationQuestionStep.classList.add('hidden');
        locationStatus.textContent = "Obteniendo GPS...";
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 10000});
            });
            selectedCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            locationStatus.textContent = "✅ Ubicación actual detectada.";
            locationStatus.style.color = "green";
            checkoutSubmitBtn.classList.remove('hidden');
        } catch (e) {
            alert("No pudimos detectar tu GPS. Por favor selecciona en el mapa.");
            btnNoLocation.click(); // Fallback al mapa
        }
    });

    btnNoLocation.addEventListener('click', () => {
        locationQuestionStep.classList.add('hidden');
        mapContainerWrapper.classList.remove('hidden');
        initMap();
    });

    confirmMapLocationBtn.addEventListener('click', () => {
        if (!selectedCoordinates) return;
        mapContainerWrapper.classList.add('hidden');
        locationStatus.textContent = "✅ Ubicación del mapa confirmada.";
        locationStatus.style.color = "green";
        checkoutSubmitBtn.classList.remove('hidden');
    });

    // Envío final
    checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const phone = '59173164833';
        
        let mapLink = 'No especificada';
        if (selectedCoordinates) {
            mapLink = `https://www.google.com/maps?q=${selectedCoordinates.lat},${selectedCoordinates.lng}`;
        }

        let msg = `*NUEVO PEDIDO SIRARI* 🛍️\n\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${mapLink}\n\n*PEDIDO:*`;
        
        let total = 0;
        cart.forEach(i => {
            const sub = i.price * i.quantity;
            total += sub;
            msg += `\n- ${i.title} (${i.quantity}) = Bs.${sub.toFixed(2)}`;
        });
        msg += `\n\n*TOTAL: Bs. ${total.toFixed(2)}*`;

        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = [];
        saveCart();
        document.getElementById('checkout-modal').classList.add('hidden');
        // Resetear modal
        locationQuestionStep.classList.remove('hidden');
        mapContainerWrapper.classList.add('hidden');
        checkoutSubmitBtn.classList.add('hidden');
        locationStatus.textContent = '';
    });
    
    // Botones de modales
    document.getElementById('cart-btn').addEventListener('click', () => {
        const cartList = document.getElementById('cart-items');
        cartList.innerHTML = '';
        let total = 0;
        cart.forEach((item, idx) => {
            const t = item.price * item.quantity;
            total += t;
            cartList.innerHTML += `
                <div class="cart-item">
                    <img src="${item.image}" style="width:50px;">
                    <div><h4>${item.title}</h4><p>Bs. ${t.toFixed(2)}</p></div>
                    <button onclick="removeItem(${idx})">X</button>
                </div>`;
        });
        document.getElementById('cart-total').textContent = total.toFixed(2);
        document.getElementById('cart-modal').classList.remove('hidden');
        document.getElementById('checkout-btn').disabled = cart.length === 0;
    });

    document.getElementById('checkout-btn').addEventListener('click', () => {
        document.getElementById('cart-modal').classList.add('hidden');
        document.getElementById('checkout-modal').classList.remove('hidden');
    });

    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
    });

    // Función global para eliminar del carrito (necesaria por el innerHTML)
    window.removeItem = (idx) => {
        cart.splice(idx, 1);
        saveCart();
        document.getElementById('cart-btn').click(); // Refrescar
    };

    // Carga Inicial
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
        
        if (sess.data.session) {
            showView('admin');
            
            // Renderizar lista admin simple
            const adminList = document.getElementById('admin-product-list');
            adminList.innerHTML = '';
            products.forEach(p => {
                adminList.innerHTML += `
                    <div class="admin-product-item">
                        <img src="${p.images[0] || ''}">
                        <div><h4>${p.title}</h4><p>${p.code}</p></div>
                        <button class="action-btn edit-btn" data-id="${p.id}">Editar</button>
                        <button class="action-btn delete-btn" data-id="${p.id}">Eliminar</button>
                    </div>`;
            });
            
            // Listeners de botones dinámicos admin
            adminList.querySelectorAll('.delete-btn').forEach(b => {
                b.onclick = async () => {
                    if(confirm('Borrar?')) {
                        await sb.from('products').delete().eq('id', b.dataset.id);
                        loadDataFromServer();
                    }
                };
            });
             adminList.querySelectorAll('.edit-btn').forEach(b => {
                b.onclick = () => {
                    const p = products.find(pr => pr.id == b.dataset.id);
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
                    
                    document.getElementById('admin-form-title').textContent = 'Editar';
                    document.getElementById('cancel-edit-btn').classList.remove('hidden');
                    window.scrollTo(0,0);
                };
            });
            
             // Llenar select de categorías
            const catSelect = document.getElementById('product-category');
            catSelect.innerHTML = '';
            categories.forEach(c => {
                catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });

        } else {
            showView('store');
        }
    }
    
    loadDataFromServer();
});
