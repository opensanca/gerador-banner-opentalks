const args = process.argv.splice(2);

// If no arguments are found
if (!args.length) {
  console.error("No arguments found");
  console.info(
    "To use this script pass at least one .json file path similar to example.json"
  );
  process.exit(1);
}

const { createSVGWindow } = require("svgdom");
const $ = require("cheerio");
const axios = require("axios");
const { SVG, registerWindow } = require("@svgdotjs/svg.js");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const QRCode = require("qrcode");

const IDS = {
  TITULO: "#tspan9598",
  DATE: "#tspan9598-0",
  QRCODE: "#image1482-3-6",
  PALESTRAS: [
  {
    id: 1,
    IMG: "#image1482-3",
    TITULO: "#tspan9651-3-2",
    NOME: "#tspan9647-0-2",
    EMPRESA: "#tspan910-5",
  },
  {
    id: 2,
    IMG: "#image1482",
    TITULO: "#tspan9651-3",
    NOME: "#tspan9647-0",
    EMPRESA: "#tspan910",
  }],
};

const cache = ".cache";
if (!fs.existsSync(cache)) {
  fs.mkdirSync(cache);
}

const eventos = "imagens";
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
  return cached;
}

async function processFiles() {
  for (let i = 0; i < args.length; i++) {
    let rawdata = fs.readFileSync(args[i]);
    let event = JSON.parse(rawdata);
    const { speakers, date, time, title, url, templates } = event;

    for (let t = 0; t < templates.length; t++) {
      const window = createSVGWindow();
      const document = window.document;
      registerWindow(window, document);

      const template = templates[t];
      console.log(template);
      const svgRawdata = fs.readFileSync(
        path.resolve("templates", template),
        "utf-8"
      );
      const canvas = SVG(document.documentElement);
      canvas.svg(svgRawdata);

      const options = {
        width: canvas.find("svg").attr("width")[0],
        height: canvas.find("svg").attr("height")[0],
      };

      const promises = speakers.map(speaker => getUserImage(speaker.github))

      const images = await Promise.all(promises);

      canvas.find(IDS.TITULO).text(title);
      canvas.find(IDS.DATE).text(`${date} ${time}`);

      speakers.forEach((speaker, index) => {
        canvas.find(IDS.PALESTRAS[index].TITULO).text(speakers[index].title);
        canvas
          .find(IDS.PALESTRAS[index].IMG)
          .attr(
            "xlink:href",
            "data:image/jpeg;base64," + base64_encode(images[index])
          );
  
        canvas.find(IDS.PALESTRAS[index].NOME).text(speakers[index].fullname);
        canvas.find(IDS.PALESTRAS[index].EMPRESA).text("@" + speakers[index].company);          
      });

      // Draw QRCode
      const canvasQrcode = createCanvas(600, 600);
      await QRCode.toCanvas(canvasQrcode, url);
      const QrCode64 = canvasQrcode.toDataURL();
      canvas.find(IDS.QRCODE).attr("xlink:href", QrCode64);

      const dateString =  date.replace(/(\/| )/g,"-");
      const fileOutputPath = `${template}-${time.replace(/:/g, "")}`;

      const eventPath = path.resolve(eventos, dateString);

      if (!fs.existsSync(eventPath)) {
        fs.mkdirSync(eventPath);
      }

      const svg = canvas.svg();

      await svgToImage(
        svg,
        path.resolve(eventPath, `${fileOutputPath}.png`),
        options
      );

      fs.writeFileSync(path.resolve(eventPath, `${fileOutputPath}.svg`), canvas.findOne('svg svg').svg(), "utf-8");

      console.log(`Image for event '${title}' is done`);
    }
  }

  process.exit(0);
}

const sharp = require("sharp");

function base64_encode(file) {
  // read binary data
  var bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  const base64 = new Buffer.from(bitmap).toString("base64");

  return base64;
}

async function svgToImage(svgString, filePath, options) {
  console.log(options);
  let img = sharp(Buffer.from(svgString)).extract({
    left: 0,
    top: 0,
    width: options.width,
    height: options.height,
  });
  await img.toFile(filePath);
}

processFiles();
