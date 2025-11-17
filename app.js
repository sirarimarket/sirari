// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
// Pega tu URL y tu Llave "Publishable" (anon) aquí
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_X756WMLJdDeXPYHCXlZBOg_BZ0V3Inq';

// Si no sabes dónde están:
// URL:  Settings > API > Project URL
// KEY:  Settings > API > API Keys > Publishable key (la que dice 'anon')

// Crea el cliente de Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // Selectores de Elementos (sin cambios)
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
    const productImages = document.getElementById('product-images');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const productCategory = document.getElementById('product-category');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const adminProductList = document.getElementById('admin-product-list');
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

    // =============================================
    //         VARIABLES GLOBALES
    // =============================================
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || []; // El carrito SÍ se queda en localStorage
    let imageDatacUrls = [];
    let currentCategoryFilter = 'todos';

    // Función para guardar el carrito
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
    adminLogoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('sirari_admin_logged_in');
        showView(loginView);
    });
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = usernameInput.value;
        const pass = passwordInput.value;

        if (user === 'admin' && pass === 'sirari.1') {
            sessionStorage.setItem('sirari_admin_logged_in', 'true');
            showView(adminView);
            refreshAdminUI();
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
            option.value = cat.name;
            option.textContent = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
            productCategory.appendChild(option);
        });
    }

    // CAMBIO: Habla con Supabase
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
            
            // 1. Actualizar la categoría en sí
            const { error: catError } = await sb.from('categories').update({ name: newName }).eq('id', editingId);
            if (catError) {
                console.error("Error al editar categoría:", catError);
                return;
            }
            
            // 2. Buscar y actualizar todos los productos con la categoría antigua
            // (Esto es lento, pero replica tu lógica anterior. Mejor sería con "foreign keys" en la DB)
            const { data: productsToUpdate } = await sb.from('products').select('id').eq('category', oldName);
            const updatePromises = productsToUpdate.map(p => 
                sb.from('products').update({ category: newName }).eq('id', p.id)
            );
            await Promise.all(updatePromises);
            
        } else {
            // --- LÓGICA DE CREACIÓN ---
            const { error } = await sb.from('categories').insert([{ name: newName }]);
            if (error) console.error("Error al crear categoría:", error);
        }

        categoryNameInput.value = '';
        categoryEditId.value = '';
        categorySaveBtn.textContent = 'Añadir';
        await loadDataFromServer(); // Recarga todos los datos
    });

    // CAMBIO: Habla con Supabase
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
                
                // 1. Mover productos a "otros"
                const { data: productsToMove } = await sb.from('products').select('id').eq('category', name);
                const updatePromises = productsToMove.map(p => 
                    sb.from('products').update({ category: 'otros' }).eq('id', p.id)
                );
                await Promise.all(updatePromises);

                // 2. Eliminar la categoría
                await sb.from('categories').delete().eq('id', id);

                // 3. Recargar todo
                await loadDataFromServer();
            }
        }
    });

    // =============================================
    //     LÓGICA DEL PANEL (ADMIN) - PRODUCTOS
    // =============================================

    // Convertir imágenes a Base64 (sin cambios)
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

    // CAMBIO: Habla con Supabase
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
        
        // Asume que tu tabla 'products' tiene una columna 'images' de tipo 'text[]' (array de texto)
        const productData = {
            title: productTitle.value,
            description: productDesc.value,
            price: parseFloat(productPrice.value),
            category: productCategory.value
        };

        let error = null;

        if (editingId) {
            // --- LÓGICA DE ACTUALIZAR ---
            if (imageDatacUrls.length > 0) {
                productData.images = imageDatacUrls;
            }
            
            const { error: updateError } = await sb.from('products').update(productData).eq('id', editingId);
            error = updateError;

        } else {
            // --- LÓGICA DE AÑADIR NUEVO ---
            productData.code = generateUniqueCode();
            productData.images = imageDatacUrls; 
            
            const { error: insertError } = await sb.from('products').insert([productData]);
            error = insertError;
        }

        // Manejo de errores (¡Importante!)
        if (error) {
            console.error("Error al guardar en Supabase:", error);
            if (error.message.includes('payload too large')) {
                alert("Error: ¡Las imágenes son demasiado grandes! \nIntenta con menos imágenes o más pequeñas.\n(Este es el límite de Base64, no de Supabase Storage)");
            } else {
                alert("Error al guardar el producto.");
            }
        } else {
            alert(editingId ? '¡Producto actualizado!' : '¡Producto guardado!');
            await loadDataFromServer();
            resetAdminForm();
        }
    });
    
    // Dibuja la lista de productos en el panel de admin (sin cambios)
    function renderAdminProductList() {
        adminProductList.innerHTML = '';
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'admin-product-item';
            // Asegúrate de que 'images' sea un array y tenga al menos una imagen
            const imageUrl = (product.images && product.images.length > 0) ? product.images[0] : 'placeholder.jpg';
            item.innerHTML = `
                <img src="${imageUrl}" alt="${product.title}">
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
    
    // CAMBIO: Habla con Supabase
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
            if (product.images && product.images.length > 0) {
                product.images.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'image-preview-item';
                    imagePreviewContainer.appendChild(img);
                });
            }
            imageDatacUrls = [];
            
            adminFormTitle.textContent = 'Editando Producto';
            saveProductBtn.textContent = 'Actualizar Producto';
            cancelEditBtn.classList.remove('hidden');
            adminView.scrollTo({ top: 0, behavior: 'smooth' });
        
        } else if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
                const { error } = await sb.from('products').delete().eq('id', id);
                if (error) console.error("Error al eliminar:", error);
                await loadDataFromServer(); // Recargar
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

        const categoryFiltered = products.filter(p => 
            currentCategoryFilter === 'todos' || p.category === currentCategoryFilter
        );

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
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" alt="${product.title}" class="product-image">
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

        productDetailModal.innerHTML = `
            <div class="modal-content" id="product-detail-content">
                <button class="close-modal" id="close-detail-modal">&times;</button>
                <div id="product-detail-gallery">
                    <img src="${mainImageUrl}" id="gallery-main-image" alt="${product.title}">
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
            </div>`;
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
    //           LÓGICA DEL CARRITO (SIN CAMBIOS)
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
        cartModal.innerHTML = `
            <div class="modal-content cart-modal-content">
                <button class="close-modal" id="close-cart-modal">&times;</button>
                <h2>Tu Carrito</h2>
                <div id="cart-items"></div>
                <hr>
                <div class="cart-total">
                    <strong>Total: Bs. <span id="cart-total">0.00</span></strong>
                </div>
                <button id="checkout-btn" class="primary-btn" disabled>Enviar Pedido</button>
            </div>`;
        
        const cartItemsEl = document.getElementById('cart-items');
        const cartTotalEl = document.getElementById('cart-total');
        const checkoutBtnEl = document.getElementById('checkout-btn');

        let total = 0;
        if (cart.length === 0) {
            cartItemsEl.innerHTML = '<p>Tu carrito está vacío.</p>';
            checkoutBtnEl.disabled = true;
        } else {
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                cartItemsEl.innerHTML += `
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
            checkoutBtnEl.disabled = false;
        }
        cartTotalEl.textContent = total.toFixed(2);
        updateCartCount();

        // Re-asignar listeners para el modal de carrito
        document.getElementById('close-cart-modal').addEventListener('click', () => cartModal.classList.add('hidden'));
        document.getElementById('checkout-btn').addEventListener('click', () => { cartModal.classList.add('hidden'); checkoutModal.classList.remove('hidden'); });
        cartModal.addEventListener('click', (e) => { if (e.target === cartModal) cartModal.classList.add('hidden'); });
        cartItemsEl.addEventListener('click', (e) => { if (e.target.classList.contains('cart-item-remove')) { removeFromCart(e.target.dataset.id); }});
    }
    
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'block' : 'none';
    }

    cartBtn.addEventListener('click', () => { renderCart(); cartModal.classList.remove('hidden'); });
    
    // =============================================
    //           LÓGICA DE CHECKOUT (SIN CAMBIOS)
    // =============================================
    
    checkoutModal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal" id="close-checkout-modal">&times;</button>
            <h2>Datos de Envío</h2>
            <form id="checkout-form">
                <div class="form-group"><label for="customer-name">Nombre Completo:</label><input type="text" id="customer-name" required></div>
                <div class="form-group"><label for="customer-location">Tu Ubicación:</label><textarea id="customer-location" rows="3" required></textarea></div>
                <button type="submit" class="primary-btn">Confirmar y Enviar por WhatsApp</button>
            </form>
        </div>`;
    
    document.getElementById('close-checkout-modal').addEventListener('click', () => checkoutModal.classList.add('hidden'));
    checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) checkoutModal.classList.add('hidden'); });
    document.getElementById('checkout-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const location = document.getElementById('customer-location').value;
        const tuNumeroWhatsapp = '591XXXXXXXX'; 
        
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

        const urlWhatsApp = `httpshttps://api.whatsapp.com/send?phone=${tuNumeroWhatsapp}&text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, '_blank');
        
        cart = [];
        saveCart();
        renderCart();
        document.getElementById('checkout-form').reset();
        checkoutModal.classList.add('hidden');
    });

    // =============================================
    //           INICIALIZACIÓN DE LA APP
    // =============================================
    
    // CAMBIO: Carga los datos desde Supabase al iniciar
    async function loadDataFromServer() {
        // Verifica si la conexión está lista
        if (SUPABASE_URL === 'URL_DE_TU_PROYECTO_SUPABASE' || SUPABASE_KEY === 'TU_LLAVE_PUBLISHABLE_ANON') {
            document.body.innerHTML = `<h1>Error de Configuración</h1><p>Por favor, edita el archivo <strong>app.js</strong> y añade tu URL y Key de Supabase en las líneas 5 y 6.</p>`;
            return;
        }

        try {
            // Pide los productos Y las categorías al mismo tiempo
            const { data: categoriesData, error: catError } = await sb.from('categories').select('*');
            const { data: productsData, error: prodError } = await sb.from('products').select('*').order('id', { ascending: false });

            if (catError) throw catError;
            if (prodError) throw prodError;

            products = productsData;
            categories = categoriesData;
            
            // Ahora que tenemos los datos, dibujamos la página
            refreshStoreUI();
            updateCartCount();
            
            if (sessionStorage.getItem('sirari_admin_logged_in') === 'true') {
                showView(adminView);
                refreshAdminUI();
            } else {
                showView(storeView);
            }

        } catch (error) {
            console.error("Error al cargar datos de Supabase:", error);
            document.body.innerHTML = `<h1>Error de Conexión</h1><p>No se pudo conectar a Supabase. Revisa tu URL, tu Llave, y que hayas deshabilitado RLS en tus tablas.</p><pre>${error.message}</pre>`;
        }
    }
    
    loadDataFromServer(); // ¡Inicia la aplicación!

});

