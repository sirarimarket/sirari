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
    
    // --- SELECTORES PRINCIPALES ---
    const views = { login: document.getElementById('login-view'), admin: document.getElementById('admin-view'), store: document.getElementById('store-view') };
    
    // Inputs de búsqueda
    const searchInputDesk = document.getElementById('search-input');
    const searchInputMob = document.getElementById('mobile-search-input');
    
    // Elementos Menú Móvil
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileCatsToggle = document.getElementById('mobile-cats-toggle');
    const mobileCatsContent = document.getElementById('mobile-cats-content');
    const mobileAboutLink = document.getElementById('mobile-about-link');
    const desktopAboutBtn = document.getElementById('about-us-btn');

    // Admin & Forms (Igual que antes)
    const loginForm = document.getElementById('login-form');
    const addProductForm = document.getElementById('add-product-form');
    const categoryForm = document.getElementById('category-form');
    const urlInputsContainer = document.getElementById('url-inputs-container');
    const addUrlBtn = document.getElementById('add-url-btn');

    // Checkout
    const checkoutForm = document.getElementById('checkout-form');
    let map = null, marker = null, selectedCoordinates = null;

    // --- TOAST NOTIFICATION ---
    if (!document.getElementById('toast-notification')) {
        const d = document.createElement('div'); d.id='toast-notification'; d.className='toast-notification'; document.body.appendChild(d);
    }
    window.showToast = (msg, type='success') => {
        const t = document.getElementById('toast-notification'); t.textContent=msg; t.className=`toast-notification show toast-${type}`;
        setTimeout(()=>t.classList.remove('show'), 3000);
    };

    // --- UTILS DE PRECIO ---
    function formatPriceHTML(p) {
        const ps = parseFloat(p).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}).split(',');
        return ps.length===2 ? `${ps[0]}<span class="decimal-small">,${ps[1]}</span>` : ps[0];
    }
    function calculateFinalPrice(p, type, val) {
        let f = parseFloat(p);
        if(type==='percent' && val>0) f = p - (p*(val/100));
        else if(type==='fixed' && val>0) f = p - val;
        return { original: parseFloat(p), final: Math.max(0, f), hasDiscount: f < p };
    }

    // --- NAVEGACIÓN Y MENU MÓVIL ---
    function showView(name) { Object.values(views).forEach(v => v.classList.add('hidden')); views[name].classList.remove('hidden'); }
    
    // Abrir/Cerrar Sidebar
    const toggleSidebar = (show) => {
        if(show) { mobileSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
        else { mobileSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
    };
    mobileMenuBtn.onclick = () => toggleSidebar(true);
    closeSidebarBtn.onclick = () => toggleSidebar(false);
    sidebarOverlay.onclick = () => toggleSidebar(false);
    
    // Acordeón Categorías Móvil
    mobileCatsToggle.onclick = () => mobileCatsContent.classList.toggle('show');

    // Scroll a Sobre Nosotros (Footer)
    const scrollToFooter = () => {
        document.getElementById('footer-section').scrollIntoView({behavior: 'smooth'});
        toggleSidebar(false);
    };
    desktopAboutBtn.onclick = scrollToFooter;
    mobileAboutLink.onclick = (e) => { e.preventDefault(); scrollToFooter(); };

    // Login logic
    document.getElementById('admin-login-btn').onclick = () => showView('login');
    document.getElementById('go-to-store-btn').onclick = () => showView('store');
    document.getElementById('admin-logout-btn').onclick = async () => { await sb.auth.signOut(); showView('login'); };
    
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({
            email: document.getElementById('username').value,
            password: document.getElementById('password').value
        });
        if(error) document.getElementById('login-error').textContent = 'Error credenciales';
        else { showView('admin'); loadDataFromServer(); }
    };

    // --- LÓGICA DE BÚSQUEDA Y FILTRADO ---
    // Sincronizar inputs de búsqueda escritorio y móvil
    const handleSearch = (e) => {
        const val = e.target.value;
        if(searchInputDesk.value !== val) searchInputDesk.value = val;
        if(searchInputMob.value !== val) searchInputMob.value = val;
        currentPage = 1; // Reset pagina al buscar
        renderProducts();
    };
    searchInputDesk.addEventListener('input', handleSearch);
    searchInputMob.addEventListener('input', handleSearch);

    // --- RENDERIZADO DE PRODUCTOS (CON PAGINACIÓN Y FILTROS) ---
    function renderProducts() {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        
        // 1. Filtrar
        const term = searchInputDesk.value.toLowerCase().trim();
        let filtered = products.filter(p => {
            // Filtro Categoría
            if (currentCategoryFilter === 'ofertas') {
                if (!(p.discount_type && p.discount_value > 0)) return false;
            } else if (currentCategoryFilter !== 'todos' && p.category !== currentCategoryFilter) {
                return false;
            }
            // Filtro Buscador (Nombre o Código)
            if (term && !p.title.toLowerCase().includes(term) && !p.code.toLowerCase().includes(term)) {
                return false;
            }
            return true;
        });

        // 2. Paginación Logica
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Ajustar página si nos pasamos
        if (currentPage > totalPages) currentPage = totalPages || 1;

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const productsToShow = filtered.slice(start, end);

        if (productsToShow.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No se encontraron productos.</p>';
            renderPagination(0);
            return;
        }

        // 3. Renderizar Tarjetas
        productsToShow.forEach(p => {
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

        // 4. Renderizar Controles Paginación
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const container = document.getElementById('pagination-controls');
        container.innerHTML = '';
        if (totalPages <= 1) return;

        // Botón Anterior
        const prevBtn = document.createElement('button');
        prevBtn.innerText = '←';
        prevBtn.className = 'page-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { currentPage--; renderProducts(); window.scrollTo({top:0, behavior:'smooth'}); };
        container.appendChild(prevBtn);

        // Números
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.onclick = () => { currentPage = i; renderProducts(); window.scrollTo({top:0, behavior:'smooth'}); };
            container.appendChild(btn);
        }

        // Botón Siguiente
        const nextBtn = document.createElement('button');
        nextBtn.innerText = '→';
        nextBtn.className = 'page-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => { currentPage++; renderProducts(); window.scrollTo({top:0, behavior:'smooth'}); };
        container.appendChild(nextBtn);
    }

    // --- DETALLE PRODUCTO & COMPARTIR ---
    let currentDetailQty = 1;
    window.getDetailQtyValue = () => parseInt(document.getElementById('detail-qty-input')?.value || 1);

    window.showProductDetail = (id) => {
        const p = products.find(x => x.id == id);
        if(!p) return;
        currentDetailQty = 1;

        let thumbs = '';
        if(p.images) p.images.forEach((url, i) => thumbs += `<img src="${url}" class="gallery-thumbnail ${i===0?'active':''}" onclick="document.getElementById('gallery-main-image').src='${url}'; document.querySelectorAll('.gallery-thumbnail').forEach(t=>t.classList.remove('active')); this.classList.add('active');">`);
        
        const mainImg = p.images?.[0] || '';
        const pricing = calculateFinalPrice(p.price, p.discount_type, p.discount_value);
        const maxStock = p.stock > 0 ? p.stock : 1;

        // GENERAR LINKS DE COMPARTIR (Deep Linking)
        const shareUrl = `${window.location.origin}${window.location.pathname}?p=${p.id}`;
        const shareText = `Mira este producto en SIRARI: ${p.title} - Bs. ${pricing.final.toFixed(2)}`;
        
        const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

        document.getElementById('product-detail-content').innerHTML = `
            <button class="close-modal" onclick="document.getElementById('product-detail-modal').classList.add('hidden')">×</button>
            <div id="product-detail-gallery">
                <img src="${mainImg}" id="gallery-main-image">
                <div id="gallery-thumbnails">${thumbs}</div>
            </div>
            <div id="product-detail-info">
                <h2 style="font-size:1.6rem;">${p.title}</h2>
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

                <div class="share-section">
                    <p class="share-title">Compartir producto:</p>
                    <div class="share-buttons">
                        <a href="${waLink}" target="_blank" class="share-btn wa" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
                        <a href="${fbLink}" target="_blank" class="share-btn fb" title="Facebook"><i class="fab fa-facebook-f"></i></a>
                        <button class="share-btn copy" title="Copiar Enlace" onclick="copyToClipboard('${shareUrl}')"><i class="fas fa-link"></i></button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('product-detail-modal').classList.remove('hidden');
    };

    window.updateDetailQty = (change, max) => {
        let n = currentDetailQty + change;
        if(n<1) n=1; if(n>max) n=max;
        currentDetailQty = n;
        document.getElementById('detail-qty-input').value = n;
    };
    
    window.copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => showToast("Enlace copiado")).catch(() => alert("Copia esto: " + text));
    };

    // --- CARGA INICIAL Y DEEP LINKING ---
    async function loadDataFromServer() {
        const [sess, cats, prods] = await Promise.all([
            sb.auth.getSession(),
            sb.from('categories').select('*'),
            sb.from('products').select('*').order('id', {ascending: false})
        ]);
        categories = cats.data || [];
        products = prods.data || [];

        renderCategoryFilters(); // Escritorio
        renderMobileCategories(); // Móvil
        renderProducts();
        
        // DEEP LINK CHECK: ¿Hay un ID de producto en la URL?
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('p');
        if (productId) {
            showProductDetail(productId);
            // Limpiar URL para que al recargar no se abra de nuevo
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (sess.data.session) {
            showView('admin');
            renderCategoryList();
            renderAdminList();
            fillCategorySelect();
        } else {
            showView('store');
        }
    }

    // Renderizar Filtros (Escritorio y Móvil comparten lógica de selección)
    function renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        const addBtn = (t,v) => {
            const b = document.createElement('button');
            b.className = `category-filter-btn ${currentCategoryFilter===v?'active':''}`;
            b.textContent=t; 
            b.onclick=()=>{
                currentCategoryFilter=v; 
                currentPage = 1; 
                renderCategoryFilters(); 
                renderMobileCategories(); // Actualizar también menú móvil
                renderProducts();
            };
            container.appendChild(b);
        };
        addBtn('Ver Todos','todos');
        if(products.some(p => (p.discount_type && p.discount_value > 0))) addBtn('🔥 Ofertas','ofertas');
        categories.forEach(c => addBtn(c.name, c.name));
        if(!categories.find(c=>c.name==='otros')) addBtn('otros','otros');
    }

    // Renderizar Categorías en Menú Hamburguesa
    function renderMobileCategories() {
        mobileCatsContent.innerHTML = '';
        const addLink = (t,v) => {
            const a = document.createElement('button'); // Usamos button para estilo link
            a.className = 'sidebar-link';
            a.style.textAlign = 'left';
            a.innerHTML = (currentCategoryFilter === v ? '<b>' + t + '</b>' : t);
            a.onclick = () => {
                currentCategoryFilter = v;
                currentPage = 1;
                renderCategoryFilters();
                renderMobileCategories();
                renderProducts();
                toggleSidebar(false); // Cerrar menú al seleccionar
            };
            mobileCatsContent.appendChild(a);
        };
        addLink('Ver Todos', 'todos');
        if(products.some(p => (p.discount_type && p.discount_value > 0))) addLink('🔥 Ofertas','ofertas');
        categories.forEach(c => addLink(c.name, c.name));
        if(!categories.find(c=>c.name==='otros')) addLink('otros','otros');
    }

    // --- CARRITO (Sin cambios grandes, solo asegurarse de que esté presente) ---
    window.addToCart = (id, qty) => {
        qty = parseInt(qty)||1; const p=products.find(x=>x.id==id); if(!p||p.stock<1)return showToast("Agotado","error");
        const ex=cart.find(i=>i.id==id);
        if(ex){ if(ex.quantity+qty>p.stock)return showToast("Stock insuficiente","error"); ex.quantity+=qty;}
        else { 
            if(qty>p.stock)return showToast("Stock insuficiente","error");
            const pr=calculateFinalPrice(p.price, p.discount_type, p.discount_value);
            cart.push({id:p.id, title:p.title, price:pr.final, image:p.images?.[0]||'', quantity:qty, maxStock:p.stock});
        }
        saveCart(); showToast("Producto añadido");
    };
    window.changeCartQty = (i, d) => { const it=cart[i]; const n=it.quantity+d; if(n<1||n>it.maxStock)return; it.quantity=n; saveCart(); renderCartHTML(); };
    window.removeFromCart = (i) => { cart.splice(i,1); saveCart(); renderCartHTML(); showToast("Eliminado"); };
    
    function renderCartHTML() {
        const l=document.getElementById('cart-items'); l.innerHTML=''; let tot=0;
        if(!cart.length) l.innerHTML='<p style="text-align:center">Vacío</p>';
        cart.forEach((i,x)=>{ tot+=i.price*i.quantity; l.innerHTML+=`<div class="cart-item"><img src="${i.image}" class="cart-item-img"><div class="cart-item-info"><div class="cart-item-title">${i.title}</div><div>Bs.${i.price.toFixed(2)}</div></div><div class="cart-qty-selector"><button class="cart-qty-btn" onclick="changeCartQty(${x},-1)">-</button><div class="cart-qty-value">${i.quantity}</div><button class="cart-qty-btn" onclick="changeCartQty(${x},1)">+</button></div><button class="cart-remove-btn" onclick="removeFromCart(${x})"><i class="fas fa-trash"></i></button></div>`; });
        document.getElementById('cart-total').textContent=tot.toFixed(2); document.getElementById('checkout-btn').disabled=!cart.length;
    }
    document.getElementById('cart-btn').onclick=()=>{renderCartHTML(); document.getElementById('cart-modal').classList.remove('hidden');};
    function saveCart() { localStorage.setItem('sirari_cart', JSON.stringify(cart)); document.getElementById('cart-count').textContent=cart.reduce((a,b)=>a+b.quantity,0); }
    
    // --- ADMIN HELPERS (URLS, EDIT, DELETE) ---
    function addUrlInput(v=''){ const w=document.createElement('div'); w.className='url-input-wrapper'; const i=document.createElement('input'); i.value=v; const b=document.createElement('button'); b.textContent='X'; b.className='remove-url-btn'; b.onclick=()=>w.remove(); w.append(i,b); urlInputsContainer.append(w); }
    addUrlBtn.onclick=()=>addUrlInput();
    
    addProductForm.onsubmit=async(e)=>{ e.preventDefault();
        const imgs=[...urlInputsContainer.querySelectorAll('input')].map(i=>i.value.trim()).filter(x=>x);
        const data={ 
            title:document.getElementById('product-title').value, description:document.getElementById('product-desc').value,
            price:parseFloat(document.getElementById('product-price').value), stock:parseInt(productStock.value),
            category:document.getElementById('product-category').value, images:imgs,
            discount_type:discountType.value||null, discount_value:parseFloat(discountValue.value)||0
        };
        const eid=document.getElementById('product-edit-id').value;
        const {error} = eid ? await sb.from('products').update(data).eq('id',eid) : await sb.from('products').insert([{...data, code:'SIRARI-'+Math.random().toString(36).substr(2,6).toUpperCase()}]);
        if(error) alert(error.message); else { showToast("Guardado"); loadDataFromServer(); resetAdminForm(); }
    };
    function resetAdminForm(){ addProductForm.reset(); urlInputsContainer.innerHTML=''; addUrlInput(); document.getElementById('product-edit-id').value=''; document.getElementById('cancel-edit-btn').classList.add('hidden'); }
    
    // Admin Actions
    window.deleteProduct=async(id)=>{if(confirm('¿Borrar?')){await sb.from('products').delete().eq('id',id); loadDataFromServer();}};
    window.editProduct=(id)=>{
        const p=products.find(x=>x.id==id); document.getElementById('product-edit-id').value=p.id;
        document.getElementById('product-title').value=p.title; document.getElementById('product-desc').value=p.description;
        document.getElementById('product-price').value=p.price; document.getElementById('product-stock').value=p.stock;
        document.getElementById('product-category').value=p.category; discountType.value=p.discount_type||""; discountValue.value=p.discount_value||"";
        urlInputsContainer.innerHTML=''; (p.images||[]).forEach(u=>addUrlInput(u)); if(!p.images?.length)addUrlInput();
        document.getElementById('cancel-edit-btn').classList.remove('hidden'); window.scrollTo(0,0);
    };
    function renderAdminList() { const l=document.getElementById('admin-product-list'); l.innerHTML=''; products.forEach(p=>l.innerHTML+=`<div class="admin-product-item"><img src="${p.images?.[0]||''}"><div><h4>${p.title}</h4></div><button class="action-btn edit-btn" onclick="editProduct('${p.id}')">Edit</button><button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')">X</button></div>`); }
    function fillCategorySelect() { const s=document.getElementById('product-category'); s.innerHTML=''; const c=[...categories]; if(!c.find(x=>x.name==='otros'))c.push({name:'otros'}); c.forEach(x=>s.innerHTML+=`<option value="${x.name}">${x.name}</option>`); }

    // Init Logic
    document.querySelectorAll('.close-modal').forEach(b=>b.onclick=(e)=>e.target.closest('.modal').classList.add('hidden'));
    
    // Checkout (Mapa)
    function initMap() { const dLat=-17.7833, dLng=-63.1821; if(map)map.remove(); map=L.map('delivery-map').setView([dLat,dLng],13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); marker=L.marker([dLat,dLng],{draggable:true}).addTo(map); marker.on('dragend',e=>selectedCoordinates=marker.getLatLng()); map.on('click',e=>{marker.setLatLng(e.latlng);selectedCoordinates=e.latlng;}); setTimeout(()=>map.invalidateSize(),200); }
    document.getElementById('btn-no-location').onclick=()=>{ document.getElementById('location-question-step').classList.add('hidden'); document.getElementById('map-container-wrapper').classList.remove('hidden'); initMap(); };
    // (Resto de la lógica de checkout/maps es igual a la versión anterior, asegurate de tenerla)
    document.getElementById('checkout-btn').onclick=()=>{document.getElementById('cart-modal').classList.add('hidden'); document.getElementById('checkout-modal').classList.remove('hidden');};
    
    loadDataFromServer();
});
