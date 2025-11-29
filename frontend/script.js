
let globalConfig = null;
let globalServices = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Load Config
    globalConfig = await fetchConfig();
    if (globalConfig) {
        applyConfig(globalConfig);
        await renderServices(globalConfig.sites);
    }
});

function updateContent() {
    if (!globalServices.length) return;

    // Re-render Global Status
    const total = globalServices.length;
    let up = 0;
    let degraded = 0;

    globalServices.forEach(s => {
        if (s.calculatedStatus === 'up') up++;
        if (s.calculatedStatus === 'degraded') degraded++;
    });

    updateGlobalStatus(total, up, degraded);

    // Re-render Service Cards
    renderServiceGrid(globalServices);
}

async function fetchConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load config');
        return await response.json();
    } catch (error) {
        console.error('Error fetching config:', error);
        document.getElementById('global-status').innerHTML = `<span class="status-text" style="color: var(--error-color)">Error loading configuration</span>`;
        return null;
    }
}

function applyConfig(config) {
    if (config.statusWebsite) {
        const sw = config.statusWebsite;
        document.title = sw.name || 'Service Status';

        const pageTitle = document.getElementById('page-title');
        // Basic markdown parsing
        if (sw.introTitle) {
             pageTitle.innerHTML = sw.introTitle.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } else {
            pageTitle.textContent = sw.name;
        }

        if (sw.logoUrl) {
            const logo = document.getElementById('logo');
            logo.src = sw.logoUrl;
            logo.classList.remove('hidden');
        }
        if (sw.favicon) {
            document.getElementById('favicon').href = sw.favicon;
        }
        if (sw.introMessage) {
            let introHtml = sw.introMessage
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            document.getElementById('intro-message').innerHTML = introHtml;
        }
        if (sw.navbar) {
            const nav = document.getElementById('navbar');
            nav.innerHTML = '';
            sw.navbar.forEach(item => {
                const link = document.createElement('a');
                link.href = item.href;
                link.textContent = item.title;
                nav.appendChild(link);
            });
        }
    }
    if (config.i18n && config.i18n.footer) {
        document.getElementById('footer').textContent = config.i18n.footer;
    }
}

async function renderServices(sites) {
    // Note: We intentionally do NOT clear the grid here to prevent CLS.
    // The skeleton loaders will remain until we call updateContent().

    // Fetch data
    const servicePromises = sites.map(async (site) => {
        try {
            const [uptimeRes, responseTimeRes] = await Promise.all([
                fetch(`./api/${site.slug}/uptime.json`),
                fetch(`./api/${site.slug}/response-time.json`)
            ]);

            let uptimeData = { message: 'Unknown' };
            let responseTimeData = { message: 'Unknown' };

            if (uptimeRes.ok) uptimeData = await uptimeRes.json();
            if (responseTimeRes.ok) responseTimeData = await responseTimeRes.json();

            let status = 'up';
            if (uptimeData.color === 'red') status = 'down';
            else if (uptimeData.color === 'yellow' || uptimeData.color === 'orange') status = 'degraded';

            return {
                ...site,
                calculatedStatus: status,
                uptimeMsg: uptimeData.message,
                responseTimeMsg: responseTimeData.message,
            };
        } catch (e) {
            console.error(`Failed to fetch data for ${site.name}`, e);
            return {
                ...site,
                calculatedStatus: 'unknown',
                uptimeMsg: '-',
                responseTimeMsg: '-'
            };
        }
    });

    globalServices = await Promise.all(servicePromises);
    updateContent();
}

function renderServiceGrid(services) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    services.forEach(service => {
        let statusText = "Systems Normal";
        if (service.calculatedStatus === 'down') statusText = "Down";
        if (service.calculatedStatus === 'degraded') statusText = "Degraded";

        const card = document.createElement('div');
        card.className = `service-card ${service.calculatedStatus}`;

        // Header (Always Visible)
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `
            <div class="service-name">
                ${service.icon ? `<img src="${service.icon}" class="service-icon" alt="">` : ''}
                <span>${service.name}</span>
            </div>
            <div class="status-pill ${service.calculatedStatus}">${statusText}</div>
        `;

        // Stats Row (Always Visible)
        const stats = document.createElement('div');
        stats.className = 'card-stats';
        stats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Latency</span>
                <span class="stat-value">${service.responseTimeMsg}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Uptime</span>
                <span class="stat-value">${service.uptimeMsg}</span>
            </div>
        `;

        // Graph Container (Hidden by default)
        const graphContainer = document.createElement('div');
        graphContainer.className = 'graph-container hidden';
        graphContainer.innerHTML = `
            <div class="graph-controls">
                <button data-period="day" class="active">24h</button>
                <button data-period="week">Week</button>
                <button data-period="month">Month</button>
            </div>
            <div class="graph-image-wrapper">
                <img src="./graphs/${service.slug}/response-time-day.png" alt="Response Time Graph" class="graph-img">
            </div>
        `;

        // Toggle Logic
        header.addEventListener('click', () => {
            card.classList.toggle('expanded');
            graphContainer.classList.toggle('hidden');
        });

        // Graph Switch Logic
        const buttons = graphContainer.querySelectorAll('.graph-controls button');
        const img = graphContainer.querySelector('.graph-img');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card toggle
                // Update active state
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update Image
                const period = btn.getAttribute('data-period');
                img.src = `./graphs/${service.slug}/response-time-${period}.png`;
            });
        });

        // Add to DOM
        card.appendChild(header);
        card.appendChild(stats);
        card.appendChild(graphContainer);
        grid.appendChild(card);
    });
}

function updateGlobalStatus(total, up, degraded) {
    const statusEl = document.getElementById('global-status');
    const icon = statusEl.querySelector('.status-icon');
    const text = statusEl.querySelector('.status-text');

    if (up === total) {
        statusEl.className = 'status-summary up';
        icon.textContent = '🌸';
        text.textContent = "All Systems Go";
    } else if (up === 0 && total > 0) {
        statusEl.className = 'status-summary down';
        icon.textContent = '🥀';
        text.textContent = "Major Outage";
    } else {
        statusEl.className = 'status-summary degraded';
        icon.textContent = '💮';
        text.textContent = "Partial Outage";
    }
}
