const env = globalThis.process?.env || {};
const baseUrl = env.ADMIN_API_BASE_URL;
const sessionToken = env.ADMIN_SESSION_TOKEN;

const paths = [
  '/manager/DynamicLeverageList',
  '/manager/DynamicLeverageListExt',
  '/manager/HolidayListExt',
];

const fetchPath = async (path) => {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Accept: 'application/json',
    },
  });
  const data = await response.text();
  return { path, status: response.status, data };
};

const run = async () => {
  if (!baseUrl || !sessionToken) {
    console.error('Set ADMIN_API_BASE_URL and ADMIN_SESSION_TOKEN to run this helper.');
    if (globalThis.process) globalThis.process.exitCode = 1;
    return;
  }

  const results = await Promise.all(paths.map(fetchPath));
  results.forEach((result) => {
    console.log(result.path, result.status, result.data.slice(0, 100));
  });
};

run().catch((error) => {
  console.error(error.message || error);
  if (globalThis.process) globalThis.process.exitCode = 1;
});
