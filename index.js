const [node, file, ...args] = process.argv;

// If no arguments are found
if (!args.length) {
  console.error("No arguments found");
  console.info(
    "To use this script pass at least one .json file path similar to example.json"
  );
  process.exit(1);
}

const $ = require("cheerio");
const axios = require("axios");
const { registerFont, createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const QRCode = require('qrcode')

registerFont(
  "./node_modules/@openfonts/montserrat_all/files/montserrat-all-400.woff",
  { family: "montserrat-normal" }
);

registerFont(
  "./node_modules/@openfonts/montserrat_all/files/montserrat-all-700.woff",
  { family: "montserrat-bold" }
);

const cache = ".cache";
if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache);
}

const eventos = "eventos";
if (!fs.existsSync(eventos)) {
  fs.mkdirSync(eventos);
}

async function downloadImage(url, path) {
  const writer = fs.createWriteStream(path);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function getUserImage(githubHandle) {
  let imgUrl;

  // Se não tiver handle, use imagem de fallback
  if (!githubHandle || githubHandle === "") {
    return loadImage("./desconhecido.png");
  }

  // Se imagem não estiver no cache, minere ela do github e coloque em cache
  let cached = path.resolve(`.cache`, `${githubHandle}.jpeg`);
  if (!fs.existsSync(cached)) {
    const result = await axios(`https://github.com/${githubHandle}`).catch(
      (e) => {
        console.error("Failed to fetch github html");
        console.error(e);
      }
    );

    imgUrl = $(".avatar.avatar-user", result.data).attr("src");
    await downloadImage(imgUrl, cached);
  }

  // Carregue imagem do cache
  return loadImage(cached);
}

async function processFiles() {
  for (let i = 0; i < args.length; i++) {
    let rawdata = fs.readFileSync(args[i]);
    let event = JSON.parse(rawdata);
    const { speaker1, speaker2, date, time, title, subtitle, url } = event;

    const promises = [
      getUserImage(speaker1.github),
      getUserImage(speaker2.github),
    ];

    const images = await Promise.all(promises);

    speaker1.githubImg = images[0];
    speaker2.githubImg = images[1];

    // Load images
    const backgroundImg = await loadImage("./background.png");

    // Create canvas image
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.save();
    ctx.drawImage(backgroundImg, 0, 0, 1280, 720);
    // ctx.globalCompositeOperation='difference';
    // ctx.fillStyle = "white";
    // ctx.globalAlpha = 1;
    // ctx.fillRect(0, 0, 1280, 720);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(850, 280, 140, 0, Math.PI * 2);
    // ctx.strokeStyle = "#f00";
    // ctx.stroke();
    ctx.clip();
    ctx.drawImage(speaker1.githubImg, 710, 140, 280, 280);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(1090, 180, 140, 0, Math.PI * 2);
    // ctx.strokeStyle = "#f00";
    // ctx.stroke();
    ctx.clip();
    ctx.drawImage(speaker2.githubImg, 950, 40, 280, 280);
    ctx.restore();

    // texts
    ctx.fillStyle = "#4c7861";
    ctx.textBaseline = "top";

    // Write title
    ctx.font = "41px montserrat-bold";
    ctx.fillText(title, 205, 185);
    // write date and time
    ctx.fillText(date, 250, 340);
    ctx.fillText(time, 250, 385);

    // Write subtitle
    ctx.font = "38px montserrat-normal";
    ctx.fillText(subtitle, 205, 235);

    ctx.textAlign = "center";
    // write company 1
    ctx.font = "28px montserrat-bold";
    ctx.fillText("@" + speaker2.company, 1090, 395);
    // write company 2
    ctx.fillText("@" + speaker1.company, 850, 495);

    // write name / last name 1
    ctx.fillStyle = "#000000";
    ctx.font = "35px montserrat-bold";
    ctx.fillText(speaker2.name, 1090, 320);
    ctx.fillText(speaker2.lastname, 1090, 355);
    // write name / last name 2
    ctx.fillText(speaker1.name, 850, 420);
    ctx.fillText(speaker1.lastname, 850, 455);


    // Draw QRCode
    const canvasQrcode = createCanvas(600, 600);
    await QRCode.toCanvas(canvasQrcode, url)
    ctx.drawImage(canvasQrcode, 1280 - canvasQrcode.width, 720 - canvasQrcode.height, canvasQrcode.width, canvasQrcode.height);

    // Save image to fs
    const base64Data = canvas
      .toDataURL("image/png")
      .replace(/^data:image\/png;base64,/, "");

    fs.writeFileSync(
      path.resolve(
        eventos,
        `${date.replace(/(\/| )/g, "-")}-${time.replace(/:/g, "")}.png`
      ),
      base64Data,
      "base64"
    );

    console.log(`Image for event '${title}' is done`);
  }

  process.exit(0);
}

processFiles();
