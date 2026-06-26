export const DESKTOP_RELEASE_REPO = 'rtx5-orrnn/rtx5-broker-admin-releases';
export const DESKTOP_RELEASES_PAGE_URL = `https://github.com/${DESKTOP_RELEASE_REPO}/releases/latest`;
export const DESKTOP_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${DESKTOP_RELEASE_REPO}/releases/latest`;

const isWindowsInstallerAsset = (asset) => {
  const name = String(asset?.name || '');
  return /setup\.exe$/i.test(name) && !/\.blockmap$/i.test(name);
};

const normalizeReleaseVersion = (release) => (
  String(release?.tag_name || release?.name || 'latest').replace(/^v/i, '')
);

export const getLatestDesktopInstaller = async ({ fetchImpl = globalThis.fetch } = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Download lookup is not available in this browser.');
  }

  const response = await fetchImpl(DESKTOP_LATEST_RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response?.ok) {
    throw new Error(`Unable to load latest desktop release${response?.status ? ` (${response.status})` : ''}.`);
  }

  const release = await response.json();
  const asset = (Array.isArray(release?.assets) ? release.assets : []).find(isWindowsInstallerAsset);

  if (!asset?.browser_download_url) {
    throw new Error('Latest desktop release does not include a Windows installer.');
  }

  return {
    downloadUrl: asset.browser_download_url,
    fileName: asset.name,
    pageUrl: release?.html_url || DESKTOP_RELEASES_PAGE_URL,
    size: Number.isFinite(asset.size) ? asset.size : undefined,
    version: normalizeReleaseVersion(release),
  };
};
