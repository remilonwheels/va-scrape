const axios = require('axios');
const _ = require('lodash');
const stringify = require('csv-stringify');
const fs = require('fs');
const { Readable } = require('stream'); 
const { Transform } = require('stream');
const cheerio = require('cheerio');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

const Cookie = `SpryMedia_DataTables_searchResults_business=%7B%22iCreate%22%3A1524333584971%2C%22iStart%22%3A0%2C%22iEnd%22%3A0%2C%22iLength%22%3A25%2C%22aaSorting%22%3A%5B%5B0%2C%22asc%22%2C0%5D%5D%2C%22oSearch%22%3A%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%2C%22aoSearchCols%22%3A%5B%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%2C%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%2C%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%2C%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%2C%7B%22bCaseInsensitive%22%3Atrue%2C%22sSearch%22%3A%22%22%2C%22bRegex%22%3Afalse%2C%22bSmart%22%3Atrue%7D%5D%2C%22abVisCols%22%3A%5Btrue%2Ctrue%2Ctrue%2Ctrue%2Ctrue%5D%2C%22SearchText%22%3A%22e%22%2C%22PreviousSearchPattern%22%3A%22C%22%7D; NSC_FDQSPEXFC=ffffffffc3a01b7845525d5f4f58455e445a4a4233ec; citrix_ns_id=/EiD84w1w8n9NnN9O3lGMc5Poro0000; citrix_ns_id_.scc.virginia.gov_%2F_wat=AAAAAAVnE4YfegYtd3Zxjb_ROTE2Y9fvWH0-M4cu9VKMaRyiUDk2V50h4t5n-rT7Gms6xFAhsaCgKvAjuw1MpD2LehzRd2Bd_4QZu2CfBXdcfE5VgA==&; nmstat=1524333623096`

const setConfig = (start, num) => ({
  method: 'get',
  url: 'https://sccefile.scc.virginia.gov/Find/AjaxBusiness',
  headers: {
    Cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: 'https://sccefile.scc.virginia.gov/Find/Business?SearchTerm=e&SearchPattern=C&as_fid=45188df57f217441c1fd6384194a8ad133178764',
    Host: 'sccefile.scc.virginia.gov',
    Pragma: 'no-cache',
  },
  params: {
    searchTerm: '*',
    searchPattern: 'C',
    sEcho: '1',
    iDisplayStart: start,
    iDisplayLength: num
  }
});

// const START = 1;
// const END = 20;
// const FILES_PER_CALL = 2;
// const BATCH_SIZE = 10;

// const TOTAL_FILES = (END - START) + 1;

// const apiArray = _.times(TOTAL_FILES / FILES_PER_CALL, (n) => {
//   return setConfig(START + n * FILES_PER_CALL, FILES_PER_CALL - 1);
// });

// const f = fs.createWriteStream(`ID_${START}_${END}.txt`);

// const fileOptions = {
//   delimiter: ','
// }
// const file = stringify(fileOptions);

// file.pipe(f);

const getRecords = (config, file) => {
  const { params: { iDisplayStart: start, iDisplayLength: length }} = config;
  const end = start + length;

  let activeCount = 0;
  let inactiveCount = 0;

  console.log(`requesting records ${start} - ${end}...`);
  return axios.request(config)
  .then(({ data }) => {
    console.log(`data returned for ${start} - ${end}...`);
    _.each(data.aaData, (record, i) => {
      if (record[4] === 'Active') {
        activeCount++;
        const id = cheerio.load(record[1])('a').text();
        const formattedRecord = [record[0], id];
        // const id = cheerio.load(record[1])('a').text();
        // const name = cheerio.load(record[2])('a').text();
        // const formattedRecord = _.chain(record)
        //   .slice(0,4)
        //   .map((field, index) => {
        //     if (index === 1) {
        //       return id;
        //     }
        //     if (index === 2) {
        //       return name;
        //     }
        //     return field
        //   })
        //   .value();

        // formattedRecord.push(`https://sccefile.scc.virginia.gov/Business/${id}`);

        file.write(formattedRecord, () => {
        });

      } else {
        inactiveCount++;
      }
    });

    return { active: activeCount, inactive: inactiveCount, total: data.aaData.length }
  })
  .catch(err => {
    console.error('err', err.message)
  })
}

function writeRecordsIds(start, end, perCall, file) {
  const totalFiles = (end - start) + 1;
  const apiArray = _.times(totalFiles / perCall, (n) => {
    return setConfig(start + n * perCall, perCall - 1);
  });

  const promiseArray = []
  _.each(apiArray, (config, i) => {
    promiseArray.push(
      setTimeoutPromise(i * 500)
        .then(() => {
          return getRecords(config, file);
        })
    );
  });

  return Promise.all(promiseArray)
  .then(resultArray => {
    console.log('done');
    const result = _.reduce(resultArray, (res, total) => {
      return {
        active: res.active + total.active,
        inactive: res.inactive + total.inactive,
        total: res.total + total.total,
      };
    }, { active: 0, inactive: 0, total: 0 });

    console.log('result', result)
    return result;
  })
}

async function batchedWrite(start, end, perCall, batchSize, filename) {
  const outputFile = fs.createWriteStream(`${filename}.txt`);

  const fileOptions = {
    delimiter: ','
  }
  const csvStringify = stringify(fileOptions);

  csvStringify.pipe(outputFile);

  const batchArray = [];
  const totalFiles = (end - start) + 1;
  const numBatches = totalFiles / batchSize;

  _.times(numBatches, (n) => {
    const callStart = start + n * batchSize;
    batchArray.push([callStart, callStart + batchSize - 1, perCall]);
  });

  async function yo(callArray) {
    let yoArray = [...callArray];

    while (yoArray.length > 0) {
      await writeRecordsIds(..._.head(yoArray), csvStringify);
      yoArray = _.slice(yoArray, 1);
    }

    return;
  }
  
  yo(batchArray);
}

// batchedWrite(1, 2000000, 5000, 100000, )