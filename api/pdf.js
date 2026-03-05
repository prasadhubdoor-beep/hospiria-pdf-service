const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple secret key check — hardcoded on both sides
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== 'hosp-pdf-secret-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'Missing html in request body' });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        chromium.headless,
    });

    const page = await browser.newPage();

    // Set A4 viewport
    await page.setViewport({ width: 794, height: 1123 });

    // Load HTML content
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for Google Fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Generate PDF — A4, no margins (HTML handles its own padding)
    const pdfBuffer = await page.pdf({
      format:           'A4',
      printBackground:  true,
      margin:           { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await browser.close();

    // Return PDF binary
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
