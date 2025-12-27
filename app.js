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
    let categories = []; 
    let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
    let currentCategoryFilter = 'todos';
    let currentPage = 1;
    const itemsPerPage = 100;
    let map = null, marker = null, selectedCoordinates = null;

    // --- SELECTORES ---
    const views = { 
        login: document.getElementById('login-view'), 
        admin: document.getElementById('admin-view'), 
        store: document.getElementById('store-view') 
    };

    const searchInputDesk = document.getElementById('search-input');
    const searchInputMob = document.getElementById('mobile-search-input');

    // --- FUNCIONES DE NAVEGACIÓN VISUAL ---
    window.showView = (name) => {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if(views[name]) views[name].classList.remove('hidden');
        window.scrollTo(0,0);
    };

    // TOAST
    window.showToast = (msg) => {
        const t = document.getElementById('toast');
        if(!t) {
            const d = document.createElement('div'); d.id='toast'; d.className='toast-notification'; 
            document.body.appendChild(d);
            setTimeout(()=> { d.textContent = msg; d.classList.add('show'); }, 10);
            setTimeout(()=> d.classList.remove('show'), 3000);
        } else {
            t.textContent = msg; t.classList.add('show');
            setTimeout(()=>t.classList.remove('show'), 3000);
        }
    };

    // --- CALCULADORA DE PRECIOS ---
    function calculateFinalPrice(price, type, val) { 
        let f = parseFloat(price); 
        if(type==='percent' && val>0) f = price - (price*(val/100)); 
        else if(type==='fixed' && val>0) f = price - val; 
        return { original: parseFloat(price), final: Math.max(0, f), hasDiscount: f < price }; 
    }
    
    function formatPrice(val) {
        return parseFloat(val).toFixed(2);
    }

    // --- CARGA DE DATOS ---
    async function loadDataFromServer() {
        const [sess, cats, prods] = await Promise.all([
            sb.auth.getSession(), 
            sb.from('categories').select('*'), 
            sb.from('products').select('*').order('id', {ascending: false})
        ]);

        categories = cats.data || []; 
        products = prods.data || [];
        
        // Renderizar elementos de la tienda
        renderCategoryFilters(); 
        renderMobileCategories(); 
        renderProducts();
        
        // Lógica de sesión
        if (sess.data.session) { 
            showView('admin'); 
            // Iniciar Admin
            switchAdminTab('user');
            renderAdminProductTable(); 
            populateCategorySelect();
        } else { 
            showView('store'); 
        }
    }

    // =============================================
    //           LÓGICA TIENDA PÚBLICA
    // =============================================

    // Botón "Sobre Nosotros" (Escritorio)
    const aboutBtn = document.getElementById('about-us-btn');
    if(aboutBtn) {
        aboutBtn.onclick = () => {
            const footer = document.getElementById('footer-section');
            if(footer) footer.scrollIntoView({ behavior: 'smooth' });
        };
    }

    // Sidebar Móvil
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    const toggleSidebar = (show) => {
        if(show) { mobileSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
        else { mobileSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
    };
    if(mobileMenuBtn) mobileMenuBtn.onclick = () => toggleSidebar(true);
    if(closeSidebarBtn) closeSidebarBtn.onclick = () => toggleSidebar(false);
    if(sidebarOverlay) sidebarOverlay.onclick = () => toggleSidebar(false);
    
    document.getElementById('mobile-cats-toggle').onclick = () => {
        document.getElementById('mobile-cats-content').classList.toggle('show');
    };
    
    document.getElementById('mobile-about-link').onclick = (e) => {
        e.preventDefault();
        toggleSidebar(false);
        document.getElementById('footer-section').scrollIntoView({ behavior: 'smooth' });
    };

    document.getElementById('mobile-admin-link').onclick = () => {
        toggleSidebar(false);
        showView('login');
    };

    // Filtros Categoría (Tienda)
    function renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        
        const createBtn = (label, value) => {
            const btn = document.createElement('button');
            btn.className = `category-filter-btn ${currentCategoryFilter === value ? 'active' : ''}`;
            btn.textContent = label;
            btn.onclick = () => {
                currentCategoryFilter = value;
                currentPage = 1;
                if(searchInputDesk) searchInputDesk.value = '';
                if(searchInputMob) searchInputMob.value = '';
                renderCategoryFilters();
                renderMobileCategories();
                renderProducts();
            };
            container.appendChild(btn);
        };

        createBtn('Ver Todos', 'todos');
        createBtn('🔥 Ofertas', 'ofertas');
        categories.forEach(c => createBtn(c.name, c.name));
    }
    
    function renderMobileCategories() {
        const container = document.getElementById('mobile-cats-content');
        container.innerHTML = '';
        const createLink = (label, value) => {
            const btn = document.createElement('button');
            btn.className = 'sidebar-link';
            btn.innerHTML = currentCategoryFilter === value ? `<b>${label}</b>` : label;
            btn.onclick = () => {
                currentCategoryFilter = value;
                currentPage = 1;
                if(searchInputDesk) searchInputDesk.value = '';
                if(searchInputMob) searchInputMob.value = '';
                renderCategoryFilters(); // Actualizar botones arriba también
                renderMobileCategories();
                renderProducts();
                toggleSidebar(false);
            };
            container.appendChild(btn);
        };
        createLink('Ver Todos', 'todos');
        createLink('🔥 Ofertas', 'ofertas');
        categories.forEach(c => createLink(c.name, c.name));
    }

    // Renderizar Grid Productos
    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        
        // Obtener término de búsqueda (del input visible)
        const term = (searchInputDesk.value || searchInputMob.value).toLowerCase().trim();

        let filtered = products.filter(p => {
            // 1. Filtro Categoría
            if (currentCategoryFilter === 'ofertas') {
                if (!(p.discount_type && p.discount_value > 0)) return false;
            } else if (currentCategoryFilter !== 'todos' && p.category !== currentCategoryFilter) {
                return false;
            }
            
            // 2. Filtro Buscador
            if (term && !p.title.toLowerCase().includes(term) && !p.code.toLowerCase().includes(term)) {
                return false;
            }
            return true;
        });

        // Paginación
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = 1;
        const productsToShow = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if(productsToShow.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px;">No se encontraron productos.</p>';
            document.getElementById('pagination-controls').innerHTML = '';
            return;
        }

        productsToShow.forEach(p => {
            const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : '';
            
            // HTML del precio
            let priceHTML = '';
            if(pricing.hasDiscount) {
                priceHTML = `<span class="original-price">Bs.${formatPrice(p.price)}</span> <span class="final-price discounted">Bs.${formatPrice(pricing.final)}</span>`;
            } else {
                priceHTML = `<span class="final-price">Bs.${formatPrice(p.price)}</span>`;
            }

            const stockHtml = p.stock < 10 
                ? `<div class="stock-display low-stock">¡Solo ${p.stock} disponibles!</div>` 
                : `<div class="stock-display">${p.stock} Disponibles</div>`;

            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${imgUrl}" alt="${p.title}">
                    ${pricing.hasDiscount ? `<div class="discount-badge">-${p.discount_type==='percent'?p.discount_value+'%':p.discount_value+'Bs'}</div>` : ''}
                </div>
                <div class="product-info">
                    <div>
                        <div class="p-category">${p.category}</div>
                        <h3 class="product-title">${p.title}</h3>
                        <div class="p-prices">${priceHTML}</div>
                        ${stockHtml}
                    </div>
                    <button class="add-btn" onclick="addToCart('${p.id}', 1); event.stopPropagation();">Añadir al Carrito</button>
                </div>
            `;
            // Clic en toda la tarjeta abre detalle
            card.onclick = (e) => {
                if(!e.target.classList.contains('add-btn')) showProductDetail(p.id);
            };
            grid.appendChild(card);
        });

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const container = document.getElementById('pagination-controls');
        container.innerHTML = '';
        if(totalPages <= 1) return;

        for(let i=1; i<=totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => { currentPage = i; renderProducts(); window.scrollTo(0,0); };
            container.appendChild(btn);
        }
    }

    // Buscador
    const onSearch = (e) => {
        const val = e.target.value;
        if(searchInputDesk) searchInputDesk.value = val;
        if(searchInputMob) searchInputMob.value = val;
        currentPage = 1;
        renderProducts();
    };
    if(searchInputDesk) searchInputDesk.addEventListener('input', onSearch);
    if(searchInputMob) searchInputMob.addEventListener('input', onSearch);

    // =============================================
    //         CARRITO Y DETALLE PRODUCTO
    // =============================================

    window.addToCart = (id, q) => {
        q = parseInt(q) || 1;
        const p = products.find(x => x.id == id);
        if(!p || p.stock < 1) return showToast('Producto agotado');
        
        const existing = cart.find(i => i.id == id);
        if(existing) {
            if(existing.quantity + q > p.stock) return showToast('Stock insuficiente');
            existing.quantity += q;
        } else {
            if(q > p.stock) return showToast('Stock insuficiente');
            const pr = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            cart.push({ id: p.id, title: p.title, price: pr.final, quantity: q, stock: p.stock, image: (p.images && p.images[0]) || '' });
        }
        saveCart();
        showToast('Producto agregado');
    };

    function saveCart() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
        const count = document.getElementById('cart-count');
        if(count) count.textContent = cart.reduce((a,b)=>a+b.quantity,0);
    }
    saveCart();

    // Modal Detalle
    window.showProductDetail = (id) => {
        const p = products.find(x => x.id == id);
        if(!p) return;
        const modal = document.getElementById('product-detail-modal');
        const content = document.getElementById('product-detail-content');
        
        const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
        
        let thumbnails = '';
        if(p.images && p.images.length > 0) {
            p.images.forEach((img, idx) => {
                thumbnails += `<img src="${img}" class="gallery-thumbnail ${idx===0?'active':''}" onclick="document.getElementById('gallery-main-image').src='${img}'; document.querySelectorAll('.gallery-thumbnail').forEach(t=>t.classList.remove('active')); this.classList.add('active');">`;
            });
        }

        content.innerHTML = `
            <div id="product-detail-gallery">
                <img src="${(p.images && p.images[0]) || ''}" id="gallery-main-image">
                <div id="gallery-thumbnails">${thumbnails}</div>
            </div>
            <div id="product-detail-info">
                <button class="close-modal" onclick="document.getElementById('product-detail-modal').classList.add('hidden')" style="position:absolute; top:0; right:0;">×</button>
                <h2>${p.title}</h2>
                <p style="color:#666; font-size:0.9rem;">Cód: ${p.code}</p>
                <div style="margin: 15px 0;">
                    ${pricing.hasDiscount ? 
                        `<span class="original-price">Bs. ${formatPrice(p.price)}</span><br><span class="final-price discounted">Bs. ${formatPrice(pricing.final)}</span>` 
                        : `<span class="final-price">Bs. ${formatPrice(p.price)}</span>`}
                </div>
                <p style="margin-bottom:10px;"><b>Stock:</b> ${p.stock > 0 ? p.stock : '<span style="color:red">Agotado</span>'}</p>
                <p style="white-space: pre-wrap; font-size: 0.95rem; line-height:1.5;">${p.description || 'Sin descripción.'}</p>
                
                <div class="detail-actions">
                    <button class="primary-btn" onclick="addToCart('${p.id}', 1); document.getElementById('product-detail-modal').classList.add('hidden')" style="width:100%;">Añadir al Carrito</button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    };

    // Modal Carrito
    document.getElementById('cart-btn').onclick = () => {
        const modal = document.getElementById('cart-modal');
        const list = document.getElementById('cart-items');
        list.innerHTML = '';
        let total = 0;

        if(cart.length === 0) {
            list.innerHTML = '<p style="text-align:center;">El carrito está vacío.</p>';
        } else {
            cart.forEach((i, idx) => {
                total += i.price * i.quantity;
                list.innerHTML += `
                    <div class="cart-item">
                        <img src="${i.image}" class="cart-item-img">
                        <div class="cart-item-info">
                            <div class="cart-item-title">${i.title}</div>
                            <div class="cart-item-price">Bs.${formatPrice(i.price)}</div>
                        </div>
                        <div class="cart-qty-selector">
                            <button class="cart-qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                            <div class="cart-qty-value">${i.quantity}</div>
                            <button class="cart-qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                        </div>
                        <button class="cart-remove-btn" onclick="removeFromCart(${idx})"><i class="fas fa-trash"></i></button>
                    </div>
                `;
            });
        }
        
        document.getElementById('cart-total').textContent = formatPrice(total);
        const checkoutBtn = document.getElementById('checkout-btn');
        checkoutBtn.disabled = cart.length === 0;
        
        checkoutBtn.onclick = () => {
            modal.classList.add('hidden');
            document.getElementById('checkout-modal').classList.remove('hidden');
        };

        modal.classList.remove('hidden');
    };

    window.updateCartQty = (idx, delta) => {
        cart[idx].quantity += delta;
        if(cart[idx].quantity < 1) cart[idx].quantity = 1;
        if(cart[idx].quantity > cart[idx].stock) {
            cart[idx].quantity = cart[idx].stock;
            showToast('Máximo stock alcanzado');
        }
        saveCart(); document.getElementById('cart-btn').click(); // Refrescar modal
    };
    
    window.removeFromCart = (idx) => {
        cart.splice(idx, 1);
        saveCart(); document.getElementById('cart-btn').click();
    };

    // Checkout Modal
    document.getElementById('close-cart-modal').onclick = () => document.getElementById('cart-modal').classList.add('hidden');
    document.getElementById('close-checkout-modal').onclick = () => document.getElementById('checkout-modal').classList.add('hidden');

    // MAPA
    function initMap() {
        if(map) map.remove();
        const lat = -17.7833, lng = -63.1821;
        map = L.map('delivery-map').setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        marker = L.marker([lat, lng], {draggable:true}).addTo(map);
        
        marker.on('dragend', (e) => selectedCoordinates = e.target.getLatLng());
        map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            selectedCoordinates = e.latlng;
        });
        selectedCoordinates = {lat, lng};
        setTimeout(()=> map.invalidateSize(), 300);
    }

    document.getElementById('btn-yes-location').onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('location-status').textContent = 'Obteniendo GPS...';
        navigator.geolocation.getCurrentPosition((pos) => {
            selectedCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            document.getElementById('location-status').textContent = '✅ GPS Obtenido';
            document.getElementById('checkout-submit-btn').classList.remove('hidden');
        }, () => {
            alert('No se pudo obtener GPS, usa el mapa.');
            document.getElementById('btn-no-location').click();
        });
    };

    document.getElementById('btn-no-location').onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    };

    document.getElementById('confirm-map-location').onclick = () => {
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = '✅ Ubicación Mapa Confirmada';
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };

    document.getElementById('checkout-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const locLink = selectedCoordinates ? `https://www.google.com/maps?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` : 'Sin ubicación';
        
        let msg = `*NUEVO PEDIDO SIRARI* 🛍️\n\n*Cliente:* ${name}\n*Ref:* ${ref}\n*Ubicación:* ${locLink}\n\n*PRODUCTOS:*`;
        let total = 0;
        cart.forEach(i => {
            total += i.price * i.quantity;
            msg += `\n- ${i.title} (${i.quantity}) = Bs.${formatPrice(i.price * i.quantity)}`;
        });
        msg += `\n\n*TOTAL: Bs. ${formatPrice(total)}*`;

        window.open(`https://api.whatsapp.com/send?phone=59173164833&text=${encodeURIComponent(msg)}`, '_blank');
        cart = []; saveCart(); 
        window.location.reload();
    };


    // =============================================
    //           LÓGICA ADMIN (NUEVA)
    // =============================================
    
    // Login
    document.getElementById('admin-login-btn').onclick = () => showView('login');
    document.getElementById('go-to-store-btn').onclick = () => showView('store');
    
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if(error) {
            document.getElementById('login-error').textContent = 'Credenciales Incorrectas';
        } else {
            showView('admin');
            switchAdminTab('user');
            loadDataFromServer();
        }
    };
    
    document.getElementById('logout-btn').onclick = async () => {
        await sb.auth.signOut();
        showView('store');
    };

    // Navegación Tabs Admin
    window.switchAdminTab = (tabName) => {
        ['user', 'add', 'list', 'placeholder'].forEach(t => {
             const el = document.getElementById(`tab-${t}`);
             if(el) el.classList.add('hidden');
        });

        if(['sales', 'buyers', 'analytics', 'notifications', 'settings'].includes(tabName)){
            document.getElementById('tab-placeholder').classList.remove('hidden');
        } else {
            document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        }

        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        if(event && event.currentTarget) event.currentTarget.classList.add('active');

        if(tabName === 'list') {
            renderAdminProductTable();
            populateCategoryFilterAdmin();
        }
        if(tabName === 'add') {
             populateCategorySelect();
        }
    };

    // Guardar Producto
    document.getElementById('product-form').onsubmit = async (e) => {
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
        
        const images = [];
        document.querySelectorAll('.image-input').forEach(i => { if(i.value) images.push(i.value); });

        const data = { title, code, category, price, stock, description: desc, images, discount_type: discountType, discount_value: discount };
        
        let error;
        if(id) {
            const res = await sb.from('products').update(data).eq('id', id);
            error = res.error;
        } else {
            const res = await sb.from('products').insert([data]);
            error = res.error;
        }

        if(error) showToast("Error: " + error.message);
        else { showToast("Guardado con éxito"); clearForm(); loadDataFromServer(); }
    };

    // Buscar para editar
    window.searchProductToEdit = () => {
        const code = document.getElementById('search-code-edit').value.trim();
        const p = products.find(x => x.code === code);
        if(p) { loadProductForEdit(p); showToast("Producto cargado"); }
        else showToast("No encontrado");
    };

    function loadProductForEdit(p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-code').value = p.code;
        populateCategorySelect();
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-discount').value = p.discount_value || '';
        document.getElementById('p-discount-type').value = p.discount_type || 'percent';
        document.getElementById('p-desc').value = p.description || '';
        
        const container = document.getElementById('image-url-container');
        container.innerHTML = '';
        if(p.images) p.images.forEach(url => addImageInput(url));
        if(!p.images || p.images.length===0) addImageInput();
    }

    window.addImageInput = (val = '') => {
        const d = document.createElement('div');
        d.innerHTML = `<input type="url" class="image-input" value="${val}" placeholder="URL imagen" style="width:90%; margin-bottom:5px;">`;
        document.getElementById('image-url-container').appendChild(d);
    };

    window.clearForm = () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('image-url-container').innerHTML = '';
        addImageInput();
    };

    window.renderAdminProductTable = () => {
        const tbody = document.getElementById('admin-product-table-body');
        if(!tbody) return;
        tbody.innerHTML = '';
        
        const catFilter = document.getElementById('filter-category').value;
        const stockFilter = document.getElementById('filter-stock').value;

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
            tbody.innerHTML += `
                <tr>
                    <td><input type="radio" name="prod-select" value="${p.id}"></td>
                    <td>${index+1}</td>
                    <td>${p.title}</td>
                    <td>${p.code}</td>
                    <td>${p.category}</td>
                    <td>${p.price}</td>
                    <td>${p.discount_value ? p.discount_value : '-'}</td>
                    <td>${formatPrice(pricing.final)}</td>
                    <td>${p.stock}</td>
                </tr>
            `;
        });
    };
    
    window.editSelectedProduct = () => {
        const sel = document.querySelector('input[name="prod-select"]:checked');
        if(sel) {
            const p = products.find(x => x.id == sel.value);
            switchAdminTab('add');
            loadProductForEdit(p);
        } else showToast("Selecciona un producto");
    };

    // Funciones auxiliares Admin
    function populateCategorySelect() {
        const sel = document.getElementById('p-category');
        if(!sel) return;
        sel.innerHTML = '';
        categories.forEach(c => sel.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        sel.innerHTML += `<option value="new">+ Nueva...</option>`;
        sel.onchange = async () => {
            if(sel.value === 'new') {
                const n = prompt("Nombre categoría:");
                if(n) { await sb.from('categories').insert([{name: n.toLowerCase()}]); loadDataFromServer(); }
            }
        };
    }

    function populateCategoryFilterAdmin() {
        const sel = document.getElementById('filter-category');
        if(!sel) return;
        sel.innerHTML = '<option value="all">Todas</option>';
        categories.forEach(c => sel.innerHTML += `<option value="${c.name}">${c.name}</option>`);
    }

    // Inicializar
    loadDataFromServer();
});
