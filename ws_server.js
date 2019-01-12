const ws = require('ws');

async function launchCrawler(config, debug=false) {
    let user_agent = config._useragent;
    let url = config._url;
    let viewportType = "desktop";
    let loadPictures = config._loadpictures;
    let runCss = config._runcss;
    let plugins = config._plugins;
    let webdriver = config._webdriver;
    let action='screenshot';

    const puppeteer = require('puppeteer');
    const regexOccurence = require('regex-occurrence');

    let sigint_cntr = 0;
    let siginthandler = () => {
        sigint_cntr++;
        console.log('Caught SIGINT...');
        setTimeout(()=> {
            sigint_cntr = 0;
        },7000); //Remise a zero du compteur de sigint apres 7 secondes
        if(sigint_cntr == 1)
            throw new Error('SIGINT requested');
        else if(sigint_cntr == 3)
            process.exit(-1);

    };
    process.on('SIGINT', siginthandler);

    const fs = require('fs');
    try {


        let properties = {};
        properties.args = [];
        if(debug) {
            properties.headless = true;
        }
        properties.args.push('--disable-notifications');
        properties.headless = false;
        const browser = await puppeteer.launch(properties);
        const page = await browser.newPage();
        if(user_agent !== undefined) {
            await page.setUserAgent(user_agent);
        }


        if(url === '') {
            throw new Error("URL not defined");
        }

        if(plugins) {
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                })
            });
        }

        if(webdriver) {
            await page.evaluateOnNewDocument(() => {
                const newProto = Object.getPrototypeOf(navigator);
                delete newProto.webdriver;
                Object.setPrototypeOf(navigator, newProto);
            })
        }
        if(!loadPictures || !runCss) {
            await page.setRequestInterception(true);
            if(!loadPictures && !runCss) {
                await page.on('request', (req) => {
                    if (['image', 'stylesheet'].indexOf(req.resourceType()) > -1) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
            }
            else if (!loadPictures && runCss) {
                await page.on('request', (req) => {
                    if (req.resourceType() === 'image') {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
            }
            else if (!runCss && loadPictures) {
                await page.on('request', (req) => {
                    if(req.resourceType() === 'stylesheet') {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
            }
        }
        let link = url;
        if(!regexOccurence(url, /http[s]*:\/\/.+/gm))
            link = 'http://'+url;


        page.on('unhandledRejection', () => {
            throw new Error('Unhandled rejection inside of browser');
        });
        page.on('uncaughtException', () => {
            throw new Error('Uncaught exception inside browser');
        });


        let response = await page.goto(link, {timeout:30000, waitUntil:'networkidle2'});
        let status = response._status;
        if (status === undefined) {
            link = link.replace('http', 'https');
            response = await page.goto(link,{timeout:30000, waitUntil:'networkidle2'});
            status = response._status;
        }

        let content = await page.content();


        const captchaOcc = regexOccurence(content, /(captcha)+/gi);
        const cloudflareOcc = regexOccurence(content, /(cloudflare)+/ig);
        const pleaseAllowOcc = regexOccurence(content, /(Please allow up)([A-Za-z ])+([0-9])+( seconds)+/gi);

        if (pleaseAllowOcc >= 1 && cloudflareOcc >= 1) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        if (action === 'screenshot') {
            await page.screenshot({path: `${__dirname}/screenshots/currentPicture.png`, fullPage: true});
        }
        let stats = fs.statSync(`${__dirname}/screenshots/currentPicture.png`);


        let propertyObject = {};
        propertyObject.fileSize = stats.size;
        propertyObject.captchaOccurence = captchaOcc;
        propertyObject.cloudflareOccurence = cloudflareOcc;
        propertyObject.pleaseAllowOccurence = pleaseAllowOcc;
        propertyObject.responseCode = status;

        await browser.close();
        return Promise.resolve(propertyObject);
    }catch(err) {
        console.error(err);

        let propertyObject = {};
        propertyObject.unknown = true;
        clearTimeout(timeout);
        return Promise.resolve(propertyObject);
    } finally {
        console.log('Finished crawl...');
        process.removeListener('SIGINT', siginthandler)
    }


}
const wss = new ws.Server({port:8081});

wss.on('connection', ws=> {
    ws.on('message', message => {
        console.log(message);
        let config = JSON.parse(message);
        (async () => {
            try {
                let propObject = await launchCrawler(config);
                ws.send(JSON.stringify(propObject));
            } catch(err) {
                console.error(err);
            }
        })();
    });
});