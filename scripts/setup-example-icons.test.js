const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  discoverIconSets,
  linkLocalPackage,
  patchExamplePackageJson,
  patchExampleMetroConfig,
  patchExampleTsConfig,
  renderExampleMetroConfig,
  renderExampleApp,
  renderAndroidAliases,
  renderIosBundleIcons,
} = require('./setup-example-icons');

function makeIconSet(rootDir, name) {
  const iosDir = path.join(
    rootDir,
    name,
    'Assets.xcassets',
    'AppIcon.appiconset'
  );
  const androidDir = path.join(rootDir, name, 'android', 'mipmap-mdpi');

  fs.mkdirSync(iosDir, { recursive: true });
  fs.mkdirSync(androidDir, { recursive: true });
  fs.writeFileSync(path.join(iosDir, 'Contents.json'), '{"images":[]}');
  fs.writeFileSync(path.join(androidDir, 'ic_launcher.png'), 'png');
}

describe('setup-example-icons', () => {
  test('runs icon setup directly after generating the yarn example', () => {
    const packageJson = require('../package.json');

    expect(packageJson.scripts.example).toContain('--pm yarn');
    expect(packageJson.scripts.example).toContain(
      '&& node scripts/setup-example-icons.js'
    );
  });

  test('renders an example app that uses the README app icon APIs', () => {
    const source = renderExampleApp();

    expect(source).toContain('getActiveIcon');
    expect(source).toContain('getAllAlternativeIcons');
    expect(source).toContain('setIcon(iconName)');
    expect(source).toContain('resetIcon()');
    expect(source).toContain(
      "from '@vinicius_santos/react-native-app-icon-changer'"
    );
    expect(source).toContain('ExampleIcon1');
    expect(source).toContain('export default App');
  });

  test('patches the example package with the scoped workspace dependency', () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-')
    );
    fs.writeFileSync(
      path.join(rootDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          react: '19.2.3',
          'react-native-app-icon-changer': 'workspace:*',
        },
      })
    );

    patchExamplePackageJson(rootDir);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    );

    expect(packageJson.dependencies).toEqual({
      react: '19.2.3',
      '@vinicius_santos/react-native-app-icon-changer': 'workspace:*',
    });
  });

  test('links the scoped package into the example node_modules folder', () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-project-')
    );
    const exampleRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-example-')
    );
    const packageLinkPath = path.join(
      exampleRoot,
      'node_modules',
      '@vinicius_santos',
      'react-native-app-icon-changer'
    );

    linkLocalPackage(projectRoot, exampleRoot);

    expect(fs.lstatSync(packageLinkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(packageLinkPath)).toBe(projectRoot);
  });

  test('patches the example TypeScript config to resolve local source types', () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-')
    );
    fs.writeFileSync(
      path.join(rootDir, 'tsconfig.json'),
      JSON.stringify({
        extends: '@react-native/typescript-config',
        compilerOptions: {
          types: ['jest'],
        },
      })
    );

    patchExampleTsConfig(rootDir);

    const tsConfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf8')
    );

    expect(tsConfig.compilerOptions).toEqual({
      types: ['jest'],
      baseUrl: '.',
      paths: {
        '@vinicius_santos/react-native-app-icon-changer': ['../src/index'],
      },
    });
  });

  test('renders Metro config that resolves the scoped package from local source', () => {
    const source = renderExampleMetroConfig();

    expect(source).toContain('watchFolders: [workspaceRoot]');
    expect(source).toContain(
      "moduleName === '@vinicius_santos/react-native-app-icon-changer'"
    );
    expect(source).toContain("type: 'sourceFile'");
    expect(source).toContain("'src', 'index.tsx'");
  });

  test('patches the generated Metro config', () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-')
    );
    fs.writeFileSync(path.join(rootDir, 'metro.config.js'), 'module.exports = {};');

    patchExampleMetroConfig(rootDir);

    expect(
      fs.readFileSync(path.join(rootDir, 'metro.config.js'), 'utf8')
    ).toContain("'@vinicius_santos/react-native-app-icon-changer'");
  });

  test('discovers the default icon and numbered alternatives', () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-example-icons-')
    );
    makeIconSet(rootDir, 'example-icons2');
    makeIconSet(rootDir, 'example-icons');
    makeIconSet(rootDir, 'example-icons1');

    expect(discoverIconSets(rootDir)).toEqual([
      {
        sourceName: 'example-icons',
        iosName: 'AppIcon',
        androidIconName: 'ic_launcher_default',
        androidRoundIconName: 'ic_launcher_round_default',
        componentSuffix: 'Default',
        isDefault: true,
      },
      {
        sourceName: 'example-icons1',
        iosName: 'ExampleIcon1',
        androidIconName: 'ic_launcher_example_icon_1',
        androidRoundIconName: 'ic_launcher_round_example_icon_1',
        componentSuffix: 'ExampleIcon1',
        isDefault: false,
      },
      {
        sourceName: 'example-icons2',
        iosName: 'ExampleIcon2',
        androidIconName: 'ic_launcher_example_icon_2',
        androidRoundIconName: 'ic_launcher_round_example_icon_2',
        componentSuffix: 'ExampleIcon2',
        isDefault: false,
      },
    ]);
  });

  test('renders Android aliases using the component names expected by the native module', () => {
    const iconSets = [
      {
        androidIconName: 'ic_launcher_default',
        androidRoundIconName: 'ic_launcher_round_default',
        componentSuffix: 'Default',
      },
      {
        androidIconName: 'ic_launcher_example_icon_1',
        androidRoundIconName: 'ic_launcher_round_example_icon_1',
        componentSuffix: 'ExampleIcon1',
      },
    ];

    expect(renderAndroidAliases(iconSets)).toContain(
      'android:name="${applicationId}.MainActivityDefault"'
    );
    expect(renderAndroidAliases(iconSets)).toContain(
      'android:name="${applicationId}.MainActivityExampleIcon1"'
    );
    expect(renderAndroidAliases(iconSets)).toContain(
      'android:icon="@mipmap/ic_launcher_example_icon_1"'
    );
    expect(renderAndroidAliases(iconSets)).toContain(
      'android:roundIcon="@mipmap/ic_launcher_round_example_icon_1"'
    );
  });

  test('renders iOS bundle icons with default and alternate app icon names', () => {
    const iconSets = [
      { iosName: 'AppIcon', isDefault: true },
      { iosName: 'ExampleIcon1', isDefault: false },
      { iosName: 'ExampleIcon2', isDefault: false },
    ];

    const xml = renderIosBundleIcons(iconSets);

    expect(xml).toContain('<key>CFBundlePrimaryIcon</key>');
    expect(xml).toContain('<string>AppIcon</string>');
    expect(xml).toContain('<key>CFBundleAlternateIcons</key>');
    expect(xml).toContain('<key>ExampleIcon1</key>');
    expect(xml).toContain('<string>ExampleIcon2</string>');
  });
});
