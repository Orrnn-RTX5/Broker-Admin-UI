import { access } from 'node:fs/promises';
import path from 'node:path';
import rcedit from 'rcedit';

const APP_NAME = 'RTX5 Broker Admin';

export default async function applyWinIcon(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appInfo = context.packager?.appInfo;
  const projectDir = context.packager?.projectDir ?? process.cwd();
  const productName = appInfo?.productName ?? APP_NAME;
  const productFilename = appInfo?.productFilename ?? productName;
  const version = appInfo?.shortVersion ?? appInfo?.buildVersion ?? appInfo?.version ?? '1.0.0';
  const productVersion = appInfo?.shortVersionWindows ?? appInfo?.getVersionInWeirdWindowsForm?.() ?? version;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(projectDir, 'build', 'logo V2.ico');

  await Promise.all([access(exePath), access(iconPath)]);

  await rcedit(exePath, {
    icon: iconPath,
    'file-version': version,
    'product-version': productVersion,
    'version-string': {
      FileDescription: productName,
      ProductName: productName,
      InternalName: productFilename,
      OriginalFilename: `${productFilename}.exe`,
    },
  });
}
