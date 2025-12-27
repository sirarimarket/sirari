// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES DE ESTADO ---
    let products = [];
    let categories = []; // Array de objetos {id, name}
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';
    let currentPage = 1;
    const itemsPerPage = 100;
    
    // Variables Checkout
    let map = null, marker = null, selectedCoordinates = null;

    // --- SELECTORES GLOBALES ---
    const views = { 
        login: document.getElementById('login-view'), 
        admin: document.getElementById('admin-view'), 
        store: document.getElementById('store-view') 
    };
    
    // Selectores del menú móvil (Tu diseño original)
    const searchInputDesk = document.getElementById('search-input');
    // Si no existe el mobile input (a veces está oculto), usamos el desk como fallback
    const searchInputMob = document.getElementById('mobile-search-input') || document.getElementById('search-input'); 
    
    const mobileMenuBtn = document.getElementById('mobile-menu-btn'); // Botón hamburguesa
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileCatsToggle = document.getElementById('mobile-cats-toggle');
    const mobileCatsContent = document.getElementById('mobile-cats-content');
    
    // Selectores Panel Admin (NUEVOS)
    const productForm = document.getElementById('product-form'); // El nuevo form
    
    // --- TOAST NOTIFICATION ---
    if (!document.getElementById('toast')) {
        const d = document.createElement('div'); d.id='toast'; d.className='toast-notification'; document.body.appendChild(d);
    }
    window.showToast = (msg) => {
        const t = document.getElementById('toast'); 
        t.textContent = msg; 
        t.classList.add('show');
        setTimeout(()=>t.classList.remove('show'), 3000);
    };

    // --- UTILIDADES DE PRECIO ---
    function formatPriceHTML(val) { 
        const ps = parseFloat(val).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}).split(','); 
        return ps.length===2 ? `${ps[0]}<span class="decimal-small">,${ps[1]}</span>` : ps[0]; 
    }
    
    // Unificamos la lógica de cálculo
    function calculateFinalPrice(price, type, val) { 
        let f = parseFloat(price); 
        // Adaptación: tu BD usa 'percent'/'fixed' y un valor numérico
        if(type==='percent' && val>0) f = price - (price*(val/100)); 
        else if(type==='fixed' && val>0) f = price - val; 
        
        return { 
            original: parseFloat(price), 
            final: Math.max(0, f), 
            hasDiscount: f < price 
        }; 
    }

    // =============================================
    //            NAVEGACIÓN Y LOGIN
    // =============================================

    window.showView = (name) => { 
        Object.values(views).forEach(v => v && v.classList.add('hidden')); 
        if(views[name]) views[name].classList.remove('hidden'); 
    };
    
    // Lógica Sidebar Móvil (Tu código original)
    const toggleSidebar = (show) => {
        if(!mobileSidebar) return; // Protección si no existe en HTML actual
        if(show) { mobileSidebar.classList.add('open'); sidebarOverlay?.classList.add('show'); }
        else { mobileSidebar.classList.remove('open'); sidebarOverlay?.classList.remove('show'); }
    };
    if(mobileMenuBtn) mobileMenuBtn.onclick = () => toggleSidebar(true);
    if(closeSidebarBtn) closeSidebarBtn.onclick = () => toggleSidebar(false);
    if(sidebarOverlay) sidebarOverlay.onclick = () => toggleSidebar(false);
    if(mobileCatsToggle) mobileCatsToggle.onclick = () => mobileCatsContent.classList.toggle('show');

    // Botones de navegación
    const btnAdminLogin = document.getElementById('admin-login-btn');
    if(btnAdminLogin) btnAdminLogin.onclick = () => showView('login');

    const btnGoStore = document.getElementById('go-to-store-btn');
    if(btnGoStore) btnGoStore.onclick = () => showView('store');
    
    // Logout (Soporta ambos botones, el viejo y el nuevo)
    const handleLogout = async () => { await sb.auth.signOut(); showView('login'); };
    const btnLogoutNew = document.getElementById('logout-btn');
    const btnLogoutOld = document.getElementById('admin-logout-btn');
    if(btnLogoutNew) btnLogoutNew.onclick = handleLogout;
    if(btnLogoutOld) btnLogoutOld.onclick = handleLogout;

    // LOGIN SUBMIT
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            const { error } = await sb.auth.signInWithPassword({ email, password: pass });
            
            if(error) document.getElementById('login-error').textContent = 'Credenciales incorrectas';
            else { 
                showView('admin'); 
                loadDataFromServer(); 
                // IMPORTANTE: Iniciar en la pestaña de usuario del nuevo admin
                switchAdminTab('user');
            }
        };
    }

    // =============================================
    //          CARGA DE DATOS (SERVER)
    // =============================================
    
    async function loadDataFromServer() {
        // Obtenemos sesión, categorías y productos
        const [sess, cats, prods] = await Promise.all([
            sb.auth.getSession(), 
            sb.from('categories').select('*'), 
            sb.from('products').select('*').order('id', {ascending: false})
        ]);

        categories = cats.data || []; 
        products = prods.data || [];
        
        // Renderizamos la tienda pública
        renderCategoryFilters(); 
        renderMobileCategories(); 
        renderProducts();
        
        // Si hay sesión, renderizamos el panel de admin
        if (sess.data.session) { 
            showView('admin'); 
            // Iniciar componentes del nuevo admin
            renderAdminProductTable(); 
            populateCategoryFilterAdmin();
        } else { 
            showView('store'); 
        }
    }

    // =============================================
    //          LÓGICA TIENDA (PÚBLICA)
    // =============================================

    // Búsqueda
    const handleSearch = (e) => {
        const val = e.target.value;
        if(searchInputDesk) searchInputDesk.value = val;
        if(searchInputMob) searchInputMob.value = val;
        currentPage = 1; 
        renderProducts();
        if (e.key === 'Enter') toggleSidebar(false);
    };
    if(searchInputDesk) searchInputDesk.addEventListener('input', handleSearch);
    if(searchInputMob) searchInputMob.addEventListener('keyup', handleSearch); 

    // Renderizar Productos (Grid)
    function renderProducts() {
        const grid = document.getElementById('product-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        const term = searchInputDesk ? searchInputDesk.value.toLowerCase().trim() : '';
        
        let filtered = products.filter(p => {
            // Filtro Categoría
            if (currentCategoryFilter === 'ofertas') { if (!(p.discount_type && p.discount_value > 0)) return false; }
            else if (currentCategoryFilter !== 'todos' && p.category !== currentCategoryFilter) return false;
            
            // Filtro Texto
            if (term && !p.title.toLowerCase().includes(term) && !p.code.toLowerCase().includes(term)) return false;
            return true;
        });

        // Paginación
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages || 1;
        const productsToShow = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if (productsToShow.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No se encontraron productos.</p>';
            renderPagination(0);
            return;
        }

        productsToShow.forEach(p => {
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            const card = document.createElement('div'); card.className = 'product-card';
            
            // Generar HTML del precio
            const priceHtml = pricing.hasDiscount 
                ? `<span class="p-price-old">Bs.${p.price.toFixed(2)}</span> <span class="p-price">Bs.${formatPriceHTML(pricing.final)}</span>`
                : `<span class="p-price">Bs.${formatPriceHTML(p.price)}</span>`;

            const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/300?text=Sin+Imagen';

            card.innerHTML = `
                <div class="product-img-box" onclick="showProductDetail('${p.id}')">
                    <img src="${imgUrl}" loading="lazy">
                    ${pricing.hasDiscount ? `<span class="discount-badge">-${p.discount_type==='percent'?p.discount_value+'%':p.discount_value+'Bs'}</span>` : ''}
                </div>
                <div class="product-info">
                    <span class="p-category">${p.category}</span>
                    <h3 class="p-title">${p.title}</h3>
                    <div class="p-prices">${priceHtml}</div>
                    <button class="add-btn" onclick="addToCart('${p.id}', 1)">Agregar</button>
                </div>
            `;
            grid.appendChild(card);
        });
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const container = document.getElementById('pagination-controls'); 
        if(!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) return;
        
        // Botones simples Anterior/Siguiente
        const createBtn = (text, page) => {
            const btn = document.createElement('button');
            btn.className = `page-btn ${currentPage === page ? 'active' : ''}`;
            btn.textContent = text;
            btn.onclick = () => { currentPage = page; renderProducts(); window.scrollTo({top:0, behavior:'smooth'}); };
            container.appendChild(btn);
        };

        if(currentPage > 1) createBtn('←', currentPage - 1);
        // Mostrar solo algunas páginas para no saturar
        for (let i = 1; i <= totalPages; i++) {
             createBtn(i, i);
        }
        if(currentPage < totalPages) createBtn('→', currentPage + 1);
    }

    // Filtros de Categoría (Tienda)
    function renderCategoryFilters() {
        const c = document.getElementById('category-filters');
        if(!c) return;
        c.innerHTML = '';
        
        const add = (t,v) => { 
            const div = document.createElement('div'); 
            div.className = `category-pill ${currentCategoryFilter===v?'active':''}`; 
            div.textContent=t; 
            div.onclick=()=>{ 
                if(searchInputDesk) searchInputDesk.value = ''; 
                currentCategoryFilter=v; currentPage=1; 
                renderCategoryFilters(); renderMobileCategories(); renderProducts(); 
            }; 
            c.appendChild(div); 
        };
        add('Todos','todos'); 
        add('🔥 Ofertas','ofertas'); 
        categories.forEach(x=>add(x.name,x.name));
    }
    
    function renderMobileCategories() {
        if(!mobileCatsContent) return;
        mobileCatsContent.innerHTML = '';
        const add = (t,v) => { 
            const b = document.createElement('button'); 
            b.className='sidebar-link'; b.style.textAlign='left'; 
            b.innerHTML=(currentCategoryFilter===v?`<b>${t}</b>`:t); 
            b.onclick=()=>{ 
                if(searchInputDesk) searchInputDesk.value = ''; 
                currentCategoryFilter=v; currentPage=1; 
                renderCategoryFilters(); renderMobileCategories(); renderProducts(); 
                toggleSidebar(false);
            }; 
            mobileCatsContent.appendChild(b); 
        };
        add('Ver Todos','todos'); 
        add('🔥 Ofertas','ofertas'); 
        categories.forEach(x=>add(x.name,x.name));
    }

    // Modal Detalle Producto
    window.showProductDetail = (id) => {
        const p = products.find(x => x.id == id); if(!p) return;
        const modal = document.getElementById('product-detail-modal');
        const info = document.getElementById('modal-product-info');
        if(!modal || !info) return;

        const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
        let imagesHtml = '';
        if(p.images) p.images.forEach(img => imagesHtml += `<img src="${img}" style="width:60px; height:60px; object-fit:cover; margin:5px; border-radius:4px; border:1px solid #ddd;">`);

        info.innerHTML = `
            <h2>${p.title}</h2>
            <p style="color:#666;">Ref: ${p.code}</p>
            <div style="margin:15px 0;">
                <img src="${(p.images && p.images[0]) || ''}" style="width:100%; max-height:300px; object-fit:contain; border-radius:8px;">
                <div style="display:flex; overflow-x:auto; margin-top:10px;">${imagesHtml}</div>
            </div>
            <p>${p.description || 'Sin descripción'}</p>
            <h3 style="margin-top:20px;">Precio: Bs. ${pricing.final.toFixed(2)}</h3>
            <button class="primary-btn" onclick="addToCart('${p.id}', 1); document.querySelector('.close-modal').click();" style="width:100%; margin-top:10px;">Agregar al Carrito</button>
        `;
        
        modal.classList.remove('hidden');
        const closeBtn = modal.querySelector('.close-modal');
        if(closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    };

    // =============================================
    //           CARRITO Y CHECKOUT
    // =============================================

    window.addToCart = (id, q) => { 
        q = parseInt(q)||1; 
        const p = products.find(x=>x.id==id); 
        if(!p || p.stock<1) return showToast("Agotado"); 
        
        const existing = cart.find(i=>i.id==id); 
        if(existing) {
            existing.quantity += q;
        } else {
            // Guardamos precio FINAL en el carrito
            const pr = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            cart.push({id:p.id, title:p.title, price:pr.final, quantity:q, stock:p.stock});
        } 
        saveCart(); 
        showToast("Agregado al carrito"); 
    };

    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart)); 
        const count = document.getElementById('cart-count');
        if(count) count.textContent = cart.reduce((a,b)=>a+b.quantity,0);
    }
    // Inicializar contador
    saveCart();

    window.openCheckoutModal = () => {
        const modal = document.getElementById('checkout-modal');
        const container = document.getElementById('cart-items-container');
        const totalEl = document.getElementById('cart-total-price');
        
        container.innerHTML = '';
        let total = 0;

        cart.forEach((item, idx) => {
            total += item.price * item.quantity;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <p>Bs. ${item.price.toFixed(2)} x ${item.quantity}</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="qty-selector">
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                        <span class="cart-qty-value">${item.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                    </div>
                    <button class="cart-remove-btn" onclick="removeFromCart(${idx})">×</button>
                </div>
            `;
            container.appendChild(div);
        });

        totalEl.textContent = `Bs. ${total.toFixed(2)}`;
        document.getElementById('checkout-form-container').classList.add('hidden');
        const btnCheckout = document.getElementById('checkout-btn');
        if(btnCheckout) {
            btnCheckout.classList.remove('hidden');
            btnCheckout.onclick = () => {
                if(cart.length === 0) return showToast("Carrito vacío");
                btnCheckout.classList.add('hidden');
                document.getElementById('checkout-form-container').classList.remove('hidden');
            };
        }
        modal.classList.remove('hidden');
    };

    window.updateCartQty = (idx, delta) => {
        cart[idx].quantity += delta;
        if(cart[idx].quantity < 1) cart[idx].quantity = 1;
        saveCart(); openCheckoutModal();
    };

    window.removeFromCart = (idx) => {
        cart.splice(idx, 1);
        saveCart(); openCheckoutModal();
    };

    // MAPA
    function initMap() {
        if(map) map.remove(); 
        const lat = -17.7833, lng = -63.1821; 
        map = L.map('delivery-map').setView([lat,lng], 13); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); 
        marker = L.marker([lat,lng], {draggable:true}).addTo(map); 
        
        const updateCoords = (e) => selectedCoordinates = e.latlng;
        marker.on('dragend', (e) => updateCoords(e)); 
        map.on('click', (e) => { marker.setLatLng(e.latlng); updateCoords(e); }); 
        selectedCoordinates = {lat, lng}; 
        setTimeout(() => map.invalidateSize(), 200);
    }

    const btnYesLoc = document.getElementById('btn-yes-location');
    if(btnYesLoc) btnYesLoc.onclick = async () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('location-status').textContent = "Buscando GPS...";
        try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:10000}));
            selectedCoordinates = {lat: pos.coords.latitude, lng: pos.coords.longitude};
            document.getElementById('location-status').textContent = "✅ GPS OK";
            document.getElementById('checkout-submit-btn').classList.remove('hidden');
        } catch(e) {
            document.getElementById('btn-no-location').click();
        }
    };

    const btnNoLoc = document.getElementById('btn-no-location');
    if(btnNoLoc) btnNoLoc.onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    };
    
    document.getElementById('confirm-map-location').onclick = () => {
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = "✅ Mapa OK";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };

    document.getElementById('checkout-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const locLink = selectedCoordinates ? `http://maps.google.com/?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` : 'No map';
        
        let msg = `*PEDIDO SIRARI* 🛍️\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${locLink}\n\n*ITEMS:*`;
        let total = 0;
        cart.forEach(i => {
            total += i.price * i.quantity;
            msg += `\n- ${i.title} (${i.quantity}) = Bs.${(i.price*i.quantity).toFixed(2)}`;
        });
        msg += `\n\n*TOTAL: Bs. ${total.toFixed(2)}*`;
        
        window.open(`https://api.whatsapp.com/send?phone=59173164833&text=${encodeURIComponent(msg)}`, '_blank');
        cart = []; saveCart(); 
        document.getElementById('checkout-modal').classList.add('hidden');
        window.location.reload();
    };

    // =============================================
    //      NUEVA LÓGICA DEL PANEL ADMIN (V2)
    // =============================================

    window.switchAdminTab = (tabName) => {
        ['user', 'add', 'list', 'placeholder'].forEach(t => {
             const el = document.getElementById(`tab-${t}`);
             if(el) el.classList.add('hidden');
        });

        if(['sales', 'buyers', 'analytics', 'notifications', 'settings'].includes(tabName)){
            const ph = document.getElementById('tab-placeholder');
            if(ph) ph.classList.remove('hidden');
        } else {
            const el = document.getElementById(`tab-${tabName}`);
            if(el) el.classList.remove('hidden');
        }

        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        if(event && event.currentTarget) event.currentTarget.classList.add('active');

        if(tabName === 'list') {
            populateCategoryFilterAdmin();
            renderAdminProductTable();
        }
        if(tabName === 'add') {
             populateCategorySelect();
        }
    };

    // --- CRUD PRODUCTOS (ADMIN NUEVO) ---
    
    // Guardar (Submit)
    if(productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Recoger valores del NUEVO formulario (IDs con prefijo p-)
            const id = document.getElementById('product-id').value;
            const title = document.getElementById('p-title').value;
            const code = document.getElementById('p-code').value;
            const category = document.getElementById('p-category').value;
            const price = parseFloat(document.getElementById('p-price').value);
            const stock = parseInt(document.getElementById('p-stock').value);
            const discount = parseFloat(document.getElementById('p-discount').value) || 0;
            const discountType = document.getElementById('p-discount-type').value; // 'percent' o 'fixed'
            const desc = document.getElementById('p-desc').value;

            // Recoger imágenes
            const images = [];
            document.querySelectorAll('.image-input').forEach(input => {
                if(input.value.trim()) images.push(input.value.trim());
            });

            // Preparar objeto para Supabase (Usando columnas de tu BD original)
            const productData = {
                title, 
                code, 
                category, 
                price, 
                stock, 
                description: desc, 
                images,
                // Mapeamos a las columnas que usabas antes
                discount_type: discountType, 
                discount_value: discount 
            };

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

            if(error) showToast("Error: " + error.message);
            else {
                showToast("Producto Guardado");
                clearForm();
                loadDataFromServer(); // Recargar tablas
            }
        });
    }

    // Buscar para editar
    window.searchProductToEdit = () => {
        const code = document.getElementById('search-code-edit').value.trim();
        if(!code) return showToast("Escribe un código");
        const product = products.find(p => p.code === code);
        if(product) {
            loadProductForEdit(product);
            showToast(`Cargado: ${product.title}`);
        } else {
            showToast('No encontrado');
        }
    };

    // Cargar datos al form
    function loadProductForEdit(p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-code').value = p.code;
        populateCategorySelect(); 
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-stock').value = p.stock;
        
        // Mapeo inverso de BD a Form
        document.getElementById('p-discount').value = p.discount_value || '';
        document.getElementById('p-discount-type').value = p.discount_type || 'percent';
        
        document.getElementById('p-desc').value = p.description || '';
        
        // Imágenes
        const container = document.getElementById('image-url-container');
        container.innerHTML = '';
        if(p.images && p.images.length > 0) {
            p.images.forEach(url => addImageInput(url));
        } else {
             addImageInput();
        }
    }
    
    // Auxiliar imágenes
    window.addImageInput = (val = '') => {
        const container = document.getElementById('image-url-container');
        const input = document.createElement('input');
        input.type = 'url';
        input.className = 'image-input';
        input.placeholder = "https://...";
        input.value = val;
        container.appendChild(input);
    };

    // Limpiar form
    window.clearForm = () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = ''; 
        document.getElementById('image-url-container').innerHTML = '';
        addImageInput();
    };

    // Renderizar Tabla Admin
    window.renderAdminProductTable = () => {
        const tbody = document.getElementById('admin-product-table-body');
        if(!tbody) return; // Si no estamos en la pestaña correcta
        tbody.innerHTML = '';

        // Filtros (Admin)
        const catFilter = document.getElementById('filter-category')?.value || 'all';
        const stockFilter = document.getElementById('filter-stock')?.value || 'all';
        
        let filtered = products.filter(p => {
            if(catFilter !== 'all' && p.category !== catFilter) return false;
            if(stockFilter !== 'all') {
                const [min, max] = stockFilter.split('-').map(Number);
                if(p.stock < min || p.stock > max) return false;
            }
            return true;
        });

        filtered.forEach((p, index) => {
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            const discountTxt = pricing.hasDiscount ? (p.discount_type === 'percent' ? `${p.discount_value}%` : `Bs.${p.discount_value}`) : '-';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="radio" name="prod-select" value="${p.id}"></td>
                <td>${index + 1}</td>
                <td>${p.title}</td>
                <td><strong>${p.code}</strong></td>
                <td>${p.category}</td>
                <td>Bs. ${p.price}</td>
                <td style="color:red">${discountTxt}</td>
                <td><strong>Bs. ${pricing.final.toFixed(2)}</strong></td>
                <td>${p.stock}</td>
            `;
            tbody.appendChild(tr);
        });
    };
    
    window.editSelectedProduct = () => {
        const selected = document.querySelector('input[name="prod-select"]:checked');
        if(!selected) return showToast('Selecciona un producto');
        const product = products.find(p => p.id == selected.value);
        if(product) {
            switchAdminTab('add'); 
            loadProductForEdit(product);
        }
    };
    
    // Llenar Selects
    function populateCategorySelect() {
        const sel = document.getElementById('p-category');
        if(!sel) return;
        sel.innerHTML = '';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name; // Usamos .name porque categories son objetos
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
        
        // Agregar opción para nueva categoría (simple)
        const optNew = document.createElement('option');
        optNew.value = "nueva";
        optNew.textContent = "+ Nueva Categoría...";
        sel.appendChild(optNew);
        
        sel.onchange = () => {
            if(sel.value === 'nueva') window.addNewCategory();
        };
    }
    
    window.addNewCategory = async () => {
        const name = prompt("Nombre nueva categoría:");
        if(name) {
            const { error } = await sb.from('categories').insert([{name: name.toLowerCase()}]);
            if(!error) {
                showToast("Categoría creada");
                loadDataFromServer();
            }
        }
    };

    function populateCategoryFilterAdmin() {
        const sel = document.getElementById('filter-category');
        if(!sel) return;
        sel.innerHTML = '<option value="all">Todas las Categorías</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    }
    
    // Exportar
    window.exportData = (format) => {
        const data = products.map(p => ({
            ID: p.id, Titulo: p.title, Codigo: p.code, Categoria: p.category, 
            Precio: p.price, Stock: p.stock
        }));
        
        // Lógica simple CSV
        const header = Object.keys(data[0]).join(',');
        const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
        const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'productos.csv'; a.click();
    };

    // Inicializar Categoría nueva en select
    window.addNewCategory = async () => {
        const n = prompt("Nombre:");
        if(n) {
             await sb.from('categories').insert([{name:n.toLowerCase()}]);
             loadDataFromServer();
        }
    };

});
