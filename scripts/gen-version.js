const fs = require("fs");

const now = new Date();

const version =
    now.getFullYear().toString().slice(2) +
    ("0" + (now.getMonth() + 1)).slice(-2) +
    ("0" + now.getDate()).slice(-2) +
    "-" +
    ("0" + now.getHours()).slice(-2) +
    ("0" + now.getMinutes()).slice(-2);

fs.writeFileSync(
    "js/version.js",
    `window.APP_VERSION = "${version}";`
);

console.log("✔ Versión generada:", version);