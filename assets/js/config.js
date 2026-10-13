// The one file to edit after deploying the Worker (see README).
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

export const config = {
  // URL of the deployed Cloudflare Worker, without a trailing slash.
  apiBase: LOCAL ? 'http://127.0.0.1:8787' : 'https://larpin-api.YOUR-SUBDOMAIN.workers.dev',
  // GitHub repository that hosts the site and the larp-stuff folder.
  repo: 'izzyfrm/larpin',
  // Where people reach the operator. Shown in the Terms and Privacy Policy.
  contactUrl: 'https://github.com/izzyfrm/larpin/issues',
  contactLabel: 'github.com/izzyfrm/larpin/issues',
};

export const apiConfigured = !config.apiBase.includes('YOUR-SUBDOMAIN');
