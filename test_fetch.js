const http = require('http');

function fetchPath(path) {
  return new Promise((resolve) => {
    http.get(`http://69.197.178.27:80${path}?id=aba389b2-ca4b-a2fc-75c7-09978b0a9fe8`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ path, status: res.statusCode, data }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function run() {
  const p1 = await fetchPath('/manager/DynamicLeverageList');
  const p2 = await fetchPath('/manager/DynamicLeverageListExt');
  const p3 = await fetchPath('/manager/HolidayListExt');
  
  console.log(p1.path, p1.status, p1.data.slice(0, 100));
  console.log(p2.path, p2.status, p2.data.slice(0, 100));
  console.log(p3.path, p3.status, p3.data.slice(0, 100));
}

run();
