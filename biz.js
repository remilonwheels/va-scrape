const axios = require('axios');
const _ = require('lodash');
const stringify = require('csv-stringify');
const fs = require('fs');
const { Readable, Transform } = require('stream'); 
const cheerio = require('cheerio');
const util = require('util'),
    es = require('event-stream'),
    parse = require('csv-parse'),
    iconv = require('iconv-lite');

function getBizData(bizId) {
  return axios.request(setConfig(bizId));
}

function print(ay) {
  console.log(ay)
}

async function processFileBizData(file, csvTransform) {
  var s = fs.createReadStream(file)
    .pipe(es.split())
    .pipe(es.mapSync(async function(line){

        // pause the readstream
        s.pause();
        // lineNr += 1;

        // process line here and call s.resume() when rdy
        // function below was for logging memory usage
        parse(line, {}, async (err, parsedLine) => {
          if (_.isEmpty(parsedLine)) {
            s.resume();
          } else {
            console.log('parsed', parsedLine)
            const yo = parsedLine[0];
            const id = yo[1];
            const { data: html } = await getBizData(id);
            const $ = cheerio.load(html);
  
            const name = $('#detail-entity-name').text();
  
            const entityDetail = $('.entity-detail');
  
            const generalRaw = [];
            entityDetail.find('fieldset:first-child > div')
              .each((i, el) => {
                generalRaw.push(entityDetail.find(el).text())
              });
            const general = _.chain(generalRaw)
              .slice(0,5)
              .map(div => _.chain(div)
                .replace(/\n/g, '')
                .split(':')
                .get('1')
                .trim()
                .value())
              .value()
  
            const principalOfficeRaw = [];
            const principalOfficeHtml = entityDetail.find('fieldset:nth-child(2)');
            principalOfficeHtml.find('> div:nth-child(2), > div:nth-child(3), > div:nth-child(4) > span')
              .each((i, el) => {
                principalOfficeRaw.push(entityDetail.find(el).text())
              });
            
            const principalOffice = _.chain(principalOfficeRaw)
              .map(div => _.chain(div)
                .replace(/\n/g, '')
                .trim()
                .value())
              .value()
  
            const registeredAgentRaw = [];
            const registeredAgentHtml = entityDetail.find('fieldset:nth-child(3)');
            registeredAgentHtml.find('> div')
              .each((i, el) => {
                if (i === 5 || i === 6) {
                  const formatted = _.chain(entityDetail.find(el).text())
                  .split(':')
                  .get('1');
                  registeredAgentRaw.push(formatted);
                    
                } else {
                  registeredAgentRaw.push(entityDetail.find(el).text())
                }
              });
            
            const registeredAgent = _.chain(registeredAgentRaw)
              .map(div => _.chain(div)
                .replace(/\s\s+/g, ' ')
                .trim()
                .value())
              .value()
  
            const record = _.concat(name, general, principalOffice, registeredAgent);
            csvTransform.write(record, () => {});
  
            s.resume();
          }
        })

        // resume the readstream, possibly from a callback
    })
    .on('error', function(err){
        console.log('Error while reading file.', err);
    })
    .on('end', function(){
        console.log('Read entire file.')
    })
);
}

// const outputFile = fs.createWriteStream('holla.txt');

// const inputFile = fs.createReadStream('all-or-nothing.txt');

// const fileOptions = {
//   delimiter: ','
// }
// const csvStringify = stringify(fileOptions);

// csvStringify.pipe(outputFile);

const setConfig = (id) => ({
  method: 'get',
  url: `https://sccefile.scc.virginia.gov/Business/${id}`
});

const TOTAL_FILES = 40;
const FILES_PER_CALL = 10;

const apiArray = _.times(TOTAL_FILES / FILES_PER_CALL, (n) => {
  return setConfig(n * FILES_PER_CALL, FILES_PER_CALL);
});

// processFileBizData('keep/ID_1_5000.txt');

console.log(typeof process.argv[2])

function doIt(inputFilename) {
  const outputFile = fs.createWriteStream(`biz_data_${inputFilename}`);
  const fileOptions = {
    delimiter: ','
  }
  const csvStringify = stringify(fileOptions);
  csvStringify.pipe(outputFile);
  processFileBizData(inputFilename, csvStringify);
}

doIt(process.argv[2]);