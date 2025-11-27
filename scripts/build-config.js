const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

try {
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

  // Ensure frontend directory exists
  if (!fs.existsSync(path.join(__dirname, '../frontend'))) {
    fs.mkdirSync(path.join(__dirname, '../frontend'));
  }

  fs.writeFileSync(path.join(__dirname, '../frontend/config.json'), JSON.stringify(output, null, 2));
  console.log('Successfully generated frontend/config.json');

} catch (e) {
  console.error('Error parsing .upptimerc.yml or generating config:', e);
  process.exit(1);
}
