// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
// RECUERDA: Cambia estas claves si vas a producción real.
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES DE ESTADO ---
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';
    let currentPage = 1;
    const itemsPerPage = 100;
    
    // Variables de Checkout
    let selectedCoordinates = null;
    let mapInstance = null;
    let markerInstance = null;

    // --- SELECTORES ---
    const views = { 
        login: document.getElementById('login-view'), 
        admin: document.getElementById('admin-view'), 
        store: document.getElementById('store-view') 
    };

    // =============================================
    //            LÓGICA INICIAL Y LOGIN
    // =============================================
    
    // Verificar sesión (simple)
    const checkSession = async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            // Si hay sesión, podríamos ir directo al admin, 
            // pero por defecto mostramos la tienda y habilitamos botón admin.
            console.log("Admin logueado");
        }
    };
    checkSession();

    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        const { data, error } = await sb.auth.signInWithPassword({ email: email, password: pass });

        if (error) {
            errorMsg.textContent = "Credenciales incorrectas.";
        } else {
            errorMsg.textContent = "";
            views.login.classList.add('hidden');
            views.admin.classList.remove('hidden');
            // Inicializar Admin en la pestaña USUARIO por defecto
            switchAdminTab('user'); 
            fetchProducts(); // Recargar datos frescos
        }
    });

    // Navegación Básica
    document.getElementById('admin-login-btn').onclick = () => {
        views.store.classList.add('hidden');
        // Verificar si ya está logueado para saltar login
        sb.auth.getSession().then(({data}) => {
            if(data.session) {
                views.admin.classList.remove('hidden');
                switchAdminTab('user');
            } else {
                views.login.classList.remove('hidden');
            }
        });
    };

    document.getElementById('go-to-store-btn').onclick = () => {
        views.login.classList.add('hidden');
        views.store.classList.remove('hidden');
    };

    document.getElementById('logout-btn').onclick = async () => {
        await sb.auth.signOut();
        views.admin.classList.add('hidden');
        views.store.classList.remove('hidden');
        showToast("Sesión cerrada");
    };

    // =============================================
    //         LÓGICA DE DATOS (PRODUCTOS)
    // =============================================

    async function fetchProducts() {
        const { data, error } = await sb.from('products').select('*');
        if (error) { console.error(error); return; }
        products = data || [];
        
        // Extraer categorías únicas
        const cats = new Set(products.map(p => p.category));
        categories = Array.from(cats);

        renderStore();
        
        // Si el admin está visible, renderizar tablas admin también
        if(!views.admin.classList.contains('hidden')) {
            renderAdminProductTable();
        }
    }

    // =============================================
    //           LÓGICA TIENDA (PÚBLICA)
    // =============================================

    function renderStore() {
        renderCategories();
        renderProducts();
        document.getElementById('cart-count').textContent = cart.reduce((acc, item) => acc + item.quantity, 0);
    }

    function renderCategories() {
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        
        const allBtn = document.createElement('div');
        allBtn.className = `category-pill ${currentCategoryFilter === 'todos' ? 'active' : ''}`;
        allBtn.textContent = 'Todos';
        allBtn.onclick = () => { currentCategoryFilter = 'todos'; renderStore(); };
        container.appendChild(allBtn);

        const offerBtn = document.createElement('div');
        offerBtn.className = `category-pill ${currentCategoryFilter === 'ofertas' ? 'active' : ''}`;
        offerBtn.textContent = 'Ofertas';
        offerBtn.onclick = () => { currentCategoryFilter = 'ofertas'; renderStore(); };
        container.appendChild(offerBtn);

        categories.forEach(c => {
            const btn = document.createElement('div');
            btn.className = `category-pill ${currentCategoryFilter === c ? 'active' : ''}`;
            btn.textContent = c;
            btn.onclick = () => { currentCategoryFilter = c; renderStore(); };
            container.appendChild(btn);
        });
    }

    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        
        const searchTerm = document.getElementById('search-input').value.toLowerCase();

        let filtered = products.filter(p => {
            // Filtro Categoría
            if (currentCategoryFilter === 'ofertas' && (!p.discount || p.discount <= 0)) return false;
            if (currentCategoryFilter !== 'todos' && currentCategoryFilter !== 'ofertas' && p.category !== currentCategoryFilter) return false;
            
            // Filtro Buscador
            if (searchTerm && !p.title.toLowerCase().includes(searchTerm) && !p.code.toLowerCase().includes(searchTerm)) return false;

            return true;
        });

        // Paginación simple (mostrar primeros 100)
        const start = (currentPage - 1) * itemsPerPage;
        const sliced = filtered.slice(start, start + itemsPerPage);

        sliced.forEach(p => {
            const finalPrice = calculateFinalPrice(p.price, p.discount, p.discountType);
            const hasDiscount = p.discount > 0;
            const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/300?text=No+Image';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-img-box">
                    <img src="${imgUrl}" alt="${p.title}">
                    ${hasDiscount ? `<span class="discount-badge">-${p.discount}${p.discountType==='percent'?'%':'Bs'}</span>` : ''}
                </div>
                <div class="product-info">
                    <span class="p-category">${p.category}</span>
                    <h3 class="p-title">${p.title}</h3>
                    <div class="p-prices">
                        ${hasDiscount ? `<span class="p-price-old">Bs.${p.price}</span>` : ''}
                        <span class="p-price">Bs.${finalPrice.toFixed(2)}</span>
                    </div>
                    <button class="add-btn" onclick="addToCart('${p.id}')">Agregar</button>
                </div>
            `;
            // Al hacer clic en la imagen (no en el botón), abrir detalle
            card.querySelector('.product-img-box').onclick = () => openProductDetail(p);
            
            grid.appendChild(card);
        });
    }

    // Buscador listener
    document.getElementById('search-btn').onclick = renderProducts;
    document.getElementById('search-input').onkeyup = renderProducts;

    // Calcular precio
    window.calculateFinalPrice = (price, discount, type) => {
        if (!discount) return parseFloat(price);
        if (type === 'fixed') return price - discount;
        return price - (price * (discount / 100));
    };

    // =============================================
    //           CARRITO Y CHECKOUT
    // =============================================

    window.addToCart = (id) => {
        const prod = products.find(p => p.id == id);
        if (!prod) return;
        
        const existing = cart.find(i => i.id == id);
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({ ...prod, quantity: 1 });
        }
        saveCart();
        showToast('Producto agregado al carrito');
    };

    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
        document.getElementById('cart-count').textContent = cart.reduce((acc, i) => acc + i.quantity, 0);
    }

    window.openCheckoutModal = () => {
        const modal = document.getElementById('checkout-modal');
        const container = document.getElementById('cart-items-container');
        const totalEl = document.getElementById('cart-total-price');
        
        container.innerHTML = '';
        let total = 0;

        cart.forEach((item, idx) => {
            const finalP = calculateFinalPrice(item.price, item.discount, item.discountType);
            total += finalP * item.quantity;
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <p>Bs. ${finalP.toFixed(2)} x ${item.quantity}</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="qty-selector">
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                        <span class="cart-qty-value">${item.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                    </div>
                    <button class="cart-remove-btn" onclick="removeFromCart(${idx})">&times;</button>
                </div>
            `;
            container.appendChild(div);
        });

        totalEl.textContent = `Bs. ${total.toFixed(2)}`;
        
        // Reset steps
        document.getElementById('checkout-form-container').classList.add('hidden');
        document.getElementById('checkout-btn').classList.remove('hidden');
        modal.classList.remove('hidden');
    };

    window.updateCartQty = (idx, delta) => {
        cart[idx].quantity += delta;
        if (cart[idx].quantity < 1) cart[idx].quantity = 1;
        saveCart();
        openCheckoutModal();
    };

    window.removeFromCart = (idx) => {
        cart.splice(idx, 1);
        saveCart();
        openCheckoutModal();
    };

    // Flujo Checkout
    document.getElementById('checkout-btn').onclick = () => {
        if(cart.length === 0) return showToast("El carrito está vacío");
        document.getElementById('checkout-btn').classList.add('hidden');
        document.getElementById('checkout-form-container').classList.remove('hidden');
    };

    // Mapa y Geolocalización
    document.getElementById('btn-yes-location').onclick = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                selectedCoordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
                document.getElementById('location-status').textContent = "✅ Ubicación GPS detectada";
                document.getElementById('location-status').style.color = "green";
                document.getElementById('checkout-submit-btn').classList.remove('hidden');
                document.getElementById('location-question-step').classList.add('hidden');
            }, (err) => {
                alert("No pudimos obtener tu GPS. Por favor usa el mapa.");
                showMapStep();
            });
        } else {
            showMapStep();
        }
    };

    document.getElementById('btn-no-location').onclick = showMapStep;

    function showMapStep() {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    }

    function initMap() {
        if (mapInstance) return; 
        // Coordenadas Santa Cruz default
        const defaultCoords = [-17.7833, -63.1821]; 
        mapInstance = L.map('delivery-map').setView(defaultCoords, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(mapInstance);

        markerInstance = L.marker(defaultCoords, {draggable: true}).addTo(mapInstance);
        
        markerInstance.on('dragend', function(e) {
            selectedCoordinates = markerInstance.getLatLng();
        });
        
        // Fix gris mapa
        setTimeout(() => { mapInstance.invalidateSize(); }, 200);
    }

    document.getElementById('confirm-map-location').onclick = () => {
        if (!selectedCoordinates) selectedCoordinates = markerInstance.getLatLng();
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = "✅ Ubicación del Mapa confirmada";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };

    // ENVIAR WHATSAPP
    document.getElementById('checkout-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        
        const mapLink = selectedCoordinates 
            ? `http://maps.google.com/?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` 
            : 'No especificada';

        let msg = `*NUEVO PEDIDO SIRARI* 🛍️\n\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${mapLink}\n\n*PRODUCTOS:*`;
        
        let total = 0;
        cart.forEach(i => {
            const finalP = calculateFinalPrice(i.price, i.discount, i.discountType);
            const subtotal = finalP * i.quantity;
            total += subtotal;
            msg += `\n- ${i.title} (${i.quantity}) = Bs.${subtotal.toFixed(2)}`;
        });
        
        msg += `\n\n*TOTAL A PAGAR: Bs. ${total.toFixed(2)}*`;

        const phone = '59173164833'; // TU NÚMERO
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = [];
        saveCart();
        document.getElementById('checkout-modal').classList.add('hidden');
        showToast("¡Pedido enviado a WhatsApp!");
        
        // Resetear form
        document.getElementById('checkout-form').reset();
        window.location.reload(); // Recargar para limpiar todo
    };


    // =============================================
    //      NUEVA LÓGICA DEL PANEL ADMIN (V2)
    // =============================================

    // 1. CAMBIAR PESTAÑAS
    window.switchAdminTab = (tabName) => {
        // Ocultar todas las pestañas
        ['user', 'add', 'list', 'placeholder'].forEach(t => {
             const el = document.getElementById(`tab-${t}`);
             if(el) el.classList.add('hidden');
        });

        // Manejar lógica de placeholders (Ventas, etc)
        if(['sales', 'buyers', 'analytics', 'notifications', 'settings'].includes(tabName)){
            document.getElementById('tab-placeholder').classList.remove('hidden');
        } else {
            document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        }

        // Actualizar botón activo en menú
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        // Intentar resaltar el botón presionado (event puede ser null si llamamos desde codigo)
        if(event && event.currentTarget) event.currentTarget.classList.add('active');

        // Si entramos a lista, renderizar y llenar filtros
        if(tabName === 'list') {
            populateCategoryFilterAdmin();
            renderAdminProductTable();
        }
        // Si entramos a agregar, llenar select categoría
        if(tabName === 'add') {
             populateCategorySelect();
        }
    };

    // 2. BUSCAR PRODUCTO PARA EDITAR
    window.searchProductToEdit = () => {
        const code = document.getElementById('search-code-edit').value.trim();
        if(!code) return showToast("Escribe un código");

        const product = products.find(p => p.code === code);
        if(product) {
            loadProductForEdit(product);
            showToast(`Producto ${code} cargado`);
        } else {
            showToast('Producto no encontrado');
        }
    };

    // 3. CARGAR DATOS EN FORMULARIO
    function loadProductForEdit(p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-code').value = p.code;
        populateCategorySelect(); // Asegurar que opciones existen
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-discount').value = p.discount || '';
        document.getElementById('p-discount-type').value = p.discountType || 'percent';
        document.getElementById('p-desc').value = p.description || '';
        
        // Cargar imágenes
        const container = document.getElementById('image-url-container');
        container.innerHTML = '';
        if(p.images && p.images.length > 0) {
            p.images.forEach(url => {
                const input = document.createElement('input');
                input.type = 'url';
                input.className = 'image-input';
                input.value = url;
                container.appendChild(input);
            });
        } else {
             const input = document.createElement('input');
             input.type = 'url';
             input.className = 'image-input';
             input.placeholder = "https://...";
             container.appendChild(input);
        }
    }

    // 4. GUARDAR / ACTUALIZAR PRODUCTO
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('product-id').value;
        const title = document.getElementById('p-title').value;
        const code = document.getElementById('p-code').value;
        const category = document.getElementById('p-category').value;
        const price = parseFloat(document.getElementById('p-price').value);
        const stock = parseInt(document.getElementById('p-stock').value);
        const discount = parseFloat(document.getElementById('p-discount').value) || 0;
        const discountType = document.getElementById('p-discount-type').value;
        const desc = document.getElementById('p-desc').value;

        // Recoger URLs de imágenes
        const images = [];
        document.querySelectorAll('.image-input').forEach(input => {
            if(input.value.trim()) images.push(input.value.trim());
        });

        const productData = {
            title, code, category, price, stock, discount, discountType, description: desc, images
        };

        // Si hay ID, es update. Si no, Supabase crea ID nuevo si no enviamos nada, 
        // pero para upsert necesitamos saber. 
        // Mejor estrategia: Si hay ID, update. Si no, insert.
        
        let error = null;

        if(id) {
            // Update
            const res = await sb.from('products').update(productData).eq('id', id);
            error = res.error;
        } else {
            // Insert
            const res = await sb.from('products').insert([productData]);
            error = res.error;
        }

        if(error) {
            showToast("Error al guardar: " + error.message);
        } else {
            showToast("Producto Guardado Exitosamente");
            clearForm();
            fetchProducts(); // Recargar todo
        }
    });

    // 5. RENDERIZAR TABLA CON FILTROS
    window.renderAdminProductTable = () => {
        const tbody = document.getElementById('admin-product-table-body');
        tbody.innerHTML = '';

        const catFilter = document.getElementById('filter-category').value;
        const stockFilter = document.getElementById('filter-stock').value;
        const priceFilter = document.getElementById('filter-price').value;
        const offerFilter = document.getElementById('filter-offer').value;

        let filtered = products.filter(p => {
            if(catFilter !== 'all' && p.category !== catFilter) return false;
            
            if(stockFilter !== 'all') {
                const [min, max] = stockFilter.split('-').map(Number);
                if(p.stock < min || p.stock > max) return false;
            }

            if(priceFilter !== 'all') {
                const [min, max] = priceFilter.split('-').map(Number);
                if(p.price < min || (max && p.price > max)) return false;
            }

            if(offerFilter !== 'all') {
                if(offerFilter === 'yes' && (!p.discount || p.discount <= 0)) return false;
                if(offerFilter !== 'yes' && (!p.discount || p.discount != offerFilter)) return false; 
            }
            return true;
        });

        filtered.forEach((p, index) => {
            const finalPrice = calculateFinalPrice(p.price, p.discount, p.discountType);
            const discountTxt = p.discount ? (p.discountType === 'percent' ? `${p.discount}%` : `Bs.${p.discount}`) : '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="radio" name="prod-select" value="${p.id}"></td>
                <td>${index + 1}</td>
                <td>${p.title}</td>
                <td><strong>${p.code}</strong></td>
                <td>${p.category}</td>
                <td>Bs. ${p.price}</td>
                <td style="color:red">${discountTxt}</td>
                <td><strong>Bs. ${finalPrice.toFixed(2)}</strong></td>
                <td>${p.stock}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    // 6. EDITAR SELECCIONADO (Desde tabla)
    window.editSelectedProduct = () => {
        const selected = document.querySelector('input[name="prod-select"]:checked');
        if(!selected) return showToast('Selecciona un producto primero');
        
        const product = products.find(p => p.id == selected.value);
        if(product) {
            switchAdminTab('add'); 
            // Simular activo en menú
            document.querySelectorAll('.menu-btn')[1].classList.add('active'); 
            document.querySelectorAll('.menu-btn')[2].classList.remove('active');
            loadProductForEdit(product);
        }
    };

    // 7. EXPORTAR DATOS
    window.exportData = (format) => {
        const dataToExport = products.map(p => ({
            ID: p.id, Nombre: p.title, Codigo: p.code, Categoria: p.category, 
            Precio: p.price, Stock: p.stock, Descuento: p.discount || 0
        }));

        let content = '', mimeType = 'text/plain', extension = '';

        if(format === 'csv' || format === 'excel') {
            const separator = format === 'excel' ? '\t' : ','; 
            const headers = Object.keys(dataToExport[0]).join(separator);
            const rows = dataToExport.map(row => Object.values(row).join(separator)).join('\n');
            content = headers + '\n' + rows;
            mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv';
            extension = format === 'excel' ? 'xls' : 'csv';
        } else if (format === 'sql') {
            content = `CREATE TABLE IF NOT EXISTS productos (id TEXT, nombre TEXT, codigo TEXT, categoria TEXT, precio REAL, stock INTEGER);\n`;
            dataToExport.forEach(p => {
                content += `INSERT INTO productos VALUES ('${p.ID}', '${p.Nombre}', '${p.Codigo}', '${p.Categoria}', ${p.Precio}, ${p.Stock});\n`;
            });
            extension = 'sql';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_${new Date().toISOString().slice(0,10)}.${extension}`;
        a.click();
    };

    // UTILS DEL FORM
    window.addNewCategory = () => {
        const newCat = prompt("Nombre de la nueva categoría:");
        if (newCat) {
            const select = document.getElementById('p-category');
            const opt = document.createElement('option');
            opt.value = newCat;
            opt.textContent = newCat;
            opt.selected = true;
            select.appendChild(opt);
        }
    };

    window.addImageInput = () => {
        const container = document.getElementById('image-url-container');
        const input = document.createElement('input');
        input.type = 'url';
        input.className = 'image-input';
        input.placeholder = "https://...";
        container.appendChild(input);
    };

    window.clearForm = () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = ''; // Importante para limpiar ID
        document.getElementById('image-url-container').innerHTML = '<input type="url" class="image-input" placeholder="https://ejemplo.com/foto1.jpg">';
    };

    function populateCategorySelect() {
        const sel = document.getElementById('p-category');
        sel.innerHTML = '';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
    }

    function populateCategoryFilterAdmin() {
        const sel = document.getElementById('filter-category');
        sel.innerHTML = '<option value="all">Todas las Categorías</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
    }

    // Modal detalle producto
    window.openProductDetail = (p) => {
        const modal = document.getElementById('product-detail-modal');
        const info = document.getElementById('modal-product-info');
        const finalP = calculateFinalPrice(p.price, p.discount, p.discountType);

        // Crear galería de fotos si hay más de una
        let imagesHtml = '';
        if(p.images && p.images.length > 0) {
            p.images.forEach(img => imagesHtml += `<img src="${img}" style="width:100px; height:100px; object-fit:cover; margin:5px;">`);
        }

        info.innerHTML = `
            <h2>${p.title}</h2>
            <p style="color:#666;">Ref: ${p.code}</p>
            <div style="margin:15px 0;">
                <img src="${(p.images && p.images[0]) || ''}" style="width:100%; max-height:300px; object-fit:contain;">
                <div style="display:flex; overflow-x:auto;">${imagesHtml}</div>
            </div>
            <p>${p.description || 'Sin descripción'}</p>
            <h3 style="margin-top:20px;">Precio: Bs. ${finalP.toFixed(2)}</h3>
            <button class="primary-btn" onclick="addToCart('${p.id}'); document.querySelector('.close-modal').click();" style="width:100%; margin-top:10px;">Agregar al Carrito</button>
        `;
        
        modal.classList.remove('hidden');
        
        // Cerrar modal
        modal.querySelector('.close-modal').onclick = () => {
            modal.classList.add('hidden');
        };
    };

    // Utils Toast
    window.showToast = (msg) => {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    };

    // Cargar productos al inicio
    fetchProducts();
});
