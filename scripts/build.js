const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Helper to copy directories recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    // 1. Prepare Output Directory
    const publicDir = path.join(__dirname, '../public');
    if (fs.existsSync(publicDir)) {
        fs.rmSync(publicDir, { recursive: true, force: true });
    }
    fs.mkdirSync(publicDir);

    // 2. Copy Frontend Assets
    const frontendDir = path.join(__dirname, '../frontend');
    copyDir(frontendDir, publicDir);
    // Remove the dev config.json if it exists in source to avoid confusion,
    // though we will overwrite it next.

    // 3. Copy API Data
    const apiSrcDir = path.join(__dirname, '../api');
    const apiDestDir = path.join(publicDir, 'api');
    copyDir(apiSrcDir, apiDestDir);

    // 3.5 Copy Graphs
    const graphsSrcDir = path.join(__dirname, '../graphs');
    const graphsDestDir = path.join(publicDir, 'graphs');
    if (fs.existsSync(graphsSrcDir)) {
        copyDir(graphsSrcDir, graphsDestDir);
    }

    // 4. Generate Config
    const configFile = fs.readFileSync(path.join(__dirname, '../.upptimerc.yml'), 'utf8');
    const config = yaml.load(configFile);

    // Helper function to slugify site names (matching Upptime's behavior)
    const slugify = (text) => {
        return text
            .toString()
            .replace(/([a-z])([A-Z])/g, '$1-$2') // Split camelCase (OurCraft -> Our-Craft)
            .toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    };

    const output = {
        owner: config.owner,
        repo: config.repo,
        sites: config.sites.map(site => ({
            ...site,
            slug: slugify(site.name)
        })),
        i18n: config.i18n,
        statusWebsite: config['status-website']
    };

    fs.writeFileSync(path.join(publicDir, 'config.json'), JSON.stringify(output, null, 2));

    // 5. Generate CNAME
    if (config['status-website'] && config['status-website'].cname) {
        fs.writeFileSync(path.join(publicDir, 'CNAME'), config['status-website'].cname);
    }

    // Cleanup: Remove config.json from frontend/ if it was generated there previously
    // to avoid confusion in dev.
    if (fs.existsSync(path.join(frontendDir, 'config.json'))) {
        fs.unlinkSync(path.join(frontendDir, 'config.json'));
    }

    console.log('Build completed successfully. Output in public/');

} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}
