// =============================================
//         ¡CONFIGURACIÓN DE SUPABASE!
// =============================================
const SUPABASE_URL = 'https://lflwrzeqfdtgowoqdhpq.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHdyemVxZmR0Z293b3FkaHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMzYyODAsImV4cCI6MjA3ODkxMjI4MH0.LLUahTSOvWcc-heoq_DsvXvVbvyjT24dm0E4SqKahOA'; 

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABLES GLOBALES
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('sirari_cart')) || [];
let currentCategoryFilter = 'todos';
let currentSearchTerm = '';
let adminSelectedId = null; // Para el checkbox del admin

document.addEventListener('DOMContentLoaded', () => {
    
    // Referencias DOM principales
    const views = {
        login: document.getElementById('login-view'),
        admin: document.getElementById('admin-view'),
        store: document.getElementById('store-view')
    };

    // --- CARGAR DATOS INICIALES ---
    loadProducts();
    updateCartUI();

    // =============================================
    //            LÓGICA TIENDA (CLIENTE)
    // =============================================

    async function loadProducts() {
        // Cargar Categorías
        let { data: catData, error: catError } = await sb.from('categories').select('*');
        if (!catError) {
            categories = catData;
            renderCategories();
        }

        // Cargar Productos
        let { data: prodData, error: prodError } = await sb.from('products').select('*');
        if (!prodError) {
            products = prodData;
            renderStore();
            // Si estamos en admin, actualizar tabla también
            if (!views.admin.classList.contains('hidden')) renderAdminTable();
        }
    }

    // Renderizar Categorías en Header y Sidebar
    function renderCategories() {
        const container = document.getElementById('categories-container');
        const sidebarList = document.getElementById('sidebar-categories');
        
        // Header
        let html = `<button class="cat-btn active" data-cat="todos">Todos</button>`;
        categories.forEach(c => {
            html += `<button class="cat-btn" data-cat="${c.name}">${c.name}</button>`;
        });
        container.innerHTML = html;

        // Sidebar
        let sidebarHtml = `<li onclick="applySidebarCategory('todos')">Todos</li>`;
        categories.forEach(c => {
            sidebarHtml += `<li onclick="applySidebarCategory('${c.name}')">${c.name}</li>`;
        });
        sidebarList.innerHTML = sidebarHtml;

        // Eventos Header
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // RESETEO DE BÚSQUEDA AL CAMBIAR CATEGORÍA
                currentCategoryFilter = btn.dataset.cat;
                currentSearchTerm = ''; 
                document.getElementById('search-input').value = '';
                
                renderStore();
            });
        });
    }

    // Renderizar Grid de Productos
    function renderStore() {
        const container = document.getElementById('products-container');
        container.innerHTML = '';

        const filtered = products.filter(p => {
            const matchCat = currentCategoryFilter === 'todos' || p.category === currentCategoryFilter;
            const matchSearch = p.title.toLowerCase().includes(currentSearchTerm.toLowerCase());
            return matchCat && matchSearch;
        });

        filtered.forEach(p => {
            // Calcular precio con descuento
            const discount = p.discount_value || 0;
            const finalPrice = discount > 0 ? (p.price * (1 - discount/100)) : p.price;
            
            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
                <img src="${p.image_url || 'https://via.placeholder.com/150'}" class="product-img" alt="${p.title}">
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <div class="product-price-row">
                        ${discount > 0 ? `<span class="old-price">Bs.${p.price}</span>` : ''}
                        <span class="new-price">Bs.${finalPrice.toFixed(2)}</span>
                    </div>
                    <button class="add-btn" onclick="addToCart(${p.id})">Agregar</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // Buscador Principal
    document.getElementById('search-btn').addEventListener('click', () => {
        currentSearchTerm = document.getElementById('search-input').value;
        renderStore();
    });
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if(e.key === 'Enter') {
            currentSearchTerm = e.target.value;
            renderStore();
        }
    });

    // Menú Hamburguesa & Buscador Móvil
    document.getElementById('menu-toggle').onclick = () => {
        document.getElementById('sidebar').classList.add('show');
        document.getElementById('sidebar-overlay').classList.add('show');
    };
    const closeSidebar = () => {
        document.getElementById('sidebar').classList.remove('show');
        document.getElementById('sidebar-overlay').classList.remove('show');
    };
    document.getElementById('close-sidebar').onclick = closeSidebar;
    document.getElementById('sidebar-overlay').onclick = closeSidebar;

    document.getElementById('sidebar-search-input').addEventListener('keyup', (e) => {
        if(e.key === 'Enter') {
            currentSearchTerm = e.target.value;
            currentCategoryFilter = 'todos'; // Reset cat
            renderStore();
            closeSidebar();
        }
    });
    
    window.applySidebarCategory = (cat) => {
        currentCategoryFilter = cat;
        currentSearchTerm = ''; // Reset búsqueda
        document.getElementById('search-input').value = '';
        renderStore();
        closeSidebar();
    };

    // --- CARRITO ---
    window.toggleCart = () => {
        document.getElementById('cart-modal').classList.toggle('hidden');
    };
    
    window.addToCart = (id) => {
        const prod = products.find(p => p.id === id);
        const existing = cart.find(c => c.id === id);
        
        // Calcular precio real (con descuento si aplica)
        const discount = prod.discount_value || 0;
        const realPrice = discount > 0 ? (prod.price * (1 - discount/100)) : prod.price;

        if (existing) {
            existing.quantity++;
        } else {
            cart.push({ ...prod, price: realPrice, quantity: 1, originalPrice: prod.price });
        }
        updateCartUI();
        showToast();
    };

    window.updateCartItem = (id, change) => {
        const item = cart.find(c => c.id === id);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) cart = cart.filter(c => c.id !== id);
            updateCartUI();
        }
    };

    window.removeFromCart = (id) => {
        cart = cart.filter(c => c.id !== id);
        updateCartUI();
    };

    function updateCartUI() {
        localStorage.setItem('sirari_cart', JSON.stringify(cart));
        document.getElementById('cart-count').innerText = cart.reduce((acc, c) => acc + c.quantity, 0);
        
        const container = document.getElementById('cart-items');
        container.innerHTML = '';
        let total = 0;

        cart.forEach(c => {
            total += c.price * c.quantity;
            container.innerHTML += `
                <div class="cart-item">
                    <div class="item-details">
                        <h4>${c.title}</h4>
                        <p>Bs. ${(c.price * c.quantity).toFixed(2)}</p>
                    </div>
                    <div class="qty-selector">
                        <button class="cart-qty-btn" onclick="updateCartItem(${c.id}, -1)">-</button>
                        <span class="cart-qty-value">${c.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartItem(${c.id}, 1)">+</button>
                    </div>
                    <button class="cart-remove-btn" onclick="removeFromCart(${c.id})">&times;</button>
                </div>
            `;
        });
        document.getElementById('cart-total-price').innerText = total.toFixed(2);
    }

    function showToast() {
        const t = document.getElementById('toast');
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }

    // --- CHECKOUT & MAPA ---
    document.getElementById('checkout-btn').onclick = () => {
        if (cart.length === 0) return alert("El carrito está vacío");
        document.getElementById('cart-modal').classList.add('hidden');
        document.getElementById('checkout-modal').classList.remove('hidden');
    };
    window.closeCheckout = () => document.getElementById('checkout-modal').classList.add('hidden');

    // Lógica Mapa (Simplificada)
    let map, marker, selectedCoordinates = null;
    function initMap() {
        if(!map) {
            map = L.map('delivery-map').setView([-17.7833, -63.1821], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            map.on('click', (e) => {
                if(marker) map.removeLayer(marker);
                marker = L.marker(e.latlng).addTo(map);
                selectedCoordinates = e.latlng;
            });
        }
    }
    
    document.getElementById('btn-yes-location').onclick = () => {
        document.getElementById('location-status').textContent = "✅ Ubicación confirmada (Texto)";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
        document.getElementById('location-question-step').classList.add('hidden');
    };
    document.getElementById('btn-no-location').onclick = () => {
        document.getElementById('location-question-step').classList.add('hidden');
        document.getElementById('map-container-wrapper').classList.remove('hidden');
        initMap();
    };
    document.getElementById('confirm-map-location').onclick = () => {
        if(!selectedCoordinates) return alert("Marca un punto en el mapa");
        document.getElementById('map-container-wrapper').classList.add('hidden');
        document.getElementById('location-status').textContent = "✅ Ubicación GPS guardada";
        document.getElementById('checkout-submit-btn').classList.remove('hidden');
    };

    document.getElementById('checkout-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const ref = document.getElementById('customer-location').value;
        const mapUrl = selectedCoordinates 
            ? `https://www.google.com/maps?q=${selectedCoordinates.lat},${selectedCoordinates.lng}` 
            : 'No GPS';
        
        let msg = `*NUEVO PEDIDO SIRARI* 📦\n\n👤 *Cliente:* ${name}\n📍 *Ref:* ${ref}\n🗺 *Mapa:* ${mapUrl}\n\n*PEDIDO:*`;
        let total = 0;
        cart.forEach(c => {
            msg += `\n- ${c.title} (${c.quantity}) = Bs.${(c.price * c.quantity).toFixed(2)}`;
            total += c.price * c.quantity;
        });
        msg += `\n\n💰 *TOTAL: Bs. ${total.toFixed(2)}*`;

        window.open(`https://api.whatsapp.com/send?phone=59173164833&text=${encodeURIComponent(msg)}`, '_blank');
        
        cart = [];
        updateCartUI();
        window.closeCheckout();
    };


    // =============================================
    //            LÓGICA ADMINISTRADOR (NUEVA)
    // =============================================
    
    // Login Simulado
    document.getElementById('go-to-admin').onclick = () => {
        views.store.classList.add('hidden');
        views.login.classList.remove('hidden');
        closeSidebar();
    };
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if(u === 'admin@sirari.com' && p === 'admin123') {
            views.login.classList.add('hidden');
            views.admin.classList.remove('hidden');
            renderAdminTable(); // Cargar tabla al entrar
        } else {
            document.getElementById('login-error').innerText = 'Credenciales incorrectas';
        }
    };
    document.getElementById('admin-logout-btn').onclick = () => {
        views.admin.classList.add('hidden');
        views.store.classList.remove('hidden');
    };

    // --- 1. NAVEGACIÓN TABS ---
    window.switchAdminTab = (tabId) => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active-tab'));
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden-tab'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));

        document.getElementById(tabId).classList.remove('hidden-tab');
        document.getElementById(tabId).classList.add('active-tab');

        if(tabId === 'tab-agregar') document.querySelector("button[onclick=\"switchAdminTab('tab-agregar')\"]").classList.add('active');
        if(tabId === 'tab-productos') {
            document.querySelector("button[onclick=\"switchAdminTab('tab-productos')\"]").classList.add('active');
            applyAdminFilters(); // Refrescar tabla
        }
    };

    // --- 2. BUSCAR POR CÓDIGO Y EDITAR ---
    window.searchForEdit = () => {
        const code = document.getElementById('admin-search-code').value.trim();
        if (!code) return alert("Por favor ingresa un código.");
        
        const prod = products.find(p => p.code === code);
        if (prod) {
            fillAdminForm(prod);
            alert(`Producto ${prod.title} encontrado.`);
        } else {
            alert("No se encontró ningún producto con ese código.");
        }
    };

    // --- 3. GUARDAR PRODUCTO (NUEVO O EDITAR) ---
    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-product-id').value;
        const title = document.getElementById('p-title').value;
        const category = document.getElementById('p-category').value;
        const price = parseFloat(document.getElementById('p-price').value);
        const stock = parseInt(document.getElementById('p-stock').value);
        const desc = document.getElementById('p-description').value;
        const discountVal = parseInt(document.getElementById('p-discount').value) || 0;
        // Generar código si no existe
        const code = document.getElementById('p-code').value || 'SIRARI-' + Math.random().toString(36).substr(2, 5).toUpperCase();

        const file = document.getElementById('p-image-file').files[0];
        let imageUrl = document.getElementById('current-image-url').value;

        // Subir Imagen
        if (file) {
            const fileName = `prod_${Date.now()}_${file.name}`;
            const { error: upErr } = await sb.storage.from('products').upload(fileName, file);
            if (upErr) return alert('Error subiendo imagen');
            const { data } = sb.storage.from('products').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }

        const productData = {
            title,
            category,
            price,
            stock,
            description: desc,
            code,
            discount_value: discountVal,
            image_url: imageUrl
        };

        let error;
        if (id) {
            // Update
            const res = await sb.from('products').update(productData).eq('id', id);
            error = res.error;
        } else {
            // Insert
            const res = await sb.from('products').insert([productData]);
            error = res.error;
        }

        if (error) alert('Error al guardar: ' + error.message);
        else {
            alert('Guardado con éxito');
            resetAdminForm();
            loadProducts(); // Recargar todo
            switchAdminTab('tab-productos');
        }
    };

    // --- 4. RENDERIZAR TABLA CON FILTROS ---
    window.applyAdminFilters = () => {
        renderAdminTable();
    };

    window.renderAdminTable = () => {
        const tbody = document.getElementById('admin-table-body');
        tbody.innerHTML = '';
        
        // Llenar select categorías si está vacío
        const catSelect = document.getElementById('f-cat');
        if (catSelect.options.length <= 1) {
            categories.forEach(c => catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        const fCat = document.getElementById('f-cat').value;
        const fStock = document.getElementById('f-stock').value;
        const fPrice = document.getElementById('f-price').value;
        const fOffer = document.getElementById('f-offer').value;

        let filtered = products.filter(p => {
            // Filtros
            if (fCat !== 'all' && p.category !== fCat) return false;
            
            const s = p.stock || 0;
            if (fStock !== 'all') {
                const [min, max] = fStock.split('-').map(Number);
                if (max && (s < min || s > max)) return false;
            }

            const pr = p.price;
            if (fPrice !== 'all') {
                const [min, max] = fPrice.split('-').map(Number);
                if (max && (pr < min || pr > max)) return false;
            }

            const dVal = p.discount_value || 0;
            if (fOffer !== 'all') {
                if (fOffer === 'yes' && dVal === 0) return false;
                if (fOffer !== 'yes' && dVal != fOffer) return false;
            }
            return true;
        });

        filtered.forEach((p, idx) => {
            const dVal = p.discount_value || 0;
            const final = dVal > 0 ? (p.price * (1 - dVal/100)) : p.price;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-chk" value="${p.id}" onclick="handleCheck(this)"></td>
                <td>${idx + 1}</td>
                <td><strong>${p.title}</strong></td>
                <td>${p.code || '-'}</td>
                <td>${p.category}</td>
                <td>Bs ${p.price}</td>
                <td>${dVal > 0 ? dVal + '%' : ''}</td>
                <td>Bs ${final.toFixed(2)}</td>
                <td>${p.stock}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    // --- 5. SELECCIÓN Y EDICIÓN ---
    window.handleCheck = (chk) => {
        document.querySelectorAll('.row-chk').forEach(c => { if(c!==chk) c.checked = false; });
        const btn = document.getElementById('btn-global-edit');
        if (chk.checked) {
            adminSelectedId = chk.value;
            btn.classList.remove('hidden');
        } else {
            adminSelectedId = null;
            btn.classList.add('hidden');
        }
    };

    window.editSelectedRow = () => {
        if(!adminSelectedId) return;
        const prod = products.find(p => p.id == adminSelectedId);
        if(prod) {
            fillAdminForm(prod);
            switchAdminTab('tab-agregar');
        }
    };

    function fillAdminForm(p) {
        document.getElementById('edit-product-id').value = p.id;
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-code').value = p.code || '';
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-discount').value = p.discount_value || 0;
        document.getElementById('p-description').value = p.description || '';
        document.getElementById('current-image-url').value = p.image_url;
        document.getElementById('img-status-msg').style.display = 'block';
    }

    window.resetAdminForm = () => {
        document.getElementById('product-form').reset();
        document.getElementById('edit-product-id').value = '';
        document.getElementById('img-status-msg').style.display = 'none';
        adminSelectedId = null;
    };

    // --- 6. EXPORTAR ---
    window.toggleExportMenu = () => document.getElementById('export-dropdown').classList.toggle('hidden');

    window.exportData = (type) => {
        // Preparar datos limpios
        const dataClean = products.map(p => {
            const dVal = p.discount_value || 0;
            return {
                ID: p.id,
                Producto: p.title,
                Codigo: p.code,
                Categoria: p.category,
                Precio: p.price,
                Descuento_Porc: dVal,
                Precio_Final: (p.price * (1 - dVal/100)).toFixed(2),
                Stock: p.stock,
                Descripcion: p.description
            };
        });

        if (type === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(dataClean);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario");
            XLSX.writeFile(wb, "Sirari_Reporte.xlsx");
        } 
        else if (type === 'csv') {
            let csv = "ID,Producto,Codigo,Categoria,Precio,Desc%,Final,Stock\n";
            dataClean.forEach(r => {
                csv += `${r.ID},"${r.Producto}",${r.Codigo},${r.Categoria},${r.Precio},${r.Descuento_Porc},${r.Precio_Final},${r.Stock}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sirari_reporte.csv'; a.click();
        }
        else if (type === 'sql') {
            let sql = "-- Export SQL Sirari\n";
            dataClean.forEach(r => {
                sql += `INSERT INTO products (title, code, price, stock) VALUES ('${r.Producto}', '${r.Codigo}', ${r.Precio}, ${r.Stock});\n`;
            });
            const blob = new Blob([sql], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sirari_backup.sql'; a.click();
        }
        document.getElementById('export-dropdown').classList.add('hidden');
    };

});
