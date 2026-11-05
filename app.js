// ==============================================================================
// 3D FILAMENT TRACKER - APLIKACJA GŁÓWNA
// ==============================================================================

// Stan aplikacji
const state = {
    supabaseClient: null,
    isOnline: false,
    filaments: [],
    viewMode: 'table', // domyślny widok listy (tabela)
    filters: {
        search: '',
        materials: [],     // wielokrotny wybór materiałów
        manufacturers: [], // wielokrotny wybór producentów
        colors: [],        // wielokrotny wybór kolorów
        locations: [],     // wielokrotny wybór lokalizacji
        statuses: [],      // wielokrotny wybór statusów
        sortBy: 'newest'
    }
};

// Przykładowe dane demonstracyjne (gdy Supabase nie jest jeszcze skonfigurowane)
const DEMO_DATA = [
    {
        id: 'demo-1',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        manufacturer: 'Devil Design',
        material: 'PETG',
        version: 'Standard',
        color_name: 'Transparent Red',
        color_hex: '#dc2626',
        location: 'Pudełko próżniowe 1',
        weight_total: 1000,
        weight_current: 820,
        weight_spool: 230,
        temp_nozzle: '230-240',
        temp_bed: '75-80',
        status: 'W użyciu',
        notes: 'Wymaga suszenia przed użyciem, zero stringingu przy 235°C.'
    },
    {
        id: 'demo-2',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        manufacturer: 'Fiberlogy',
        material: 'PLA',
        version: 'Matte',
        color_name: 'Graphite (Grafit)',
        color_hex: '#374151',
        location: 'Półka A',
        weight_total: 1000,
        weight_current: 310,
        weight_spool: 220,
        temp_nozzle: '210-225',
        temp_bed: '50-60',
        status: 'Końcówka',
        notes: 'Matowe wykończenie doskonale maskuje linie warstw.'
    },
    {
        id: 'demo-3',
        created_at: new Date().toISOString(),
        manufacturer: 'Sunlu',
        material: 'PLA',
        version: 'High Speed',
        color_name: 'Biały (White)',
        color_hex: '#f8fafc',
        location: 'Półka A',
        weight_total: 1000,
        weight_current: 1000,
        weight_spool: 215,
        temp_nozzle: '215-225',
        temp_bed: '55',
        status: 'Nowa',
        notes: 'Nowa zafoliowana szpula pod szybkie druki CoreXY.'
    },
    {
        id: 'demo-4',
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        manufacturer: 'Rosa3D',
        material: 'TPU 95A',
        version: 'Flexible',
        color_name: 'Fluo Yellow',
        color_hex: '#eab308',
        location: 'Pudełko próżniowe 2',
        weight_total: 500,
        weight_current: 410,
        weight_spool: 200,
        temp_nozzle: '220-230',
        temp_bed: '40',
        status: 'W użyciu',
        notes: 'Drukować wolno (max 30 mm/s), wyłączyć retrakcję.'
    }
];

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', async () => {
    initIcons();
    initSettings();
    initEventListeners();
    setViewMode(state.viewMode);
    await connectAndLoad();
});

function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ------------------------------------------------------------------------------
// Konfiguracja i połączenie z Supabase
// ------------------------------------------------------------------------------
function cleanSupabaseUrl(input) {
    if (!input) return '';
    let url = input.trim();

    // Jeśli wklejono adres z paska adresu dashboardu (np. https://supabase.com/dashboard/project/xyz/...)
    const dashMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
    if (dashMatch && dashMatch[1]) {
        url = `https://${dashMatch[1]}.supabase.co`;
    }

    // Jeśli brakuje https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // Usunięcie ewentualnych zbędnych ścieżek na końcu
    url = url.replace(/\/rest\/v1\/?$/i, '');
    url = url.replace(/\/rest\/?$/i, '');
    url = url.replace(/\/auth\/v1\/?$/i, '');
    url = url.replace(/\/+$/, '');

    return url;
}

function getSupabaseConfig() {
    const storedUrl = localStorage.getItem('filament_sb_url');
    const storedKey = localStorage.getItem('filament_sb_key');

    const configUrl = window.APP_CONFIG?.SUPABASE_URL || '';
    const configKey = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';

    return {
        url: cleanSupabaseUrl(storedUrl || configUrl),
        key: (storedKey || configKey).trim()
    };
}

async function connectAndLoad() {
    const { url, key } = getSupabaseConfig();
    const connectionBadge = document.getElementById('connectionBadge');
    const unconfiguredBanner = document.getElementById('unconfiguredBanner');

    if (!url || !key) {
        state.isOnline = false;
        state.supabaseClient = null;
        connectionBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20';
        connectionBadge.innerHTML = 'Tryb Demo';
        unconfiguredBanner.classList.remove('hidden');

        // Wczytaj z localStorage lub użyj danych demo
        const local = localStorage.getItem('filament_demo_items');
        state.filaments = local ? JSON.parse(local) : [...DEMO_DATA];
        render();
        return;
    }

    try {
        if (!window.supabase) {
            throw new Error('Biblioteka Supabase nie została załadowana.');
        }

        state.supabaseClient = window.supabase.createClient(url, key);
        
        // Próba pobrania danych z tabeli filaments
        const { data, error } = await state.supabaseClient
            .from('filaments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        state.isOnline = true;
        state.filaments = data || [];
        connectionBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        connectionBadge.innerHTML = '<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Supabase Połączone';
        unconfiguredBanner.classList.add('hidden');
    } catch (err) {
        console.warn('Błąd połączenia z Supabase:', err);
        state.isOnline = false;
        connectionBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-400 border border-red-500/20';
        connectionBadge.innerHTML = 'Błąd połączenia';
        unconfiguredBanner.classList.remove('hidden');
        
        // Awaryjnie załaduj dane lokalne
        const local = localStorage.getItem('filament_demo_items');
        state.filaments = local ? JSON.parse(local) : [...DEMO_DATA];
    }

    render();
}

function initSettings() {
    const { url, key } = getSupabaseConfig();
    document.getElementById('settingsSupabaseUrl').value = url;
    document.getElementById('settingsSupabaseKey').value = key;
}

// ------------------------------------------------------------------------------
// Obsługa zdarzeń
// ------------------------------------------------------------------------------
function initEventListeners() {
    // Przełączanie widoków
    document.getElementById('viewGridBtn').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('viewTableBtn').addEventListener('click', () => setViewMode('table'));

    // Wyszukiwanie
    document.getElementById('searchInput').addEventListener('input', (e) => {
        state.filters.search = e.target.value.toLowerCase();
        updateFilterDropdowns();
        renderFiltered();
    });

    // Zamknięcie menu filtrów po kliknięciu poza nimi
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown-container')) {
            ['materials', 'manufacturers', 'colors', 'locations', 'statuses'].forEach(t => {
                document.getElementById(`menu_${t}`)?.classList.add('hidden');
            });
        }
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
        state.filters.sortBy = e.target.value;
        renderFiltered();
    });

    // Otwieranie modali
    document.getElementById('btnOpenAddModal').addEventListener('click', () => openFilamentModal());
    document.getElementById('btnOpenSettings').addEventListener('click', () => openModal('settingsModal'));
    document.getElementById('btnOpenBackupModal')?.addEventListener('click', () => {
        const countBadge = document.getElementById('backupExportCountBadge');
        if (countBadge) {
            const count = state.filaments.length;
            countBadge.textContent = `${count} ${count === 1 ? 'szpula' : (count >= 2 && count <= 4 ? 'szpule' : 'szpul')}`;
        }
        openModal('backupModal');
    });

    // Formularz filamentu
    document.getElementById('filamentForm').addEventListener('submit', handleSaveFilament);

    // Formularz ustawień
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawUrl = document.getElementById('settingsSupabaseUrl').value;
        const key = document.getElementById('settingsSupabaseKey').value.trim();
        const url = cleanSupabaseUrl(rawUrl);

        document.getElementById('settingsSupabaseUrl').value = url;
        localStorage.setItem('filament_sb_url', url);
        localStorage.setItem('filament_sb_key', key);

        closeModal('settingsModal');
        await connectAndLoad();
    });

    // Test połączenia
    document.getElementById('btnTestConnection').addEventListener('click', async () => {
        const rawUrl = document.getElementById('settingsSupabaseUrl').value;
        const key = document.getElementById('settingsSupabaseKey').value.trim();
        const url = cleanSupabaseUrl(rawUrl);
        document.getElementById('settingsSupabaseUrl').value = url;

        const resultDiv = document.getElementById('testConnectionResult');

        resultDiv.className = 'text-xs p-2.5 rounded-lg bg-slate-800 text-slate-300 block';
        resultDiv.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 inline animate-spin mr-1"></i> Testowanie połączenia...';
        initIcons();

        try {
            if (!url) throw new Error('Podaj Project URL');
            if (!key) throw new Error('Podaj klucz anon / public');

            const client = window.supabase.createClient(url, key);
            const { error } = await client.from('filaments').select('id').limit(1);

            if (error) throw error;

            resultDiv.className = 'text-xs p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 block';
            resultDiv.innerHTML = '✓ Sukces! Połączenie z bazą Supabase działa prawidłowo.';
        } catch (err) {
            resultDiv.className = 'text-xs p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 block';
            resultDiv.innerHTML = `✕ Błąd połączenia: ${err.message || 'Nieznany błąd'}.`;
        }
    });

    // Kalkulator wagi brutto -> netto
    document.getElementById('btnCalculateNet').addEventListener('click', () => {
        const gross = parseFloat(document.getElementById('calcGrossInput').value);
        const spool = parseFloat(document.getElementById('formWeightSpool').value) || 220;
        
        if (!isNaN(gross)) {
            const net = Math.max(0, Math.round(gross - spool));
            document.getElementById('formWeightCurrent').value = net;
        }
    });
}

function setViewMode(mode) {
    state.viewMode = mode;
    const gridBtn = document.getElementById('viewGridBtn');
    const tableBtn = document.getElementById('viewTableBtn');
    const gridContainer = document.getElementById('gridContainer');
    const tableContainer = document.getElementById('tableContainer');

    if (mode === 'grid') {
        gridBtn.className = 'p-1.5 rounded-lg bg-slate-800 text-cyan-400 transition-colors';
        tableBtn.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors';
        gridContainer.classList.remove('hidden');
        tableContainer.classList.add('hidden');
    } else {
        tableBtn.className = 'p-1.5 rounded-lg bg-slate-800 text-cyan-400 transition-colors';
        gridBtn.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors';
        gridContainer.classList.add('hidden');
        tableContainer.classList.remove('hidden');
    }
}

// ------------------------------------------------------------------------------
// Filtrowanie i renderowanie
// ------------------------------------------------------------------------------
function getFilteredFilaments() {
    let list = [...state.filaments];

    // Tekstowe wyszukiwanie
    if (state.filters.search) {
        const q = state.filters.search;
        list = list.filter(item => 
            (item.manufacturer || '').toLowerCase().includes(q) ||
            (item.material || '').toLowerCase().includes(q) ||
            (item.version || '').toLowerCase().includes(q) ||
            (item.color_name || '').toLowerCase().includes(q) ||
            (item.location || '').toLowerCase().includes(q) ||
            (item.notes || '').toLowerCase().includes(q)
        );
    }

    // Filtry wielokrotnego wyboru (Material, Producent, Kolor, Lokalizacja)
    if (state.filters.materials.length > 0) {
        list = list.filter(item => state.filters.materials.includes((item.material || '').trim()));
    }
    if (state.filters.manufacturers.length > 0) {
        list = list.filter(item => state.filters.manufacturers.includes((item.manufacturer || '').trim()));
    }
    if (state.filters.colors.length > 0) {
        list = list.filter(item => state.filters.colors.includes((item.color_name || '').trim()));
    }
    if (state.filters.locations.length > 0) {
        list = list.filter(item => state.filters.locations.includes((item.location || '').trim()));
    }
    if (state.filters.statuses.length > 0) {
        list = list.filter(item => state.filters.statuses.includes((item.status || 'W użyciu').trim()));
    }

    // Sortowanie
    switch (state.filters.sortBy) {
        case 'newest':
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            break;
        case 'material_asc':
            list.sort((a, b) => (a.material || '').localeCompare(b.material || '', 'pl', { sensitivity: 'base' }));
            break;
        case 'color_asc':
            list.sort((a, b) => (a.color_name || '').localeCompare(b.color_name || '', 'pl', { sensitivity: 'base' }));
            break;
        case 'producer_asc':
        case 'name_asc':
            list.sort((a, b) => (a.manufacturer || '').localeCompare(b.manufacturer || '', 'pl', { sensitivity: 'base' }));
            break;
        case 'weight_asc':
            list.sort((a, b) => (a.weight_current || 0) - (b.weight_current || 0));
            break;
        case 'weight_desc':
            list.sort((a, b) => (b.weight_current || 0) - (a.weight_current || 0));
            break;
    }

    return list;
}

// ------------------------------------------------------------------------------
// Obsługa filtrów wielokrotnego wyboru (Multi-Select)
// ------------------------------------------------------------------------------
function toggleFilterMenu(type) {
    const targetMenu = document.getElementById(`menu_${type}`);
    if (!targetMenu) return;
    const isCurrentlyOpen = !targetMenu.classList.contains('hidden');

    ['materials', 'manufacturers', 'colors', 'locations', 'statuses'].forEach(t => {
        document.getElementById(`menu_${t}`)?.classList.add('hidden');
    });

    if (!isCurrentlyOpen) {
        targetMenu.classList.remove('hidden');
    }
    initIcons();
}

function toggleFilterValue(type, value) {
    const list = state.filters[type];
    const index = list.indexOf(value);
    if (index === -1) {
        list.push(value);
    } else {
        list.splice(index, 1);
    }
    updateFilterDropdowns();
    renderFiltered();
}

function clearFilterCategory(type) {
    state.filters[type] = [];
    updateFilterDropdowns();
    renderFiltered();
}

function selectAllFilterCategory(type) {
    if (type === 'colors') {
        const colorNames = [...new Set(state.filaments.map(f => (f.color_name || '').trim()).filter(Boolean))];
        state.filters.colors = colorNames;
    } else if (type === 'statuses') {
        const statuses = ['W użyciu', 'Nowa', 'Końcówka', 'Pusta'];
        state.filters.statuses = statuses;
    } else {
        const propMap = {
            materials: 'material',
            manufacturers: 'manufacturer',
            locations: 'location'
        };
        const prop = propMap[type];
        if (prop) {
            state.filters[type] = [...new Set(state.filaments.map(f => (f[prop] || '').trim()).filter(Boolean))];
        }
    }
    updateFilterDropdowns();
    renderFiltered();
}

function resetAllFilters() {
    state.filters.search = '';
    state.filters.materials = [];
    state.filters.manufacturers = [];
    state.filters.colors = [];
    state.filters.locations = [];
    state.filters.statuses = [];
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    updateFilterDropdowns();
    renderFiltered();
}

// Udostępnij funkcje w zasięgu window dla zdarzeń inline w HTML
window.toggleFilterMenu = toggleFilterMenu;
window.toggleFilterValue = toggleFilterValue;
window.clearFilterCategory = clearFilterCategory;
window.selectAllFilterCategory = selectAllFilterCategory;
window.resetAllFilters = resetAllFilters;

function updateFilterDropdowns() {
    // 1. Materiały
    const materials = [...new Set(state.filaments.map(f => (f.material || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

    // 2. Producenci
    const manufacturers = [...new Set(state.filaments.map(f => (f.manufacturer || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

    // 3. Kolory (nazwa + kolor HEX dla próbki wizualnej)
    const colorMap = new Map();
    state.filaments.forEach(f => {
        const name = (f.color_name || '').trim();
        if (name && !colorMap.has(name)) {
            colorMap.set(name, f.color_hex || '#3b82f6');
        }
    });
    const colors = Array.from(colorMap.entries())
        .map(([name, hex]) => ({ name, hex }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));

    // 4. Lokalizacje
    const locations = [...new Set(state.filaments.map(f => (f.location || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

    // 5. Statusy
    const allKnownStatuses = ['W użyciu', 'Nowa', 'Końcówka', 'Pusta'];
    const existingStatuses = [...new Set(state.filaments.map(f => (f.status || 'W użyciu').trim()).filter(Boolean))];
    const statuses = allKnownStatuses.filter(s => existingStatuses.includes(s))
        .concat(existingStatuses.filter(s => !allKnownStatuses.includes(s)));
    if (statuses.length === 0) statuses.push(...allKnownStatuses);

    renderFilterMenu('materials', materials, 'Materiał');
    renderFilterMenu('manufacturers', manufacturers, 'Producent');
    renderFilterMenu('colors', colors, 'Kolor', true);
    renderFilterMenu('locations', locations, 'Lokalizacja');
    renderFilterMenu('statuses', statuses, 'Status', false, true);
    initIcons();

    // Aktualizacja przycisku "Wyczyść filtry"
    const totalActiveFilters = state.filters.materials.length +
                               state.filters.manufacturers.length +
                               state.filters.colors.length +
                               state.filters.locations.length +
                               state.filters.statuses.length +
                               (state.filters.search ? 1 : 0);

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
        if (totalActiveFilters > 0) {
            btnReset.classList.remove('hidden');
        } else {
            btnReset.classList.add('hidden');
        }
    }
}

function renderFilterMenu(type, items, title, isColor = false, isStatus = false) {
    const menu = document.getElementById(`menu_${type}`);
    const label = document.getElementById(`label_${type}`);
    const btn = document.getElementById(`btnFilter_${type}`);
    if (!menu || !label || !btn) return;

    const selected = state.filters[type];

    // Zaktualizuj etykietę i wygląd przycisku
    if (selected.length === 0) {
        label.innerHTML = `${title} (wszystkie)`;
        btn.className = 'filter-dropdown-btn bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 flex items-center gap-2 transition-all';
    } else if (items.length > 0 && selected.length === items.length) {
        label.innerHTML = `<span class="text-cyan-400 font-semibold">${title}:</span> <span class="text-slate-100 font-medium">Wszystkie (${selected.length})</span>`;
        btn.className = 'filter-dropdown-btn bg-cyan-950/40 border border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-cyan-300 flex items-center gap-2 transition-all shadow-sm shadow-cyan-500/10';
    } else if (selected.length === 1) {
        label.innerHTML = `<span class="text-cyan-400 font-semibold">${title}:</span> <span class="text-slate-100 font-medium">${escapeHtml(selected[0])}</span>`;
        btn.className = 'filter-dropdown-btn bg-cyan-950/40 border border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-cyan-300 flex items-center gap-2 transition-all shadow-sm shadow-cyan-500/10';
    } else {
        label.innerHTML = `<span class="text-cyan-400 font-semibold">${title}</span> <span class="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-bold">${selected.length}</span>`;
        btn.className = 'filter-dropdown-btn bg-cyan-950/40 border border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-cyan-300 flex items-center gap-2 transition-all shadow-sm shadow-cyan-500/10';
    }

    if (items.length === 0) {
        menu.innerHTML = `<div class="p-3 text-xs text-slate-500 text-center">Brak pozycji</div>`;
        return;
    }

    let html = `
    <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 px-1 text-[11px]">
        <div class="flex items-center gap-1.5">
            <button type="button" onclick="selectAllFilterCategory('${type}')" class="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold flex items-center gap-1 transition-colors">
                <i data-lucide="check-check" class="w-3 h-3"></i>
                Wszystkie
            </button>
            <span class="text-slate-700">|</span>
            <button type="button" onclick="clearFilterCategory('${type}')" class="text-slate-400 hover:text-slate-200 hover:underline flex items-center gap-1 transition-colors">
                <i data-lucide="square" class="w-3 h-3"></i>
                Żadne
            </button>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">${selected.length}/${items.length}</span>
    </div>
    `;

    html += items.map(item => {
        const val = isColor ? item.name : item;
        const isChecked = selected.includes(val);
        const swatch = isColor 
            ? `<span class="w-3.5 h-3.5 rounded-full color-swatch-ring flex-shrink-0" style="background-color: ${escapeHtml(item.hex || '#3b82f6')}"></span>` 
            : '';
        const badge = isStatus
            ? `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusBadgeClass(val)}">${escapeHtml(val)}</span>`
            : `<span class="truncate">${escapeHtml(val)}</span>`;
        
        return `
        <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-200 cursor-pointer select-none transition-colors">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleFilterValue('${type}', '${escapeHtml(val)}')" 
                class="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 w-3.5 h-3.5 flex-shrink-0 accent-cyan-500 cursor-pointer">
            ${swatch}
            ${badge}
        </label>
        `;
    }).join('');

    menu.innerHTML = html;
}

// Dynamiczne podpowiedzi (datalist) z dotychczas wprowadzonych wartości (za wyjątkiem koloru)
function updateFormDatalists() {
    const getUniqueValues = (key) => {
        return [...new Set(
            state.filaments
                .map(f => (f[key] || '').trim())
                .filter(val => val.length > 0)
        )].sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    };

    const manufacturers = getUniqueValues('manufacturer');
    const materials = getUniqueValues('material');
    const versions = getUniqueValues('version');
    const locations = getUniqueValues('location');
    const tempNozzles = getUniqueValues('temp_nozzle');
    const tempBeds = getUniqueValues('temp_bed');

    const fillDatalist = (elementId, values) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = values.map(val => `<option value="${escapeHtml(val)}"></option>`).join('');
    };

    fillDatalist('manufacturersList', manufacturers);
    fillDatalist('materialsList', materials);
    fillDatalist('versionsList', versions);
    fillDatalist('locationsList', locations);
    fillDatalist('tempNozzleList', tempNozzles);
    fillDatalist('tempBedList', tempBeds);
}

function updateStats() {
    const totalSpools = state.filaments.length;
    const totalWeightGrams = state.filaments.reduce((acc, f) => acc + (parseInt(f.weight_current) || 0), 0);
    const activeSpools = state.filaments.filter(f => f.status === 'W użyciu' || f.status === 'Nowa').length;

    document.getElementById('statTotalSpools').innerText = totalSpools;
    document.getElementById('statTotalWeight').innerText = `${(totalWeightGrams / 1000).toFixed(2)} kg`;
    document.getElementById('statActiveSpools').innerText = activeSpools;
}

function render() {
    document.getElementById('loadingState').classList.add('hidden');
    updateFilterDropdowns();
    updateFormDatalists();
    updateStats();
    renderFiltered();
}

function renderFiltered() {
    const filtered = getFilteredFilaments();
    const emptyState = document.getElementById('emptyState');
    const gridContainer = document.getElementById('gridContainer');
    const tableContainer = document.getElementById('tableContainer');
    const tableBody = document.getElementById('tableBody');

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        gridContainer.innerHTML = '';
        tableBody.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');

    // 1. Render kart (Grid)
    gridContainer.innerHTML = filtered.map(item => createCardHtml(item)).join('');

    // 2. Render tabeli
    tableBody.innerHTML = filtered.map(item => createTableRowHtml(item)).join('');

    initIcons();
}

function createCardHtml(f) {
    const total = f.weight_total || 1000;
    const current = f.weight_current !== undefined ? f.weight_current : total;
    const percentage = Math.min(100, Math.max(0, Math.round((current / total) * 100)));

    let progressColor = 'bg-cyan-500';
    if (percentage < 20) progressColor = 'bg-red-500';
    else if (percentage < 40) progressColor = 'bg-amber-500';

    const versionBadge = f.version ? `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700/80 truncate max-w-[80px]" title="${escapeHtml(f.version)}">${escapeHtml(f.version)}</span>` : '';

    return `
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm hover:shadow-cyan-500/5">
        <div>
            <!-- Nagłówek karty -->
            <div class="flex items-start justify-between gap-1.5 mb-2.5">
                <div class="flex items-center gap-2 min-w-0">
                    <!-- Próbnik koloru -->
                    <div class="w-6 h-6 rounded-full color-swatch-ring flex-shrink-0" style="background-color: ${escapeHtml(f.color_hex || '#3b82f6')};"></div>
                    <div class="min-w-0">
                        <div class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate" title="${escapeHtml(f.manufacturer || 'Nieznany')}">
                            ${escapeHtml(f.manufacturer || 'Nieznany')}
                        </div>
                        <h3 class="text-sm font-bold text-slate-100 flex items-center gap-1 truncate" title="${escapeHtml(f.material || 'Filament')}">
                            <span class="truncate">${escapeHtml(f.material || 'Filament')}</span>
                            ${versionBadge}
                        </h3>
                    </div>
                </div>

                <!-- Status badge -->
                <span class="text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${getStatusBadgeClass(f.status)}">
                    ${escapeHtml(f.status || 'W użyciu')}
                </span>
            </div>

            <!-- Dane filamentu: Kolor & Lokalizacja -->
            <div class="space-y-1 my-2 text-[11px]">
                <div class="flex items-center justify-between text-slate-300 gap-1">
                    <span class="text-slate-500">Kolor:</span>
                    <strong class="text-slate-200 truncate max-w-[120px]" title="${escapeHtml(f.color_name || 'Brak')}">${escapeHtml(f.color_name || 'Brak')}</strong>
                </div>
                <div class="flex items-center justify-between text-slate-300 gap-1">
                    <span class="text-slate-500">Lokalizacja:</span>
                    <span class="inline-flex items-center gap-1 text-cyan-400 font-medium truncate max-w-[120px]" title="${escapeHtml(f.location || 'Nieokreślona')}">
                        <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
                        <span class="truncate">${escapeHtml(f.location || 'Nieokreślona')}</span>
                    </span>
                </div>
                ${f.temp_nozzle || f.temp_bed ? `
                <div class="flex items-center justify-between text-slate-400 pt-0.5 text-[10px]">
                    <span class="text-slate-500">Temp:</span>
                    <span class="truncate">${escapeHtml(f.temp_nozzle || '-')}° / ${escapeHtml(f.temp_bed || '-')}°C</span>
                </div>
                ` : ''}
            </div>

            <!-- Pasek postępu wagi -->
            <div class="mt-2.5 pt-2 border-t border-slate-800/80">
                <div class="flex justify-between items-center text-[10px] mb-1">
                    <span class="text-slate-400">Pozostało:</span>
                    <span class="font-bold text-slate-200">
                        <span class="${percentage < 20 ? 'text-red-400 font-extrabold' : 'text-cyan-400'}">${current}g</span>
                        <span class="text-slate-500 font-normal">/ ${total}g</span>
                    </span>
                </div>
                <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div class="${progressColor} h-1.5 rounded-full transition-all" style="width: ${percentage}%"></div>
                </div>
            </div>

            ${f.notes ? `
            <p class="mt-2 text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/50 line-clamp-2" title="${escapeHtml(f.notes)}">
                ${escapeHtml(f.notes)}
            </p>
            ` : ''}
        </div>

        <!-- Stopka karty z akcjami -->
        <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
            <button onclick="quickUpdateWeight('${f.id}')" title="Szybka waga" class="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors p-1">
                <i data-lucide="scale" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Waga</span>
            </button>

            <div class="flex items-center gap-0.5">
                <button onclick="duplicateFilament('${f.id}')" title="Duplikuj szpulę" class="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="openFilamentModal('${f.id}')" title="Edytuj szpulę" class="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="deleteFilament('${f.id}')" title="Usuń szpulę" class="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    </div>
    `;
}

function createTableRowHtml(f) {
    const total = f.weight_total || 1000;
    const current = f.weight_current !== undefined ? f.weight_current : total;
    const percentage = Math.round((current / total) * 100);

    return `
    <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full color-swatch-ring flex-shrink-0" style="background-color: ${escapeHtml(f.color_hex || '#3b82f6')};"></div>
                <span class="text-xs font-medium text-slate-200">${escapeHtml(f.color_name)}</span>
            </div>
        </td>
        <td class="p-4 whitespace-nowrap font-medium text-slate-300">
            ${escapeHtml(f.manufacturer)}
        </td>
        <td class="p-4 whitespace-nowrap">
            <span class="font-bold text-slate-100">${escapeHtml(f.material)}</span>
            ${f.version ? `<span class="ml-1.5 text-xs text-slate-400">(${escapeHtml(f.version)})</span>` : ''}
        </td>
        <td class="p-4 whitespace-nowrap text-cyan-400">
            <span class="inline-flex items-center gap-1 text-xs">
                <i data-lucide="map-pin" class="w-3 h-3"></i>
                ${escapeHtml(f.location)}
            </span>
        </td>
        <td class="p-4 whitespace-nowrap">
            <span class="text-xs font-semibold ${percentage < 20 ? 'text-red-400' : 'text-slate-200'}">
                ${current}g
            </span>
            <span class="text-[11px] text-slate-500">/ ${total}g (${percentage}%)</span>
        </td>
        <td class="p-4 whitespace-nowrap">
            <span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusBadgeClass(f.status)}">
                ${escapeHtml(f.status || 'W użyciu')}
            </span>
        </td>
        <td class="p-4 whitespace-nowrap text-right space-x-1">
            <button onclick="quickUpdateWeight('${f.id}')" class="p-1 rounded text-slate-400 hover:text-cyan-400" title="Zmień wagę">
                <i data-lucide="scale" class="w-4 h-4"></i>
            </button>
            <button onclick="duplicateFilament('${f.id}')" class="p-1 rounded text-slate-400 hover:text-cyan-400" title="Duplikuj">
                <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
            <button onclick="openFilamentModal('${f.id}')" class="p-1 rounded text-slate-400 hover:text-slate-200" title="Edytuj">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteFilament('${f.id}')" class="p-1 rounded text-slate-400 hover:text-red-400" title="Usuń">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    </tr>
    `;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Nowa':
            return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        case 'Końcówka':
            return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        case 'Pusta':
            return 'bg-slate-700/50 text-slate-400 border border-slate-700';
        default:
            return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
}

// ------------------------------------------------------------------------------
// Operacje CRUD (Dodawanie, Edycja, Duplikowanie, Usuwanie)
// ------------------------------------------------------------------------------
function openFilamentModal(id = null, isDuplicate = false) {
    updateFormDatalists();
    const isEdit = Boolean(id) && !isDuplicate;

    let modalTitle = '<i data-lucide="plus-circle" class="w-5 h-5 text-cyan-400"></i> Dodaj nową szpulę';
    if (isEdit) {
        modalTitle = '<i data-lucide="edit-3" class="w-5 h-5 text-cyan-400"></i> Edytuj szpulę';
    } else if (isDuplicate) {
        modalTitle = '<i data-lucide="copy" class="w-5 h-5 text-cyan-400"></i> Duplikuj szpulę';
    }
    document.getElementById('modalTitle').innerHTML = modalTitle;

    const form = document.getElementById('filamentForm');
    form.reset();
    document.getElementById('calcGrossInput').value = '';

    if (id) {
        const item = state.filaments.find(f => f.id === id);
        if (!item) return;

        // Jeśli to duplikat, filamentId pozostaje pusty, co wymusza INSERT nowego rekordu
        document.getElementById('filamentId').value = isDuplicate ? '' : item.id;
        document.getElementById('formManufacturer').value = item.manufacturer || '';
        document.getElementById('formMaterial').value = item.material || '';
        document.getElementById('formVersion').value = item.version || '';
        document.getElementById('formColorName').value = item.color_name || '';
        document.getElementById('formColorHex').value = item.color_hex || '#3b82f6';
        document.getElementById('formLocation').value = item.location || '';
        document.getElementById('formWeightTotal').value = item.weight_total || 1000;
        document.getElementById('formWeightCurrent').value = isDuplicate ? (item.weight_total || 1000) : (item.weight_current !== undefined ? item.weight_current : 1000);
        document.getElementById('formWeightSpool').value = item.weight_spool || 220;
        document.getElementById('formTempNozzle').value = item.temp_nozzle || '';
        document.getElementById('formTempBed').value = item.temp_bed || '';
        document.getElementById('formStatus').value = isDuplicate ? 'Nowa' : (item.status || 'W użyciu');
        document.getElementById('formNotes').value = item.notes || '';
    } else {
        document.getElementById('filamentId').value = '';
        document.getElementById('formColorHex').value = '#3b82f6';
        document.getElementById('formWeightTotal').value = 1000;
        document.getElementById('formWeightCurrent').value = 1000;
        document.getElementById('formWeightSpool').value = 220;
        document.getElementById('formStatus').value = 'W użyciu';
    }

    initIcons();
    openModal('filamentModal');
}

function duplicateFilament(id) {
    openFilamentModal(id, true);
}

async function handleSaveFilament(e) {
    e.preventDefault();
    const id = document.getElementById('filamentId').value;
    const isEdit = Boolean(id);

    const payload = {
        manufacturer: document.getElementById('formManufacturer').value.trim(),
        material: document.getElementById('formMaterial').value.trim(),
        version: document.getElementById('formVersion').value.trim() || null,
        color_name: document.getElementById('formColorName').value.trim(),
        color_hex: document.getElementById('formColorHex').value,
        location: document.getElementById('formLocation').value.trim(),
        weight_total: parseInt(document.getElementById('formWeightTotal').value) || 1000,
        weight_current: parseInt(document.getElementById('formWeightCurrent').value) || 0,
        weight_spool: parseInt(document.getElementById('formWeightSpool').value) || 220,
        temp_nozzle: document.getElementById('formTempNozzle').value.trim() || null,
        temp_bed: document.getElementById('formTempBed').value.trim() || null,
        status: document.getElementById('formStatus').value,
        notes: document.getElementById('formNotes').value.trim() || null
    };

    const saveBtn = document.getElementById('btnSaveFilament');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Zapisywanie...';
    initIcons();

    try {
        if (state.isOnline && state.supabaseClient) {
            if (isEdit) {
                const { error } = await state.supabaseClient
                    .from('filaments')
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await state.supabaseClient
                    .from('filaments')
                    .insert([payload]);
                if (error) throw error;
            }
            await connectAndLoad();
        } else {
            // Tryb offline / demo
            if (isEdit) {
                const index = state.filaments.findIndex(f => f.id === id);
                if (index !== -1) {
                    state.filaments[index] = { ...state.filaments[index], ...payload };
                }
            } else {
                const newItem = {
                    id: 'local-' + Date.now(),
                    created_at: new Date().toISOString(),
                    ...payload
                };
                state.filaments.unshift(newItem);
            }
            localStorage.setItem('filament_demo_items', JSON.stringify(state.filaments));
            render();
        }

        closeModal('filamentModal');
    } catch (err) {
        alert('Błąd podczas zapisywania: ' + (err.message || 'Nieznany błąd'));
        console.error(err);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Zapisz szpulę';
        initIcons();
    }
}

async function quickUpdateWeight(id) {
    const item = state.filaments.find(f => f.id === id);
    if (!item) return;

    const input = prompt(`Zmień pozostałą wagę netto dla "${item.manufacturer} ${item.material} (${item.color_name})":\n\nPodaj wagę w gramach (g):`, item.weight_current);
    if (input === null) return;

    const newWeight = parseInt(input);
    if (isNaN(newWeight) || newWeight < 0) {
        alert('Proszę podać poprawną wagę w gramach.');
        return;
    }

    let newStatus = item.status;
    if (newWeight === 0) newStatus = 'Pusta';
    else if (newWeight <= 150) newStatus = 'Końcówka';
    else if (newStatus === 'Pusta' || newStatus === 'Nowa') newStatus = 'W użyciu';

    try {
        if (state.isOnline && state.supabaseClient) {
            const { error } = await state.supabaseClient
                .from('filaments')
                .update({ weight_current: newWeight, status: newStatus })
                .eq('id', id);
            if (error) throw error;
            await connectAndLoad();
        } else {
            item.weight_current = newWeight;
            item.status = newStatus;
            localStorage.setItem('filament_demo_items', JSON.stringify(state.filaments));
            render();
        }
    } catch (err) {
        alert('Błąd aktualizacji: ' + err.message);
    }
}

async function deleteFilament(id) {
    const item = state.filaments.find(f => f.id === id);
    const name = item ? `${item.manufacturer} ${item.material} (${item.color_name})` : 'tę szpulę';

    if (!confirm(`Czy na pewno chcesz usunąć szpulę:\n"${name}"?`)) {
        return;
    }

    try {
        if (state.isOnline && state.supabaseClient) {
            const { error } = await state.supabaseClient
                .from('filaments')
                .delete()
                .eq('id', id);
            if (error) throw error;
            await connectAndLoad();
        } else {
            state.filaments = state.filaments.filter(f => f.id !== id);
            localStorage.setItem('filament_demo_items', JSON.stringify(state.filaments));
            render();
        }
    } catch (err) {
        alert('Błąd podczas usuwania: ' + err.message);
    }
}

// ------------------------------------------------------------------------------
// Pomocnicze funkcje modali i UI
// ------------------------------------------------------------------------------
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    initIcons();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Zamknięcie modali klawiszem Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('filamentModal');
        closeModal('settingsModal');
        closeModal('backupModal');
    }
});

// ------------------------------------------------------------------------------
// System powiadomień Toast
// ------------------------------------------------------------------------------
function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-emerald-500/40 text-emerald-300' :
                        type === 'error' ? 'border-red-500/40 text-red-300' :
                        'border-cyan-500/40 text-cyan-300';

    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium border bg-slate-900/95 backdrop-blur transition-all duration-300 transform translate-y-2 opacity-0 ${borderColor}`;

    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    initIcons();

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ------------------------------------------------------------------------------
// Pomocnicza funkcja kontrastu kolorów dla arkuszy (YIQ / WCAG)
// ------------------------------------------------------------------------------
function getContrastColor(hexColor) {
    if (!hexColor) {
        return {
            bgRgb: '3B82F6',
            textRgb: 'FFFFFF',
            bgHex: '#3B82F6',
            textHex: '#FFFFFF',
            isDark: true
        };
    }

    let hex = String(hexColor).trim().replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) {
        hex = '3B82F6';
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Formuła postrzeganej jasności ludzkiego oka (YIQ)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    // Wartość graniczna: poniżej 135 kolor uznajemy za ciemny -> czcionka biała (FFFFFF), powyżej -> czcionka ciemna (0F172A)
    const isDark = yiq < 135;

    return {
        bgRgb: hex.toUpperCase(),
        textRgb: isDark ? 'FFFFFF' : '0F172A',
        bgHex: '#' + hex.toUpperCase(),
        textHex: isDark ? '#FFFFFF' : '#0F172A',
        isDark
    };
}

// ------------------------------------------------------------------------------
// Eksport do arkuszy kalkulacyjnych (Excel, CSV, Google Sheets)
// ------------------------------------------------------------------------------
function exportToExcel() {
    if (!state.filaments || state.filaments.length === 0) {
        showToast('Brak szpul do wyeksportowania.', 'error');
        return;
    }

    if (!window.XLSX) {
        showToast('Biblioteka arkuszy Excel nie załadowała się jeszcze. Pobierz plik CSV.', 'error');
        return;
    }

    const data = state.filaments.map((f, index) => {
        const total = f.weight_total || 1000;
        const current = f.weight_current != null ? f.weight_current : total;
        const percentLeft = total > 0 ? Math.round((current / total) * 100) : 0;
        const contrast = getContrastColor(f.color_hex);

        return {
            'Lp.': index + 1,
            'Producent': f.manufacturer || '',
            'Materiał': f.material || '',
            'Wersja': f.version || '',
            'Kolor': f.color_name || '',
            'Kod HEX': contrast.bgHex,
            'Pozostało (g)': current,
            'Waga początkowa (g)': total,
            'Tara szpuli (g)': f.weight_spool || 220,
            '% Pozostało': `${percentLeft}%`,
            'Status': f.status || 'W użyciu',
            'Lokalizacja': f.location || '',
            'Temp. dyszy (°C)': f.temp_nozzle || '',
            'Temp. stołu (°C)': f.temp_bed || '',
            'Uwagi': f.notes || '',
            'Data dodania': f.created_at ? new Date(f.created_at).toLocaleString('pl-PL') : ''
        };
    });

    const worksheet = window.XLSX.utils.json_to_sheet(data);

    // 1. Stylizacja nagłówków kolumn (Wiersz 0)
    for (let c = 0; c < 16; c++) {
        const cellRef = window.XLSX.utils.encode_cell({ c, r: 0 });
        if (worksheet[cellRef]) {
            worksheet[cellRef].s = {
                fill: {
                    patternType: 'solid',
                    fgColor: { rgb: '1E293B' } // Ciemny elegancki grafit slate-800
                },
                font: {
                    name: 'Calibri',
                    sz: 11,
                    bold: true,
                    color: { rgb: 'F8FAFC' }
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'center'
                },
                border: {
                    top: { style: 'thin', color: { rgb: '334155' } },
                    bottom: { style: 'medium', color: { rgb: '06B6D4' } }, // Turkusowy pasek akcentu na dole
                    left: { style: 'thin', color: { rgb: '334155' } },
                    right: { style: 'thin', color: { rgb: '334155' } }
                }
            };
        }
    }

    // 2. Stylizacja wierszy danych oraz komórek z kodem koloru
    state.filaments.forEach((f, index) => {
        const rowIdx = index + 1;
        const contrast = getContrastColor(f.color_hex);

        // Standardowe formatowanie komórek w wierszu
        for (let c = 0; c < 16; c++) {
            const cellRef = window.XLSX.utils.encode_cell({ c, r: rowIdx });
            if (!worksheet[cellRef]) continue;

            const isCentered = [0, 5, 6, 7, 8, 9, 10, 12, 13, 15].includes(c);

            worksheet[cellRef].s = {
                font: {
                    name: 'Calibri',
                    sz: 10,
                    color: { rgb: '0F172A' }
                },
                alignment: {
                    vertical: 'center',
                    horizontal: isCentered ? 'center' : 'left'
                },
                border: {
                    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    right: { style: 'thin', color: { rgb: 'E2E8F0' } }
                }
            };
        }

        // Pokolorowanie pola "Kod HEX" (Kolumna 5 = F) na kolor filamentu
        // z automatycznie dobranym kolorem czcionki (biała dla ciemnych, ciemna dla jasnych)
        const hexCellRef = window.XLSX.utils.encode_cell({ c: 5, r: rowIdx });
        if (worksheet[hexCellRef]) {
            worksheet[hexCellRef].s = {
                fill: {
                    patternType: 'solid',
                    fgColor: { rgb: contrast.bgRgb } // Tło w kolorze filamentu
                },
                font: {
                    name: 'Calibri',
                    sz: 10,
                    bold: true,
                    color: { rgb: contrast.textRgb } // Odpowiednio jasny lub ciemny kolor tekstu
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'center'
                },
                border: {
                    top: { style: 'medium', color: { rgb: contrast.isDark ? '64748B' : '94A3B8' } },
                    bottom: { style: 'medium', color: { rgb: contrast.isDark ? '64748B' : '94A3B8' } },
                    left: { style: 'medium', color: { rgb: contrast.isDark ? '64748B' : '94A3B8' } },
                    right: { style: 'medium', color: { rgb: contrast.isDark ? '64748B' : '94A3B8' } }
                }
            };
        }
    });

    // Dopasowanie szerokości kolumn dla czytelności
    worksheet['!cols'] = [
        { wch: 6 },   // Lp.
        { wch: 18 },  // Producent
        { wch: 13 },  // Materiał
        { wch: 15 },  // Wersja
        { wch: 22 },  // Kolor
        { wch: 14 },  // Kod HEX (zwiększona szerokość dla czytelnego kafelka koloru)
        { wch: 15 },  // Pozostało
        { wch: 19 },  // Waga początkowa
        { wch: 15 },  // Tara szpuli
        { wch: 13 },  // % Pozostało
        { wch: 14 },  // Status
        { wch: 20 },  // Lokalizacja
        { wch: 16 },  // Temp. dyszy
        { wch: 16 },  // Temp. stołu
        { wch: 35 },  // Uwagi
        { wch: 20 }   // Data dodania
    ];

    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Filamenty 3D');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    window.XLSX.writeFile(workbook, `filamenty_baza_${dateStr}.xlsx`);
    showToast('Wygenerowano i pobrano kolorowy arkusz Excel (.xlsx)!', 'success');
}

function exportToCsv() {
    if (!state.filaments || state.filaments.length === 0) {
        showToast('Brak szpul do wyeksportowania.', 'error');
        return;
    }

    const headers = [
        'Lp.', 'Producent', 'Materiał', 'Wersja', 'Kolor', 'Kod HEX',
        'Pozostało (g)', 'Waga całkowita (g)', 'Tara szpuli (g)', '% Pozostało',
        'Status', 'Lokalizacja', 'Temp dyszy (°C)', 'Temp stołu (°C)', 'Uwagi', 'Data dodania'
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = state.filaments.map((f, i) => {
        const total = f.weight_total || 1000;
        const current = f.weight_current != null ? f.weight_current : total;
        const percentLeft = total > 0 ? Math.round((current / total) * 100) : 0;
        const dateStr = f.created_at ? new Date(f.created_at).toLocaleString('pl-PL') : '';
        const contrast = getContrastColor(f.color_hex);

        return [
            i + 1,
            escapeCsv(f.manufacturer),
            escapeCsv(f.material),
            escapeCsv(f.version),
            escapeCsv(f.color_name),
            escapeCsv(contrast.bgHex),
            current,
            total,
            f.weight_spool || 220,
            `${percentLeft}%`,
            escapeCsv(f.status),
            escapeCsv(f.location),
            escapeCsv(f.temp_nozzle),
            escapeCsv(f.temp_bed),
            escapeCsv(f.notes),
            escapeCsv(dateStr)
        ].join(';');
    });

    // \uFEFF to znacznik UTF-8 BOM, dzięki któremu Excel i Sheets od razu prawidłowo otwierają polskie znaki
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `filamenty_arkusz_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Pobrano plik CSV (zoptymalizowany dla Excel i Sheets)!', 'success');
}

async function copyForGoogleSheets() {
    if (!state.filaments || state.filaments.length === 0) {
        showToast('Brak szpul do skopiowania.', 'error');
        return;
    }

    const headers = [
        'Lp.', 'Producent', 'Materiał', 'Wersja', 'Kolor', 'Kod HEX',
        'Pozostało (g)', 'Waga całkowita (g)', 'Tara szpuli (g)', '% Pozostało',
        'Status', 'Lokalizacja', 'Temp dyszy (°C)', 'Temp stołu (°C)', 'Uwagi', 'Data dodania'
    ];

    const cleanTsv = (val) => String(val ?? '').replace(/[\t\r\n]+/g, ' ');

    // 1. Zwykły format tekstowy TSV (uniwersalny fallback)
    const tsvRows = state.filaments.map((f, i) => {
        const total = f.weight_total || 1000;
        const current = f.weight_current != null ? f.weight_current : total;
        const percentLeft = total > 0 ? Math.round((current / total) * 100) : 0;
        const dateStr = f.created_at ? new Date(f.created_at).toLocaleString('pl-PL') : '';
        const contrast = getContrastColor(f.color_hex);

        return [
            i + 1,
            cleanTsv(f.manufacturer),
            cleanTsv(f.material),
            cleanTsv(f.version),
            cleanTsv(f.color_name),
            contrast.bgHex,
            current,
            total,
            f.weight_spool || 220,
            `${percentLeft}%`,
            cleanTsv(f.status),
            cleanTsv(f.location),
            cleanTsv(f.temp_nozzle),
            cleanTsv(f.temp_bed),
            cleanTsv(f.notes),
            dateStr
        ].join('\t');
    });
    const tsvContent = [headers.join('\t'), ...tsvRows].join('\n');

    // 2. Format HTML ze stylami i kolorami komórek (Google Sheets wkleja kolory z HTML!)
    const htmlRows = state.filaments.map((f, i) => {
        const total = f.weight_total || 1000;
        const current = f.weight_current != null ? f.weight_current : total;
        const percentLeft = total > 0 ? Math.round((current / total) * 100) : 0;
        const dateStr = f.created_at ? new Date(f.created_at).toLocaleString('pl-PL') : '';
        const contrast = getContrastColor(f.color_hex);

        return `<tr>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${i + 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.manufacturer || '')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.material || '')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.version || '')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.color_name || '')}</td>
            <td style="background-color: ${contrast.bgHex}; color: ${contrast.textHex}; font-weight: bold; text-align: center; border: 1px solid #64748b; padding: 4px 8px; font-family: monospace;">${escapeHtml(contrast.bgHex)}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 4px 8px;">${current}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 4px 8px;">${total}</td>
            <td style="text-align: right; border: 1px solid #cbd5e1; padding: 4px 8px;">${f.weight_spool || 220}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${percentLeft}%</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.status || 'W użyciu')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.location || '')}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.temp_nozzle || '')}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.temp_bed || '')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(f.notes || '')}</td>
            <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px 8px;">${escapeHtml(dateStr)}</td>
        </tr>`;
    }).join('\n');

    const htmlContent = `<table>
        <thead>
            <tr style="background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center;">
                ${headers.map(h => `<th style="padding: 6px 10px; border: 1px solid #475569;">${escapeHtml(h)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${htmlRows}
        </tbody>
    </table>`;

    try {
        if (navigator.clipboard && window.ClipboardItem) {
            const blobHtml = new Blob([htmlContent], { type: 'text/html' });
            const blobText = new Blob([tsvContent], { type: 'text/plain' });
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': blobHtml,
                    'text/plain': blobText
                })
            ]);
            showToast('Skopiowano tabelę z kolorami! Wklej ją w Google Sheets (Ctrl+V).', 'success', 5000);
            return;
        }
    } catch (e) {
        console.warn('ClipboardItem text/html niedostępny, używam czystego tekstu:', e);
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(tsvContent);
        } else {
            const ta = document.createElement('textarea');
            ta.value = tsvContent;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        showToast('Skopiowano tabelę do schowka! Wklej ją w Google Sheets (Ctrl+V).', 'success', 5000);
    } catch (err) {
        showToast('Nie udało się skopiować do schowka: ' + err.message, 'error');
    }
}

// ------------------------------------------------------------------------------
// Kopia zapasowa (Backup JSON & Udostępnianie do Chmury)
// ------------------------------------------------------------------------------
function generateBackupObject() {
    return {
        app: '3D Filament Tracker',
        version: '1.0',
        exported_at: new Date().toISOString(),
        total_spools: state.filaments.length,
        filaments: state.filaments
    };
}

function downloadBackupJson() {
    if (!state.filaments || state.filaments.length === 0) {
        showToast('Baza jest pusta — brak danych do kopii.', 'error');
        return;
    }

    const backupObj = generateBackupObject();
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    a.href = url;
    a.download = `filament_tracker_backup_${dateFormatted}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Pobrano plik kopii zapasowej (.json)!', 'success');
}

async function shareBackupToCloud() {
    if (!state.filaments || state.filaments.length === 0) {
        showToast('Baza jest pusta — brak danych do kopii.', 'error');
        return;
    }

    const backupObj = generateBackupObject();
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const now = new Date();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const fileName = `filament_tracker_backup_${dateFormatted}.json`;

    // 1. Sprawdź Web Share API (dostępne w nowoczesnych przeglądarkach, smartfonach i Windows 10/11)
    try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Filament Tracker - Kopia bazy',
                text: `Kopia zapasowa bazy filamentów (${backupObj.total_spools} szpul)`,
                files: [file]
            });
            showToast('Udostępniono plik kopii zapasowej!', 'success');
            return;
        }
    } catch (shareErr) {
        if (shareErr.name === 'AbortError') return; // Użytkownik zamknął okno
        console.warn('Web Share API niedostępne lub błąd:', shareErr);
    }

    // 2. Jeśli bezpośrednie okno udostępniania plików nie jest wspierane, pobierz plik i wyświetl pomoc
    downloadBackupJson();
    showToast('Pobrano plik kopii! Przeciągnij go teraz do Google Drive lub OneDrive.', 'info', 6000);
}

// ------------------------------------------------------------------------------
// Awaryjne przywracanie bazy (Disaster Recovery / Restore)
// ------------------------------------------------------------------------------
let pendingRestoreData = null;

function handleRestoreFileSelect(event) {
    const file = event.target.files?.[0];
    const infoBox = document.getElementById('restoreFileInfo');
    const statusDiv = document.getElementById('restoreStatusResult');
    statusDiv.classList.add('hidden');

    if (!file) {
        pendingRestoreData = null;
        infoBox.classList.add('hidden');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            let items = null;

            if (Array.isArray(parsed)) {
                items = parsed;
            } else if (parsed && Array.isArray(parsed.filaments)) {
                items = parsed.filaments;
            } else if (parsed && Array.isArray(parsed.data)) {
                items = parsed.data;
            }

            if (!items || items.length === 0) {
                throw new Error('Plik nie zawiera listy szpul lub lista jest pusta.');
            }

            // Podstawowa weryfikacja rekordów
            const sample = items[0];
            if (!sample.manufacturer && !sample.material && !sample.color_name) {
                throw new Error('Plik nie zawiera poprawnych rekordów szpul (brak podstawowych pól).');
            }

            pendingRestoreData = items;

            document.getElementById('restoreFileName').textContent = file.name;
            const exportDate = parsed.exported_at ? new Date(parsed.exported_at).toLocaleString('pl-PL') : 'brak daty w pliku';
            document.getElementById('restoreFileMeta').textContent = `Liczba szpul w pliku: ${items.length} | Data kopii: ${exportDate}`;
            infoBox.classList.remove('hidden');
            initIcons();
        } catch (err) {
            pendingRestoreData = null;
            infoBox.classList.add('hidden');
            statusDiv.className = 'mt-3 text-xs p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 block';
            statusDiv.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1 text-red-400"></i> Błąd odczytu pliku: ${escapeHtml(err.message)}`;
            initIcons();
        }
    };
    reader.readAsText(file);
}

async function executeRestore() {
    if (!pendingRestoreData || pendingRestoreData.length === 0) {
        showToast('Wybierz najpierw poprawny plik kopii zapasowej.', 'error');
        return;
    }

    const mode = document.querySelector('input[name="restoreMode"]:checked')?.value || 'replace';
    const statusDiv = document.getElementById('restoreStatusResult');
    const restoreBtn = document.getElementById('btnExecuteRestore');
    const restoreLabel = document.getElementById('btnRestoreLabel');

    if (mode === 'replace') {
        const confirmMsg = `UWAGA: Wybrano opcję „Zastąp całą bazę”.\n\nWszystkie obecne szpule w bazie (${state.filaments.length}) zostaną USUNIĘTE i zastąpione danymi z kopii zapasowej (${pendingRestoreData.length} szpul).\n\nCzy na pewno chcesz kontynuować?`;
        if (!confirm(confirmMsg)) {
            return;
        }
    }

    restoreBtn.disabled = true;
    restoreLabel.textContent = 'Przywracanie danych...';
    statusDiv.className = 'mt-3 text-xs p-2.5 rounded-lg bg-slate-800 text-slate-300 block';
    statusDiv.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 inline animate-spin mr-1 text-cyan-400"></i> Trwa zapisywanie szpul w bazie...';
    initIcons();

    try {
        const sanitizedItems = pendingRestoreData.map(item => {
            const clean = {
                manufacturer: String(item.manufacturer || 'Nieznany').trim(),
                material: String(item.material || 'PLA').trim(),
                version: item.version ? String(item.version).trim() : null,
                color_name: String(item.color_name || 'Brak koloru').trim(),
                color_hex: item.color_hex && item.color_hex.startsWith('#') ? item.color_hex : '#3b82f6',
                location: String(item.location || 'Domyślna').trim(),
                weight_total: parseInt(item.weight_total) || 1000,
                weight_current: item.weight_current !== undefined ? parseInt(item.weight_current) : 1000,
                weight_spool: parseInt(item.weight_spool) || 220,
                temp_nozzle: item.temp_nozzle ? String(item.temp_nozzle).trim() : null,
                temp_bed: item.temp_bed ? String(item.temp_bed).trim() : null,
                status: item.status || 'W użyciu',
                notes: item.notes ? String(item.notes).trim() : null
            };

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
            if (isUuid && mode === 'replace') {
                clean.id = item.id;
            }
            if (item.created_at) {
                clean.created_at = item.created_at;
            }
            return clean;
        });

        if (state.isOnline && state.supabaseClient) {
            if (mode === 'replace') {
                // Usuń wszystkie istniejące szpule
                const { error: delError } = await state.supabaseClient
                    .from('filaments')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                if (delError) throw delError;
            }

            // Wstawiaj partiami po 50 sztuk
            const chunkSize = 50;
            for (let i = 0; i < sanitizedItems.length; i += chunkSize) {
                const chunk = sanitizedItems.slice(i, i + chunkSize);
                const { error: insError } = await state.supabaseClient
                    .from('filaments')
                    .insert(chunk);
                if (insError) throw insError;
            }

            await connectAndLoad();
        } else {
            if (mode === 'replace') {
                state.filaments = sanitizedItems.map((item, idx) => ({
                    ...item,
                    id: item.id || `demo-restored-${Date.now()}-${idx}`,
                    created_at: item.created_at || new Date().toISOString()
                }));
            } else {
                const newItems = sanitizedItems.map((item, idx) => ({
                    ...item,
                    id: `demo-restored-${Date.now()}-${idx}`,
                    created_at: item.created_at || new Date().toISOString()
                }));
                state.filaments = [...newItems, ...state.filaments];
            }
            localStorage.setItem('filament_demo_items', JSON.stringify(state.filaments));
            render();
        }

        statusDiv.className = 'mt-3 text-xs p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 block';
        statusDiv.innerHTML = `✓ Pomyślnie przywrócono ${sanitizedItems.length} szpul do bazy danych!`;
        showToast(`Przywrócono ${sanitizedItems.length} szpul!`, 'success');

        pendingRestoreData = null;
        document.getElementById('restoreFileInput').value = '';
        setTimeout(() => {
            document.getElementById('restoreFileInfo').classList.add('hidden');
        }, 2000);

    } catch (err) {
        console.error('Błąd przywracania bazy:', err);
        statusDiv.className = 'mt-3 text-xs p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 block';
        statusDiv.innerHTML = `✕ Błąd przywracania: ${escapeHtml(err.message)}`;
        showToast('Błąd podczas przywracania bazy danych.', 'error');
    } finally {
        restoreBtn.disabled = false;
        restoreLabel.textContent = 'Przywróć dane do bazy';
        initIcons();
    }
}
