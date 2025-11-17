document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    //           SELECTORES DE ELEMENTOS
    // =============================================
    
    // Vistas
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const storeView = document.getElementById('store-view');

    // Login Admin
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const goToStoreBtn = document.getElementById('go-to-store-btn');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');

    // Admin - Gestión de Categorías
    const categoryForm = document.getElementById('category-form');
    const categoryNameInput = document.getElementById('category-name-input');
    const categoryEditId = document.getElementById('category-edit-id'); // Cambiado a ID
    const categorySaveBtn = document.getElementById('category-save-btn');
    const categoryList = document.getElementById('category-list');

    // Admin - Gestión de Productos
    const addProductForm = document.getElementById('add-product-form');
    const adminFormTitle = document.getElementById('admin-form-title');
    const productEditId = document.getElementById('product-edit-id');
    const productTitle = document.getElementById('product-title');
    const productDesc = document.getElementById('product-desc');
    const productPrice = document.getElementById('product-price');
    const productImages = document.getElementById('product-images');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const productCategory = document.getElementById('product-category');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const adminProductList = document.getElementById('admin-product-list');

    // Tienda (Usuario)
    const searchInput = document.getElementById('search-input');
    const categoryFilters = document.getElementById('category-filters');
    const productGrid = document.getElementById('product-grid');
    
    // Carrito (sigue en localStorage, ¡esto es lo normal!)
    const cartBtn = document.getElementById('cart-btn');
    const cartCount = document.getElementById('cart-count');
    const cartModal = document.getElementById('cart-modal');
    const closeCartModal = document.getElementById('close-cart-modal');
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Checkout
    const checkoutModal = document.getElementById('checkout-modal');
    const closeCheckoutModal = document.getElementById('close-checkout-modal');
    const checkoutForm = document.getElementById('checkout-form');
    const customerName = document.getElementById('customer-name');
    const customerLocation = document.getElementById('customer-location');
    
    // Detalle Producto
    const productDetailModal = document.getElementById('product-detail-modal');
    const productDetailContent = document.getElementById('product-detail-content');

    // =============================================
    //         CONFIGURACIÓN Y BASE DE DATOS
    // =============================================
    
    // Usamos una ruta relativa. Esto funciona porque json-server servirá
    // tanto la API como los archivos estáticos (index.html, etc.)
    const API_URL = ''; 

    // Los datos de productos y categorías ahora vivirán en estas variables
    let products = [];
    let categories = [];
    
    // El carrito SÍ debe estar en localStorage, porque es específico de cada usuario.
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];

    // Función para guardar el carrito (la única que usa localStorage)
    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
        updateCartCount();
    }
    
    // Variables globales
    let imageDatacUrls = [];
    let currentCategoryFilter = 'todos';

    // =============================================
    //           LÓGICA DE NAVEGACIÓN Y VISTAS
    // =============================================

    function showView(viewToShow) {
        [loginView, adminView, storeView].forEach(view => view.classList.add('hidden'));
        viewToShow.classList.remove('hidden');
    }
    
    goToStoreBtn.addEventListener('click', () => showView(storeView));
    adminLoginBtn.addEventListener('click', () => showView(loginView));
    adminLogoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('sirari_admin_logged_in');
        showView(loginView);
    });

    // =============================================
    //           LÓGICA DE LOGIN (ADMIN)
    // =============================================
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = usernameInput.value;
        const pass = passwordInput.value;

        if (user === 'admin' && pass === 'sirari.1') {
            sessionStorage.setItem('sirari_admin_logged_in', 'true');
            showView(adminView);
            refreshAdminUI(); // Carga los datos del admin
        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos.';
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
            option.value = cat.name; // El valor es el nombre
            option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            productCategory.appendChild(option);
        });
    }

    // Manejador del formulario de categorías (Crear y Editar)
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
            // --- LÓGICA DE EDICIÓN ---
            const oldName = categories.find(c => c.id == editingId).name;
            try {
                // 1. Actualizar la categoría en sí
                await fetch(`${API_URL}/categories/${editingId}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: newName }) // json-server es flexible, no necesita el ID
                });
                
                // 2. Buscar y actualizar todos los productos con la categoría antigua
                const productsToUpdate = products.filter(p => p.category === oldName);
                const updatePromises = productsToUpdate.map(p => {
                    return fetch(`${API_URL}/products/${p.id}`, {
                        method: 'PATCH', // PATCH solo actualiza un campo
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ category: newName })
                    });
                });
                await Promise.all(updatePromises);
                
            } catch (error) { console.error("Error al editar categoría:", error); }
            
        } else {
            // --- LÓGICA DE CREACIÓN ---
            try {
                await fetch(`${API_URL}/categories`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: newName }) // json-server creará el ID
                });
            } catch (error) { console.error("Error al crear categoría:", error); }
        }

        // Resetear formulario y recargar todo
        categoryNameInput.value = '';
        categoryEditId.value = '';
        categorySaveBtn.textContent = 'Añadir';
        await loadDataFromServer(); // Recarga todos los datos desde el servidor
    });

    // Listeners para botones de la lista de categorías
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
            // --- LÓGICA DE ELIMINACIÓN ---
            if (confirm(`¿Seguro que quieres eliminar la categoría "${name}"?\nTodos sus productos se moverán a "otros".`)) {
                try {
                    // 1. Mover productos a "otros"
                    const productsToMove = products.filter(p => p.category === name);
                    const updatePromises = productsToMove.map(p => {
                        return fetch(`${API_URL}/products/${p.id}`, {
                            method: 'PATCH',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ category: 'otros' })
                        });
                    });
                    await Promise.all(updatePromises);

                    // 2. Eliminar la categoría
                    await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });

                    // 3. Recargar todo
                    await loadDataFromServer();

                } catch (error) { console.error("Error al eliminar categoría:", error); }
            }
        }
    });

    // =============================================
    //     LÓGICA DEL PANEL (ADMIN) - PRODUCTOS
    // =============================================

    // Convertir imágenes a Base64 (esto sigue siendo un problema para servidores reales,
    // pero para json-server está bien. Un servidor real manejaría la subida de archivos).
    productImages.addEventListener('change', (e) => {
        imagePreviewContainer.innerHTML = '';
        imageDatacUrls = [];
        const files = Array.from(e.target.files).slice(0, 10);
        if (files.length === 0) return;

        const readPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readPromises)
            .then(urls => {
                imageDatacUrls = urls;
                urls.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'image-preview-item';
                    imagePreviewContainer.appendChild(img);
                });
            })
            .catch(error => console.error("Error al leer imágenes:", error));
    });

    // Generar código único (ahora consulta el array 'products')
    function generateUniqueCode() {
        let code;
        do {
            code = 'SIRARI-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        } while (products.find(p => p.code === code));
        return code;
    }
    
    function resetAdminForm() {
        addProductForm.reset();
        imagePreviewContainer.innerHTML = '';
        imageDatacUrls = [];
        productEditId.value = '';
        adminFormTitle.textContent = 'Añadir Nuevo Producto';
        saveProductBtn.textContent = 'Guardar Producto';
        cancelEditBtn.classList.add('hidden');
    }
    
    cancelEditBtn.addEventListener('click', resetAdminForm);

    // Guardar (o Actualizar) el producto en el SERVIDOR
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const editingId = productEditId.value;
        
        if (!editingId && imageDatacUrls.length === 0) {
            alert('Por favor, sube al menos una imagen para el nuevo producto.');
            return;
        }
        if (!productCategory.value) {
            alert('Por favor, selecciona una categoría.');
            return;
        }

        // Prepara el objeto producto
        const productData = {
            title: productTitle.value,
            description: productDesc.value,
            price: parseFloat(productPrice.value),
            category: productCategory.value
            // Nota: El código y las imágenes se manejan por separado
        };

        try {
            if (editingId) {
                // --- LÓGICA DE ACTUALIZAR ---
                // Solo añade imágenes si se subieron nuevas
                if (imageDatacUrls.length > 0) {
                    productData.images = imageDatacUrls;
                }
                
                await fetch(`${API_URL}/products/${editingId}`, {
                    method: 'PATCH', // PATCH es mejor para actualizar
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(productData)
                });
                alert('¡Producto actualizado!');

            } else {
                // --- LÓGICA DE AÑADIR NUEVO ---
                productData.code = generateUniqueCode();
                productData.images = imageDatacUrls; // Añade las imágenes Base64

                await fetch(`${API_URL}/products`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(productData)
                });
                alert('¡Producto guardado!');
            }

            // Recargar datos y resetear formulario
            await loadDataFromServer();
            resetAdminForm();

        } catch (error) {
            // json-server también tiene un límite de tamaño (en el body del POST)
            // Si las imágenes Base64 son gigantes, podría fallar.
            console.error("Error al guardar producto:", error);
            alert("Error al guardar. ¿Las imágenes son demasiado grandes? Intenta con menos.");
        }
    });
    
    // Dibuja la lista de productos en el panel de admin
    function renderAdminProductList() {
        adminProductList.innerHTML = '';
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'admin-product-item';
            item.innerHTML = `
                <img src="${product.images[0]}" alt="${product.title}">
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
    
    // Listener para los botones de la lista de admin (Editar/Eliminar Producto)
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
            
            imagePreviewContainer.innerHTML = '';
            product.images.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'image-preview-item';
                imagePreviewContainer.appendChild(img);
            });
            imageDatacUrls = [];
            
            adminFormTitle.textContent = 'Editando Producto';
            saveProductBtn.textContent = 'Actualizar Producto';
            cancelEditBtn.classList.remove('hidden');
            adminView.scrollTo({ top: 0, behavior: 'smooth' });
        
        } else if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
                try {
                    await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
                    await loadDataFromServer(); // Recargar
                } catch (error) { console.error("Error al eliminar:", error); }
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

        // Actualizar el listener de los filtros
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

        const categoryFiltered = products.filter(p => 
            currentCategoryFilter === 'todos' || p.category === currentCategoryFilter
        );

        const finalFiltered = categoryFiltered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) || 
            p.code.toLowerCase().includes(searchTerm)
        );

        if (finalFiltered.length === 0) {
            productGrid.innerHTML = '<p class="no-products">No se encontraron productos.</p>';
            return;
        }

        finalFiltered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = product.id; 
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.images[0]}" alt="${product.title}" class="product-image">
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
        product.images.forEach((img, index) => {
            thumbnailsHTML += `<img src="${img}" class="gallery-thumbnail ${index === 0 ? 'active' : ''}" data-index="${index}">`;
        });

        productDetailContent.innerHTML = `
            <button class="close-modal" id="close-detail-modal">&times;</button>
            <div id="product-detail-gallery">
                <img src="${product.images[0]}" id="gallery-main-image" alt="${product.title}">
                <div id="gallery-thumbnails">
                    ${thumbnailsHTML}
                </div>
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

        document.getElementById('close-detail-modal').addEventListener('click', () => {
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
    //           LÓGICA DEL CARRITO (localStorage)
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
                    image: product.images[0],
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
        cartItems.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cartItems.innerHTML = '<p>Tu carrito está vacío.</p>';
            checkoutBtn.disabled = true;
        } else {
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
                        <button class="cart-item-remove" data-id="${item.id}">&times;</button>
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
    
    // =============================================
    //           LÓGICA DE CHECKOUT (WHATSAPP)
    // =============================================

    checkoutBtn.addEventListener('click', () => { cartModal.classList.add('hidden'); checkoutModal.classList.remove('hidden'); });
    closeCheckoutModal.addEventListener('click', () => checkoutModal.classList.add('hidden'));
    checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) checkoutModal.classList.add('hidden'); });

    checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = customerName.value;
        const location = customerLocation.value;
        const tuNumeroWhatsapp = '591XXXXXXXX'; // ¡RECUERDA CONFIGURAR ESTO!
        
        if (tuNumeroWhatsapp === '591XXXXXXXX') {
            alert('Error: Debes configurar tu número de WhatsApp en el archivo app.js.');
            return;
        }

        let mensaje = `*¡Nuevo Pedido de SIRARI!* 🛍️\n\n`;
        mensaje += `*A nombre de:* ${name}\n`;
        mensaje += `*Ubicación/Dirección:* ${location}\n\n`;
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
    });

    // =============================================
    //           INICIALIZACIÓN DE LA APP
    // =============================================
    
    // Nueva función para cargar datos desde el servidor
    async function loadDataFromServer() {
        try {
            // Pide los productos Y las categorías al mismo tiempo
            const [productsRes, categoriesRes] = await Promise.all([
                fetch(`${API_URL}/products?_sort=id&_order=desc`), // Pide productos ordenados por ID
                fetch(`${API_URL}/categories`)
            ]);

            products = await productsRes.json();
            categories = await categoriesRes.json();
            
            // Ahora que tenemos los datos, dibujamos la página
            refreshStoreUI();
            updateCartCount();
            
            // Si el admin ya está logueado, refresca su panel
            if (sessionStorage.getItem('sirari_admin_logged_in') === 'true') {
                showView(adminView);
                refreshAdminUI();
            } else {
                showView(storeView);
            }

        } catch (error) {
            console.error("Error al cargar datos del servidor:", error);
            document.body.innerHTML = `<h1>Error de Conexión</h1><p>No se pudo conectar a la base de datos (json-server). ¿Iniciaste el servidor con el comando correcto?</p>`;
        }
    }
    
    loadDataFromServer(); // ¡Inicia la aplicación!

});