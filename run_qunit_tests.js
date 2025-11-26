const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8877;
const ROOT_DIR = '.';

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

function startServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            // Parse the URL and remove the query string to get the pathname
            const pathname = url.parse(req.url).pathname;
            const filePath = path.join(ROOT_DIR, pathname === '/' ? 'test.html' : pathname);
            const extname = path.extname(filePath);
            const contentType = MIME_TYPES[extname] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    if (err.code == 'ENOENT') {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(`<h1>404 Not Found: ${pathname}</h1>`);
                    } else {
                        res.writeHead(500);
                        res.end(`Sorry, check with the site admin for error: ${err.code} ..\n`);
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        });

        server.listen(PORT, (err) => {
            if (err) {
                return reject(err);
            }
            console.log(`Server is listening on http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

async function runTests() {
    let server;
    let browser;
    try {
        server = await startServer();
        browser = await chromium.launch();
        const page = await browser.newPage();

        // Log browser console errors to the Node console
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser console error: ${msg.text()}`);
            }
        });

        await page.goto(`http://localhost:${PORT}/test.html`);

        // Wait for the QUnit test run to complete
        await page.waitForSelector('#qunit-testresult.result', { timeout: 15000 });

        const testResult = await page.evaluate(() => {
            const failedEl = document.querySelector('#qunit-testresult .failed');
            const totalEl = document.querySelector('#qunit-testresult .total');
            return {
                failed: failedEl ? parseInt(failedEl.textContent, 10) : 0,
                total: totalEl ? parseInt(totalEl.textContent, 10) : 0,
            };
        });

        if (testResult.failed > 0) {
            await page.screenshot({ path: 'test_failure.png' });
            console.error('Screenshot of the failure saved to test_failure.png');
            throw new Error(`${testResult.failed} of ${testResult.total} QUnit tests failed.`);
        }

        console.log(`All ${testResult.total} QUnit tests passed!`);

    } catch (error) {
        console.error('An error occurred during testing:', error);
        process.exit(1); // Exit with a failure code
    } finally {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.close();
        }
        // Only exit with success code if no error occurred
        if (!process.exitCode) {
            process.exit(0);
        }
    }
}

runTests();