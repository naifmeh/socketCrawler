const ws = require('ws');

const wss = new ws('ws://localhost:8081');

let response = {
    useragent:"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36",
    url:"naifmehanna.com",
    loadpictures:false,
    runcss:true,
    plugins:true,
    webdriver:true,
}

wss.on('open', function open() {
    wss.send(JSON.stringify(response))
});

wss.on('message', function incomind(data) {
    console.log(data);
});


