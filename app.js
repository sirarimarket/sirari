// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; // Pon tu URL aquí
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA'; // Pon tu Key aquí

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
    
    // --- SELECTORES ---
    const views = { login: document.getElementById('login-view'), admin: document.getElementById('admin-view'), store: document.getElementById('store-view') };

    // --- INICIO ---
    // Verificar si hay sesión
    checkSession();
    // Cargar datos públicos (Store)
    loadPublicData();
    updateCartUI();

    // =============================================
    //                 LÓGICA TIENDA
    // =============================================

    async function loadPublicData() {
        // Cargar categorías
        let { data: catData, error: catError } = await sb.from('categories').select('*');
        if(!catError) {
            categories = catData;
            renderCategoryFilters();
            renderSidebarCategories();
            renderAdminCategorySelect(); // Poblar select del admin también
        }

        // Cargar productos
        let { data: prodData, error: prodError } = await sb.from('products').select('*').order('created_at', { ascending: false });
        if(!prodError) {
            products = prodData;
            renderStoreProducts();
            renderAdminProducts(); // Poblar tabla admin también
        }
    }

    function renderCategoryFilters() {
        const container = document.getElementById('categories-container');
        let html = `<button class="cat-btn active" data-id="todos">Todos</button>`;
        categories.forEach(c => {
            html += `<button class="cat-btn" data-id="${c.name}">${c.name}</button>`;
        });
        container.innerHTML = html;

        container.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategoryFilter = btn.dataset.id;
                renderStoreProducts();
            });
        });
    }

    function renderSidebarCategories() {
        const list = document.getElementById('sidebar-categories');
        let html = `<li onclick="setCategory('todos')">Todos</li>`;
        categories.forEach(c => {
            html += `<li onclick="setCategory('${c.name}')">${c.name}</li>`;
        });
        list.innerHTML = html;
    }

    window.setCategory = (cat) => {
        currentCategoryFilter = cat;
        // Actualizar botones del header
        document.querySelectorAll('.cat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.id === cat);
        });
        renderStoreProducts();
        closeSidebar();
    }

    function renderStoreProducts() {
        const container = document.getElementById('products-container');
        const searchVal = document.getElementById('search-input').value.toLowerCase();
        
        let filtered = products.filter(p => {
            const matchCat = currentCategoryFilter === 'todos' || p.category === currentCategoryFilter;
            const matchSearch = p.title.toLowerCase().includes(searchVal) || (p.code && p.code.toLowerCase().includes(searchVal));
            return matchCat && matchSearch;
        });

        container.innerHTML = '';
        if(filtered.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px;">No se encontraron productos.</p>';
            return;
        }

        filtered.forEach(p => {
            // Calcular precio final si hay descuento
            let finalPrice = p.price;
            let discountBadge = '';
            let oldPriceHtml = '';

            if (p.discount_value && p.discount_value > 0) {
                // Asumiendo porcentaje
                finalPrice = p.price - (p.price * (p.discount_value / 100));
                discountBadge = `<div class="discount-badge">-${p.discount_value}%</div>`;
                oldPriceHtml = `<span class="old-price">Bs.${p.price}</span>`;
            }

            // Imagen (maneja array string de supabase o url simple)
            let imgUrl = 'https://via.placeholder.com/150';
            if(p.images) {
                try {
                    // Intenta parsear si es JSON array string
                    const arr = JSON.parse(p.images);
                    if(Array.isArray(arr) && arr.length > 0) imgUrl = arr[0];
                    else imgUrl = p.images;
                } catch(e) {
                    // Si no es JSON, usa el string directo
                    imgUrl = p.images;
                }
            }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                ${discountBadge}
                <img src="${imgUrl}" class="product-img" alt="${p.title}" loading="lazy">
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <div class="product-price-row">
                        ${oldPriceHtml}
                        <span class="new-price">Bs.${parseFloat(finalPrice).toFixed(2)}</span>
                    </div>
                    <button class="add-btn" onclick="addToCart(${p.id})">Agregar</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Buscador
    document.getElementById('search-btn').addEventListener('click', renderStoreProducts);
    document.getElementById('search-input').addEventListener('keyup', renderStoreProducts);
    
    // Sidebar Buscador
    document.getElementById('sidebar-search-input').addEventListener('keyup', (e) => {
        if(e.key === 'Enter') {
            document.getElementById('search-input').value = e.target.value;
            renderStoreProducts();
            closeSidebar();
        }
    });

    // Menú
    document.getElementById('menu-toggle').onclick = () => {
        document.getElementById('sidebar').classList.add('show');
        document.getElementById('sidebar-overlay').classList.add('show');
    };
    window.closeSidebar = () => {
        document.getElementById('sidebar').classList.remove('show');
        document.getElementById('sidebar-overlay').classList.remove('show');
    };
    document.getElementById('close-sidebar').onclick = closeSidebar;
    document.getElementById('sidebar-overlay').onclick = closeSidebar;


    // =============================================
    //                 CARRITO
    // =============================================
    
    window.toggleCart = () => {
        document.getElementById('cart-modal').classList.toggle('hidden');
    };

    window.addToCart = (id) => {
        const product = products.find(p => p.id === id);
        if(!product) return;

        // Precio real
        let price = product.price;
        if(product.discount_value > 0) {
            price = product.price * (1 - product.discount_value/100);
        }

        const existing = cart.find(c => c.id === id);
        if(existing) {
            existing.quantity++;
        } else {
            cart.push({
                id: product.id,
                title: product.title,
                price: price,
                quantity: 1
            });
        }
        saveCart();
        updateCartUI();
        
        // Toast
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    };

    window.updateCartItem = (id, change) => {
        const item = cart.find(c => c.id === id);
        if(item) {
            item.quantity += change;
            if(item.quantity <= 0) {
                cart = cart.filter(c => c.id !== id);
            }
            saveCart();
            updateCartUI();
        }
    };

    window.removeFromCart = (id) => {
        cart = cart.filter(c => c.id !== id);
        saveCart();
        updateCartUI();
    };

    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        document.getElementById('cart-count').innerText = cart.reduce((acc, item) => acc + item.quantity, 0);
        
        const container = document.getElementById('cart-items');
        container.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            let subtotal = item.price * item.quantity;
            total += subtotal;
            container.innerHTML += `
                <div class="cart-item">
                    <div class="item-details">
                        <h4>${item.title}</h4>
                        <p>Bs. ${subtotal.toFixed(2)}</p>
                    </div>
                    <div class="qty-selector">
                        <button class="cart-qty-btn" onclick="updateCartItem(${item.id}, -1)">-</button>
                        <span class="cart-qty-value">${item.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartItem(${item.id}, 1)">+</button>
                    </div>
                    <button class="cart-remove-btn" onclick="removeFromCart(${item.id})">×</button>
                </div>
            `;
        });
        document.getElementById('cart-total-price').innerText = total.toFixed(2);
    }


    // =============================================
    //            CHECKOUT Y MAPA
    // =============================================
    
    document.getElementById('checkout-btn').onclick = () => {
        if(cart.length === 0) return alert("Tu carrito está vacío");
        document.getElementById('cart-modal').classList.add('hidden');
        document.getElementById('checkout-modal').classList.remove('hidden');
    };
    
    window.closeCheckout = () => {
        document.getElementById('checkout-modal').classList.add('hidden');
    };

    // Mapa Lógica
    let map, marker, selectedCoordinates = null;
    
    function initMap() {
        if(!map) {
            // Coordenadas Santa Cruz aprox
            map = L.map('delivery-map').setView([-17.7833, -63.1821], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);

            map.on('click', (e) => {
                if(marker) map.removeLayer(marker);
                marker = L.marker(e.latlng).addTo(map);
                selectedCoordinates = e.latlng;
            });
        }
        setTimeout(() => map.invalidateSize(), 300); // Fix render en modal
    }

    document.getElementById('btn-yes-location').onclick = () => {
        document.getElementById('location-status').textContent = "✅ Ubicación confirmada (Solo texto)";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
        document.getElementById('location-question-step').classList.add('hidden');
    };

    document.getElementById('btn-no-location').onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    };

    document.getElementById('confirm-map-location').onclick = () => {
        if(!selectedCoordinates) return alert("Por favor marca tu ubicación en el mapa");
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = "✅ Mapa Ok";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };

    const checkoutForm = document.getElementById('checkout-form');
    checkoutForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const mapLink = selectedCoordinates 
            ? `http://googleusercontent.com/maps.google.com/maps?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` 
            : 'No map';
        
        let msg = `*PEDIDO SIRARI* 🛍️\n\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${mapLink}\n\n*ITEMS:*`;
        let total = 0;
        cart.forEach(item => {
            total += item.price * item.quantity;
            msg += `\n- ${item.title} (${item.quantity}) = Bs.${(item.price * item.quantity).toFixed(2)}`;
        });
        msg += `\n\n*TOTAL: Bs. ${total.toFixed(2)}*`;

        const phone = '59173164833'; 
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = [];
        saveCart();
        updateCartUI();
        document.getElementById('checkout-modal').classList.add('hidden');
        
        // Reset form visual
        document.getElementById('location-question-step').classList.remove('hidden');
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('checkout-submit-btn').classList.add('hidden');
        document.getElementById('location-status').textContent = '';
        checkoutForm.reset();
        selectedCoordinates = null;
        if(marker && map) map.removeLayer(marker);
    };


    // =============================================
    //                 LÓGICA ADMIN
    // =============================================

    // Navegación Básica
    document.getElementById('go-to-admin').onclick = () => {
        views.store.classList.add('hidden');
        views.login.classList.remove('hidden');
        closeSidebar();
    };

    document.getElementById('go-to-store-btn').onclick = () => {
        views.login.classList.add('hidden');
        views.store.classList.remove('hidden');
    };

    // LOGIN
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        errorMsg.innerText = 'Verificando...';

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            errorMsg.innerText = 'Error: Credenciales inválidas';
        } else {
            errorMsg.innerText = '';
            views.login.classList.add('hidden');
            views.admin.classList.remove('hidden');
            loadPublicData(); // Refrescar datos
        }
    };

    async function checkSession() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            // Opcional: Auto-login
            // views.store.classList.add('hidden');
            // views.admin.classList.remove('hidden');
        }
    }

    document.getElementById('admin-logout-btn').onclick = async () => {
        await sb.auth.signOut();
        views.admin.classList.add('hidden');
        views.store.classList.remove('hidden');
    };

    // TABS ADMIN
    window.switchTab = (tabId) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        document.getElementById(tabId).classList.add('active');
        // Buscar botón correspondiente
        if(tabId === 'products-tab') document.querySelector('button[onclick="switchTab(\'products-tab\')"]').classList.add('active');
        if(tabId === 'add-product-tab') document.querySelector('button[onclick="switchTab(\'add-product-tab\')"]').classList.add('active');
    };

    // RENDERIZAR TABLA ADMIN
    function renderAdminProducts() {
        const tbody = document.getElementById('admin-products-list');
        const filterVal = document.getElementById('admin-search').value.toLowerCase();
        
        tbody.innerHTML = '';
        
        products.forEach(p => {
            if(p.title.toLowerCase().includes(filterVal) || (p.code && p.code.toLowerCase().includes(filterVal))) {
                
                let imgUrl = 'https://via.placeholder.com/50';
                if(p.images) {
                    try { const arr = JSON.parse(p.images); if(Array.isArray(arr)) imgUrl = arr[0]; else imgUrl = p.images; } catch(e) { imgUrl = p.images; }
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${imgUrl}" class="admin-img-thumb"></td>
                    <td>${p.title}</td>
                    <td>${p.code || '-'}</td>
                    <td>${p.category}</td>
                    <td>Bs.${p.price}</td>
                    <td>${p.stock}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editProduct(${p.id})">Editar</button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${p.id})">Borrar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    }

    document.getElementById('admin-search').addEventListener('keyup', renderAdminProducts);

    // CREAR / EDITAR PRODUCTO
    window.toggleImageInput = () => {
        const val = document.querySelector('input[name="img-option"]:checked').value;
        if(val === 'file') {
            document.getElementById('input-file-container').classList.remove('hidden');
            document.getElementById('input-url-container').classList.add('hidden');
        } else {
            document.getElementById('input-file-container').classList.add('hidden');
            document.getElementById('input-url-container').classList.remove('hidden');
        }
    };
    
    window.toggleDiscountInput = () => {
        const type = document.getElementById('discount-type').value;
        const container = document.getElementById('discount-value-container');
        if(type) container.classList.remove('hidden');
        else container.classList.add('hidden');
    };

    // Nueva categoría lógica
    document.getElementById('toggle-new-cat-btn').onclick = () => {
        const input = document.getElementById('new-category-input');
        const select = document.getElementById('product-category');
        if(input.style.display === 'none') {
            input.style.display = 'block';
            select.disabled = true;
        } else {
            input.style.display = 'none';
            select.disabled = false;
        }
    };

    function renderAdminCategorySelect() {
        const sel = document.getElementById('product-category');
        sel.innerHTML = '<option value="">Selecciona...</option>';
        categories.forEach(c => {
            sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }

    // GUARDAR PRODUCTO
    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-product-id').value;
        const title = document.getElementById('product-title').value;
        const code = document.getElementById('product-code').value;
        const price = document.getElementById('product-price').value;
        const stock = document.getElementById('product-stock').value;
        const desc = document.getElementById('product-description').value;
        
        // Categoría
        let category = document.getElementById('product-category').value;
        const newCatInput = document.getElementById('new-category-input');
        if(newCatInput.style.display === 'block' && newCatInput.value.trim() !== '') {
            category = newCatInput.value.trim();
            // Guardar nueva categoría en BD si no existe (simplificado: solo la usamos aqui)
            // Idealmente: Insert into categories...
            await sb.from('categories').insert([{ name: category }]);
        }

        // Imagen
        let finalImageUrl = '';
        const imgOption = document.querySelector('input[name="img-option"]:checked').value;
        
        if(imgOption === 'url') {
            finalImageUrl = document.getElementById('product-image-url').value;
        } else {
            const fileInput = document.getElementById('product-image-file');
            if(fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const fileName = `prod_${Date.now()}_${file.name}`;
                // Subir
                const { data, error } = await sb.storage.from('products').upload(fileName, file);
                if(error) {
                    alert('Error subiendo imagen: ' + error.message);
                    return;
                }
                // Obtener URL
                const { data: urlData } = sb.storage.from('products').getPublicUrl(fileName);
                finalImageUrl = urlData.publicUrl;
            } else {
                // Si estamos editando y no seleccionó nueva imagen, mantener la anterior
                if(id) {
                     const oldP = products.find(p => p.id == id);
                     if(oldP) finalImageUrl = oldP.images; // Ojo, esto puede ser JSON o string
                }
            }
        }

        // Descuento
        const discType = document.getElementById('discount-type').value;
        const discVal = document.getElementById('discount-value').value;

        const payload = {
            title: title,
            code: code,
            price: price,
            stock: stock,
            description: desc,
            category: category,
            images: finalImageUrl, // Guardamos como string simple o JSON string
            discount_type: discType,
            discount_value: discVal ? discVal : 0
        };

        let error = null;
        if(id) {
            // Update
            const { error: err } = await sb.from('products').update(payload).eq('id', id);
            error = err;
        } else {
            // Create
            const { error: err } = await sb.from('products').insert([payload]);
            error = err;
        }

        if(error) {
            alert('Error al guardar: ' + error.message);
        } else {
            alert('Producto guardado correctamente');
            resetForm();
            loadPublicData(); // Recargar tablas
            switchTab('products-tab');
        }
    };

    window.resetForm = () => {
        document.getElementById('product-form').reset();
        document.getElementById('edit-product-id').value = '';
        document.getElementById('form-title').innerText = 'Nuevo Producto';
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('new-category-input').style.display = 'none';
        document.getElementById('product-category').disabled = false;
    };

    window.editProduct = (id) => {
        const p = products.find(prod => prod.id === id);
        if(!p) return;

        document.getElementById('edit-product-id').value = p.id;
        document.getElementById('product-title').value = p.title;
        document.getElementById('product-code').value = p.code || '';
        document.getElementById('product-price').value = p.price;
        document.getElementById('product-stock').value = p.stock;
        document.getElementById('product-description').value = p.description || '';
        
        // Categoría
        const sel = document.getElementById('product-category');
        sel.value = p.category;
        // Si la categoría no está en el select (es nueva?), habría que manejarlo, pero asumimos que está.

        // Imagen (Mostrar preview si es URL)
        // ... (Logica simplificada de preview)

        // Descuento
        if(p.discount_value > 0) {
            document.getElementById('discount-type').value = 'percentage';
            document.getElementById('discount-value').value = p.discount_value;
            document.getElementById('discount-value-container').classList.remove('hidden');
        }

        document.getElementById('form-title').innerText = 'Editar Producto';
        switchTab('add-product-tab');
    };

    window.deleteProduct = async (id) => {
        if(confirm('¿Seguro que quieres eliminar este producto?')) {
            const { error } = await sb.from('products').delete().eq('id', id);
            if(error) alert('Error al borrar');
            else loadPublicData();
        }
    };

});
