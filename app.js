// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
// Pega tu URL y tu Llave aquí
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA'; 

// Crea el cliente de Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // Selectores de Elementos
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const storeView = document.getElementById('store-view');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const goToStoreBtn = document.getElementById('go-to-store-btn');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    
    const categoryForm = document.getElementById('category-form');
    const categoryNameInput = document.getElementById('category-name-input');
    const categoryEditId = document.getElementById('category-edit-id');
    const categorySaveBtn = document.getElementById('category-save-btn');
    const categoryList = document.getElementById('category-list');
    
    const addProductForm = document.getElementById('add-product-form');
    const adminFormTitle = document.getElementById('admin-form-title');
    const productEditId = document.getElementById('product-edit-id');
    const productTitle = document.getElementById('product-title');
    const productDesc = document.getElementById('product-desc');
    const productPrice = document.getElementById('product-price');
    const productCategory = document.getElementById('product-category');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const adminProductList = document.getElementById('admin-product-list');
    
    // NUEVOS SELECTORES PARA URLS
    const urlInputsContainer = document.getElementById('url-inputs-container');
    const addUrlBtn = document.getElementById('add-url-btn');

    const searchInput = document.getElementById('search-input');
    const categoryFilters = document.getElementById('category-filters');
    const productGrid = document.getElementById('product-grid');
    const cartBtn = document.getElementById('cart-btn');
    const cartCount = document.getElementById('cart-count');
    const cartModal = document.getElementById('cart-modal');
    const closeCartModal = document.getElementById('close-cart-modal');
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const checkoutModal = document.getElementById('checkout-modal');
    const closeCheckoutModal = document.getElementById('close-checkout-modal');
    const checkoutForm = document.getElementById('checkout-form');
    const customerName = document.getElementById('customer-name');
    const customerLocation = document.getElementById('customer-location');
    const productDetailModal = document.getElementById('product-detail-modal');
    const productDetailContent = document.getElementById('product-detail-content');
    const checkoutSubmitBtn = document.getElementById('checkout-submit-btn');
    const locationStatus = document.getElementById('location-status');

    // VARIABLES GLOBALES
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';

    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
        updateCartCount();
    }
    
    // =============================================
    //           LÓGICA DE NAVEGACIÓN Y LOGIN
    // =============================================

    function showView(viewToShow) {
        [loginView, adminView, storeView].forEach(view => view.classList.add('hidden'));
        viewToShow.classList.remove('hidden');
    }
    
    goToStoreBtn.addEventListener('click', () => showView(storeView));
    adminLoginBtn.addEventListener('click', () => showView(loginView));
    
    adminLogoutBtn.addEventListener('click', async () => {
        const { error } = await sb.auth.signOut(); 
        if (error) console.error("Error al cerrar sesión:", error);
        showView(loginView);
    });
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = usernameInput.value; 
        const password = passwordInput.value;

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            loginError.textContent = 'Email o contraseña incorrectos.';
        } else {
            loginError.textContent = '';
            showView(adminView);
            refreshAdminUI();
        }
    });

    // =============================================
    //       LÓGICA DEL PANEL (ADMIN) - General
    // =============================================

    function refreshAdminUI() {
        renderCategoryList();
        loadCategoriesIntoSelect();
        renderAdminProductList();
    }
    
    function refreshStoreUI() {
        renderCategoryFilters();
        renderProducts();
    }

    // =============================================
    //     LÓGICA DEL PANEL (ADMIN) - CATEGORÍAS
    // =============================================
    
    function renderCategoryList() {
        categoryList.innerHTML = '';
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            if (cat.name === 'otros') {
                item.innerHTML = `<span>${cat.name} (Predeterminado)</span>`;
            } else {
                item.innerHTML = `
                    <span>${cat.name}</span>
                    <div>
                        <button class="action-btn edit-btn" data-id="${cat.id}" data-name="${cat.name}">Editar</button>
                        <button class="action-btn delete-btn" data-id="${cat.id}" data-name="${cat.name}">Eliminar</button>
                    </div>
                `;
            }
            categoryList.appendChild(item);
        });
    }
    function loadCategoriesIntoSelect() {
        productCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            productCategory.appendChild(option);
        });
    }
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = categoryNameInput.value.trim().toLowerCase();
        const editingId = categoryEditId.value;
        if (!newName) return;
        if (categories.find(c => c.name === newName && c.id != editingId)) {
            alert('Esa categoría ya existe.');
            return;
        }
        if (editingId) {
            const oldName = categories.find(c => c.id == editingId).name;
            const { error: catError } = await sb.from('categories').update({ name: newName }).eq('id', editingId);
            if (catError) { alert('Error. ¿Estás logueado?'); return; }
            const { data: productsToUpdate } = await sb.from('products').select('id').eq('category', oldName);
            const updatePromises = productsToUpdate.map(p => sb.from('products').update({ category: newName }).eq('id', p.id));
            await Promise.all(updatePromises);
        } else {
            const { error } = await sb.from('categories').insert([{ name: newName }]);
            if (error) { alert('Error. ¿Estás logueado?'); }
        }
        categoryNameInput.value = '';
        categoryEditId.value = '';
        categorySaveBtn.textContent = 'Añadir';
        await loadDataFromServer();
    });
    categoryList.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const name = e.target.dataset.name;
        if (!id) return;
        if (e.target.classList.contains('edit-btn')) {
            categoryNameInput.value = name;
            categoryEditId.value = id;
            categorySaveBtn.textContent = 'Actualizar';
            categoryNameInput.focus();
        } else if (e.target.classList.contains('delete-btn')) {
            if (confirm(`¿Seguro que quieres eliminar la categoría "${name}"?\nTodos sus productos se moverán a "otros".`)) {
                const { data: productsToMove } = await sb.from('products').select('id').eq('category', name);
                const updatePromises = productsToMove.map(p => sb.from('products').update({ category: 'otros' }).eq('id', p.id));
                await Promise.all(updatePromises);
                await sb.from('categories').delete().eq('id', id);
                await loadDataFromServer();
            }
        }
    });

    // =============================================
    //     LÓGICA DEL PANEL (ADMIN) - PRODUCTOS
    // =============================================
    
    // NUEVO: Función para crear un campo de input URL
    function addUrlInput(value = '') {
        const inputs = urlInputsContainer.querySelectorAll('input');
        if (inputs.length >= 10) {
            alert('Máximo 10 imágenes permitidas.');
            return;
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'url-input-wrapper';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'https://... (URL de la imagen)';
        input.value = value;
        input.required = inputs.length === 0; // Solo el primero es obligatorio
        
        // Botón para borrar este input específico (opcional, pero útil)
        /* const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.className = 'action-btn delete-btn';
        removeBtn.onclick = () => wrapper.remove();
        wrapper.appendChild(removeBtn);
        */

        wrapper.appendChild(input);
        urlInputsContainer.appendChild(wrapper);
    }

    // Iniciar con un input vacío
    addUrlInput();

    addUrlBtn.addEventListener('click', () => {
        addUrlInput();
    });

    function generateUniqueCode() {
        let code;
        do {
            code = 'SIRARI-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        } while (products.find(p => p.code === code));
        return code;
    }

    function resetAdminForm() {
        addProductForm.reset();
        urlInputsContainer.innerHTML = ''; // Limpiar inputs
        addUrlInput(); // Agregar uno vacío
        productEditId.value = '';
        adminFormTitle.textContent = 'Añadir Nuevo Producto';
        saveProductBtn.textContent = 'Guardar Producto';
        cancelEditBtn.classList.add('hidden');
    }
    
    cancelEditBtn.addEventListener('click', resetAdminForm);

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = productEditId.value;
        
        // Recopilar URLs
        const inputs = urlInputsContainer.querySelectorAll('input');
        const imageUrls = [];
        inputs.forEach(input => {
            const url = input.value.trim();
            if (url) imageUrls.push(url);
        });

        if (imageUrls.length === 0) {
            alert('Añade al menos una URL de imagen válida.');
            return;
        }

        if (!productCategory.value) {
            alert('Por favor, selecciona una categoría.');
            return;
        }
        
        const productData = {
            title: productTitle.value,
            description: productDesc.value,
            price: parseFloat(productPrice.value),
            category: productCategory.value,
            images: imageUrls // Guardamos el array de strings (URLs)
        };

        let error = null;
        if (editingId) {
            const { error: updateError } = await sb.from('products').update(productData).eq('id', editingId);
            error = updateError;
        } else {
            productData.code = generateUniqueCode();
            const { error: insertError } = await sb.from('products').insert([productData]);
            error = insertError;
        }

        if (error) {
            console.error("Error:", error);
            alert("Error al guardar. ¿Estás logueado?");
        } else {
            alert(editingId ? '¡Producto actualizado!' : '¡Producto guardado!');
            await loadDataFromServer();
            resetAdminForm();
        }
    });

    function renderAdminProductList() {
        adminProductList.innerHTML = '';
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'admin-product-item';
            // Usamos la URL directamente
            const imageUrl = (product.images && product.images.length > 0) ? product.images[0] : '';
            item.innerHTML = `
                <img src="${imageUrl}" alt="${product.title}" loading="lazy">
                <div class="admin-product-info">
                    <h4>${product.title}</h4>
                    <p>Cód: ${product.code} | Bs. ${product.price.toFixed(2)}</p>
                </div>
                <div class="admin-product-actions">
                    <button class="action-btn edit-btn" data-id="${product.id}">Editar</button>
                    <button class="action-btn delete-btn" data-id="${product.id}">Eliminar</button>
                </div>
            `;
            adminProductList.appendChild(item);
        });
    }

    adminProductList.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('edit-btn')) {
            const product = products.find(p => p.id == id);
            if (!product) return;
            
            productEditId.value = product.id;
            productTitle.value = product.title;
            productDesc.value = product.description;
            productPrice.value = product.price;
            productCategory.value = product.category;
            
            // Cargar URLs en los inputs
            urlInputsContainer.innerHTML = '';
            if (product.images && product.images.length > 0) {
                product.images.forEach(url => {
                    addUrlInput(url);
                });
            } else {
                addUrlInput();
            }
            
            adminFormTitle.textContent = 'Editando Producto';
            saveProductBtn.textContent = 'Actualizar Producto';
            cancelEditBtn.classList.remove('hidden');
            adminView.scrollTo({ top: 0, behavior: 'smooth' });
        
        } else if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
                const { error } = await sb.from('products').delete().eq('id', id);
                if (error) { alert('Error. ¿Estás logueado?'); }
                await loadDataFromServer();
            }
        }
    });

    // =============================================
    //         LÓGICA DE LA TIENDA (USUARIO)
    // =============================================
    
    function renderCategoryFilters() {
        categoryFilters.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.className = 'category-filter-btn active';
        allBtn.textContent = 'Ver Todos';
        allBtn.dataset.category = 'todos';
        categoryFilters.appendChild(allBtn);
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-filter-btn';
            btn.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            btn.dataset.category = cat.name;
            categoryFilters.appendChild(btn);
        });
        document.querySelectorAll('.category-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategoryFilter = btn.dataset.category;
                renderProducts();
            });
        });
    }
    
    function renderProducts() {
        productGrid.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase().trim();
        const categoryFiltered = products.filter(p => currentCategoryFilter === 'todos' || p.category === currentCategoryFilter);
        const finalFiltered = categoryFiltered.filter(p => 
            (p.title && p.title.toLowerCase().includes(searchTerm)) ||
            (p.description && p.description.toLowerCase().includes(searchTerm)) || 
            (p.code && p.code.toLowerCase().includes(searchTerm))
        );

        if (finalFiltered.length === 0) {
            productGrid.innerHTML = '<p class="no-products">No se encontraron productos.</p>';
            return;
        }

        finalFiltered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = product.id; 
            const imageUrl = (product.images && product.images.length > 0) ? product.images[0] : '';
            
            // OPTIMIZACIÓN: loading="lazy"
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" alt="${product.title}" class="product-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-desc-snippet">${product.description}</p>
                    <p class="product-price">Bs. ${product.price.toFixed(2)}</p>
                    <p class="product-code">Cód: ${product.code}</p>
                    <button class="add-to-cart-btn primary-btn">Añadir al Carrito</button>
                </div>
            `;
            productGrid.appendChild(card);
        });
    }

    searchInput.addEventListener('input', renderProducts);
    productGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const productId = card.dataset.id;
        if (e.target.classList.contains('add-to-cart-btn')) {
            addToCart(productId);
        } else if (e.target.closest('.product-image-container')) {
            showProductDetail(productId);
        }
    });

    function showProductDetail(productId) {
        const product = products.find(p => p.id == productId);
        if (!product) return;
        let thumbnailsHTML = '';
        if (product.images && product.images.length > 0) {
            product.images.forEach((img, index) => {
                thumbnailsHTML += `<img src="${img}" class="gallery-thumbnail ${index === 0 ? 'active' : ''}" data-index="${index}">`;
            });
        }
        const mainImageUrl = (product.images && product.images.length > 0) ? product.images[0] : '';
        
        productDetailContent.innerHTML = `
            <button class="close-modal" id="close-detail-modal-inner">×</button>
            <div id="product-detail-gallery">
                <img src="${mainImageUrl}" id="gallery-main-image" alt="${product.title}">
                <div id="gallery-thumbnails">${thumbnailsHTML}</div>
            </div>
            <div id="product-detail-info">
                <h2>${product.title}</h2>
                <p class="product-code">Código: ${product.code}</p>
                <p class="product-price">Bs. ${product.price.toFixed(2)}</p>
                <p class="product-category">Categoría: ${product.category}</p>
                <p class="product-full-description">${product.description}</p>
                <button class="primary-btn add-to-cart-btn-detail" data-id="${product.id}">Añadir al Carrito</button>
            </div>
        `;
        productDetailModal.classList.remove('hidden');
        
        const mainImage = document.getElementById('gallery-main-image');
        const thumbnails = document.querySelectorAll('.gallery-thumbnail');
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                mainImage.src = product.images[thumb.dataset.index];
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
        document.getElementById('close-detail-modal-inner').addEventListener('click', () => {
            productDetailModal.classList.add('hidden');
        });
        document.querySelector('.add-to-cart-btn-detail').addEventListener('click', (e) => {
            addToCart(e.target.dataset.id);
            productDetailModal.classList.add('hidden');
        });
    }
    
    productDetailModal.addEventListener('click', (e) => {
        if (e.target === productDetailModal) {
            productDetailModal.classList.add('hidden');
        }
    });

    // =============================================
    //           LÓGICA DEL CARRITO
    // =============================================
    function addToCart(productId) {
        const existingItem = cart.find(item => item.id == productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            const product = products.find(p => p.id == productId);
            if (product) {
                cart.push({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    code: product.code,
                    image: (product.images && product.images.length > 0) ? product.images[0] : '',
                    quantity: 1
                });
            }
        }
        saveCart();
        renderCart();
    }
    function removeFromCart(productId) {
        cart = cart.filter(item => item.id != productId);
        saveCart();
        renderCart();
    }
    function renderCart() {
        let total = 0;
        if (cart.length === 0) {
            cartItems.innerHTML = '<p>Tu carrito está vacío.</p>';
            checkoutBtn.disabled = true;
        } else {
            cartItems.innerHTML = '';
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                cartItems.innerHTML += `
                    <div class="cart-item">
                        <img src="${item.image}" alt="${item.title}">
                        <div class="cart-item-info">
                            <h4>${item.title} (x${item.quantity})</h4>
                            <p>Bs. ${itemTotal.toFixed(2)}</p>
                        </div>
                        <button class="cart-item-remove" data-id="${item.id}">×</button>
                    </div>
                `;
            });
            checkoutBtn.disabled = false;
        }
        cartTotal.textContent = total.toFixed(2);
        updateCartCount();
    }
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'block' : 'none';
    }
    cartBtn.addEventListener('click', () => { renderCart(); cartModal.classList.remove('hidden'); });
    closeCartModal.addEventListener('click', () => cartModal.classList.add('hidden'));
    cartModal.addEventListener('click', (e) => { if (e.target === cartModal) cartModal.classList.add('hidden'); });
    cartItems.addEventListener('click', (e) => { if (e.target.classList.contains('cart-item-remove')) { removeFromCart(e.target.dataset.id); }});
    checkoutBtn.addEventListener('click', () => { cartModal.classList.add('hidden'); checkoutModal.classList.remove('hidden'); });
    closeCheckoutModal.addEventListener('click', () => checkoutModal.classList.add('hidden'));
    checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) checkoutModal.classList.add('hidden'); });

    // =============================================
    //           LÓGICA DE CHECKOUT
    // =============================================
    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada.'));
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
    };
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        checkoutSubmitBtn.disabled = true;
        checkoutSubmitBtn.textContent = 'Procesando...';
        locationStatus.textContent = 'Obteniendo ubicación, por favor espera...';

        const name = customerName.value;
        const locationReference = customerLocation.value;
        const tuNumeroWhatsapp = '59173164833';
        
        let locationLink = '';
        let locationError = false;

        try {
            const position = await getLocation();
            const { latitude, longitude } = position.coords;
            locationLink = `https://maps.google.com/?q=${latitude},${longitude}`;
            locationStatus.textContent = '¡Ubicación obtenida!';
        } catch (error) {
            locationError = true;
            console.warn("Error al obtener ubicación:", error.message);
            locationStatus.textContent = 'No se pudo obtener ubicación exacta.';
        }
        
        let mensaje = `*¡Nuevo Pedido de SIRARI!* 🛍️\n\n`;
        mensaje += `*A nombre de:* ${name}\n\n`;
        mensaje += `*--- UBICACIÓN ---*\n`;
        mensaje += `*Referencia Escrita:* ${locationReference}\n`;
        if (locationError) {
            mensaje += `*Ubicación GPS:* No se pudo obtener.\n\n`;
        } else {
            mensaje += `*Link GPS (Exacto):* ${locationLink}\n\n`;
        }
        mensaje += `*--- DETALLE DEL PEDIDO ---*\n`;

        let granTotal = 0;
        cart.forEach(item => {
            const totalItem = item.price * item.quantity;
            granTotal += totalItem;
            mensaje += `\n*Producto:* ${item.title}\n`;
            mensaje += `*Código:* ${item.code}\n`;
            mensaje += `*Precio Unit:* Bs. ${item.price.toFixed(2)}\n`;
            mensaje += `*Cantidad:* ${item.quantity}\n`;
            mensaje += `*Subtotal:* Bs. ${totalItem.toFixed(2)}\n`;
        });
        mensaje += `\n*-----------------------------------*\n`;
        mensaje += `*TOTAL A PAGAR: Bs. ${granTotal.toFixed(2)}*`;

        const urlWhatsApp = `https://api.whatsapp.com/send?phone=${tuNumeroWhatsapp}&text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, '_blank');
        
        cart = [];
        saveCart();
        renderCart();
        checkoutForm.reset();
        checkoutModal.classList.add('hidden');
        checkoutSubmitBtn.disabled = false;
        checkoutSubmitBtn.textContent = 'Confirmar y Enviar por WhatsApp';
        locationStatus.textContent = '';
    });

    // =============================================
    //           INICIALIZACIÓN DE LA APP
    // =============================================
    async function loadDataFromServer() {
        if (SUPABASE_URL === 'URL_DE_TU_PROYECTO_SUPABASE' || SUPABASE_KEY === 'TU_LLAVE_PUBLISHABLE_ANON') {
            document.body.innerHTML = `<h1>Error de Configuración</h1><p>Por favor, edita el archivo <strong>app.js</strong>.</p>`;
            return;
        }

        try {
            const [sessionRes, categoriesRes, productsRes] = await Promise.all([
                sb.auth.getSession(),
                sb.from('categories').select('*'),
                sb.from('products').select('*').order('id', { ascending: false })
            ]);
            
            if (categoriesRes.error) throw categoriesRes.error;
            if (productsRes.error) throw productsRes.error;

            products = productsRes.data;
            categories = categoriesRes.data;
            
            refreshStoreUI();
            updateCartCount();
            
            const { data: { session } } = sessionRes;
            if (session) {
                showView(adminView); 
                refreshAdminUI();
            } else {
                showView(storeView);
            }

        } catch (error) {
            console.error("Error al cargar datos de Supabase:", error);
            document.body.innerHTML = `<h1>Error de Conexión</h1><pre>${error.message}</pre>`;
        }
    }
    
    loadDataFromServer();
});

