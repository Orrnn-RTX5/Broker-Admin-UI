import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_LATEST_RELEASE_API_URL,
  DESKTOP_RELEASES_PAGE_URL,
  getLatestDesktopInstaller,
} from './desktopRelease.js';

test('getLatestDesktopInstaller returns the latest Windows setup asset', async () => {
  const installer = await getLatestDesktopInstaller({
    fetchImpl: async (url, options) => {
      assert.equal(url, DESKTOP_LATEST_RELEASE_API_URL);
      assert.equal(options.headers.Accept, 'application/vnd.github+json');

      return {
        ok: true,
        json: async () => ({
          tag_name: 'v1.2.3',
          html_url: 'https://github.com/rtx5-orrnn/rtx5-broker-admin-releases/releases/tag/v1.2.3',
          assets: [
            {
              name: 'latest.yml',
              browser_download_url: 'https://example.test/latest.yml',
              size: 363,
            },
            {
              name: 'RTX5-Broker-Admin-1.2.3-Setup.exe.blockmap',
              browser_download_url: 'https://example.test/blockmap',
              size: 100,
            },
            {
              name: 'RTX5-Broker-Admin-1.2.3-Setup.exe',
              browser_download_url: 'https://example.test/setup.exe',
              size: 109320206,
            },
          ],
        }),
      };
    },
  });

  assert.deepEqual(installer, {
    downloadUrl: 'https://example.test/setup.exe',
    fileName: 'RTX5-Broker-Admin-1.2.3-Setup.exe',
    pageUrl: 'https://github.com/rtx5-orrnn/rtx5-broker-admin-releases/releases/tag/v1.2.3',
    size: 109320206,
    version: '1.2.3',
  });
});

test('getLatestDesktopInstaller fails when no setup installer is available', async () => {
  await assert.rejects(
    () => getLatestDesktopInstaller({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          tag_name: 'v1.2.3',
          assets: [{ name: 'latest.yml', browser_download_url: 'https://example.test/latest.yml' }],
        }),
      }),
    }),
    /does not include a Windows installer/
  );
});

test('desktop release page URL points to the moving latest release route', () => {
  assert.equal(
    DESKTOP_RELEASES_PAGE_URL,
    'https://github.com/rtx5-orrnn/rtx5-broker-admin-releases/releases/latest'
  );
});
