document.addEventListener('DOMContentLoaded', async () => {
    const config = await fetchConfig();
    if (config) {
        applyConfig(config);
        renderServices(config.sites);
    }
});

async function fetchConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Failed to load config');
        return await response.json();
    } catch (error) {
        console.error('Error fetching config:', error);
        document.getElementById('global-status').innerHTML = '<span class="status-text" style="color: var(--error-color)">Error loading configuration</span>';
        return null;
    }
}

function applyConfig(config) {
    // Title and Metadata
    if (config.statusWebsite) {
        const sw = config.statusWebsite;
        document.title = sw.name || 'Service Status';

        const pageTitle = document.getElementById('page-title');
        if (sw.introTitle) {
            // Very basic markdown parsing for bold text
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
            // Basic markdown link parsing [text](url)
            let introHtml = sw.introMessage
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            document.getElementById('intro-message').innerHTML = introHtml;
        }

        if (sw.navbar) {
            const nav = document.getElementById('navbar');
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
    const grid = document.getElementById('services-grid');
    grid.innerHTML = ''; // Clear loading state

    let totalSites = 0;
    let upSites = 0;
    let degradedSites = 0;

    // We need to fetch data for all sites
    const servicePromises = sites.map(async (site) => {
        try {
            // Fetch uptime and response time data
            // We use the slug from config.json to find the correct api folder
            const [uptimeRes, responseTimeRes] = await Promise.all([
                fetch(`./api/${site.slug}/uptime.json`),
                fetch(`./api/${site.slug}/response-time.json`)
            ]);

            let uptimeData = { message: 'Unknown' };
            let responseTimeData = { message: 'Unknown' };

            if (uptimeRes.ok) uptimeData = await uptimeRes.json();
            if (responseTimeRes.ok) responseTimeData = await responseTimeRes.json();

            return {
                ...site,
                status: uptimeData.message.includes('%') ? 'up' : 'down', // Heuristic: Upptime puts percentage if up
                uptime: uptimeData.message,
                responseTime: responseTimeData.message,
                color: uptimeData.color
            };
        } catch (e) {
            console.error(`Failed to fetch data for ${site.name}`, e);
            return {
                ...site,
                status: 'unknown',
                uptime: '-',
                responseTime: '-'
            };
        }
    });

    const services = await Promise.all(servicePromises);

    services.forEach(service => {
        totalSites++;

        // Determine status based on color from shields.io json usually:
        // brightgreen: Up, green: Up, yellow: Degraded, red: Down
        let statusClass = 'up';
        let statusText = 'Operational';

        if (service.color === 'red') {
            statusClass = 'down';
            statusText = 'Down';
        } else if (service.color === 'yellow' || service.color === 'orange') {
            statusClass = 'degraded';
            statusText = 'Degraded';
            degradedSites++;
        } else {
            upSites++;
        }

        // Override if logic suggests down
        if (service.status === 'down') { // This logic was weak above, rely on color
             // If fetch failed or explicitly down
        }

        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="service-name">
                    ${service.icon ? `<img src="${service.icon}" class="service-icon" alt="">` : ''}
                    <a href="${service.url}" target="_blank">${service.name}</a>
                </div>
                <div class="status-pill ${statusClass}">${statusText}</div>
            </div>
            <div class="card-stats">
                <div class="stat-item">
                    <span class="stat-label">Response Time</span>
                    <span class="stat-value">${service.responseTime}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Uptime (All time)</span>
                    <span class="stat-value">${service.uptime}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    updateGlobalStatus(totalSites, upSites, degradedSites);
}

function updateGlobalStatus(total, up, degraded) {
    const statusEl = document.getElementById('global-status');
    const icon = statusEl.querySelector('.status-icon');
    const text = statusEl.querySelector('.status-text');

    if (up === total) {
        statusEl.className = 'status-summary up';
        icon.textContent = '✅';
        text.textContent = 'All systems operational';
    } else if (up === 0 && total > 0) {
        statusEl.className = 'status-summary down';
        icon.textContent = '❌';
        text.textContent = 'Major outage';
    } else {
        statusEl.className = 'status-summary degraded';
        icon.textContent = '⚠️';
        text.textContent = 'Partial outage';
    }
}
