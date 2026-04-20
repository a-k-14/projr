import fs from 'node:fs';

describe('android release config', () => {
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  const android = config.expo.android;

  it('uses local app versioning with a bumped Android versionCode', () => {
    expect(eas.cli.appVersionSource).toBe('local');
    expect(android.versionCode).toBeGreaterThan(1);
  });

  it('disables Android backup for local finance data', () => {
    expect(android.allowBackup).toBe(false);
  });

  it('blocks Android permissions not required by this app', () => {
    expect(android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
  });
});
